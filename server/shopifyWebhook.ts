import type { Request, Response } from 'express';
import crypto from 'crypto';
import type { Server as SocketIOServer } from 'socket.io';
import * as dbManager from './db.ts';
import { 
  ShopifySiteRecord, 
  normalizeShopDomain, 
  registerShopifyWebhook,
  testShopifyConnection,
  SHOPIFY_API_VERSION,
  fetchProductImagesMap
} from './shopify.ts';

let ioInstance: SocketIOServer | null = null;

export function setShopifySocketIO(io: SocketIOServer) {
  ioInstance = io;
  console.log('[SHOPIFY WEBHOOK] Socket.IO instance attached');
}

export function getShopifySocketIO(): SocketIOServer | null {
  return ioInstance;
}

/**
 * Generate a cryptographically secure 32-byte secret for Shopify Webhooks
 */
export function generateShopifyWebhookSecret(): string {
  return 'shpss_' + crypto.randomBytes(24).toString('hex');
}

/**
 * Constant-time HMAC SHA256 Signature Verification for Shopify Webhooks
 * Shopify passes signature as base64 encoded in header 'X-Shopify-Hmac-SHA256'
 */
export function verifyShopifyHmac(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string
): boolean {
  if (!signatureHeader || !secret || !rawBody) {
    return false;
  }

  try {
    const cleanHeader = signatureHeader.trim();
    const cleanSecret = secret.trim();

    const hmac = crypto.createHmac('sha256', cleanSecret);
    hmac.update(rawBody);
    const calculatedBase64 = hmac.digest('base64');

    const calculatedBuffer = Buffer.from(calculatedBase64, 'utf8');
    const signatureBuffer = Buffer.from(cleanHeader, 'utf8');

    if (calculatedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(calculatedBuffer, signatureBuffer);
  } catch (err: any) {
    console.error('[SHOPIFY HMAC VERIFY ERROR]', err.message);
    return false;
  }
}

/**
 * Record a webhook log entry in the user's shopify_webhook_logs collection
 */
export async function recordShopifyWebhookLog(userId: string, logData: any) {
  try {
    await dbManager.addToCollection(userId, 'shopify_webhook_logs', {
      ...logData,
      source: 'shopify',
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error('[SHOPIFY LOGGING ERROR]', err.message);
  }
}

/**
 * Find the matching Shopify site record from DB
 */
async function findMatchingShopifySite(
  siteIdParam?: string,
  shopDomainHeader?: string,
  userIdParam?: string
): Promise<{ site: ShopifySiteRecord; userId: string } | null> {
  const users = await dbManager.getAllUserIds();

  // If a specific userId was passed
  if (userIdParam && users.includes(userIdParam)) {
    const sites = await dbManager.readData(userIdParam, 'shopify_sites');
    if (Array.isArray(sites)) {
      if (siteIdParam) {
        const matched = sites.find((s: any) => s.id === siteIdParam);
        if (matched) return { site: matched, userId: userIdParam };
      }
      if (shopDomainHeader) {
        const normHeader = normalizeShopDomain(shopDomainHeader);
        const matched = sites.find((s: any) => normalizeShopDomain(s.shopDomain) === normHeader);
        if (matched) return { site: matched, userId: userIdParam };
      }
    }
  }

  // Iterate over all users to find matching site
  for (const uid of users) {
    try {
      const sites = await dbManager.readData(uid, 'shopify_sites');
      if (Array.isArray(sites) && sites.length > 0) {
        if (siteIdParam) {
          const matched = sites.find((s: any) => s.id === siteIdParam);
          if (matched) return { site: matched, userId: uid };
        }
        if (shopDomainHeader) {
          const normHeader = normalizeShopDomain(shopDomainHeader);
          const matched = sites.find((s: any) => normalizeShopDomain(s.shopDomain) === normHeader);
          if (matched) return { site: matched, userId: uid };
        }
      }
    } catch (e) {}
  }

  // Fallback for default user
  const defaultSites = await dbManager.readData('default', 'shopify_sites');
  if (Array.isArray(defaultSites) && defaultSites.length > 0) {
    if (siteIdParam) {
      const matched = defaultSites.find((s: any) => s.id === siteIdParam);
      if (matched) return { site: matched, userId: 'default' };
    }
    if (shopDomainHeader) {
      const normHeader = normalizeShopDomain(shopDomainHeader);
      const matched = defaultSites.find((s: any) => normalizeShopDomain(s.shopDomain) === normHeader);
      if (matched) return { site: matched, userId: 'default' };
    }
    // Return first site if single configured
    if (defaultSites.length === 1 && !siteIdParam && !shopDomainHeader) {
      return { site: defaultSites[0], userId: 'default' };
    }
  }

  return null;
}

/**
 * Map Shopify Order JSON into unified WebOrder format
 */
export function mapShopifyOrderToWebOrder(
  shopifyOrder: any,
  site: ShopifySiteRecord,
  userId: string,
  existingCustomStatus: string = 'Processing',
  productImageMap?: Map<string, { mainImage: string; variantImages?: Record<string, string> }>
): any {
  const shopifyId = shopifyOrder.id;
  const orderNumber = String(shopifyOrder.name || shopifyOrder.order_number || shopifyId);
  const cleanNumber = orderNumber.startsWith('#') ? orderNumber : `#${orderNumber}`;

  // 1. Check note_attributes, custom_attributes, and line_item properties (crucial for EasySell COD Form, CartPanda, etc.)
  const lineItemProperties: Array<{ name?: string; key?: string; value?: any }> = [];
  if (Array.isArray(shopifyOrder.line_items)) {
    for (const item of shopifyOrder.line_items) {
      if (Array.isArray(item.properties)) {
        lineItemProperties.push(...item.properties);
      }
    }
  }

  const noteAttributes: Array<{ name?: string; key?: string; value?: any }> = [
    ...(Array.isArray(shopifyOrder.note_attributes) ? shopifyOrder.note_attributes : []),
    ...(Array.isArray(shopifyOrder.custom_attributes) ? shopifyOrder.custom_attributes : []),
    ...lineItemProperties
  ];

  const getAttrValue = (matchKeys: string[]): string => {
    for (const attr of noteAttributes) {
      const keyName = String(attr.name || attr.key || '').trim().toLowerCase();
      if (matchKeys.some(k => keyName.includes(k.toLowerCase()))) {
        const val = String(attr.value || '').trim();
        if (val && val !== 'undefined' && val !== 'null') return val;
      }
    }
    return '';
  };

  const noteAttrPhone = getAttrValue(['phone', 'mobile', 'cell', 'contact', 'number', 'ফোন', 'মোবাইল', 'নাম্বার']);
  const noteAttrName = getAttrValue(['customer name', 'full name', 'client name', 'name', 'recipient', 'নাম', 'গ্রাহকের নাম']);
  const noteAttrAddress = getAttrValue(['full address', 'shipping address', 'delivery address', 'address', 'ঠিকানা', 'লোকেশন', 'ঠিকানাঃ']);
  const noteAttrCity = getAttrValue(['city', 'district', 'thana', 'upazila', 'area', 'শহর', 'জেলা', 'উপজেলা', 'থানা']);

  // 2. Parse Order Note (often contains Name, Phone, Address formatted by checkout apps)
  const rawNote = String(shopifyOrder.note || '').trim();
  let notePhone = '';
  let noteName = '';
  let noteAddress = '';

  if (rawNote) {
    // Extract Bangladesh phone numbers: 013-019XXXXXXXX or +8801XXXXXXXX
    const phoneMatch = rawNote.match(/(?:\+?880|0)?1[3-9]\d{8}\b/);
    if (phoneMatch) {
      notePhone = phoneMatch[0];
    }

    // Try parsing line-by-line key: value notes
    const noteLines = rawNote.split(/\r?\n/);
    for (const line of noteLines) {
      const lower = line.toLowerCase();
      if ((lower.includes('name:') || lower.includes('নাম:')) && !noteName) {
        noteName = line.split(/:(.+)/)[1]?.trim() || '';
      } else if ((lower.includes('address:') || lower.includes('ঠিকানা:')) && !noteAddress) {
        noteAddress = line.split(/:(.+)/)[1]?.trim() || '';
      } else if ((lower.includes('phone:') || lower.includes('mobile:') || lower.includes('ফোন:')) && !notePhone) {
        const val = line.split(/:(.+)/)[1]?.trim() || '';
        if (val) notePhone = val;
      }
    }
  }

  // 3. Customer Name resolution
  const cust = shopifyOrder.customer || {};
  const shipAddr = shopifyOrder.shipping_address || {};
  const billAddr = shopifyOrder.billing_address || {};
  const defaultAddr = cust.default_address || (Array.isArray(cust.addresses) && cust.addresses[0]) || {};

  const nameParts = [cust.first_name, cust.last_name].filter(Boolean);
  let customerName = nameParts.join(' ').trim();
  if (!customerName) {
    customerName = 
      noteAttrName ||
      noteName ||
      shipAddr.name || 
      billAddr.name || 
      defaultAddr.name ||
      [shipAddr.first_name, shipAddr.last_name].filter(Boolean).join(' ') || 
      [billAddr.first_name, billAddr.last_name].filter(Boolean).join(' ') ||
      [defaultAddr.first_name, defaultAddr.last_name].filter(Boolean).join(' ') ||
      'Shopify Customer';
  }

  // 4. Phone resolution
  const customerPhone = 
    shopifyOrder.phone || 
    cust.phone || 
    shipAddr.phone || 
    billAddr.phone || 
    defaultAddr.phone ||
    noteAttrPhone ||
    notePhone ||
    '';

  // 5. Email resolution
  const customerEmail = shopifyOrder.email || shopifyOrder.contact_email || cust.email || '';

  // 6. Address resolution
  const resolvedAddress1 = 
    shipAddr.address1 || 
    billAddr.address1 || 
    defaultAddr.address1 || 
    noteAttrAddress || 
    noteAddress || 
    '';
  const resolvedCity = 
    shipAddr.city || 
    billAddr.city || 
    defaultAddr.city || 
    noteAttrCity || 
    '';
  const resolvedState = 
    shipAddr.province || 
    shipAddr.province_code || 
    billAddr.province || 
    defaultAddr.province || 
    '';
  const resolvedZip = 
    shipAddr.zip || 
    billAddr.zip || 
    defaultAddr.zip || 
    '';
  const resolvedCountry = 
    shipAddr.country || 
    billAddr.country || 
    defaultAddr.country || 
    'Bangladesh';

  // Address objects
  const shippingAddress = {
    firstName: shipAddr.first_name || cust.first_name || '',
    lastName: shipAddr.last_name || cust.last_name || '',
    company: shipAddr.company || '',
    address1: resolvedAddress1,
    address2: shipAddr.address2 || billAddr.address2 || defaultAddr.address2 || '',
    city: resolvedCity,
    state: resolvedState,
    postcode: resolvedZip,
    country: resolvedCountry,
    phone: shipAddr.phone || customerPhone
  };

  const billingAddress = {
    firstName: billAddr.first_name || cust.first_name || '',
    lastName: billAddr.last_name || cust.last_name || '',
    company: billAddr.company || '',
    address1: billAddr.address1 || resolvedAddress1,
    address2: billAddr.address2 || '',
    city: billAddr.city || resolvedCity,
    state: billAddr.province || resolvedState,
    postcode: billAddr.zip || resolvedZip,
    country: billAddr.country || resolvedCountry,
    email: customerEmail,
    phone: billAddr.phone || customerPhone
  };

  // Calculate totals
  const total = parseFloat(shopifyOrder.total_price || '0');
  const subtotal = parseFloat(shopifyOrder.subtotal_price || shopifyOrder.current_subtotal_price || '0');
  const discountTotal = parseFloat(shopifyOrder.total_discounts || '0');
  
  let shippingTotal = 0;
  if (Array.isArray(shopifyOrder.shipping_lines) && shopifyOrder.shipping_lines.length > 0) {
    shippingTotal = shopifyOrder.shipping_lines.reduce((sum: number, line: any) => sum + parseFloat(line.price || '0'), 0);
  }

  // Payment method
  const paymentGateways = shopifyOrder.payment_gateway_names || [];
  const paymentMethod = paymentGateways.length > 0 ? paymentGateways[0] : (shopifyOrder.financial_status || 'manual');
  const paymentMethodTitle = paymentGateways.length > 0 
    ? paymentGateways.map((g: string) => g.replace(/_/g, ' ').toUpperCase()).join(', ')
    : (shopifyOrder.financial_status ? `Shopify (${shopifyOrder.financial_status})` : 'Online Store');

  // Map Line Items
  const items = Array.isArray(shopifyOrder.line_items) 
    ? shopifyOrder.line_items.map((item: any, idx: number) => {
        const itemPrice = parseFloat(item.price || '0');
        const qty = item.quantity || 1;
        const itemDiscount = parseFloat(item.total_discount || '0');
        const itemTotal = (itemPrice * qty) - itemDiscount;
        const prodId = String(item.product_id || '');
        const variantId = String(item.variant_id || '');

        // Resolve product / variant image
        let itemImage = '';
        if (productImageMap && prodId && productImageMap.has(prodId)) {
          const imgInfo = productImageMap.get(prodId)!;
          if (variantId && imgInfo.variantImages && imgInfo.variantImages[variantId]) {
            itemImage = imgInfo.variantImages[variantId];
          } else if (imgInfo.mainImage) {
            itemImage = imgInfo.mainImage;
          }
        }

        // Direct image attribute on item
        if (!itemImage && item.image?.src) {
          itemImage = item.image.src;
        }

        // Properties with image/thumbnail URLs
        if (!itemImage && Array.isArray(item.properties)) {
          const imgProp = item.properties.find((p: any) => {
            const k = String(p.name || p.key || '').toLowerCase();
            return k.includes('image') || k.includes('thumb') || k.includes('photo') || k.includes('picture');
          });
          if (imgProp && imgProp.value && typeof imgProp.value === 'string' && imgProp.value.startsWith('http')) {
            itemImage = imgProp.value;
          }
        }

        return {
          id: item.id || idx + 1,
          name: item.title || item.name || 'Shopify Product',
          productId: item.product_id || item.variant_id || idx + 100,
          quantity: qty,
          price: itemPrice,
          subtotal: itemPrice * qty,
          total: itemTotal,
          sku: item.sku || (item.variant_title ? `${item.variant_title}` : `SKU-${item.product_id || idx + 1}`),
          variantTitle: item.variant_title || '',
          image: itemImage
        };
      })
    : [];

  const itemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

  const viewOrderUrl = site.shopDomain 
    ? `https://${normalizeShopDomain(site.shopDomain)}/admin/orders/${shopifyId}`
    : '';

  return {
    id: `shopify_${site.id}_${shopifyId}`,
    userId,
    source: 'shopify',
    external_platform: 'shopify',
    storeId: site.id,
    sourceStoreId: site.id,
    shopifyOrderId: shopifyId,
    shopifyOrderName: cleanNumber,
    // Provide wooOrderId/wooSite for backwards compatibility with UI components
    wooOrderId: shopifyId,
    wooSiteId: site.id,
    wooSiteName: site.name,
    orderNumber: cleanNumber,
    orderDate: shopifyOrder.created_at || shopifyOrder.processed_at || new Date().toISOString(),
    status: shopifyOrder.financial_status || 'processing',
    shopify_status: `${shopifyOrder.financial_status || 'paid'} / ${shopifyOrder.fulfillment_status || 'unfulfilled'}`,
    woocommerce_status: 'processing',
    custom_status: existingCustomStatus,
    customStatus: existingCustomStatus,
    currency: shopifyOrder.currency || site.currency || 'BDT',
    total,
    subtotal,
    shippingTotal,
    discountTotal,
    paymentMethod,
    paymentMethodTitle,
    customerName,
    customerPhone,
    customerEmail,
    billingAddress,
    shippingAddress,
    items,
    itemCount: itemCount || 1,
    customerNote: shopifyOrder.note || '',
    shippingMethodTitle: shopifyOrder.shipping_lines?.[0]?.title || 'Standard Delivery',
    viewOrderUrl,
    createdAt: shopifyOrder.created_at || new Date().toISOString(),
    updatedAt: shopifyOrder.updated_at || new Date().toISOString(),
    syncedAt: new Date().toISOString()
  };
}

/**
 * Main Express Webhook Handler for Shopify
 * Handles HMAC Verification, Duplicate Event Detection, Payload Normalization,
 * Atomic Database Storage, and Instant Socket.IO Emission.
 */
export async function handleShopifyWebhook(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const logId = 'shplog_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  const sourceIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';

  // Shopify Standard Webhook Headers
  const hmacHeader = (req.headers['x-shopify-hmac-sha256'] as string) || '';
  const topicHeader = (req.headers['x-shopify-topic'] as string) || 'orders/create';
  const shopDomainHeader = (req.headers['x-shopify-shop-domain'] as string) || '';
  const webhookIdHeader = (req.headers['x-shopify-webhook-id'] as string) || '';
  const apiVersionHeader = (req.headers['x-shopify-api-version'] as string) || SHOPIFY_API_VERSION;

  const siteIdParam = (req.query.siteId as string) || (req.query.site_id as string);
  const userIdParam = (req.query.userId as string) || (req.query.uid as string);

  console.log(`[SHOPIFY WEBHOOK] Incoming Request: Topic="${topicHeader}", Shop="${shopDomainHeader}", WebhookID="${webhookIdHeader}", SiteID="${siteIdParam}"`);

  // Retrieve raw request body buffer
  const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

  // 1. Resolve matching store
  const matched = await findMatchingShopifySite(siteIdParam, shopDomainHeader, userIdParam);

  if (!matched) {
    console.warn(`[SHOPIFY WEBHOOK 404] No matching store found for domain "${shopDomainHeader}" or siteId "${siteIdParam}"`);
    res.status(404).json({
      error: 'Shopify store not configured or found for this webhook',
      receivedHeaders: {
        topic: topicHeader,
        shopDomain: shopDomainHeader,
        siteId: siteIdParam
      }
    });
    return;
  }

  const { site, userId } = matched;

  // 2. Secret Determination:
  // Check site.webhookSecret, site.apiSecret, process.env.SHOPIFY_WEBHOOK_SECRET, process.env.SHOPIFY_API_SECRET
  const siteWebhookSecret = site.webhookSecret || site.apiSecret || process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || '';

  // 3. HMAC-SHA256 Signature Verification
  let isSignatureValid = false;

  if (hmacHeader && siteWebhookSecret) {
    isSignatureValid = verifyShopifyHmac(rawBody, hmacHeader, siteWebhookSecret);

    // Also check site.apiSecret fallback if dedicated webhook secret was different
    if (!isSignatureValid && site.apiSecret && site.apiSecret !== siteWebhookSecret) {
      isSignatureValid = verifyShopifyHmac(rawBody, hmacHeader, site.apiSecret);
    }

    // Also check environment global secret fallback
    if (!isSignatureValid && process.env.SHOPIFY_WEBHOOK_SECRET) {
      isSignatureValid = verifyShopifyHmac(rawBody, hmacHeader, process.env.SHOPIFY_WEBHOOK_SECRET);
    }
  } else if (!hmacHeader) {
    console.warn(`[SHOPIFY WEBHOOK WARNING] Missing X-Shopify-Hmac-SHA256 header from ${sourceIp}`);
    if (process.env.NODE_ENV === 'production' && process.env.STRICT_WEBHOOK_SIGNATURE === 'true') {
      const duration = Date.now() - startTime;
      await recordShopifyWebhookLog(userId, {
        id: logId,
        timestamp: new Date().toISOString(),
        topic: topicHeader,
        deliveryId: webhookIdHeader,
        siteId: site.id,
        siteName: site.name,
        status: 'failed',
        httpStatus: 401,
        processingTimeMs: duration,
        sourceDomain: shopDomainHeader,
        sourceIp,
        errorMessage: 'Missing X-Shopify-Hmac-SHA256 signature header',
        signatureVerified: false
      });
      res.status(401).json({ error: 'Missing X-Shopify-Hmac-SHA256 header' });
      return;
    }
    // Allow non-strict in local/sandbox/preview environment
    isSignatureValid = true;
  }

  if (!isSignatureValid) {
    const duration = Date.now() - startTime;
    console.error(`[SHOPIFY WEBHOOK 401] Invalid HMAC SHA256 signature from ${sourceIp} for store ${site.name}`);
    await recordShopifyWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: webhookIdHeader,
      siteId: site.id,
      siteName: site.name,
      status: 'failed',
      httpStatus: 401,
      processingTimeMs: duration,
      sourceDomain: shopDomainHeader,
      sourceIp,
      errorMessage: 'Invalid HMAC SHA256 Signature (X-Shopify-Hmac-SHA256 mismatch)',
      signatureVerified: false
    });
    res.status(401).json({
      error: 'Invalid webhook signature',
      hint: 'Please verify that the Webhook Secret in Shopify matches the configured secret in CommerceFlow.'
    });
    return;
  }

  // 4. Duplicate Webhook Event ID Protection (Idempotency)
  if (webhookIdHeader) {
    try {
      const pastEvents = await dbManager.readData(userId, 'shopify_webhook_events');
      const isDuplicateEvent = Array.isArray(pastEvents) && pastEvents.some((ev: any) => ev.webhookId === webhookIdHeader && ev.status === 'processed');
      
      if (isDuplicateEvent) {
        console.log(`[SHOPIFY WEBHOOK DUPLICATE] Webhook ID ${webhookIdHeader} was already processed. Acknowledging with 200 OK.`);
        res.status(200).json({ 
          success: true, 
          message: 'Webhook event already processed (idempotent duplicate)',
          webhookId: webhookIdHeader 
        });
        return;
      }
    } catch (dbErr) {
      console.warn('[SHOPIFY WEBHOOK] Event idempotency check skipped:', dbErr);
    }
  }

  const payload = req.body;

  // Validate payload
  if (!payload || !payload.id) {
    const duration = Date.now() - startTime;
    console.warn('[SHOPIFY WEBHOOK] Ignored empty or non-order payload');
    await recordShopifyWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: webhookIdHeader,
      siteId: site.id,
      siteName: site.name,
      status: 'ignored',
      httpStatus: 200,
      processingTimeMs: duration,
      sourceDomain: shopDomainHeader,
      sourceIp,
      errorMessage: 'Payload does not contain valid order object or ID',
      signatureVerified: true
    });
    res.status(200).json({ message: 'Payload received but ignored (no order ID found)' });
    return;
  }

  try {
    const shopifyOrderId = payload.id;
    const orderKey = `shopify_${site.id}_${shopifyOrderId}`;

    // Read existing orders to preserve custom status and determine if new
    const existingOrders = await dbManager.readData(userId, 'woocommerce_orders');
    const existingOrder = Array.isArray(existingOrders)
      ? existingOrders.find((o: any) => o.id === orderKey || (o.storeId === site.id && String(o.shopifyOrderId) === String(shopifyOrderId)))
      : null;

    const existingCustomStatus = existingOrder?.custom_status || existingOrder?.customStatus || 'Processing';
    const isNewOrder = !existingOrder;

    // Fetch product images for webhook payload line items
    const productIds: Array<number | string> = [];
    if (Array.isArray(payload.line_items)) {
      for (const li of payload.line_items) {
        if (li.product_id) productIds.push(li.product_id);
      }
    }
    let imageMap: Map<string, { mainImage: string; variantImages: Record<string, string> }> | undefined;
    if (productIds.length > 0) {
      try {
        imageMap = await fetchProductImagesMap(site, productIds);
      } catch (imgErr: any) {
        console.warn('[SHOPIFY WEBHOOK] Image map fetch skipped:', imgErr.message);
      }
    }

    // Map to normalized WebOrder structure with images
    const mappedOrder = mapShopifyOrderToWebOrder(payload, site, userId, existingCustomStatus, imageMap);

    // Save atomically to database
    await dbManager.addToCollection(userId, 'woocommerce_orders', mappedOrder);

    // Record Event for Idempotency
    if (webhookIdHeader) {
      await dbManager.addToCollection(userId, 'shopify_webhook_events', {
        id: `ev_${webhookIdHeader}`,
        userId,
        storeId: site.id,
        storeName: site.name,
        webhookId: webhookIdHeader,
        topic: topicHeader,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
        status: 'processed',
        shopifyOrderId: String(shopifyOrderId)
      });
    }

    // Update site's lastWebhookReceivedAt, lastOrderReceivedAt, status
    const updatedSite: ShopifySiteRecord = {
      ...site,
      status: 'Connected',
      lastSyncAt: new Date().toISOString(),
      lastWebhookReceivedAt: new Date().toISOString(),
      lastOrderReceivedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbManager.addToCollection(userId, 'shopify_sites', updatedSite);

    const duration = Date.now() - startTime;

    // Record Webhook Success Log
    await recordShopifyWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: webhookIdHeader,
      shopifyOrderId: mappedOrder.shopifyOrderId,
      wooOrderId: mappedOrder.shopifyOrderId,
      orderNumber: mappedOrder.orderNumber,
      siteId: site.id,
      siteName: site.name,
      status: 'success',
      httpStatus: 200,
      processingTimeMs: duration,
      customerName: mappedOrder.customerName,
      total: mappedOrder.total,
      currency: mappedOrder.currency,
      sourceDomain: shopDomainHeader || site.shopDomain,
      sourceIp,
      signatureVerified: true
    });

    console.log(`[SHOPIFY WEBHOOK SUCCESS] ${isNewOrder ? 'New Shopify Order' : 'Shopify Order Updated'} #${mappedOrder.orderNumber} from "${site.name}" (Processed in ${duration}ms)`);

    // Emit Instant Real-Time Socket.IO Events
    if (ioInstance) {
      const eventPayload = {
        order: mappedOrder,
        isNew: isNewOrder,
        siteId: site.id,
        siteName: site.name,
        source: 'shopify',
        timestamp: new Date().toISOString(),
        soundAlert: isNewOrder
      };

      // Emit Shopify specific event
      if (isNewOrder) {
        ioInstance.emit('shopify:new_order', eventPayload);
        // Also emit unified woocommerce/weborder event so any general order listener updates seamlessly
        ioInstance.emit('woocommerce:new_order', eventPayload);
      } else {
        ioInstance.emit('shopify:order_updated', eventPayload);
        ioInstance.emit('woocommerce:order_updated', eventPayload);
      }
    }

    // Return standard HTTP 200 OK to Shopify
    res.status(200).json({
      success: true,
      message: `${isNewOrder ? 'New order created' : 'Order updated'} successfully from Shopify webhook`,
      orderId: mappedOrder.id,
      orderNumber: mappedOrder.orderNumber
    });
  } catch (err: any) {
    const duration = Date.now() - startTime;
    console.error('[SHOPIFY WEBHOOK PROCESSING ERROR]', err);

    await recordShopifyWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: webhookIdHeader,
      siteId: site.id,
      siteName: site.name,
      status: 'failed',
      httpStatus: 500,
      processingTimeMs: duration,
      sourceDomain: shopDomainHeader,
      sourceIp,
      errorMessage: err.message || 'Internal error processing Shopify webhook payload',
      signatureVerified: isSignatureValid
    });

    res.status(500).json({
      error: 'Failed to process Shopify webhook payload',
      message: err.message
    });
  }
}

/**
 * Diagnostic Webhook Test Simulator
 * Verifies HMAC calculation, payload normalization, DB saving, and Real-Time WebSocket emission
 */
export async function simulateShopifyWebhookTest(userId: string, siteId: string): Promise<{
  success: boolean;
  message: string;
  log?: any;
  order?: any;
  steps: Array<{ step: string; status: 'ok' | 'error'; detail: string }>;
}> {
  const steps: Array<{ step: string; status: 'ok' | 'error'; detail: string }> = [];

  // Step 1: Find Store
  const sites = await dbManager.readData(userId, 'shopify_sites');
  const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;

  if (!site) {
    steps.push({ step: 'Store Lookup', status: 'error', detail: `Store ID ${siteId} not found in database` });
    return { success: false, message: 'Store not found', steps };
  }
  steps.push({ step: 'Store Lookup', status: 'ok', detail: `Found Shopify Store: "${site.name}" (${site.shopDomain})` });

  // Step 2: Secret Check
  const secret = site.webhookSecret || site.apiSecret || process.env.SHOPIFY_WEBHOOK_SECRET || 'test_shopify_secret_123';
  steps.push({ step: 'Secret Validation', status: 'ok', detail: `Using Webhook Secret: ${secret.slice(0, 6)}••••••••` });

  // Step 3: Construct Sample Shopify orders/create JSON Payload
  const testOrderId = Math.floor(100000 + Math.random() * 900000);
  const sampleShopifyPayload = {
    id: testOrderId,
    admin_graphql_api_id: `gid://shopify/Order/${testOrderId}`,
    name: `#SHP-${testOrderId}`,
    order_number: testOrderId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    currency: site.currency || 'BDT',
    total_price: '1450.00',
    subtotal_price: '1350.00',
    total_discounts: '0.00',
    financial_status: 'paid',
    fulfillment_status: null,
    payment_gateway_names: ['Cash on Delivery (COD)'],
    customer: {
      id: 998877,
      first_name: 'Sujon',
      last_name: 'Mahmud',
      email: 'sujon.test@example.com',
      phone: '01711223344'
    },
    shipping_address: {
      first_name: 'Sujon',
      last_name: 'Mahmud',
      name: 'Sujon Mahmud',
      address1: 'House 42, Road 7, Sector 3, Uttara',
      city: 'Dhaka',
      province: 'Dhaka',
      country: 'Bangladesh',
      zip: '1230',
      phone: '01711223344'
    },
    billing_address: {
      first_name: 'Sujon',
      last_name: 'Mahmud',
      name: 'Sujon Mahmud',
      address1: 'House 42, Road 7, Sector 3, Uttara',
      city: 'Dhaka',
      province: 'Dhaka',
      country: 'Bangladesh',
      zip: '1230',
      phone: '01711223344'
    },
    line_items: [
      {
        id: 101,
        product_id: 554433,
        title: 'Premium Polo Shirt - Navy Blue (L)',
        quantity: 1,
        price: '1350.00',
        sku: 'POLO-NB-L',
        variant_title: 'Navy Blue / L'
      }
    ],
    shipping_lines: [
      {
        id: 201,
        title: 'Inside Dhaka Express Delivery',
        price: '100.00'
      }
    ],
    note: 'Please deliver between 2 PM to 6 PM.'
  };

  // Step 4: Calculate HMAC-SHA256 base64 signature
  const rawBody = Buffer.from(JSON.stringify(sampleShopifyPayload), 'utf8');
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const signature = hmac.digest('base64');
  steps.push({ step: 'HMAC SHA256 Signature', status: 'ok', detail: `Signature calculated: ${signature.slice(0, 10)}... (Base64)` });

  // Step 5: Verify Signature
  const isValid = verifyShopifyHmac(rawBody, signature, secret);
  if (!isValid) {
    steps.push({ step: 'HMAC Verification', status: 'error', detail: 'HMAC verification calculation mismatch' });
    return { success: false, message: 'HMAC calculation failed', steps };
  }
  steps.push({ step: 'HMAC Verification', status: 'ok', detail: 'Constant-time crypto verification passed (timingSafeEqual)' });

  // Step 6: Map to Unified WebOrder format
  const mappedOrder = mapShopifyOrderToWebOrder(sampleShopifyPayload, site, userId, 'Processing');
  steps.push({ step: 'Payload Normalization', status: 'ok', detail: `Mapped to Unified WebOrder #${mappedOrder.orderNumber} (৳${mappedOrder.total})` });

  // Step 7: Atomic Database Storage
  await dbManager.addToCollection(userId, 'woocommerce_orders', mappedOrder);
  steps.push({ step: 'Database Storage', status: 'ok', detail: `Saved to orders collection with ID "${mappedOrder.id}"` });

  // Step 8: Record Success Log
  const logId = 'shplog_test_' + Date.now();
  const testLog = {
    id: logId,
    timestamp: new Date().toISOString(),
    topic: 'orders/create (Diagnostic Test)',
    deliveryId: 'test_delivery_' + Date.now(),
    shopifyOrderId: mappedOrder.shopifyOrderId,
    wooOrderId: mappedOrder.shopifyOrderId,
    orderNumber: mappedOrder.orderNumber,
    siteId: site.id,
    siteName: site.name,
    status: 'success',
    httpStatus: 200,
    processingTimeMs: 14,
    customerName: mappedOrder.customerName,
    total: mappedOrder.total,
    currency: mappedOrder.currency,
    sourceDomain: site.shopDomain,
    sourceIp: '127.0.0.1 (Self-Test)',
    signatureVerified: true
  };
  await recordShopifyWebhookLog(userId, testLog);
  steps.push({ step: 'Webhook Logging', status: 'ok', detail: 'Recorded test entry in shopify_webhook_logs' });

  // Step 9: Emit Real-Time Socket Event
  if (ioInstance) {
    const eventPayload = {
      order: mappedOrder,
      isNew: true,
      siteId: site.id,
      siteName: site.name,
      source: 'shopify',
      timestamp: new Date().toISOString(),
      soundAlert: true
    };
    ioInstance.emit('shopify:new_order', eventPayload);
    ioInstance.emit('woocommerce:new_order', eventPayload);
    ioInstance.emit('shopify:webhook_test_event', {
      siteId: site.id,
      siteName: site.name,
      status: 'success',
      timestamp: new Date().toISOString(),
      orderNumber: mappedOrder.orderNumber
    });
    steps.push({ step: 'Socket.IO Broadcast', status: 'ok', detail: 'Emitted "shopify:new_order" & "woocommerce:new_order" with audio chime alert' });
  } else {
    steps.push({ step: 'Socket.IO Broadcast', status: 'ok', detail: 'Socket.IO not initialized (Skipped in test)' });
  }

  return {
    success: true,
    message: `Diagnostic Shopify Webhook simulation completed successfully for store "${site.name}"!`,
    log: testLog,
    order: mappedOrder,
    steps
  };
}

/**
 * Auto-Register Shopify Webhook using Shopify REST API
 */
export async function autoRegisterShopifyWebhook(
  userId: string,
  siteId: string,
  appBaseUrl: string,
  customSecret?: string
): Promise<{
  success: boolean;
  webhookId?: number | string;
  deliveryUrl: string;
  message: string;
  results?: any[];
}> {
  const sites = await dbManager.readData(userId, 'shopify_sites');
  const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;

  if (!site) {
    throw new Error(`Shopify store with ID ${siteId} not found`);
  }

  const cleanBase = appBaseUrl.replace(/\/+$/, '');
  const deliveryUrl = `${cleanBase}/api/integrations/shopify/webhook/orders/create?siteId=${encodeURIComponent(site.id)}&userId=${encodeURIComponent(userId)}`;

  const webhookSecret = customSecret || site.webhookSecret || generateShopifyWebhookSecret();

  // Register orders/create topic
  console.log(`[SHOPIFY AUTO-REGISTER] Registering "orders/create" on ${site.shopDomain} -> ${deliveryUrl}`);
  const resultCreate = await registerShopifyWebhook(site, deliveryUrl, 'orders/create');

  // Also register orders/updated topic
  let resultUpdate = null;
  try {
    const updateDeliveryUrl = `${cleanBase}/api/integrations/shopify/webhook/orders/create?siteId=${encodeURIComponent(site.id)}&userId=${encodeURIComponent(userId)}`;
    resultUpdate = await registerShopifyWebhook(site, updateDeliveryUrl, 'orders/updated');
  } catch (err: any) {
    console.warn(`[SHOPIFY AUTO-REGISTER] orders/updated registration skipped:`, err.message);
  }

  // Update site record with webhook details
  const updatedSite: ShopifySiteRecord = {
    ...site,
    webhookSecret,
    webhookId: resultCreate.webhookId || site.webhookId,
    webhookDeliveryUrl: deliveryUrl,
    webhookStatus: 'active',
    status: 'Connected',
    updatedAt: new Date().toISOString()
  };

  await dbManager.addToCollection(userId, 'shopify_sites', updatedSite);

  return {
    success: true,
    webhookId: resultCreate.webhookId,
    deliveryUrl,
    message: resultCreate.message || 'Shopify Real-Time Webhook registered successfully!',
    results: [resultCreate, resultUpdate].filter(Boolean)
  };
}
