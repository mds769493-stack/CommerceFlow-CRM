import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ override: true });

// Ensure fallback JSON data directory exists
const DATA_DIR = path.join(process.cwd(), 'data', 'collections');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// MySQL Connection Configuration from .env
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 3000 // Fast fail in 3 seconds to avoid cPanel timeout 503 errors
};

let pool: mysql.Pool | null = null;
let genericDbDisabledUntil = 0; // Cooldown timestamp to prevent hammering and hanging when DB is wrong
let initPromise: Promise<mysql.Pool | null> | null = null;

function triggerCooldown() {
  console.warn('[DB] Triggering 30-second database bypass cooldown.');
  genericDbDisabledUntil = Date.now() + 30000;
  pool = null; // Reset pool to retry connection after cooldown expires
}

export const getDatabase = async () => {
  const now = Date.now();
  if (genericDbDisabledUntil > now) {
    return null; // Bypassed during cooldown
  }

  if (pool) {
    return pool;
  }

  if (initPromise) {
    return initPromise;
  }

  if (!dbConfig.user || !dbConfig.database) {
    console.warn(`[DB] MySQL credentials missing or empty (user: ${dbConfig.user}, db: ${dbConfig.database}). Falling back to local JSON persistence.`);
    return null;
  }

  console.log(`[DB] Initializing pool with user: ${dbConfig.user}, database: ${dbConfig.database}, host: ${dbConfig.host}`);

  initPromise = (async () => {
    try {
      console.log('[DB] Attempting to connect & initialize MySQL pool...');
      const tempPool = mysql.createPool(dbConfig);
      pool = tempPool; // Temporarily assign so initializeSchema can find it
      await initializeSchema();
      console.log('[DB] Database pool initialized successfully.');
      return tempPool;
    } catch (err: any) {
      console.warn('[DB] MySQL pool initialized in offline mode (local JSON fallback active):', err ? err.message : '');
      triggerCooldown();
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
};

// Initialize the individual module tables and generic collections table
async function initializeSchema() {
  if (!pool) return;
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('[DB] Ensuring modular MySQL tables exist...');
    
    // 1. Generic Collections
    await conn.query(`
      CREATE TABLE IF NOT EXISTS collections (
        user_id VARCHAR(255),
        collection_name VARCHAR(100),
        item_id VARCHAR(255),
        data JSON,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, collection_name, item_id)
      )
    `);

    // 2. Custom Users
    await conn.query(`
      CREATE TABLE IF NOT EXISTS custom_users (
        uid VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        email VARCHAR(255),
        passwordHash TEXT,
        createdAt VARCHAR(100)
      )
    `);

    // 3. Web Orders Table (WooCommerce & Shopify)
    await conn.query(`
      CREATE TABLE IF NOT EXISTS web_orders (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        order_number VARCHAR(100),
        source VARCHAR(50),
        status VARCHAR(50),
        custom_status VARCHAR(50),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        total DECIMAL(10, 2),
        is_paid TINYINT(1) DEFAULT 0,
        order_date VARCHAR(100),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_web_orders (user_id)
      )
    `);

    // 4. Order List Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_list (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        invoice VARCHAR(100),
        customer VARCHAR(255),
        phone VARCHAR(50),
        total DECIMAL(10, 2),
        status VARCHAR(50),
        courier VARCHAR(100),
        consignment_id VARCHAR(100),
        date VARCHAR(100),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_orders (user_id)
      )
    `);

    // 5. Products Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        name VARCHAR(255),
        sku VARCHAR(100),
        category VARCHAR(100),
        regular_price DECIMAL(10, 2),
        sale_price DECIMAL(10, 2),
        stock INT DEFAULT 0,
        status VARCHAR(50),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_products (user_id)
      )
    `);

    // 6. Follow-ups Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS followups (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        invoice VARCHAR(100),
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        status VARCHAR(50),
        amount DECIMAL(10, 2),
        next_followup_date VARCHAR(100),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_followups (user_id)
      )
    `);

    // 7. Expenses Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        category VARCHAR(100),
        description TEXT,
        amount DECIMAL(10, 2),
        group_name VARCHAR(50),
        date VARCHAR(100),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_expenses (user_id)
      )
    `);

    // 8. Fraud Check History Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS fraud_check_history (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        phone VARCHAR(50),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_fraud (user_id)
      )
    `);

    // 9. Shopify & WooCommerce Sites Tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS shopify_sites (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        name VARCHAR(255),
        store_url VARCHAR(255),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_shopify_sites (user_id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS woocommerce_sites (
        id VARCHAR(255) PRIMARY KEY,
        user_id VARCHAR(255),
        name VARCHAR(255),
        store_url VARCHAR(255),
        data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_woo_sites (user_id)
      )
    `);

    console.log('[DB] Modular MySQL Tables initialized successfully.');

    // Auto-migrate any existing rows from collections table to dedicated tables
    try {
      const [collRows]: any = await conn.query('SELECT user_id, collection_name, item_id, data FROM collections');
      if (Array.isArray(collRows) && collRows.length > 0) {
        for (const row of collRows) {
          const item = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
          await syncItemToDedicatedTable(conn, row.user_id, row.collection_name, row.item_id, item);
        }
      }
    } catch (migErr: any) {
      console.warn('[DB] Auto-migration check completed:', migErr ? migErr.message : '');
    }

  } catch (err: any) {
    console.warn('[DB] Schema connection offline:', err ? err.message : '');
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

// Helper to sync to dedicated modular MySQL table
async function syncItemToDedicatedTable(dbOrConn: any, userId: string, collection: string, itemId: string, item: any) {
  if (!dbOrConn || !item) return;
  const jsonStr = JSON.stringify(item);
  const norm = collection.toLowerCase().trim();

  try {
    if (norm === 'woocommerce_orders' || norm === 'shopify_orders' || norm === 'web_orders') {
      await dbOrConn.query(`
        INSERT INTO web_orders (id, user_id, order_number, source, status, custom_status, customer_name, customer_phone, total, is_paid, order_date, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          order_number = VALUES(order_number),
          source = VALUES(source),
          status = VALUES(status),
          custom_status = VALUES(custom_status),
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          total = VALUES(total),
          is_paid = VALUES(is_paid),
          order_date = VALUES(order_date),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.orderNumber || item.invoice || '',
        item.source || 'woocommerce',
        item.status || 'pending',
        item.custom_status || item.customStatus || '',
        item.customerName || item.customer || '',
        item.customerPhone || item.phone || '',
        Number(item.total || 0),
        item.isPaid ? 1 : 0,
        item.orderDate || item.date || item.createdAt || '',
        jsonStr
      ]);
    } else if (norm === 'orders' || norm === 'order_list') {
      await dbOrConn.query(`
        INSERT INTO order_list (id, user_id, invoice, customer, phone, total, status, courier, consignment_id, date, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          invoice = VALUES(invoice),
          customer = VALUES(customer),
          phone = VALUES(phone),
          total = VALUES(total),
          status = VALUES(status),
          courier = VALUES(courier),
          consignment_id = VALUES(consignment_id),
          date = VALUES(date),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.invoice || '',
        item.customer || item.customerName || '',
        item.phone || '',
        Number(item.total || 0),
        item.status || 'Pending',
        item.courier || '',
        item.consignmentId || '',
        item.date || item.createdAt || '',
        jsonStr
      ]);
    } else if (norm === 'products' || norm === 'product') {
      await dbOrConn.query(`
        INSERT INTO products (id, user_id, name, sku, category, regular_price, sale_price, stock, status, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          sku = VALUES(sku),
          category = VALUES(category),
          regular_price = VALUES(regular_price),
          sale_price = VALUES(sale_price),
          stock = VALUES(stock),
          status = VALUES(status),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.name || '',
        item.sku || '',
        item.category || '',
        Number(item.regularPrice || 0),
        Number(item.salePrice || item.regularPrice || 0),
        Number(item.stock || 0),
        item.status || 'In Stock',
        jsonStr
      ]);
    } else if (norm === 'followups' || norm === 'follow_ups') {
      await dbOrConn.query(`
        INSERT INTO followups (id, user_id, invoice, customer_name, customer_phone, status, amount, next_followup_date, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          invoice = VALUES(invoice),
          customer_name = VALUES(customer_name),
          customer_phone = VALUES(customer_phone),
          status = VALUES(status),
          amount = VALUES(amount),
          next_followup_date = VALUES(next_followup_date),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.invoice || '',
        item.customerName || '',
        item.customerPhone || '',
        item.status || 'Pending',
        Number(item.amount || 0),
        item.nextFollowUpDate || '',
        jsonStr
      ]);
    } else if (norm === 'expenses') {
      await dbOrConn.query(`
        INSERT INTO expenses (id, user_id, category, description, amount, group_name, date, data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          category = VALUES(category),
          description = VALUES(description),
          amount = VALUES(amount),
          group_name = VALUES(group_name),
          date = VALUES(date),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.category || 'General',
        item.description || '',
        Number(item.amount || 0),
        item.group || 'Daily',
        item.date || '',
        jsonStr
      ]);
    } else if (norm === 'fraud_check_history' || norm === 'fraud_checks') {
      await dbOrConn.query(`
        INSERT INTO fraud_check_history (id, user_id, phone, data)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          phone = VALUES(phone),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.phone || '',
        jsonStr
      ]);
    } else if (norm === 'shopify_sites') {
      await dbOrConn.query(`
        INSERT INTO shopify_sites (id, user_id, name, store_url, data)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          store_url = VALUES(store_url),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.name || '',
        item.storeUrl || '',
        jsonStr
      ]);
    } else if (norm === 'woocommerce_sites') {
      await dbOrConn.query(`
        INSERT INTO woocommerce_sites (id, user_id, name, store_url, data)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          store_url = VALUES(store_url),
          data = VALUES(data)
      `, [
        itemId,
        userId,
        item.name || '',
        item.storeUrl || '',
        jsonStr
      ]);
    }
  } catch (err: any) {
    console.warn(`[DB DEDICATED TABLE SYNC ERROR] ${collection}:`, err ? err.message : '');
  }
}

// Helper to delete from dedicated modular MySQL table
async function deleteFromDedicatedTable(dbOrConn: any, userId: string, collection: string, itemId: string) {
  if (!dbOrConn) return;
  const norm = collection.toLowerCase().trim();
  const tableMap: Record<string, string> = {
    'woocommerce_orders': 'web_orders',
    'shopify_orders': 'web_orders',
    'web_orders': 'web_orders',
    'orders': 'order_list',
    'order_list': 'order_list',
    'products': 'products',
    'product': 'products',
    'followups': 'followups',
    'follow_ups': 'followups',
    'expenses': 'expenses',
    'fraud_check_history': 'fraud_check_history',
    'shopify_sites': 'shopify_sites',
    'woocommerce_sites': 'woocommerce_sites'
  };

  const tableName = tableMap[norm];
  if (tableName) {
    try {
      await dbOrConn.query(`DELETE FROM ${tableName} WHERE id = ? AND user_id = ?`, [itemId, userId]);
    } catch (_) {}
  }
}

import { readJsonCollectionFile, writeJsonCollectionFile, DATA_BASE_DIR, MODULE_DIRS } from './db/fileStorage.ts';

// Helper functions to read/write modular JSON collection files
async function readLocalCollection(userId: string, collection: string): Promise<any[]> {
  return await readJsonCollectionFile(userId, collection);
}

async function writeLocalCollection(userId: string, collection: string, items: any[]): Promise<void> {
  return await writeJsonCollectionFile(userId, collection, items);
}

// 1. readData
export async function readData(userId: string, collection: string) {
  const db = await getDatabase();
  const localItems = await readLocalCollection(userId, collection);

  if (!db) {
    return localItems;
  }
  
  try {
    const [rows]: any = await db.query(
      'SELECT data FROM collections WHERE user_id = ? AND collection_name = ?',
      [userId, collection]
    );
    const dbData = rows.map((r: any) => typeof r.data === 'string' ? JSON.parse(r.data) : r.data);

    // Merge DB data with local JSON data if local file contains entries saved during DB offline windows
    if (localItems.length > 0) {
      const mergedMap = new Map<string, any>();
      for (const item of dbData) {
        const key = item.internalId || item.id;
        if (key) mergedMap.set(key, item);
      }
      for (const item of localItems) {
        const key = item.internalId || item.id;
        if (!key) continue;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, item);
          // Sync missing item back to MySQL asynchronously
          db.query(
            'INSERT INTO collections (user_id, collection_name, item_id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = ?',
            [userId, collection, key, JSON.stringify(item), JSON.stringify(item)]
          ).catch(() => {});
        } else {
          const existing = mergedMap.get(key);
          const timeExisting = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
          const timeLocal = new Date(item.updatedAt || item.createdAt || 0).getTime();
          if (timeLocal >= timeExisting) {
            mergedMap.set(key, item);
            db.query(
              'INSERT INTO collections (user_id, collection_name, item_id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = ?',
              [userId, collection, key, JSON.stringify(item), JSON.stringify(item)]
            ).catch(() => {});
          }
        }
      }
      return Array.from(mergedMap.values());
    }

    return dbData;
  } catch (err) {
    console.warn(`[DB INFO] readData ${collection} using local file fallback.`);
    triggerCooldown();
    return localItems;
  }
}

// 2. addToCollection
export async function addToCollection(userId: string, collection: string, item: any) {
  const db = await getDatabase();
  const id = item.id || item.internalId || `gen_${Date.now()}`;
  
  // Ensure the item object itself has normalized id and internalId
  item.id = id;
  item.internalId = item.internalId || id;
  
  // ALWAYS save to local JSON file as persistent storage & backup
  const localItems = await readLocalCollection(userId, collection);
  const existingIndex = localItems.findIndex((i: any) => (
    (i.id && id && i.id === id) ||
    (i.internalId && id && i.internalId === id) ||
    (item.internalId && i.internalId && i.internalId === item.internalId) ||
    (item.orderId && i.orderId && i.orderId.toLowerCase() === item.orderId.toLowerCase()) ||
    (item.consignmentId && i.consignmentId && i.consignmentId.toLowerCase() === item.consignmentId.toLowerCase())
  ));
  if (existingIndex >= 0) {
    localItems[existingIndex] = { ...localItems[existingIndex], ...item };
  } else {
    localItems.push(item);
  }
  await writeLocalCollection(userId, collection, localItems);

  if (!db) {
    return;
  }
  
  try {
    await db.query(
      'INSERT INTO collections (user_id, collection_name, item_id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = ?',
      [userId, collection, id, JSON.stringify(item), JSON.stringify(item)]
    );
    // Also sync to dedicated module table
    await syncItemToDedicatedTable(db, userId, collection, id, item);
  } catch (err: any) {
    console.warn(`[DB INFO] addToCollection ${collection} saved to local fallback (MySQL sync delayed):`, err ? err.message : '');
    triggerCooldown();
  }
}

// 3. deleteFromCollection
export async function deleteFromCollection(userId: string, collection: string, id: string) {
  const db = await getDatabase();

  // ALWAYS delete from local JSON fallback file
  const localItems = await readLocalCollection(userId, collection);
  const filtered = localItems.filter((i: any) => i.id !== id && i.internalId !== id);
  await writeLocalCollection(userId, collection, filtered);

  if (!db) {
    return;
  }
  
  try {
    await db.query(
      'DELETE FROM collections WHERE user_id = ? AND collection_name = ? AND item_id = ?',
      [userId, collection, id]
    );
    // Also delete from dedicated module table
    await deleteFromDedicatedTable(db, userId, collection, id);
  } catch (err: any) {
    console.warn(`[DB INFO] deleteFromCollection ${collection} removed from local fallback (MySQL sync delayed):`, err ? err.message : '');
    triggerCooldown();
  }
}

// 4. batchWriteToCollection
export async function batchWriteToCollection(userId: string, collection: string, items: any[], strategy: string = 'keep') {
  const db = await getDatabase();
  
  const sanitizedItems = items.map(item => {
    const id = item.id || item.internalId || `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return {
      ...item,
      id,
      internalId: item.internalId || id
    };
  });

  // ALWAYS write to local JSON fallback file
  const localItems = await readLocalCollection(userId, collection);
  for (const item of sanitizedItems) {
    const id = item.id;
    const existingIndex = localItems.findIndex((i: any) => (
      (i.id && id && i.id === id) ||
      (i.internalId && id && i.internalId === id) ||
      (item.internalId && i.internalId && i.internalId === item.internalId) ||
      (item.orderId && i.orderId && i.orderId.toLowerCase() === item.orderId.toLowerCase()) ||
      (item.consignmentId && i.consignmentId && i.consignmentId.toLowerCase() === item.consignmentId.toLowerCase())
    ));
    if (existingIndex >= 0) {
      localItems[existingIndex] = { ...localItems[existingIndex], ...item };
    } else {
      localItems.push(item);
    }
  }
  await writeLocalCollection(userId, collection, localItems);

  if (!db) {
    return;
  }
  
  try {
    for (const item of sanitizedItems) {
      const id = item.id;
      await db.query(
        'INSERT INTO collections (user_id, collection_name, item_id, data) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = ?',
        [userId, collection, id, JSON.stringify(item), JSON.stringify(item)]
      );
      // Also sync to dedicated module table
      await syncItemToDedicatedTable(db, userId, collection, id, item);
    }
  } catch (err: any) {
    console.warn(`[DB INFO] batchWriteToCollection ${collection} saved to local fallback (MySQL sync delayed):`, err ? err.message : '');
    triggerCooldown();
  }
}

// 5. batchDeleteFromCollection
export async function batchDeleteFromCollection(userId: string, collection: string, ids: string[]) {
  const db = await getDatabase();

  // ALWAYS delete from local JSON fallback file
  const localItems = await readLocalCollection(userId, collection);
  const filtered = localItems.filter((i: any) => !ids.includes(i.id) && !ids.includes(i.internalId));
  await writeLocalCollection(userId, collection, filtered);

  if (!db) {
    return;
  }
  
  try {
    if (ids.length === 0) return;
    await db.query(
      'DELETE FROM collections WHERE user_id = ? AND collection_name = ? AND item_id IN (?)',
      [userId, collection, ids]
    );
    for (const id of ids) {
      await deleteFromDedicatedTable(db, userId, collection, id);
    }
  } catch (err: any) {
    console.warn(`[DB INFO] batchDeleteFromCollection ${collection} removed from local fallback (MySQL sync delayed):`, err ? err.message : '');
    triggerCooldown();
  }
}

// 6. getAllUserIds
export async function getAllUserIds(): Promise<string[]> {
  const userSet = new Set<string>();

  // 1. Scan filesystem collections in all modular directories
  try {
    const dirsToScan = [
      DATA_DIR,
      MODULE_DIRS.web_orders,
      MODULE_DIRS.orders,
      MODULE_DIRS.products,
      MODULE_DIRS.followups,
      MODULE_DIRS.expenses,
      MODULE_DIRS.settings,
      MODULE_DIRS.legacy
    ];
    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.endsWith('.json') && !file.includes('.tmp.')) {
            const parts = file.slice(0, -5).split('_');
            if (parts.length >= 2) {
              const userId = parts[0];
              if (userId) userSet.add(userId);
            }
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('[DB INFO] Error scanning local user collection files:', err.message);
  }

  // 2. Query MySQL if available
  const db = await getDatabase();
  if (db) {
    try {
      const [collRows] = await db.query<any[]>('SELECT DISTINCT user_id FROM collections');
      if (Array.isArray(collRows)) {
        for (const row of collRows) {
          if (row.user_id) userSet.add(String(row.user_id));
        }
      }
      const [userRows] = await db.query<any[]>('SELECT uid FROM custom_users').catch(() => [[]]);
      if (Array.isArray(userRows)) {
        for (const row of userRows) {
          if (row.uid) userSet.add(String(row.uid));
        }
      }
    } catch (err: any) {
      console.warn('[DB INFO] Error querying users from MySQL:', err.message);
    }
  }

  // Default fallback user if set is empty
  if (userSet.size === 0) {
    userSet.add('default');
  }

  return Array.from(userSet);
}

// Support older function names if they exist in frontend
export const getCollection = readData;
export const saveToCollection = addToCollection;
export const batchSaveToCollection = batchWriteToCollection;
