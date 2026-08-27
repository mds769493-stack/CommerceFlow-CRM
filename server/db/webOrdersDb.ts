import { readJsonCollectionFile, writeJsonCollectionFile } from './fileStorage.ts';

export interface WebOrderRecord {
  id: string;
  userId: string;
  source: 'woocommerce' | 'shopify' | 'manual' | string;
  wooSiteId?: string;
  wooOrderId?: number | string;
  shopifySiteId?: string;
  shopifyOrderId?: number | string;
  orderNumber: string;
  status: string;
  custom_status?: string;
  customStatus?: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: any;
  billingAddress: any;
  items: any[];
  total: number;
  currency: string;
  paymentMethod: string;
  isPaid: boolean;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export interface StoreSiteRecord {
  id: string;
  userId: string;
  type: 'woocommerce' | 'shopify';
  name: string;
  storeUrl: string;
  consumerKey?: string;
  consumerSecret?: string;
  accessToken?: string;
  webhookSecret?: string;
  autoSyncInterval?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

const ORDERS_COLLECTION = 'woocommerce_orders';
const WOO_SITES_COLLECTION = 'woocommerce_sites';
const SHOPIFY_SITES_COLLECTION = 'shopify_sites';

/**
 * Get all Web Orders for a user
 */
export async function getWebOrders(userId: string): Promise<WebOrderRecord[]> {
  return await readJsonCollectionFile(userId, ORDERS_COLLECTION);
}

/**
 * Get single Web Order by ID
 */
export async function getWebOrderById(userId: string, orderId: string): Promise<WebOrderRecord | null> {
  const orders = await getWebOrders(userId);
  const cleanId = String(orderId).trim().toLowerCase();
  return orders.find(o => 
    o.id.toLowerCase() === cleanId || 
    String(o.orderNumber || '').toLowerCase() === cleanId ||
    String(o.wooOrderId || '').toLowerCase() === cleanId ||
    String(o.shopifyOrderId || '').toLowerCase() === cleanId
  ) || null;
}

/**
 * Save or update a Web Order in the local database ONLY.
 * NEVER makes outgoing mutation requests to Shopify or WooCommerce.
 */
export async function saveWebOrder(userId: string, order: Partial<WebOrderRecord> & { id: string }): Promise<WebOrderRecord> {
  const orders = await getWebOrders(userId);
  const now = new Date().toISOString();
  
  const existingIndex = orders.findIndex(o => (
    o.id === order.id || 
    (order.wooSiteId && o.wooSiteId === order.wooSiteId && String(o.wooOrderId) === String(order.wooOrderId)) ||
    (order.shopifySiteId && o.shopifySiteId === order.shopifySiteId && String(o.shopifyOrderId) === String(order.shopifyOrderId))
  ));

  let finalRecord: WebOrderRecord;

  if (existingIndex >= 0) {
    finalRecord = {
      ...orders[existingIndex],
      ...order,
      updatedAt: now
    };
    orders[existingIndex] = finalRecord;
  } else {
    finalRecord = {
      userId,
      source: order.source || 'manual',
      orderNumber: order.orderNumber || `WO-${Date.now()}`,
      status: order.status || 'pending',
      customerName: order.customerName || 'Customer',
      customerEmail: order.customerEmail || '',
      customerPhone: order.customerPhone || '',
      shippingAddress: order.shippingAddress || {},
      billingAddress: order.billingAddress || {},
      items: order.items || [],
      total: Number(order.total || 0),
      currency: order.currency || 'BDT',
      paymentMethod: order.paymentMethod || 'Cash on Delivery',
      isPaid: Boolean(order.isPaid),
      orderDate: order.orderDate || now,
      createdAt: order.createdAt || now,
      updatedAt: now,
      ...order,
      id: order.id
    } as WebOrderRecord;
    orders.unshift(finalRecord);
  }

  await writeJsonCollectionFile(userId, ORDERS_COLLECTION, orders);
  return finalRecord;
}

/**
 * Update Web Order Status strictly locally in database
 */
export async function updateWebOrderStatusLocal(
  userId: string, 
  orderId: string, 
  newStatus: string
): Promise<WebOrderRecord> {
  const order = await getWebOrderById(userId, orderId);
  if (!order) {
    throw new Error(`Web Order ${orderId} not found in database.`);
  }

  console.log(`[WEB_ORDER_DB] Updating status for Order #${order.orderNumber || order.id} to "${newStatus}" locally only. Remote store remains untouched.`);
  
  return await saveWebOrder(userId, {
    ...order,
    status: newStatus.toLowerCase().trim(),
    updatedAt: new Date().toISOString()
  });
}

/**
 * Update Web Order Custom Status strictly locally in database
 */
export async function updateWebOrderCustomStatusLocal(
  userId: string, 
  orderId: string, 
  customStatus: string
): Promise<WebOrderRecord> {
  const order = await getWebOrderById(userId, orderId);
  if (!order) {
    throw new Error(`Web Order ${orderId} not found in database.`);
  }

  return await saveWebOrder(userId, {
    ...order,
    custom_status: customStatus,
    customStatus: customStatus,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Delete a Web Order from database
 */
export async function deleteWebOrder(userId: string, orderId: string): Promise<boolean> {
  const orders = await getWebOrders(userId);
  const filtered = orders.filter(o => o.id !== orderId);
  if (filtered.length !== orders.length) {
    await writeJsonCollectionFile(userId, ORDERS_COLLECTION, filtered);
    return true;
  }
  return false;
}

/**
 * WooCommerce & Shopify Sites Management
 */
export async function getWooSites(userId: string): Promise<StoreSiteRecord[]> {
  return await readJsonCollectionFile(userId, WOO_SITES_COLLECTION);
}

export async function saveWooSite(userId: string, site: StoreSiteRecord): Promise<StoreSiteRecord> {
  const sites = await getWooSites(userId);
  const idx = sites.findIndex(s => s.id === site.id);
  if (idx >= 0) {
    sites[idx] = { ...sites[idx], ...site, updatedAt: new Date().toISOString() };
  } else {
    sites.push({ ...site, createdAt: site.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await writeJsonCollectionFile(userId, WOO_SITES_COLLECTION, sites);
  return site;
}

export async function deleteWooSite(userId: string, siteId: string): Promise<boolean> {
  const sites = await getWooSites(userId);
  const filtered = sites.filter(s => s.id !== siteId);
  await writeJsonCollectionFile(userId, WOO_SITES_COLLECTION, filtered);
  return filtered.length !== sites.length;
}

export async function getShopifySites(userId: string): Promise<StoreSiteRecord[]> {
  return await readJsonCollectionFile(userId, SHOPIFY_SITES_COLLECTION);
}

export async function saveShopifySite(userId: string, site: StoreSiteRecord): Promise<StoreSiteRecord> {
  const sites = await getShopifySites(userId);
  const idx = sites.findIndex(s => s.id === site.id);
  if (idx >= 0) {
    sites[idx] = { ...sites[idx], ...site, updatedAt: new Date().toISOString() };
  } else {
    sites.push({ ...site, createdAt: site.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() });
  }
  await writeJsonCollectionFile(userId, SHOPIFY_SITES_COLLECTION, sites);
  return site;
}

export async function deleteShopifySite(userId: string, siteId: string): Promise<boolean> {
  const sites = await getShopifySites(userId);
  const filtered = sites.filter(s => s.id !== siteId);
  await writeJsonCollectionFile(userId, SHOPIFY_SITES_COLLECTION, filtered);
  return filtered.length !== sites.length;
}
