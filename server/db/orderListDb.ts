import { readJsonCollectionFile, writeJsonCollectionFile } from './fileStorage.ts';

export interface OrderItem {
  name: string;
  sku: string;
  qty: number;
  price: number;
  salePrice?: number;
  image?: string;
  [key: string]: any;
}

export interface OrderRecord {
  id: string;
  userId: string;
  invoice: string;
  customer: string;
  customerName?: string;
  phone: string;
  phoneSuccessRate?: number;
  address: string;
  city?: string;
  note?: string;
  shippingNote?: string;
  productName?: string;
  sku?: string;
  items: OrderItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  deliveryCharge: number;
  total: number;
  status: string;
  courier?: string;
  consignmentId?: string;
  trackingCode?: string;
  deliveryMethod?: string;
  webOrderId?: string;
  sourceOrderId?: string;
  source?: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

const ORDERS_COLLECTION = 'orders';

/**
 * Get all Orders in Order List
 */
export async function getOrders(userId: string): Promise<OrderRecord[]> {
  return await readJsonCollectionFile(userId, ORDERS_COLLECTION);
}

/**
 * Get single Order by ID or Invoice number
 */
export async function getOrderById(userId: string, idOrInvoice: string): Promise<OrderRecord | null> {
  const orders = await getOrders(userId);
  const clean = String(idOrInvoice).trim().toLowerCase();
  return orders.find(o => 
    o.id.toLowerCase() === clean || 
    String(o.invoice || '').toLowerCase() === clean ||
    String(o.consignmentId || '').toLowerCase() === clean
  ) || null;
}

/**
 * Generate next sequential invoice number AR-XXXXX
 */
export async function getNextInvoiceNumber(userId: string): Promise<string> {
  try {
    const orders = await getOrders(userId);
    let maxNum = 23804;
    for (const o of orders) {
      if (o && o.invoice) {
        const match = String(o.invoice).match(/AR-(\d+)/i);
        if (match) {
          const n = parseInt(match[1], 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      }
    }
    return `AR-${maxNum + 1}`;
  } catch (e) {
    return `AR-${23805 + Math.floor(Math.random() * 100)}`;
  }
}

/**
 * Save or update a single Order
 */
export async function saveOrder(userId: string, order: Partial<OrderRecord> & { id?: string }): Promise<OrderRecord> {
  const orders = await getOrders(userId);
  const now = new Date().toISOString();
  const id = order.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const invoice = order.invoice || await getNextInvoiceNumber(userId);

  const existingIndex = orders.findIndex(o => o.id === id || (order.invoice && o.invoice === order.invoice));
  let finalRecord: OrderRecord;

  if (existingIndex >= 0) {
    finalRecord = {
      ...orders[existingIndex],
      ...order,
      id: orders[existingIndex].id,
      updatedAt: now
    };
    orders[existingIndex] = finalRecord;
  } else {
    finalRecord = {
      id,
      userId,
      invoice,
      customer: order.customer || order.customerName || 'Customer',
      phone: order.phone || '',
      address: order.address || '',
      items: order.items || [],
      itemCount: order.items ? order.items.reduce((s, i) => s + (i.qty || 1), 0) : 1,
      subtotal: Number(order.subtotal || 0),
      discount: Number(order.discount || 0),
      deliveryCharge: Number(order.deliveryCharge || 130),
      total: Number(order.total || 0),
      status: order.status || 'Pending',
      date: order.date || now,
      createdAt: order.createdAt || now,
      updatedAt: now,
      ...order
    } as OrderRecord;
    orders.unshift(finalRecord);
  }

  await writeJsonCollectionFile(userId, ORDERS_COLLECTION, orders);
  return finalRecord;
}

/**
 * Batch save Orders
 */
export async function batchSaveOrders(userId: string, items: OrderRecord[], strategy: string = 'keep'): Promise<void> {
  const existing = await getOrders(userId);
  const now = new Date().toISOString();

  if (strategy === 'replace') {
    const formatted = items.map(it => ({
      ...it,
      id: it.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      updatedAt: now
    }));
    await writeJsonCollectionFile(userId, ORDERS_COLLECTION, formatted);
    return;
  }

  for (const item of items) {
    const id = item.id || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const idx = existing.findIndex(o => o.id === id || (item.invoice && o.invoice === item.invoice));
    if (idx >= 0) {
      existing[idx] = { ...existing[idx], ...item, updatedAt: now };
    } else {
      existing.unshift({ ...item, id, userId, updatedAt: now });
    }
  }

  await writeJsonCollectionFile(userId, ORDERS_COLLECTION, existing);
}

/**
 * Delete a single Order
 */
export async function deleteOrder(userId: string, id: string): Promise<boolean> {
  const orders = await getOrders(userId);
  const filtered = orders.filter(o => o.id !== id);
  if (filtered.length !== orders.length) {
    await writeJsonCollectionFile(userId, ORDERS_COLLECTION, filtered);
    return true;
  }
  return false;
}

/**
 * Batch delete Orders
 */
export async function batchDeleteOrders(userId: string, ids: string[]): Promise<void> {
  const orders = await getOrders(userId);
  const filtered = orders.filter(o => !ids.includes(o.id));
  await writeJsonCollectionFile(userId, ORDERS_COLLECTION, filtered);
}
