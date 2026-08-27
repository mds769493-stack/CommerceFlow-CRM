import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import * as dbManager from './db.ts';

export interface WooSiteRecord {
  id: string;
  userId: string;
  name: string;
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string; // Stored securely on server
  status: 'Connected' | 'Disconnected' | 'Error';
  lastSyncAt?: string;
  autoSyncInterval?: 'off' | '5m' | '15m' | '30m' | '1h';
  currency?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebOrderRecord {
  id: string; // "woo_${siteId}_${wooOrderId}"
  userId: string;
  wooOrderId: number | string;
  wooSiteId: string;
  wooSiteName: string;
  orderNumber: string;
  orderDate: string;
  status: string; // WooCommerce API status
  woocommerce_status?: string;
  custom_status: string; // Custom Order Status (default: 'Processing')
  customStatus?: string;
  currency: string;
  total: number;
  subtotal: number;
  shippingTotal: number;
  discountTotal: number;
  paymentMethod: string;
  paymentMethodTitle: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  billingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shippingAddress: {
    firstName: string;
    lastName: string;
    company?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    phone?: string;
  };
  items: Array<{
    id: number | string;
    name: string;
    productId: number;
    variationId?: number;
    quantity: number;
    subtotal: number | string;
    total: number | string;
    sku?: string;
    price: number;
    image?: string;
  }>;
  itemCount: number;
  customerNote?: string;
  shippingMethodTitle?: string;
  viewOrderUrl?: string;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

// Clean and normalize store URL
export function normalizeStoreUrl(url: string): string {
  if (!url) return '';
  let cleaned = url.trim();
  if (!/^https?:\/\//i.test(cleaned)) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned.replace(/\/+$/, '');
}

// Build Basic Auth header for WooCommerce REST API
function getWooAuthHeader(key: string, secret: string): string {
  const credentials = Buffer.from(`${key.trim()}:${secret.trim()}`).toString('base64');
  return `Basic ${credentials}`;
}

// Safe site object for frontend (NEVER exposes consumerSecret)
export function sanitizeSiteForFrontend(site: WooSiteRecord): Omit<WooSiteRecord, 'consumerSecret'> & { hasSecret: boolean; consumerSecretMasked: string } {
  const { consumerSecret, ...rest } = site;
  return {
    ...rest,
    hasSecret: !!consumerSecret,
    consumerSecretMasked: consumerSecret ? '••••••••••••••••' : ''
  };
}

// Fetch helper with timeout and clean error handling
async function fetchWooApi(url: string, key: string, secret: string, options: RequestInit = {}): Promise<any> {
  const authHeader = getWooAuthHeader(key, secret);
  const headers = {
    'Authorization': authHeader,
    'Accept': 'application/json',
    'User-Agent': 'WooCommerce-Manager/2.0',
    ...(options.headers || {})
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type') || '';
    let data: any = null;

    if (contentType.includes('application/json')) {
      data = await response.json().catch(() => null);
    } else {
      const text = await response.text();
      // Handle HTML error pages (e.g., 404/500/Cloudflare)
      if (!response.ok) {
        throw new Error(`WooCommerce REST API returned HTTP ${response.status} (${response.statusText}). Make sure the REST API is enabled and the URL is correct.`);
      }
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid non-JSON response received from WooCommerce server (HTTP ${response.status})`);
      }
    }

    if (!response.ok) {
      const message = data?.message || data?.code || `WooCommerce API error (HTTP ${response.status})`;
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Unauthorized: Invalid Consumer Key or Consumer Secret. Please verify your WooCommerce REST API keys.`);
      }
      if (response.status === 404) {
        throw new Error(`WooCommerce REST API endpoint not found (404). Please verify that WooCommerce is active and Store URL is correct.`);
      }
      throw new Error(message);
    }

    return { data, headers: response.headers };
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Connection timed out while reaching WooCommerce store. Please check the Store URL and server status.');
    }
    throw error;
  }
}

// Test WooCommerce Connection
export async function testWooConnection(storeUrl: string, key: string, secret: string): Promise<{ success: boolean; message: string; storeName?: string; currency?: string; orderCount?: number }> {
  const normalizedUrl = normalizeStoreUrl(storeUrl);
  if (!normalizedUrl) {
    throw new Error('Store URL is required.');
  }
  if (!key || !secret) {
    throw new Error('Consumer Key and Consumer Secret are required.');
  }

  // Try fetching 1 order or system status
  const testEndpoint = `${normalizedUrl}/wp-json/wc/v3/orders?per_page=1`;
  const { data, headers } = await fetchWooApi(testEndpoint, key, secret);

  const totalOrders = parseInt(headers.get('x-wp-total') || '0', 10);
  const sampleOrder = Array.isArray(data) && data.length > 0 ? data[0] : null;

  return {
    success: true,
    message: 'Connection successful! WooCommerce REST API verified.',
    currency: sampleOrder?.currency || 'BDT',
    orderCount: isNaN(totalOrders) ? (Array.isArray(data) ? data.length : 0) : totalOrders
  };
}

// Map WooCommerce Order to WebOrder
function mapWcOrderToWebOrder(
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

  const itemCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const cleanStoreUrl = normalizeStoreUrl(site.storeUrl);
  const viewOrderUrl = `${cleanStoreUrl}/wp-admin/post.php?post=${wcOrder.id}&action=edit`;

  const orderDate = wcOrder.date_created || wcOrder.date_created_gmt || new Date().toISOString();
  const wcStatus = wcOrder.status || 'pending';
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

// Sync Orders for a specific site or all sites of a user
export async function syncWooOrdersForUser(
  userId: string, 
  targetSiteId?: string, 
  maxPages: number = 5
): Promise<{
  success: boolean;
  newCount: number;
  updatedCount: number;
  totalSynced: number;
  lastSyncAt: string;
  siteResults: Array<{ siteId: string; siteName: string; count: number; error?: string }>;
}> {
  const sitesRaw = await dbManager.readData(userId, 'woocommerce_sites');
  let sites: WooSiteRecord[] = Array.isArray(sitesRaw) ? sitesRaw : [];

  if (targetSiteId && targetSiteId !== 'all') {
    sites = sites.filter(s => s.id === targetSiteId);
  }

  if (sites.length === 0) {
    throw new Error('No WooCommerce store connected. Please add and connect a store first.');
  }

  const existingOrders = await dbManager.readData(userId, 'woocommerce_orders');
  const existingMap = new Map<string, any>();
  if (Array.isArray(existingOrders)) {
    for (const o of existingOrders) {
      if (o.id) existingMap.set(o.id, o);
    }
  }

  let totalNew = 0;
  let totalUpdated = 0;
  let totalSynced = 0;
  const siteResults: Array<{ siteId: string; siteName: string; count: number; error?: string }> = [];
  const ordersToSave: WebOrderRecord[] = [];

  const nowIso = new Date().toISOString();

  for (const site of sites) {
    if (!site.storeUrl || !site.consumerKey || !site.consumerSecret) {
      siteResults.push({
        siteId: site.id,
        siteName: site.name,
        count: 0,
        error: 'Missing credentials'
      });
      continue;
    }

    try {
      const normalizedUrl = normalizeStoreUrl(site.storeUrl);
      let page = 1;
      let siteSyncedCount = 0;
      let hasMore = true;

      while (hasMore && page <= maxPages) {
        const endpoint = `${normalizedUrl}/wp-json/wc/v3/orders?per_page=100&page=${page}&orderby=date&order=desc`;
        const { data } = await fetchWooApi(endpoint, site.consumerKey, site.consumerSecret);

        if (!Array.isArray(data) || data.length === 0) {
          hasMore = false;
          break;
        }

        for (const wcOrder of data) {
          const orderKey = `woo_${site.id}_${wcOrder.id}`;
          const existing = existingMap.get(orderKey);
          const existingCustomStatus = existing?.custom_status || existing?.customStatus;
          const mappedOrder = mapWcOrderToWebOrder(wcOrder, site, userId, existingCustomStatus);

          if (existingMap.has(orderKey)) {
            totalUpdated++;
          } else {
            totalNew++;
          }

          existingMap.set(orderKey, mappedOrder);
          ordersToSave.push(mappedOrder);
          siteSyncedCount++;
        }

        if (data.length < 100) {
          hasMore = false;
        } else {
          page++;
        }
      }

      totalSynced += siteSyncedCount;

      // Update site status & last sync
      const updatedSite: WooSiteRecord = {
        ...site,
        status: 'Connected',
        lastSyncAt: nowIso,
        errorMessage: undefined,
        updatedAt: nowIso
      };
      await dbManager.addToCollection(userId, 'woocommerce_sites', updatedSite);

      siteResults.push({
        siteId: site.id,
        siteName: site.name,
        count: siteSyncedCount
      });
    } catch (err: any) {
      console.error(`[WOO SYNC ERROR] Store ${site.name} (${site.id}):`, err.message);
      
      // Update site status to Error
      const updatedSite: WooSiteRecord = {
        ...site,
        status: 'Error',
        errorMessage: err.message,
        updatedAt: nowIso
      };
      await dbManager.addToCollection(userId, 'woocommerce_sites', updatedSite);

      siteResults.push({
        siteId: site.id,
        siteName: site.name,
        count: 0,
        error: err.message
      });
    }
  }

  // Batch save all synced orders
  if (ordersToSave.length > 0) {
    await dbManager.batchWriteToCollection(userId, 'woocommerce_orders', ordersToSave, 'replace');
  }

  return {
    success: true,
    newCount: totalNew,
    updatedCount: totalUpdated,
    totalSynced,
    lastSyncAt: nowIso,
    siteResults
  };
}

// Sync a single WooCommerce Order
export async function syncSingleWooOrder(
  userId: string, 
  siteId: string, 
  wooOrderId: number | string
): Promise<WebOrderRecord> {
  const sitesRaw = await dbManager.readData(userId, 'woocommerce_sites');
  const site = Array.isArray(sitesRaw) ? sitesRaw.find(s => s.id === siteId) : null;

  if (!site || !site.storeUrl || !site.consumerKey || !site.consumerSecret) {
    throw new Error('WooCommerce store configuration not found or invalid.');
  }

  const normalizedUrl = normalizeStoreUrl(site.storeUrl);
  const endpoint = `${normalizedUrl}/wp-json/wc/v3/orders/${wooOrderId}`;

  const { data } = await fetchWooApi(endpoint, site.consumerKey, site.consumerSecret);
  
  const existingOrders = await dbManager.readData(userId, 'woocommerce_orders');
  const existing = Array.isArray(existingOrders) ? existingOrders.find((o: any) => o.id === `woo_${siteId}_${wooOrderId}` || (o.wooSiteId === siteId && String(o.wooOrderId) === String(wooOrderId))) : null;
  const existingCustomStatus = existing?.custom_status || existing?.customStatus;

  const mappedOrder = mapWcOrderToWebOrder(data, site, userId, existingCustomStatus);

  await dbManager.addToCollection(userId, 'woocommerce_orders', mappedOrder);
  return mappedOrder;
}

// Update status of a WooCommerce Order locally ONLY (Do not touch remote website)
export async function updateWooOrderStatus(
  userId: string,
  localOrderId: string,
  newStatus: string
): Promise<WebOrderRecord> {
  const orders = await dbManager.readData(userId, 'woocommerce_orders');
  const order: WebOrderRecord = Array.isArray(orders) ? orders.find(o => o.id === localOrderId) : null;

  if (!order) {
    throw new Error(`Order ${localOrderId} not found.`);
  }

  console.log(`[WOO LOCAL UPDATE] Updating order ${localOrderId} status to "${newStatus}" locally only. Remote store remains untouched.`);

  const updatedOrder: WebOrderRecord = {
    ...order,
    status: newStatus.toLowerCase().trim(),
    updatedAt: new Date().toISOString()
  };

  await dbManager.addToCollection(userId, 'woocommerce_orders', updatedOrder);
  return updatedOrder;
}

// Manual Sync single WooCommerce order via Order ID (Webhook fallback)
export async function manualSyncSingleOrderById(
  userId: string,
  rawOrderId: string | number,
  targetSiteId?: string
): Promise<{
  order: WebOrderRecord;
  isNew: boolean;
  message: string;
}> {
  const cleanWooOrderId = String(rawOrderId).trim().replace(/^#/, '');
  if (!cleanWooOrderId) {
    throw new Error('Please enter a valid WooCommerce Order ID.');
  }

  const sitesRaw = await dbManager.readData(userId, 'woocommerce_sites');
  let sites: WooSiteRecord[] = Array.isArray(sitesRaw) ? sitesRaw : [];

  if (targetSiteId && targetSiteId !== 'all') {
    sites = sites.filter(s => s.id === targetSiteId);
  }

  if (sites.length === 0) {
    throw new Error('No WooCommerce store connected. Please add and connect a store first.');
  }

  // 1. Read existing local database orders to check if order already exists
  const existingOrders = await dbManager.readData(userId, 'woocommerce_orders');
  const existingOrderList: any[] = Array.isArray(existingOrders) ? existingOrders : [];

  let matchedSite: WooSiteRecord | null = null;
  let fetchedWcOrder: any = null;
  let lastErrorMsg = '';

  // 2. Fetch the specific Order from WooCommerce REST API (ONLY THAT ORDER ID)
  for (const site of sites) {
    if (!site.storeUrl || !site.consumerKey || !site.consumerSecret) continue;

    try {
      const normalizedUrl = normalizeStoreUrl(site.storeUrl);
      const endpoint = `${normalizedUrl}/wp-json/wc/v3/orders/${encodeURIComponent(cleanWooOrderId)}`;
      const { data } = await fetchWooApi(endpoint, site.consumerKey, site.consumerSecret);

      if (data && data.id && String(data.id) === String(cleanWooOrderId)) {
        matchedSite = site;
        fetchedWcOrder = data;
        break;
      }
    } catch (err: any) {
      lastErrorMsg = err.message || '';
      // If 404 on this store, continue checking next store (if multiple)
    }
  }

  // 3. If Order Not Found in WooCommerce
  if (!matchedSite || !fetchedWcOrder) {
    throw new Error(
      lastErrorMsg && lastErrorMsg.includes('404')
        ? `Order #${cleanWooOrderId} was not found on your connected WooCommerce store.`
        : (lastErrorMsg || `Order #${cleanWooOrderId} could not be retrieved from WooCommerce. Please check the Order ID and store connection.`)
    );
  }

  // 4. Check existing order locally
  const expectedKey = `woo_${matchedSite.id}_${fetchedWcOrder.id}`;
  const existingLocally = existingOrderList.find(
    (o) => o.id === expectedKey || (o.wooSiteId === matchedSite!.id && String(o.wooOrderId) === String(fetchedWcOrder.id))
  );

  const isNew = !existingLocally;
  const existingCustomStatus = existingLocally?.custom_status || existingLocally?.customStatus;

  // 5. Map and save/update locally without creating duplicates
  const mappedOrder = mapWcOrderToWebOrder(fetchedWcOrder, matchedSite, userId, existingCustomStatus);

  await dbManager.addToCollection(userId, 'woocommerce_orders', mappedOrder);

  return {
    order: mappedOrder,
    isNew,
    message: isNew 
      ? `✓ Order #${cleanWooOrderId} synced successfully.` 
      : `✓ Order #${cleanWooOrderId} updated successfully.`
  };
}

// Background Auto-Sync Scheduler (Disabled by default / webhook-first)
let schedulerInterval: NodeJS.Timeout | null = null;
let isAutoSyncRunning = false;

export function initAutoSyncScheduler() {
  // Automatic polling / cron sync is disabled in favor of real-time webhooks & manual fallback
  console.log('[WOOCOMMERCE] Auto-sync background scheduler disabled. Webhook-first real-time architecture active.');
}
