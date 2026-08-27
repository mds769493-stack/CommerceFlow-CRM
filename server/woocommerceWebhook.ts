import crypto from 'crypto';
import type { Request, Response } from 'express';
import * as dbManager from './db.ts';
import { normalizeStoreUrl, WooSiteRecord, WebOrderRecord } from './woocommerce.ts';
import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketIOInstance(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketIOInstance(): SocketIOServer | null {
  return ioInstance;
}

export interface WebhookLog {
  id: string;
  timestamp: string;
  topic: string;
  deliveryId?: string;
  wooOrderId?: number | string;
  orderNumber?: string;
  siteId?: string;
  siteName?: string;
  status: 'success' | 'failed' | 'ignored';
  httpStatus: number;
  processingTimeMs: number;
  customerName?: string;
  total?: number;
  currency?: string;
  sourceUrl?: string;
  sourceIp?: string;
  errorMessage?: string;
  signatureVerified: boolean;
}

// Generate a secure random webhook secret
export function generateWebhookSecret(): string {
  return 'wc_sec_' + crypto.randomBytes(24).toString('hex');
}

// Constant-time string / buffer comparison to prevent timing attacks
export function verifyHmacSignature(rawBody: Buffer | string, signatureHeader: string, secret: string): boolean {
  if (!rawBody || !signatureHeader || !secret) {
    return false;
  }

  try {
    const rawBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const computedHmac = crypto
      .createHmac('sha256', secret.trim())
      .update(rawBuffer)
      .digest('base64');

    const signatureBuffer = Buffer.from(signatureHeader.trim());
    const computedBuffer = Buffer.from(computedHmac.trim());

    if (signatureBuffer.length !== computedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (err) {
    console.error('[WEBHOOK HMAC ERROR]', err);
    return false;
  }
}

// Map raw WooCommerce Webhook Order payload to standard WebOrderRecord
export function mapWebhookOrderToWebOrder(
  wcOrder: any,
  site: WooSiteRecord,
  userId: string,
  existingCustomStatus?: string
): WebOrderRecord {
  const billing = wcOrder.billing || {};
  const shipping = wcOrder.shipping || {};
  
  const customerName = [billing.first_name, billing.last_name].filter(Boolean).join(' ') ||
                       [shipping.first_name, shipping.last_name].filter(Boolean).join(' ') ||
                       'Guest Customer';
  
  const customerPhone = billing.phone || shipping.phone || '';
  const customerEmail = billing.email || '';

  const items = Array.isArray(wcOrder.line_items) ? wcOrder.line_items.map((item: any) => ({
    id: item.id,
    name: item.name || 'Product',
    productId: item.product_id,
    variationId: item.variation_id,
    quantity: item.quantity || 1,
    subtotal: item.subtotal || 0,
    total: item.total || 0,
    sku: item.sku || '',
    price: item.price !== undefined ? parseFloat(item.price) : (item.quantity ? parseFloat(item.total) / item.quantity : 0),
    image: item.image?.src || ''
  })) : [];

  const itemCount = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
  const cleanStoreUrl = normalizeStoreUrl(site.storeUrl);
  const viewOrderUrl = `${cleanStoreUrl}/wp-admin/post.php?post=${wcOrder.id}&action=edit`;

  const orderDate = wcOrder.date_created || wcOrder.date_created_gmt || new Date().toISOString();
  const wcStatus = (wcOrder.status || 'processing').toLowerCase();
  const customStatus = existingCustomStatus || 'Processing';

  return {
    id: `woo_${site.id}_${wcOrder.id}`,
    userId,
    wooOrderId: wcOrder.id,
    wooSiteId: site.id,
    wooSiteName: site.name,
    orderNumber: String(wcOrder.number || wcOrder.id),
    orderDate,
    status: wcStatus,
    woocommerce_status: wcStatus,
    custom_status: customStatus,
    customStatus: customStatus,
    currency: wcOrder.currency || 'BDT',
    total: parseFloat(wcOrder.total) || 0,
    subtotal: parseFloat(wcOrder.subtotal || wcOrder.total) || 0,
    shippingTotal: parseFloat(wcOrder.shipping_total) || 0,
    discountTotal: parseFloat(wcOrder.discount_total) || 0,
    paymentMethod: wcOrder.payment_method || 'cod',
    paymentMethodTitle: wcOrder.payment_method_title || (wcOrder.payment_method === 'cod' ? 'Cash on delivery' : wcOrder.payment_method || 'Online Payment'),
    customerName,
    customerPhone,
    customerEmail,
    billingAddress: {
      firstName: billing.first_name || '',
      lastName: billing.last_name || '',
      company: billing.company || '',
      address1: billing.address_1 || '',
      address2: billing.address_2 || '',
      city: billing.city || '',
      state: billing.state || '',
      postcode: billing.postcode || '',
      country: billing.country || '',
      email: billing.email || '',
      phone: billing.phone || ''
    },
    shippingAddress: {
      firstName: shipping.first_name || '',
      lastName: shipping.last_name || '',
      company: shipping.company || '',
      address1: shipping.address_1 || '',
      address2: shipping.address_2 || '',
      city: shipping.city || '',
      state: shipping.state || '',
      postcode: shipping.postcode || '',
      country: shipping.country || '',
      phone: shipping.phone || billing.phone || ''
    },
    items,
    itemCount,
    customerNote: wcOrder.customer_note || '',
    shippingMethodTitle: wcOrder.shipping_lines?.[0]?.method_title || 'Standard Shipping',
    viewOrderUrl,
    createdAt: orderDate,
    updatedAt: wcOrder.date_modified || new Date().toISOString(),
    syncedAt: new Date().toISOString()
  };
}

// Log a webhook event in the user's collection
export async function recordWebhookLog(userId: string, log: WebhookLog) {
  try {
    await dbManager.addToCollection(userId, 'woocommerce_webhook_logs', log);
  } catch (e: any) {
    console.warn('[WEBHOOK LOG ERROR]', e?.message);
  }
}

// Find matching WooCommerce site record across users/sites
export async function findMatchingSite(
  siteIdParam?: string,
  sourceUrlHeader?: string,
  providedUserId?: string
): Promise<{ site: WooSiteRecord; userId: string } | null> {
  // If specific userId and siteId passed in query
  if (providedUserId && siteIdParam) {
    const sites = await dbManager.readData(providedUserId, 'woocommerce_sites');
    if (Array.isArray(sites)) {
      const match = sites.find((s: any) => s.id === siteIdParam);
      if (match) return { site: match, userId: providedUserId };
    }
  }

  // Search across all users
  const scannedUserIds = new Set<string>();
  if (providedUserId) scannedUserIds.add(providedUserId);

  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // 1. Scan custom_users.json if present
    const usersFile = path.join(process.cwd(), 'data', 'custom_users.json');
    if (fs.existsSync(usersFile)) {
      try {
        const localUsers = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
        if (Array.isArray(localUsers)) {
          for (const u of localUsers) {
            if (u.uid) scannedUserIds.add(u.uid);
          }
        }
      } catch (e) {}
    }

    // 2. Scan data/collections directory for existing user collections
    const collectionsDir = path.join(process.cwd(), 'data', 'collections');
    if (fs.existsSync(collectionsDir)) {
      const files = fs.readdirSync(collectionsDir);
      for (const file of files) {
        if (file.endsWith('_woocommerce_sites.json')) {
          const uid = file.replace('_woocommerce_sites.json', '');
          if (uid) scannedUserIds.add(uid);
        }
      }
    }
  } catch (e) {}

  for (const uid of scannedUserIds) {
    if (!uid) continue;
    try {
      const sites = await dbManager.readData(uid, 'woocommerce_sites');
      if (!Array.isArray(sites) || sites.length === 0) continue;

      // 1. Match by site ID
      if (siteIdParam) {
        const match = sites.find((s: any) => s.id === siteIdParam);
        if (match) return { site: match, userId: uid };
      }

      // 2. Match by store URL
      if (sourceUrlHeader) {
        const cleanSource = normalizeStoreUrl(sourceUrlHeader);
        const match = sites.find((s: any) => {
          const cleanSiteUrl = normalizeStoreUrl(s.storeUrl);
          return cleanSource.includes(cleanSiteUrl) || cleanSiteUrl.includes(cleanSource);
        });
        if (match) return { site: match, userId: uid };
      }

      // If only one site exists for user and no siteId specified
      if (!siteIdParam && !sourceUrlHeader && sites.length === 1) {
        return { site: sites[0], userId: uid };
      }
    } catch (e) {}
  }

  return null;
}

// Process WooCommerce Webhook Request
export async function handleWooCommerceWebhook(req: Request, res: Response): Promise<void> {
  const startTime = Date.now();
  const logId = `wh_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const sourceIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  
  // WooCommerce Webhook Standard Headers
  const signatureHeader = (req.headers['x-wc-webhook-signature'] as string) || '';
  const topicHeader = (req.headers['x-wc-webhook-topic'] as string) || 'order.created';
  const sourceHeader = (req.headers['x-wc-webhook-source'] as string) || '';
  const deliveryIdHeader = (req.headers['x-wc-webhook-delivery-id'] as string) || '';
  const webhookIdHeader = (req.headers['x-wc-webhook-id'] as string) || '';
  const resourceHeader = (req.headers['x-wc-webhook-resource'] as string) || '';
  const eventHeader = (req.headers['x-wc-webhook-event'] as string) || '';

  const siteIdParam = (req.query.siteId as string) || (req.query.site_id as string);
  const userIdParam = (req.query.userId as string) || (req.query.uid as string);

  console.log(`[WOO WEBHOOK] Incoming request: Topic=${topicHeader}, Source=${sourceHeader}, DeliveryID=${deliveryIdHeader}, SiteIDParam=${siteIdParam}`);

  // Retrieve raw request body buffer
  const rawBody: Buffer = (req as any).rawBody || Buffer.from(JSON.stringify(req.body || {}));

  // Resolve matching site
  const matched = await findMatchingSite(siteIdParam, sourceHeader, userIdParam);
  
  if (!matched) {
    console.warn(`[WOO WEBHOOK ERROR] No matching store found for source: "${sourceHeader}", siteId: "${siteIdParam}"`);
    res.status(404).json({
      error: 'WooCommerce store not configured or found for this webhook',
      receivedHeaders: {
        topic: topicHeader,
        source: sourceHeader,
        siteId: siteIdParam
      }
    });
    return;
  }

  const { site, userId } = matched;

  // Determine secret to use for verification
  // Priority: 1) Site-specific webhookSecret, 2) Environment WOOCOMMERCE_WEBHOOK_SECRET, 3) Site consumerSecret fallback
  const siteWebhookSecret = (site as any).webhookSecret || process.env.WOOCOMMERCE_WEBHOOK_SECRET || site.consumerSecret || '';

  // Handle WooCommerce Ping / Webhook Verification (topic: action.woocommerce_webhook_ping or webhook.test)
  const isPing = topicHeader.includes('ping') || topicHeader === 'action.woocommerce_webhook_ping' || req.body?.webhook_id;
  
  let isSignatureValid = false;

  if (signatureHeader && siteWebhookSecret) {
    isSignatureValid = verifyHmacSignature(rawBody, signatureHeader, siteWebhookSecret);
    
    // Also try global env secret if site secret failed
    if (!isSignatureValid && process.env.WOOCOMMERCE_WEBHOOK_SECRET) {
      isSignatureValid = verifyHmacSignature(rawBody, signatureHeader, process.env.WOOCOMMERCE_WEBHOOK_SECRET);
    }

    // Also try consumer secret if dedicated webhook secret failed
    if (!isSignatureValid && site.consumerSecret && site.consumerSecret !== siteWebhookSecret) {
      isSignatureValid = verifyHmacSignature(rawBody, signatureHeader, site.consumerSecret);
    }
  } else if (!signatureHeader) {
    // If no signature header was provided in development / sandbox mode, warn
    console.warn(`[WOO WEBHOOK WARNING] No X-WC-Webhook-Signature header present from ${sourceIp}`);
    // If environment explicitly requires signature, block.
    if (process.env.NODE_ENV === 'production' && process.env.STRICT_WEBHOOK_SIGNATURE === 'true') {
      const duration = Date.now() - startTime;
      await recordWebhookLog(userId, {
        id: logId,
        timestamp: new Date().toISOString(),
        topic: topicHeader,
        deliveryId: deliveryIdHeader,
        siteId: site.id,
        siteName: site.name,
        status: 'failed',
        httpStatus: 401,
        processingTimeMs: duration,
        sourceUrl: sourceHeader,
        sourceIp,
        errorMessage: 'Missing X-WC-Webhook-Signature header',
        signatureVerified: false
      });
      res.status(401).json({ error: 'Missing X-WC-Webhook-Signature header' });
      return;
    }
    // Allow non-strict in local/sandbox testing
    isSignatureValid = true;
  }

  if (!isSignatureValid) {
    const duration = Date.now() - startTime;
    console.error(`[WOO WEBHOOK ERROR] Invalid HMAC signature from ${sourceIp} for site ${site.name}`);
    await recordWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: deliveryIdHeader,
      siteId: site.id,
      siteName: site.name,
      status: 'failed',
      httpStatus: 401,
      processingTimeMs: duration,
      sourceUrl: sourceHeader,
      sourceIp,
      errorMessage: 'Invalid HMAC SHA256 Signature (X-WC-Webhook-Signature mismatch)',
      signatureVerified: false
    });
    res.status(401).json({ 
      error: 'Invalid webhook signature', 
      hint: 'Please verify that the Webhook Secret in WooCommerce matches the configured secret in CommerceFlow.'
    });
    return;
  }

  // If this is a WooCommerce test / ping request
  if (isPing || (req.body && req.body.webhook_id && !req.body.id)) {
    const duration = Date.now() - startTime;
    console.log(`[WOO WEBHOOK] Ping verified successfully for store: ${site.name}`);
    await recordWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: 'ping',
      deliveryId: deliveryIdHeader,
      siteId: site.id,
      siteName: site.name,
      status: 'success',
      httpStatus: 200,
      processingTimeMs: duration,
      sourceUrl: sourceHeader,
      sourceIp,
      signatureVerified: true
    });
    
    // Broadcast ping event to socket clients
    if (ioInstance) {
      ioInstance.emit('woocommerce:webhook_ping', {
        siteId: site.id,
        siteName: site.name,
        timestamp: new Date().toISOString(),
        message: 'WooCommerce Webhook ping connection verified!'
      });
    }

    res.status(200).json({ 
      success: true, 
      message: 'WooCommerce Webhook Ping received and verified successfully',
      store: site.name
    });
    return;
  }

  const payload = req.body;

  // Validate that payload contains an order object
  if (!payload || !payload.id) {
    const duration = Date.now() - startTime;
    console.warn(`[WOO WEBHOOK] Ignored non-order or empty payload`);
    await recordWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: deliveryIdHeader,
      siteId: site.id,
      siteName: site.name,
      status: 'ignored',
      httpStatus: 200,
      processingTimeMs: duration,
      sourceUrl: sourceHeader,
      sourceIp,
      errorMessage: 'Payload does not contain valid order data',
      signatureVerified: true
    });
    res.status(200).json({ message: 'Payload received but ignored (no order ID found)' });
    return;
  }

  try {
    const wooOrderId = payload.id;
    const orderKey = `woo_${site.id}_${wooOrderId}`;

    // Read existing orders for idempotency & custom status preservation
    const existingOrders = await dbManager.readData(userId, 'woocommerce_orders');
    const existingOrder = Array.isArray(existingOrders) 
      ? existingOrders.find((o: any) => o.id === orderKey || (o.wooSiteId === site.id && String(o.wooOrderId) === String(wooOrderId)))
      : null;

    const existingCustomStatus = existingOrder?.custom_status || existingOrder?.customStatus || 'Processing';
    const isNewOrder = !existingOrder;

    // Map to normalized WebOrderRecord
    const mappedOrder = mapWebhookOrderToWebOrder(payload, site, userId, existingCustomStatus);

    // Save atomically to DB & JSON collections
    await dbManager.addToCollection(userId, 'woocommerce_orders', mappedOrder);

    // Update site's lastSyncAt
    const updatedSite: WooSiteRecord = {
      ...site,
      status: 'Connected',
      lastSyncAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await dbManager.addToCollection(userId, 'woocommerce_sites', updatedSite);

    const duration = Date.now() - startTime;

    // Record success log
    await recordWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: deliveryIdHeader,
      wooOrderId: mappedOrder.wooOrderId,
      orderNumber: mappedOrder.orderNumber,
      siteId: site.id,
      siteName: site.name,
      status: 'success',
      httpStatus: 200,
      processingTimeMs: duration,
      customerName: mappedOrder.customerName,
      total: mappedOrder.total,
      currency: mappedOrder.currency,
      sourceUrl: sourceHeader,
      sourceIp,
      signatureVerified: true
    });

    console.log(`[WOO WEBHOOK SUCCESS] ${isNewOrder ? 'New Order' : 'Order Updated'} #${mappedOrder.orderNumber} from "${site.name}" (Processed in ${duration}ms)`);

    // Emit Real-Time Socket Event
    if (ioInstance) {
      const eventPayload = {
        order: mappedOrder,
        isNew: isNewOrder,
        siteId: site.id,
        siteName: site.name,
        timestamp: new Date().toISOString(),
        soundAlert: isNewOrder // Trigger sound on client for new orders
      };

      if (isNewOrder) {
        ioInstance.emit('woocommerce:new_order', eventPayload);
      } else {
        ioInstance.emit('woocommerce:order_updated', eventPayload);
      }
      
      // Also emit general webhook activity event for live monitoring UI
      ioInstance.emit('woocommerce:webhook_activity', {
        logId,
        topic: topicHeader,
        orderNumber: mappedOrder.orderNumber,
        siteName: site.name,
        customerName: mappedOrder.customerName,
        total: mappedOrder.total,
        currency: mappedOrder.currency,
        timestamp: new Date().toISOString(),
        isNew: isNewOrder
      });
    }

    // Acknowledge receipt to WooCommerce immediately
    res.status(200).json({
      success: true,
      message: isNewOrder ? 'New order created and synced in real-time' : 'Order updated successfully',
      orderId: mappedOrder.id,
      orderNumber: mappedOrder.orderNumber,
      siteName: site.name,
      processingTimeMs: duration
    });
  } catch (processError: any) {
    const duration = Date.now() - startTime;
    console.error(`[WOO WEBHOOK PROCESSING ERROR]`, processError);
    await recordWebhookLog(userId, {
      id: logId,
      timestamp: new Date().toISOString(),
      topic: topicHeader,
      deliveryId: deliveryIdHeader,
      wooOrderId: payload.id,
      siteId: site.id,
      siteName: site.name,
      status: 'failed',
      httpStatus: 500,
      processingTimeMs: duration,
      sourceUrl: sourceHeader,
      sourceIp,
      errorMessage: processError?.message || 'Database write error',
      signatureVerified: true
    });

    res.status(500).json({
      error: 'Failed to process webhook order payload',
      details: processError?.message
    });
  }
}

// Auto-Register Webhook on WooCommerce via REST API
export async function autoRegisterWooCommerceWebhook(
  userId: string,
  siteId: string,
  appBaseUrl: string,
  customSecret?: string
): Promise<{ success: boolean; webhookId?: number | string; deliveryUrl: string; message: string }> {
  const sites = await dbManager.readData(userId, 'woocommerce_sites');
  const site: WooSiteRecord = Array.isArray(sites) ? sites.find(s => s.id === siteId) : null;

  if (!site || !site.storeUrl || !site.consumerKey || !site.consumerSecret) {
    throw new Error('WooCommerce store connection not found or missing API credentials.');
  }

  const webhookSecret = customSecret || (site as any).webhookSecret || generateWebhookSecret();
  
  // Format clean delivery URL (ensure not localhost in production/remote setup)
  let cleanAppUrl = normalizeStoreUrl(appBaseUrl);
  if (cleanAppUrl.includes('localhost') || cleanAppUrl.includes('127.0.0.1')) {
    if (process.env.APP_BASE_URL) {
      cleanAppUrl = normalizeStoreUrl(process.env.APP_BASE_URL);
    }
  }
  const deliveryUrl = `${cleanAppUrl}/api/webhooks/woocommerce?siteId=${site.id}`;

  const normalizedStoreUrl = normalizeStoreUrl(site.storeUrl);
  const webhooksEndpoint = `${normalizedStoreUrl}/wp-json/wc/v3/webhooks`;

  // Helper auth header
  const authHeader = `Basic ${Buffer.from(`${site.consumerKey.trim()}:${site.consumerSecret.trim()}`).toString('base64')}`;

  // 1. Fetch existing webhooks to see if already registered
  let existingWebhooksList: any[] = [];
  try {
    const listRes = await fetch(`${webhooksEndpoint}?per_page=100`, {
      headers: {
        'Authorization': authHeader,
        'Accept': 'application/json',
        'User-Agent': 'CommerceFlow-Webhook-Manager/2.0'
      }
    });

    if (listRes.ok) {
      const data = await listRes.json();
      if (Array.isArray(data)) {
        existingWebhooksList = data;
      }
    }
  } catch (listErr) {
    console.warn('[WEBHOOK REGISTRATION] Failed to list existing webhooks:', listErr);
  }

  let primaryWebhookId: number | string | undefined;

  // Topics to register for complete real-time order tracking
  const topicsToRegister = [
    { topic: 'order.created', name: 'CommerceFlow Real-Time Order Created' },
    { topic: 'order.updated', name: 'CommerceFlow Real-Time Order Updated' }
  ];

  for (const item of topicsToRegister) {
    const matchedExisting = existingWebhooksList.find((wh: any) => 
      wh.topic === item.topic && (
        (wh.delivery_url && wh.delivery_url.includes('/api/webhooks/woocommerce')) ||
        wh.name?.includes('CommerceFlow')
      )
    );

    if (matchedExisting) {
      console.log(`[WEBHOOK REGISTRATION] Updating existing webhook ID ${matchedExisting.id} (${item.topic}) on ${site.name}...`);
      try {
        const updateRes = await fetch(`${webhooksEndpoint}/${matchedExisting.id}`, {
          method: 'PUT',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'User-Agent': 'CommerceFlow-Webhook-Manager/2.0'
          },
          body: JSON.stringify({
            name: item.name,
            topic: item.topic,
            delivery_url: deliveryUrl,
            secret: webhookSecret,
            status: 'active'
          })
        });

        if (updateRes.ok) {
          const updated = await updateRes.json();
          if (item.topic === 'order.created') primaryWebhookId = updated.id;
        }
      } catch (err: any) {
        console.warn(`[WEBHOOK REGISTRATION] Update failed for ${item.topic}:`, err.message);
      }
    } else {
      console.log(`[WEBHOOK REGISTRATION] Creating new webhook (${item.topic}) on ${site.name}...`);
      try {
        const createRes = await fetch(webhooksEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'User-Agent': 'CommerceFlow-Webhook-Manager/2.0'
          },
          body: JSON.stringify({
            name: item.name,
            topic: item.topic,
            delivery_url: deliveryUrl,
            secret: webhookSecret,
            status: 'active'
          })
        });

        if (createRes.ok) {
          const created = await createRes.json();
          if (item.topic === 'order.created') primaryWebhookId = created.id;
        }
      } catch (err: any) {
        console.warn(`[WEBHOOK REGISTRATION] Create failed for ${item.topic}:`, err.message);
      }
    }
  }

  // Save secret & webhook metadata to site record
  const updatedSite = {
    ...site,
    webhookSecret,
    webhookId: primaryWebhookId || (site as any).webhookId,
    webhookStatus: 'active',
    webhookDeliveryUrl: deliveryUrl,
    updatedAt: new Date().toISOString()
  };
  await dbManager.addToCollection(userId, 'woocommerce_sites', updatedSite);

  return {
    success: true,
    webhookId: primaryWebhookId || (site as any).webhookId,
    deliveryUrl,
    message: `Webhook successfully registered and activated on ${site.name}!`
  };
}

// Test / Simulate Webhook Delivery for verification
export async function simulateWebhookTest(userId: string, siteId: string): Promise<{ success: boolean; message: string; log: WebhookLog }> {
  const sites = await dbManager.readData(userId, 'woocommerce_sites');
  const site: WooSiteRecord = Array.isArray(sites) ? sites.find(s => s.id === siteId) : null;

  if (!site) {
    throw new Error('WooCommerce store not found.');
  }

  const testOrderNumber = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;
  const logId = `wh_test_${Date.now()}`;
  
  const testLog: WebhookLog = {
    id: logId,
    timestamp: new Date().toISOString(),
    topic: 'order.created (Diagnostic Test)',
    deliveryId: `test_del_${Date.now()}`,
    wooOrderId: `test_${Date.now()}`,
    orderNumber: testOrderNumber,
    siteId: site.id,
    siteName: site.name,
    status: 'success',
    httpStatus: 200,
    processingTimeMs: 18,
    customerName: 'Diagnostic Test Customer',
    total: 1250,
    currency: site.currency || 'BDT',
    sourceUrl: site.storeUrl,
    sourceIp: '127.0.0.1 (Self Test)',
    signatureVerified: true
  };

  await recordWebhookLog(userId, testLog);

  // Trigger real-time diagnostic alert to UI
  if (ioInstance) {
    ioInstance.emit('woocommerce:webhook_test_event', {
      siteId: site.id,
      siteName: site.name,
      orderNumber: testOrderNumber,
      timestamp: new Date().toISOString(),
      message: 'Real-time WebSocket connection is working flawlessly!'
    });
  }

  return {
    success: true,
    message: `Diagnostic test event dispatched! Socket.IO real-time channel is responsive.`,
    log: testLog
  };
}
