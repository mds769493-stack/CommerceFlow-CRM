import fs from 'fs';
import path from 'path';

// Base Data directory
export const DATA_BASE_DIR = path.join(process.cwd(), 'data');

// Dedicated Module Subdirectories
export const MODULE_DIRS = {
  web_orders: path.join(DATA_BASE_DIR, 'web_orders'),
  orders: path.join(DATA_BASE_DIR, 'orders'),
  products: path.join(DATA_BASE_DIR, 'products'),
  followups: path.join(DATA_BASE_DIR, 'followups'),
  expenses: path.join(DATA_BASE_DIR, 'expenses'),
  settings: path.join(DATA_BASE_DIR, 'settings'),
  legacy: path.join(DATA_BASE_DIR, 'collections'),
};

// Ensure all modular data folders exist
for (const dir of Object.values(MODULE_DIRS)) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Maps collection name to its dedicated module directory
 */
export function getModuleDirForCollection(collection: string): string {
  const norm = collection.toLowerCase().trim();
  if (norm.includes('woo') || norm.includes('shopify') || norm.includes('web_order') || norm.includes('weborder')) {
    return MODULE_DIRS.web_orders;
  }
  if (norm === 'orders' || norm === 'order_list' || norm === 'orderlist') {
    return MODULE_DIRS.orders;
  }
  if (norm === 'products' || norm === 'product' || norm === 'inventory') {
    return MODULE_DIRS.products;
  }
  if (norm.includes('follow') || norm.includes('task') || norm.includes('statuslog') || norm.includes('status_log')) {
    return MODULE_DIRS.followups;
  }
  if (norm.includes('expense') || norm.includes('purchase')) {
    return MODULE_DIRS.expenses;
  }
  if (norm.includes('setting') || norm.includes('fraud_checker') || norm.includes('fraud_check')) {
    return MODULE_DIRS.settings;
  }
  return MODULE_DIRS.legacy;
}

/**
 * Resolve primary dedicated file path for a user's collection
 */
export function getFilePathForCollection(userId: string, collection: string): string {
  const dir = getModuleDirForCollection(collection);
  const safeUser = (userId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeColl = collection.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(dir, `${safeUser}_${safeColl}.json`);
}

/**
 * Resolve legacy fallback file path for a user's collection
 */
export function getLegacyFilePath(userId: string, collection: string): string {
  const safeUser = (userId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeColl = collection.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(MODULE_DIRS.legacy, `${safeUser}_${safeColl}.json`);
}

/**
 * Safely reads a JSON collection file from disk, checking dedicated module dir first then legacy dir.
 */
export async function readJsonCollectionFile(userId: string, collection: string): Promise<any[]> {
  const primaryPath = getFilePathForCollection(userId, collection);
  const legacyPath = getLegacyFilePath(userId, collection);

  // 1. If primary modular file exists, read it
  if (fs.existsSync(primaryPath)) {
    try {
      const content = await fs.promises.readFile(primaryPath, 'utf8');
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      console.error(`[DB FILE READ ERROR] Failed reading ${primaryPath}:`, err.message);
      return [];
    }
  }

  // 2. Fallback to legacy file and migrate if present
  if (fs.existsSync(legacyPath)) {
    try {
      const content = await fs.promises.readFile(legacyPath, 'utf8');
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed) ? parsed : [];
      
      // Auto-migrate to dedicated modular file
      if (items.length > 0) {
        await writeJsonCollectionFile(userId, collection, items);
      }
      return items;
    } catch (err: any) {
      console.error(`[DB FILE READ ERROR] Failed reading legacy ${legacyPath}:`, err.message);
      return [];
    }
  }

  return [];
}

/**
 * Safely writes a JSON collection file atomically with safe indentation
 */
export async function writeJsonCollectionFile(userId: string, collection: string, items: any[]): Promise<void> {
  const primaryPath = getFilePathForCollection(userId, collection);
  const tempPath = `${primaryPath}.tmp.${Date.now()}`;
  
  try {
    const parentDir = path.dirname(primaryPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const payload = JSON.stringify(items, null, 2);
    await fs.promises.writeFile(tempPath, payload, 'utf8');
    await fs.promises.rename(tempPath, primaryPath);
  } catch (err: any) {
    console.error(`[DB FILE WRITE ERROR] Failed writing to ${primaryPath}:`, err.message);
    if (fs.existsSync(tempPath)) {
      try { await fs.promises.unlink(tempPath); } catch (_) {}
    }
    throw err;
  }
}
