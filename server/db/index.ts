export * from './fileStorage.ts';
export * from './webOrdersDb.ts';
export * from './orderListDb.ts';
export * from './productsDb.ts';
export * from './followUpsDb.ts';
export * from './expensesDb.ts';

import { readJsonCollectionFile, writeJsonCollectionFile } from './fileStorage.ts';
import * as webOrdersDb from './webOrdersDb.ts';
import * as orderListDb from './orderListDb.ts';
import * as productsDb from './productsDb.ts';
import * as followUpsDb from './followUpsDb.ts';
import * as expensesDb from './expensesDb.ts';

/**
 * Universal router for readData delegating to specific module
 */
export async function readModularData(userId: string, collection: string): Promise<any[]> {
  const norm = collection.toLowerCase().trim();
  
  if (norm === 'woocommerce_orders' || norm === 'shopify_orders' || norm === 'web_orders') {
    return await webOrdersDb.getWebOrders(userId);
  }
  if (norm === 'woocommerce_sites') {
    return await webOrdersDb.getWooSites(userId);
  }
  if (norm === 'shopify_sites') {
    return await webOrdersDb.getShopifySites(userId);
  }
  if (norm === 'orders' || norm === 'order_list') {
    return await orderListDb.getOrders(userId);
  }
  if (norm === 'products' || norm === 'product') {
    return await productsDb.getProducts(userId);
  }
  if (norm === 'followups' || norm === 'follow_ups') {
    return await followUpsDb.getFollowUps(userId);
  }
  if (norm === 'statuslogs' || norm === 'status_logs') {
    return await followUpsDb.getStatusLogs(userId);
  }
  if (norm === 'expenses') {
    return await expensesDb.getExpenses(userId);
  }
  if (norm === 'settings') {
    return await expensesDb.getExpenseSettings(userId);
  }

  // Generic fallback
  return await readJsonCollectionFile(userId, collection);
}
