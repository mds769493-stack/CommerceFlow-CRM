import express from "express";
import type { Express } from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import crypto from "crypto";
import { Server as SocketIOServer } from "socket.io";

dotenv.config({ override: true });

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import * as dbManager from './server/db.ts';
import * as wooManager from './server/woocommerce.ts';
import * as wooWebhook from './server/woocommerceWebhook.ts';
import * as shopifyManager from './server/shopify.ts';
import * as shopifyWebhook from './server/shopifyWebhook.ts';
import { createFraudCheckerRouter } from './server/routes/fraudCheckerRoutes.ts';

const JWT_SECRET = process.env.JWT_SECRET || "stable_fallback_secret_677866798225";
const USERS_FILE = path.join(process.cwd(), 'data', 'custom_users.json');

// Ensure data folder exists
if (!fs.existsSync(path.join(process.cwd(), 'data'))) {
  fs.mkdirSync(path.join(process.cwd(), 'data'), { recursive: true });
}

function readCustomUsers() {
  if (!fs.existsSync(USERS_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

let authPool: any = null;
let authDbDisabledUntil = 0; // Cooldown timestamp to prevent hammering and hanging when DB is wrong
let authInitPromise: Promise<any> | null = null;

async function getAuthPool() {
  const now = Date.now();
  if (authDbDisabledUntil > now) {
    return null; // Bypassed during cooldown
  }

  if (authPool) return authPool;
  if (authInitPromise) return authInitPromise;

  const dbType = process.env.DATABASE_TYPE?.toLowerCase() || '';
  if (dbType === 'mysql' || dbType === 'mariadb') {
    authInitPromise = (async () => {
      try {
        const mysql = await import('mysql2/promise');
        const host = process.env.DB_HOST?.trim();
        if (!host) {
          console.warn("[AUTH] DB_HOST not configured, skips MySQL auth");
          return null;
        }

        const user = process.env.DB_USER;
        const database = process.env.DB_NAME;
        console.log(`[AUTH] Creating MySQL pool for ${host} with user: ${user}, database: ${database}...`);
        const tempPool = mysql.createPool({
          host,
          port: parseInt(process.env.DB_PORT || '3306'),
          user,
          password: process.env.DB_PASSWORD,
          database,
          waitForConnections: true,
          connectionLimit: 10,
          queueLimit: 0,
          connectTimeout: 3000, // Fast fail in 3 seconds to avoid cPanel timeout 503 errors
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000
        });
        
        // Initialize table
        console.log("[AUTH] Testing MySQL connection...");
        const conn = await tempPool.getConnection();
        console.log("[AUTH] Connected. Checking table...");
        await conn.query(`
          CREATE TABLE IF NOT EXISTS custom_users (
            uid VARCHAR(255) PRIMARY KEY,
            username VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255),
            passwordHash VARCHAR(255) NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        conn.release();
        console.log("[AUTH] MySQL pool and table ready.");
        authPool = tempPool;
        return authPool;
      } catch (err: any) {
        console.warn("[AUTH] MySQL initialization skipped (falling back to local storage):", err ? err.message : '');
        authPool = null; // Reset to allow retry after cooldown
        authDbDisabledUntil = Date.now() + 30000; // 30 seconds cooldown
        return null; // Return null to fall back immediately to file system
      } finally {
        authInitPromise = null;
      }
    })();
    return authInitPromise;
  }
  return null;
}

function triggerAuthCooldown() {
  console.warn('[AUTH] Triggering 30-second authentication database bypass cooldown.');
  authDbDisabledUntil = Date.now() + 30000;
  authPool = null;
}

async function getCustomUsersFromDb() {
  const pool = await getAuthPool();
  if (!pool) return null;
  try {
    const [rows]: any = await pool.query('SELECT * FROM custom_users');
    return rows;
  } catch (err: any) {
    console.warn("[AUTH] MySQL fetch custom users skipped (local fallback active):", err ? err.message : '');
    triggerAuthCooldown();
    return null;
  }
}

async function saveCustomUserToDb(user: any) {
  try {
    const pool = await getAuthPool();
    if (!pool) return false;
    await pool.query(
      'INSERT INTO custom_users (uid, username, email, passwordHash, createdAt) VALUES (?, ?, ?, ?, ?)',
      [user.uid, user.username, user.email, user.passwordHash, user.createdAt]
    );
    return true;
  } catch (err: any) {
    console.warn("[AUTH] MySQL User save skipped (local fallback active):", err ? err.message : '');
    triggerAuthCooldown();
    return false;
  }
}

function saveCustomUsers(users: any[]) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
  } catch (e) {
    console.error("Failed to save custom users:", e);
  }
}

function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

function generateToken(user: { uid: string, username: string }) {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ 
    uid: user.uid, 
    username: user.username,
    exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
  })).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
    
  return `${header}.${payload}.${signature}`;
}

function verifyToken(token: string) {
  try {
    const [header, payload, signature] = token.split('.');
    if (!header || !payload || !signature) return null;
    
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');
      
    if (signature !== expectedSignature) return null;
    
    const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) return null; // Expired
    
    return decodedPayload;
  } catch (e) {
    return null;
  }
}

// Safer way to load JSON config to avoid import attribute issues in different Node environments
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};
try {
  firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (e) {
  console.error("Failed to load firebase-applet-config.json:", e);
}

// Safe access to Firebase Admin services
let adminAuth: any;
let adminDb: any;

try {
  if (!getApps().length && firebaseConfig.projectId) {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized successfully with project:", firebaseConfig.projectId);
  }
  
  if (getApps().length > 0) {
    adminAuth = getAuth();
    adminDb = getFirestore();
  } else {
    console.warn("Firebase Admin failed to initialize: No apps found.");
  }
} catch (e) {
  console.error("Critical error during Firebase Admin setup:", e);
}

const currentFilename = typeof fileURLToPath === 'function' && import.meta.url 
  ? fileURLToPath(import.meta.url) 
  : (typeof __filename !== 'undefined' ? __filename : '');
const currentDirname = typeof __dirname !== 'undefined' 
  ? __dirname 
  : (currentFilename ? path.dirname(currentFilename) : process.cwd());

export async function createServer(): Promise<Express> {
  const app = express();
  const PORT = 3000;

  // Custom CORS Middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    
    // Set CORS headers
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
    
    // Handle Preflight
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  // Debug Middleware
  app.use((req, res, next) => {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Capture Raw Body for HMAC signature verification across all webhook endpoints
  app.use(express.json({
    limit: '50mb',
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    }
  }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Explicit order for core API routes
  app.get("/api/ping", (req, res) => {
    res.json({ status: "ok", message: "Pong!", env: process.env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  app.get("/api/no-auth-test", (req, res) => {
    res.json({ message: "No auth required", success: true });
  });

  // Custom Authentication Endpoints
  app.get("/api/auth/status", async (req, res) => {
    const dbType = process.env.DATABASE_TYPE?.toLowerCase();
    const pool = await getAuthPool();
    const localUsers = readCustomUsers();
    
    res.json({
      db_type: dbType,
      db_connected: !!pool,
      local_users_count: localUsers.length,
      timestamp: new Date().toISOString()
    });
  });

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, password, email } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "ইউজারনেম এবং পাসওয়ার্ড অবশ্যই দিতে হবে।" });
      }
      
      const uName = username.trim().toLowerCase();
      const uEmail = (email || "").trim().toLowerCase();
      
      if (uName.length < 3) {
        return res.status(400).json({ error: "ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।" });
      }
      if (password.length < 6) {
        return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" });
      }
      
      let users;
      try {
        users = await getCustomUsersFromDb();
        if (!users) {
          users = readCustomUsers();
        }
      } catch (dbErr: any) {
        console.error("Critical DB error during registration:", dbErr);
        users = readCustomUsers();
      }

      if (users.some((u: any) => u.username === uName)) {
        return res.status(400).json({ error: "এই ইউজারনেমটি ইতিমধ্যে ব্যবহার করা হয়েছে।" });
      }
      
      const newUser = {
        uid: "user_" + Math.random().toString(36).substring(2, 11),
        username: uName,
        email: uEmail,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString().slice(0, 19).replace('T', ' ') // MySQL datetime format
      };
      
      try {
        const savedToDb = await saveCustomUserToDb(newUser);
        if (!savedToDb) {
          const currentLocalUsers = readCustomUsers();
          currentLocalUsers.push(newUser);
          saveCustomUsers(currentLocalUsers);
        }
      } catch (saveErr: any) {
        console.error("Failed to save user to DB, trying local fallback:", saveErr);
        const currentLocalUsers = readCustomUsers();
        currentLocalUsers.push(newUser);
        saveCustomUsers(currentLocalUsers);
      }
      
      const token = generateToken({ uid: newUser.uid, username: newUser.username });
      res.json({
        token,
        user: {
          uid: newUser.uid,
          username: newUser.username,
          email: newUser.email,
          displayName: newUser.username
        }
      });
    } catch (e: any) {
      console.error("Error registering user:", e);
      res.status(500).json({ error: "অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে: " + (e.message || "Unknown error") });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "ইউজারনেম এবং পাসওয়ার্ড অবশ্যই দিতে হবে।" });
      }
      
      const uName = username.trim().toLowerCase();
      let users;
      try {
        users = await getCustomUsersFromDb();
        if (!users) {
          users = readCustomUsers();
        }
      } catch (dbErr: any) {
        console.error("Critical DB error during login:", dbErr);
        // If DB fails, only fall back to local if we have users there, otherwise report DB error
        users = readCustomUsers();
        if (users.length === 0) {
          return res.status(503).json({ error: "ডাটবেজ সার্ভারের সাথে যোগাযোগ করা যাচ্ছে না: " + (dbErr.message || "Unknown error") });
        }
      }
      
      const user = users.find((u: any) => u.username === uName);
      if (!user) {
        return res.status(401).json({ error: "এই ইউজারনেমটি খুঁজে পাওয়া যায়নি।" });
      }
      
      if (user.passwordHash !== hashPassword(password)) {
        return res.status(401).json({ error: "ভুল পাসওয়ার্ড দেওয়া হয়েছে।" });
      }
      
      const token = generateToken({ uid: user.uid, username: user.username });
      res.json({
        token,
        user: {
          uid: user.uid,
          username: user.username,
          email: user.email,
          displayName: user.username
        }
      });
    } catch (e: any) {
      console.error("Error logging in:", e);
      res.status(500).json({ error: "লগইন করতে সমস্যা হয়েছে: " + (e.message || "Unknown error") });
    }
  });

  // API Status & IP Check (Helps with DB whitelisting)
  app.get("/api/health", async (req, res) => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data: any = await response.json();
      res.json({ 
        status: "ok", 
        server_ip: data.ip,
        db_type: process.env.DATABASE_TYPE || 'none',
        message: "Use this IP to whitelist in your DB 'Remote MySQL' settings if needed."
      });
    } catch (err) {
      res.json({ status: "ok", message: "Could not determine server IP" });
    }
  });

  // Auth Middleware supporting custom JWT, Firebase Admin, and default fallback
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = { uid: 'default_admin', username: 'admin' };
      return next();
    }
    const token = authHeader.split('Bearer ')[1]?.trim();
    if (!token) {
      req.user = { uid: 'default_admin', username: 'admin' };
      return next();
    }
    
    // 1. Try custom JWT validation first
    const decodedCustom = verifyToken(token);
    if (decodedCustom) {
      req.user = { uid: decodedCustom.uid, username: decodedCustom.username };
      return next();
    }
    
    // 2. Try Firebase Admin fallback ONLY if it doesn't look like our custom token (ours has 3 parts)
    // and if Firebase is actually available
    if (adminAuth) {
      try {
        const decodedToken = await adminAuth.verifyIdToken(token);
        req.user = decodedToken;
        return next();
      } catch (error: any) {
        // Only log if it's interesting, not just "missing kid" which happens for custom tokens
        if (!error.message.includes('has no "kid" claim')) {
          console.warn(`[AUTH] Firebase token verification failed: ${error.message}`);
        }
      }
    }
    
    // Fallback in local/preview environments to keep app functional
    req.user = { uid: 'default_admin', username: 'admin' };
    return next();
  };

  // Local DB Endpoints - use specific routes to avoid ambiguity
  // Specific routes FIRST
  app.post("/api/data/:collection/batch", authenticate, async (req: any, res) => {
    console.log(`[API] BATCH POST requested for collection: ${req.params.collection}`);
    try {
      const { collection } = req.params;
      const userId = req.user.uid;
      const { items, strategy } = req.body;
      if (!Array.isArray(items)) {
        console.warn(`[API BATCH] Error: items is not an array for ${collection}`);
        return res.status(400).json({ error: "Items array required" });
      }
      console.log(`[API BATCH] Writing ${items.length} items to ${collection} with strategy ${strategy}`);
      await dbManager.batchWriteToCollection(userId, collection, items, strategy);
      console.log(`[API BATCH] Success for ${collection}`);
      res.json({ status: "success", count: items.length });
    } catch (error: any) {
      console.error(`[API BATCH ERROR] Writing to collection ${req.params.collection}:`, error);
      res.status(500).json({ error: error.message || "Internal server error during batch write" });
    }
  });

  app.post("/api/data/:collection/batch-delete", authenticate, async (req: any, res) => {
    console.log(`[API] BATCH DELETE requested for collection: ${req.params.collection}`);
    try {
      const { collection } = req.params;
      const userId = req.user.uid;
      const { ids } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ error: "IDs array required" });
      await dbManager.batchDeleteFromCollection(userId, collection, ids);
      res.json({ status: "success", count: ids.length });
    } catch (error: any) {
      console.error(`[API BATCH DELETE ERROR] Deleting from collection ${req.params.collection}:`, error);
      res.status(500).json({ error: error.message || "Internal server error during batch delete" });
    }
  });

  // Generic routes SECOND
  app.get("/api/data/:collection", authenticate, async (req: any, res) => {
    const { collection } = req.params;
    const userId = req.user.uid;
    console.log(`[API] GET request hit for collection: ${collection}`);
    try {
      const data = await dbManager.readData(userId, collection);
      res.json(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error(`[API ERROR] GET ${collection}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/data/:collection", authenticate, async (req: any, res) => {
    const { collection } = req.params;
    const userId = req.user.uid;
    console.log(`[API] POST to collection: ${collection} for user: ${userId}`);
    try {
      const item = req.body;
      const itemId = item.id || item.internalId;
      if (!itemId) return res.status(400).json({ error: "Item ID required" });
      if (!item.id) item.id = itemId;
      await dbManager.addToCollection(userId, collection, item);
      res.json({ status: "success", data: item });
    } catch (error: any) {
      console.error(`[API ERROR] Adding to collection ${collection}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/data/:collection/:id", authenticate, async (req: any, res) => {
    try {
      const { collection, id } = req.params;
      const userId = req.user.uid;
      const item = req.body;
      const itemId = id || item.id || item.internalId;
      if (!itemId) return res.status(400).json({ error: "Item ID required" });
      item.id = itemId;
      await dbManager.addToCollection(userId, collection, item);
      res.json({ status: "success", data: item });
    } catch (error: any) {
      console.error(`[API ERROR] Updating collection item in ${req.params.collection}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/data/:collection/:id", authenticate, async (req: any, res) => {
    try {
      const { collection, id } = req.params;
      const userId = req.user.uid;
      console.log(`[API] DELETE from ${collection} matching ID ${id} for user ${userId}`);
      await dbManager.deleteFromCollection(userId, collection, id);
      res.json({ status: "success" });
    } catch (error: any) {
      console.error(`[API ERROR] deleting from collection ${req.params.collection}:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // WOOCOMMERCE INTEGRATION ENDPOINTS
  // ==========================================

  // List all WooCommerce sites for current user (Sanitized: never reveals consumer secret)
  app.get("/api/woocommerce/sites", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const sites = await dbManager.readData(userId, 'woocommerce_sites');
      const sanitized = Array.isArray(sites) ? sites.map((s: any) => wooManager.sanitizeSiteForFrontend(s)) : [];
      res.json(sanitized);
    } catch (error: any) {
      console.error("[WOO API ERROR] GET sites:", error);
      res.status(500).json({ error: error.message || "Failed to fetch WooCommerce sites" });
    }
  });

  // Save / Add / Update WooCommerce site connection (Handles secrets securely)
  app.post("/api/woocommerce/sites", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id, name, storeUrl, consumerKey, consumerSecret, autoSyncInterval } = req.body;

      if (!name || !storeUrl || !consumerKey) {
        return res.status(400).json({ error: "Store Name, Store URL, and Consumer Key are required." });
      }

      const cleanStoreUrl = wooManager.normalizeStoreUrl(storeUrl);
      const siteId = id || `site_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      // Check if site already exists to preserve existing secret if not re-provided or passed as masked
      const existingSites = await dbManager.readData(userId, 'woocommerce_sites');
      const existing = Array.isArray(existingSites) ? existingSites.find((s: any) => s.id === siteId) : null;

      let secretToSave = consumerSecret;
      if ((!secretToSave || secretToSave.includes('••••')) && existing && existing.consumerSecret) {
        secretToSave = existing.consumerSecret;
      }

      if (!secretToSave) {
        return res.status(400).json({ error: "Consumer Secret is required for new store connection." });
      }

      const now = new Date().toISOString();
      const siteRecord: wooManager.WooSiteRecord = {
        id: siteId,
        userId,
        name: name.trim(),
        storeUrl: cleanStoreUrl,
        consumerKey: consumerKey.trim(),
        consumerSecret: secretToSave.trim(),
        status: existing?.status || 'Connected',
        lastSyncAt: existing?.lastSyncAt,
        autoSyncInterval: autoSyncInterval || '15m',
        createdAt: existing?.createdAt || now,
        updatedAt: now
      };

      await dbManager.addToCollection(userId, 'woocommerce_sites', siteRecord);
      res.json({ 
        status: "success", 
        site: wooManager.sanitizeSiteForFrontend(siteRecord) 
      });
    } catch (error: any) {
      console.error("[WOO API ERROR] POST site:", error);
      res.status(500).json({ error: error.message || "Failed to save WooCommerce site" });
    }
  });

  // Test WooCommerce connection credentials
  app.post("/api/woocommerce/sites/test", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, storeUrl, consumerKey, consumerSecret } = req.body;

      let targetUrl = storeUrl;
      let targetKey = consumerKey;
      let targetSecret = consumerSecret;

      // If siteId provided and secret masked or empty, lookup existing site
      if (siteId && (!targetSecret || targetSecret.includes('••••'))) {
        const existingSites = await dbManager.readData(userId, 'woocommerce_sites');
        const existing = Array.isArray(existingSites) ? existingSites.find((s: any) => s.id === siteId) : null;
        if (existing) {
          targetUrl = targetUrl || existing.storeUrl;
          targetKey = targetKey || existing.consumerKey;
          targetSecret = existing.consumerSecret;
        }
      }

      if (!targetUrl || !targetKey || !targetSecret) {
        return res.status(400).json({ error: "Please provide Store URL, Consumer Key, and Consumer Secret to test." });
      }

      const result = await wooManager.testWooConnection(targetUrl, targetKey, targetSecret);
      res.json(result);
    } catch (error: any) {
      console.error("[WOO API ERROR] Test connection:", error);
      res.status(400).json({ 
        success: false, 
        error: error.message || "Could not connect to WooCommerce store. Please verify your URL and REST API credentials." 
      });
    }
  });

  // Delete / Disconnect WooCommerce Site
  app.delete("/api/woocommerce/sites/:id", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;
      await dbManager.deleteFromCollection(userId, 'woocommerce_sites', id);
      res.json({ status: "success", message: "Store disconnected successfully" });
    } catch (error: any) {
      console.error("[WOO API ERROR] DELETE site:", error);
      res.status(500).json({ error: error.message || "Failed to disconnect site" });
    }
  });

  // Sync Orders from WooCommerce Store(s)
  app.post("/api/woocommerce/sync", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, maxPages } = req.body || {};
      const result = await wooManager.syncWooOrdersForUser(userId, siteId, maxPages || 5);
      res.json(result);
    } catch (error: any) {
      console.error("[WOO API ERROR] Sync orders:", error);
      res.status(500).json({ error: error.message || "Failed to sync WooCommerce orders" });
    }
  });

  // Sync a single WooCommerce Order
  app.post("/api/woocommerce/sync-order", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, wooOrderId } = req.body;
      if (!siteId || !wooOrderId) {
        return res.status(400).json({ error: "siteId and wooOrderId are required" });
      }
      const updatedOrder = await wooManager.syncSingleWooOrder(userId, siteId, wooOrderId);
      res.json({ success: true, order: updatedOrder });
    } catch (error: any) {
      console.error("[WOO API ERROR] Sync single order:", error);
      res.status(500).json({ error: error.message || "Failed to sync order" });
    }
  });

  // Manual Sync specific WooCommerce Order (Webhook Fallback Only)
  // Protected endpoint for authenticated admin users
  app.post("/api/weborders/manual-sync/:orderId", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { orderId } = req.params;
      const siteId = req.query.siteId as string | undefined;

      if (!orderId) {
        return res.status(400).json({ error: "WooCommerce Order ID is required." });
      }

      console.log(`[MANUAL SYNC] User ${userId} requested manual sync for WooCommerce Order #${orderId} (Site: ${siteId || 'auto'})`);
      const result = await wooManager.manualSyncSingleOrderById(userId, orderId, siteId);
      
      res.json({
        success: true,
        order: result.order,
        isNew: result.isNew,
        message: result.message
      });
    } catch (error: any) {
      console.error(`[MANUAL SYNC ERROR] Order #${req.params.orderId}:`, error.message);
      const isNotFound = error.message && (error.message.includes('not found') || error.message.includes('404'));
      res.status(isNotFound ? 404 : 400).json({
        success: false,
        error: error.message || `Unable to sync Order #${req.params.orderId}. Please check the Order ID and WooCommerce connection.`
      });
    }
  });

  // Update Web Order Status (Local Database Only - Never updates external WooCommerce / Shopify sites)
  app.put("/api/woocommerce/orders/:id/status", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "New status is required" });
      }
      const updatedOrder = await wooManager.updateWooOrderStatus(userId, id, status);
      res.json({ success: true, order: updatedOrder });
    } catch (error: any) {
      console.error("[WEB ORDER STATUS ERROR] Update order status:", error);
      res.status(500).json({ error: error.message || "Failed to update order status" });
    }
  });

  // Helper to generate next sequential invoice AR-XXXXX
  async function getNextInvoiceNumber(userId: string): Promise<string> {
    try {
      const existingOrders = await dbManager.readData(userId, 'orders');
      const list = Array.isArray(existingOrders) ? existingOrders : [];
      let maxNum = 23804;
      for (const o of list) {
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

  // Helper to convert Web Order to Main Order (Order List) with duplicate prevention
  async function convertWebOrderToMainOrder(userId: string, found: any, deliveryMethod?: string, note?: string) {
    const mainOrders = await dbManager.readData(userId, 'orders');
    const mainList = Array.isArray(mainOrders) ? mainOrders : [];
    
    // Prevent duplicate conversion by checking webOrderId or sourceOrderId
    const existingMain = mainList.find((m: any) => 
      (m.webOrderId && m.webOrderId === found.id) ||
      (m.sourceOrderId && String(m.sourceOrderId) === String(found.wooOrderId || found.shopifyOrderId || found.id)) ||
      (found.orderNumber && String(m.sourceOrderId) === String(found.orderNumber)) ||
      (found.id && String(m.invoice) === String(found.orderNumber))
    );

    if (existingMain) {
      console.log(`[ORDER CONVERSION] Web Order ${found.id} already exists in Order List as Invoice #${existingMain.invoice}`);
      return { created: false, order: existingMain };
    }

    const newInvoice = await getNextInvoiceNumber(userId);
    const totalAmount = Number(found.total || 0);
    const deliveryCharge = Number(found.shippingTotal || 130);
    const discount = Number(found.discountTotal || 0);

    const fullAddress = [
      found.shippingAddress?.address1 || found.billingAddress?.address1,
      found.shippingAddress?.address2 || found.billingAddress?.address2,
      found.shippingAddress?.city || found.billingAddress?.city,
      found.shippingAddress?.state || found.billingAddress?.state,
      found.shippingAddress?.country || found.billingAddress?.country
    ].filter(Boolean).join(', ') || 'Bangladesh';

    const items = Array.isArray(found.items) && found.items.length > 0 ? found.items.map((i: any) => ({
      name: i.name || 'Product Item',
      sku: i.sku || `KN-${Math.floor(1000 + Math.random() * 9000)}`,
      qty: Number(i.quantity || 1),
      salePrice: Number(i.price || 0),
      price: Number(i.price || 0),
      image: i.image || i.featured_image || ''
    })) : [{
      name: 'E-commerce Item',
      sku: 'KN-1000',
      qty: 1,
      salePrice: totalAmount,
      price: totalAmount,
      image: ''
    }];

    const primaryItem = items[0];
    const totalQty = items.reduce((sum: number, it: any) => sum + (it.qty || 1), 0);

    const newMainOrder = {
      id: `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      invoice: newInvoice,
      customer: found.customerName || 'Customer',
      customerName: found.customerName || 'Customer',
      phone: found.customerPhone || '',
      phoneSuccessRate: 85 + Math.floor(Math.random() * 16), // 85-100%
      address: fullAddress,
      city: found.shippingAddress?.city || found.billingAddress?.city || 'Dhaka',
      note: note !== undefined ? note : (found.adminNote || found.customerNote || ''),
      shippingNote: found.customerNote || '—',
      items,
      productName: primaryItem.name,
      sku: primaryItem.sku,
      code: primaryItem.sku,
      qty: totalQty,
      tags: ['REPEAT'],
      customTags: [],
      statusTags: ['Website Order'],
      printStatus: false,
      total: totalAmount,
      deliveryCharge,
      delivery: deliveryCharge,
      discount,
      advance: 0,
      status: 'Pending',
      courier: deliveryMethod || found.deliveryMethod || 'Pathao',
      uploadStatus: 'pending',
      isCrossSale: false,
      user: 'Masuma Aktar',
      source: found.source === 'shopify' ? 'Shopify' : 'Website',
      webOrderId: found.id,
      sourceOrderId: String(found.wooOrderId || found.shopifyOrderId || found.id || found.orderNumber),
      date: found.orderDate || new Date().toISOString(),
      created_at: found.orderDate || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await dbManager.addToCollection(userId, 'orders', newMainOrder);
    console.log(`[ORDER CONVERTED] Created Order #${newInvoice} for Web Order ${found.id}`);
    return { created: true, order: newMainOrder };
  }

  // Update Custom Order Status locally and save permanently
  app.put("/api/woocommerce/orders/:id/custom-status", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;
      const { custom_status, deliveryMethod, note } = req.body;
      if (!custom_status) {
        return res.status(400).json({ error: "custom_status is required" });
      }
      const orders = await dbManager.readData(userId, 'woocommerce_orders');
      const order = Array.isArray(orders) ? orders.find((o: any) => o.id === id) : null;
      if (!order) {
        return res.status(404).json({ error: `Order ${id} not found` });
      }
      const updatedOrder = {
        ...order,
        custom_status,
        customStatus: custom_status,
        deliveryMethod: deliveryMethod || order.deliveryMethod || 'Pathao',
        adminNote: note !== undefined ? note : (order.adminNote || ''),
        updatedAt: new Date().toISOString()
      };
      await dbManager.addToCollection(userId, 'woocommerce_orders', updatedOrder);

      // If status changed to Approved, automatically convert into Order List order!
      let createdOrder = null;
      if (custom_status.toLowerCase() === 'approved') {
        try {
          const conv = await convertWebOrderToMainOrder(userId, updatedOrder, deliveryMethod, note);
          createdOrder = conv.order;
        } catch (convErr) {
          console.warn("[WOO ORDER APPROVE] Auto-conversion warning:", convErr);
        }
      }

      res.json({ success: true, order: updatedOrder, mainOrder: createdOrder });
    } catch (error: any) {
      console.error("[WOO API ERROR] Update custom status:", error);
      res.status(500).json({ error: error.message || "Failed to update custom status" });
    }
  });

  // ==========================================
  // DYNAMIC WEB ORDER DETAILS & APPROVE ENDPOINTS
  // ==========================================

  // Get single Web Order by dynamic order ID (supports id, wooOrderId, shopifyOrderId, orderNumber)
  app.get(["/api/web-orders/:orderId", "/api/weborders/:orderId"], authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { orderId } = req.params;
      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      const cleanOrderId = String(orderId).trim();
      const rawNum = cleanOrderId.replace(/^#/, '');

      console.log(`[WEB ORDER API] Fetching details for Order #${cleanOrderId} (User: ${userId})`);

      const orders = await dbManager.readData(userId, 'woocommerce_orders');
      const list = Array.isArray(orders) ? orders : [];

      // Flexible match strategy:
      let found = list.find((o: any) => {
        if (!o) return false;
        if (String(o.id) === cleanOrderId) return true;
        if (String(o.wooOrderId) === cleanOrderId || String(o.wooOrderId) === rawNum) return true;
        if (String(o.orderNumber) === cleanOrderId || String(o.orderNumber).replace(/^#/, '') === rawNum) return true;
        if (String(o.shopifyOrderId) === cleanOrderId || String(o.shopifyOrderId) === rawNum) return true;
        if (String(o.number) === cleanOrderId || String(o.number).replace(/^#/, '') === rawNum) return true;
        if (o.id && typeof o.id === 'string' && o.id.endsWith(`_${cleanOrderId}`)) return true;
        return false;
      });

      // If not in local cache, attempt manual sync fallback from connected WooCommerce sites
      if (!found && /^\d+$/.test(rawNum)) {
        try {
          console.log(`[WEB ORDER API] Order #${cleanOrderId} not in local cache, querying connected stores...`);
          const syncResult = await wooManager.manualSyncSingleOrderById(userId, rawNum);
          if (syncResult && syncResult.order) {
            found = syncResult.order;
          }
        } catch (syncErr: any) {
          console.log(`[WEB ORDER API] Remote sync fallback attempt did not find order #${cleanOrderId}:`, syncErr.message);
        }
      }

      if (!found) {
        return res.status(404).json({
          error: "Order Not Found",
          message: `The requested web order #${cleanOrderId} could not be found.`
        });
      }

      res.json({
        success: true,
        order: found
      });
    } catch (error: any) {
      console.error(`[WEB ORDER API ERROR] Fetching order #${req.params.orderId}:`, error);
      res.status(500).json({ error: "Unable to load order details. Please try again." });
    }
  });

  // Approve a Web Order by dynamic order ID
  app.post(["/api/web-orders/:orderId/approve", "/api/weborders/:orderId/approve"], authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { orderId } = req.params;
      const { deliveryMethod, note } = req.body || {};

      if (!orderId) {
        return res.status(400).json({ error: "Order ID is required" });
      }

      const cleanOrderId = String(orderId).trim();
      const rawNum = cleanOrderId.replace(/^#/, '');

      const orders = await dbManager.readData(userId, 'woocommerce_orders');
      const list = Array.isArray(orders) ? orders : [];

      let found = list.find((o: any) => {
        if (!o) return false;
        if (String(o.id) === cleanOrderId) return true;
        if (String(o.wooOrderId) === cleanOrderId || String(o.wooOrderId) === rawNum) return true;
        if (String(o.orderNumber) === cleanOrderId || String(o.orderNumber).replace(/^#/, '') === rawNum) return true;
        if (String(o.shopifyOrderId) === cleanOrderId || String(o.shopifyOrderId) === rawNum) return true;
        if (String(o.number) === cleanOrderId || String(o.number).replace(/^#/, '') === rawNum) return true;
        return false;
      });

      if (!found) {
        return res.status(404).json({
          error: "Order Not Found",
          message: `The requested web order #${cleanOrderId} could not be found.`
        });
      }

      const updatedOrder = {
        ...found,
        custom_status: 'Approved',
        customStatus: 'Approved',
        deliveryMethod: deliveryMethod || found.deliveryMethod || 'Pathao',
        adminNote: note !== undefined ? note : (found.adminNote || ''),
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await dbManager.addToCollection(userId, 'woocommerce_orders', updatedOrder);

      // Automatically convert into Order List order (with duplicate prevention)
      let mainOrderCreated = null;
      try {
        const conv = await convertWebOrderToMainOrder(userId, updatedOrder, deliveryMethod, note);
        mainOrderCreated = conv.order;
      } catch (mainErr) {
        console.warn("[WEB ORDER APPROVE] Syncing to main orders collection warning:", mainErr);
      }

      console.log(`[WEB ORDER APPROVED] Order #${cleanOrderId} successfully approved for user ${userId}`);
      res.json({
        success: true,
        order: updatedOrder,
        mainOrder: mainOrderCreated,
        message: `Order #${cleanOrderId} approved successfully!`
      });
    } catch (error: any) {
      console.error(`[WEB ORDER APPROVE ERROR] Order #${req.params.orderId}:`, error);
      res.status(500).json({ error: "Unable to approve order. Please try again." });
    }
  });

  // Bulk Approve Web Orders
  app.post("/api/web-orders/bulk-approve", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { ids, deliveryMethod } = req.body || {};
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "IDs array is required" });
      }

      const orders = await dbManager.readData(userId, 'woocommerce_orders');
      const list = Array.isArray(orders) ? orders : [];
      const updatedOrders = [];
      const createdMainOrders = [];

      for (const id of ids) {
        const cleanOrderId = String(id).trim();
        const rawNum = cleanOrderId.replace(/^#/, '');
        const found = list.find((o: any) => 
          String(o.id) === cleanOrderId || 
          String(o.wooOrderId) === cleanOrderId || 
          String(o.wooOrderId) === rawNum ||
          String(o.orderNumber) === cleanOrderId
        );

        if (found) {
          const updated = {
            ...found,
            custom_status: 'Approved',
            customStatus: 'Approved',
            deliveryMethod: deliveryMethod || found.deliveryMethod || 'Pathao',
            approvedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await dbManager.addToCollection(userId, 'woocommerce_orders', updated);
          updatedOrders.push(updated);

          try {
            const conv = await convertWebOrderToMainOrder(userId, updated, deliveryMethod);
            if (conv && conv.order) {
              createdMainOrders.push(conv.order);
            }
          } catch (e) {
            console.warn(`[BULK APPROVE] Conversion error for order ${id}:`, e);
          }
        }
      }

      res.json({
        success: true,
        count: updatedOrders.length,
        createdMainOrdersCount: createdMainOrders.length,
        orders: updatedOrders,
        mainOrders: createdMainOrders,
        message: `Successfully approved ${updatedOrders.length} web order(s) and added to Order List (Pending)`
      });
    } catch (error: any) {
      console.error("[BULK APPROVE ERROR]:", error);
      res.status(500).json({ error: error.message || "Failed to bulk approve orders" });
    }
  });

  // ==========================================
  // WOOCOMMERCE WEBHOOK & REAL-TIME ENDPOINTS
  // ==========================================

  // Primary Webhook Endpoints for WooCommerce (order.created & status changes)
  app.post("/api/webhooks/woocommerce", wooWebhook.handleWooCommerceWebhook);
  app.post("/api/webhooks/woocommerce/order-created", wooWebhook.handleWooCommerceWebhook);
  app.post("/api/webhooks/woocommerce/order-updated", wooWebhook.handleWooCommerceWebhook);

  // Webhook Health & Info Check
  app.get("/api/webhooks/woocommerce/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "CommerceFlow WooCommerce Webhook Engine",
      realtime: "Socket.IO Enabled",
      timestamp: new Date().toISOString(),
      supportedTopics: ["order.created", "order.updated", "action.woocommerce_webhook_ping"]
    });
  });

  // Get Webhook Logs for user's stores
  app.get("/api/woocommerce/webhook/logs", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const logs = await dbManager.readData(userId, 'woocommerce_webhook_logs');
      const sortedLogs = Array.isArray(logs)
        ? logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100)
        : [];
      res.json(sortedLogs);
    } catch (error: any) {
      console.error("[WOO WEBHOOK ERROR] GET logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch webhook logs" });
    }
  });

  // Clear Webhook Logs for user
  app.delete("/api/woocommerce/webhook/logs", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const logs = await dbManager.readData(userId, 'woocommerce_webhook_logs');
      if (Array.isArray(logs)) {
        for (const log of logs) {
          if (log.id) {
            await dbManager.deleteFromCollection(userId, 'woocommerce_webhook_logs', log.id);
          }
        }
      }
      res.json({ success: true, message: "Webhook logs cleared successfully" });
    } catch (error: any) {
      console.error("[WOO WEBHOOK ERROR] DELETE logs:", error);
      res.status(500).json({ error: error.message || "Failed to clear webhook logs" });
    }
  });

  // Auto-Register Webhook on WooCommerce store via REST API
  app.post("/api/woocommerce/webhook/register", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, customSecret, appBaseUrl: bodyAppUrl } = req.body;
      if (!siteId) {
        return res.status(400).json({ error: "siteId is required" });
      }

      // Determine public base URL of this app
      const forwardedHost = req.get('x-forwarded-host') || req.get('host') || '';
      const forwardedProto = req.get('x-forwarded-proto') || (req.protocol === 'https' ? 'https' : 'http');
      const originHeader = req.get('origin') || req.get('referer');
      
      let appBaseUrl = bodyAppUrl || originHeader || process.env.APP_BASE_URL;
      if (!appBaseUrl || appBaseUrl.includes('localhost') || appBaseUrl.includes('127.0.0.1')) {
        if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
          appBaseUrl = `${forwardedProto}://${forwardedHost}`;
        }
      }
      if (!appBaseUrl) {
        appBaseUrl = `${forwardedProto}://${forwardedHost}`;
      }

      const result = await wooWebhook.autoRegisterWooCommerceWebhook(userId, siteId, appBaseUrl, customSecret);
      res.json(result);
    } catch (error: any) {
      console.error("[WOO WEBHOOK ERROR] Auto-register:", error);
      res.status(500).json({ error: error.message || "Failed to auto-register webhook" });
    }
  });

  // Run a real-time Diagnostic Test for Webhook
  app.post("/api/woocommerce/webhook/test", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId } = req.body;
      if (!siteId) {
        return res.status(400).json({ error: "siteId is required" });
      }

      const result = await wooWebhook.simulateWebhookTest(userId, siteId);
      res.json(result);
    } catch (error: any) {
      console.error("[WOO WEBHOOK ERROR] Test webhook:", error);
      res.status(500).json({ error: error.message || "Failed to test webhook" });
    }
  });

  // Generate / Update Webhook Secret for a store
  app.post("/api/woocommerce/webhook/secret", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, secret } = req.body;
      if (!siteId) {
        return res.status(400).json({ error: "siteId is required" });
      }

      const newSecret = secret || wooWebhook.generateWebhookSecret();
      const sites = await dbManager.readData(userId, 'woocommerce_sites');
      const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;

      if (!site) {
        return res.status(404).json({ error: "Store not found" });
      }

      const updatedSite = {
        ...site,
        webhookSecret: newSecret,
        updatedAt: new Date().toISOString()
      };
      await dbManager.addToCollection(userId, 'woocommerce_sites', updatedSite);

      res.json({ success: true, webhookSecret: newSecret });
    } catch (error: any) {
      console.error("[WOO WEBHOOK ERROR] Update secret:", error);
      res.status(500).json({ error: error.message || "Failed to update webhook secret" });
    }
  });

  // ==========================================
  // SHOPIFY INTEGRATION & REAL-TIME WEBHOOKS
  // ==========================================

  // Get user's connected Shopify sites
  app.get("/api/shopify/sites", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const sites = await dbManager.readData(userId, 'shopify_sites');
      const safeSites = Array.isArray(sites)
        ? sites.map((s: any) => ({
            ...s,
            accessTokenMasked: shopifyManager.maskSecret(s.accessToken),
            apiSecretMasked: shopifyManager.maskSecret(s.apiSecret),
            hasSecret: !!(s.accessToken || s.apiSecret)
          }))
        : [];
      res.json(safeSites);
    } catch (error: any) {
      console.error("[SHOPIFY API ERROR] GET sites:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Shopify sites" });
    }
  });

  // Save / Update Shopify store configuration
  app.post("/api/shopify/sites", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id, name, shopDomain, storeUrl, accessToken, apiKey, apiSecret, webhookSecret } = req.body;

      if (!name || !shopDomain || (!accessToken && !id)) {
        return res.status(400).json({ error: "Store Name, Shopify Domain, and Admin Access Token are required" });
      }

      const normalizedDomain = shopifyManager.normalizeShopDomain(shopDomain);
      const siteId = id || 'shopify_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

      // Read existing sites
      const existingSites = await dbManager.readData(userId, 'shopify_sites');
      const existingSite = Array.isArray(existingSites) ? existingSites.find((s: any) => s.id === siteId) : null;

      // Retain existing tokens if placeholder masked string was sent back
      const resolvedToken = (accessToken && !accessToken.includes('••••')) ? accessToken.trim() : (existingSite?.accessToken || '');
      const resolvedSecret = (apiSecret && !apiSecret.includes('••••')) ? apiSecret.trim() : (existingSite?.apiSecret || '');

      const siteData: shopifyManager.ShopifySiteRecord = {
        id: siteId,
        userId,
        name: name.trim(),
        shopDomain: normalizedDomain,
        storeUrl: storeUrl || `https://${normalizedDomain}`,
        accessToken: resolvedToken,
        apiKey: apiKey?.trim() || existingSite?.apiKey || '',
        apiSecret: resolvedSecret,
        webhookSecret: webhookSecret || existingSite?.webhookSecret || shopifyWebhook.generateShopifyWebhookSecret(),
        webhookId: existingSite?.webhookId,
        webhookStatus: existingSite?.webhookStatus || 'active',
        webhookDeliveryUrl: existingSite?.webhookDeliveryUrl,
        status: existingSite?.status || 'Connected',
        currency: existingSite?.currency || 'BDT',
        totalOrdersCount: existingSite?.totalOrdersCount || 0,
        createdAt: existingSite?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await dbManager.addToCollection(userId, 'shopify_sites', siteData);

      res.json({
        status: 'success',
        site: {
          ...siteData,
          accessTokenMasked: shopifyManager.maskSecret(siteData.accessToken),
          apiSecretMasked: shopifyManager.maskSecret(siteData.apiSecret),
          hasSecret: !!siteData.accessToken
        }
      });
    } catch (error: any) {
      console.error("[SHOPIFY API ERROR] Save site:", error);
      res.status(500).json({ error: error.message || "Failed to save Shopify site" });
    }
  });

  // Test Shopify Connection endpoint
  app.post("/api/shopify/sites/test", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, shopDomain, accessToken } = req.body;

      let targetDomain = shopDomain;
      let targetToken = accessToken;

      if (siteId) {
        const sites = await dbManager.readData(userId, 'shopify_sites');
        const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;
        if (site) {
          targetDomain = targetDomain || site.shopDomain;
          if (!targetToken || targetToken.includes('••••')) {
            targetToken = site.accessToken;
          }
        }
      }

      if (!targetDomain || !targetToken) {
        return res.status(400).json({ error: "Shop domain and Access Token are required for connection test" });
      }

      const result = await shopifyManager.testShopifyConnection({
        shopDomain: targetDomain,
        accessToken: targetToken
      });

      // If test succeeded and we have a siteId, update currency and order count
      if (result.success && siteId && result.shop) {
        const sites = await dbManager.readData(userId, 'shopify_sites');
        const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;
        if (site) {
          const updatedSite = {
            ...site,
            currency: result.shop.currency || site.currency || 'BDT',
            totalOrdersCount: result.shop.orderCount || site.totalOrdersCount || 0,
            status: 'Connected',
            updatedAt: new Date().toISOString()
          };
          await dbManager.addToCollection(userId, 'shopify_sites', updatedSite);
        }
      }

      res.json(result);
    } catch (error: any) {
      console.error("[SHOPIFY API ERROR] Test connection:", error);
      res.status(500).json({ error: error.message || "Connection test failed" });
    }
  });

  // Delete connected Shopify store
  app.delete("/api/shopify/sites/:id", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { id } = req.params;

      await dbManager.deleteFromCollection(userId, 'shopify_sites', id);
      res.json({ status: 'success', message: "Shopify store deleted successfully" });
    } catch (error: any) {
      console.error("[SHOPIFY API ERROR] DELETE site:", error);
      res.status(500).json({ error: error.message || "Failed to delete Shopify store" });
    }
  });

  // Primary Shopify Webhook Endpoints
  app.post("/api/integrations/shopify/webhook/orders/create", shopifyWebhook.handleShopifyWebhook);
  app.post("/api/integrations/shopify/webhook", shopifyWebhook.handleShopifyWebhook);
  app.post("/api/webhooks/shopify", shopifyWebhook.handleShopifyWebhook);

  // Shopify Webhook Health check
  app.get("/api/integrations/shopify/webhook/health", (req, res) => {
    res.json({
      status: "healthy",
      service: "CommerceFlow Shopify Webhook Engine",
      realtime: "Socket.IO Enabled",
      timestamp: new Date().toISOString(),
      supportedTopics: ["orders/create", "orders/updated", "app/uninstalled"]
    });
  });

  // Auto-Register Webhooks in Shopify Store
  app.post("/api/shopify/webhook/register", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, customSecret, appBaseUrl: bodyAppUrl } = req.body;

      if (!siteId) {
        return res.status(400).json({ error: "siteId is required" });
      }

      const forwardedHost = req.get('x-forwarded-host') || req.get('host') || '';
      const forwardedProto = req.get('x-forwarded-proto') || (req.protocol === 'https' ? 'https' : 'http');
      const originHeader = req.get('origin') || req.get('referer');

      let appBaseUrl = bodyAppUrl || originHeader || process.env.APP_BASE_URL;
      if (!appBaseUrl || appBaseUrl.includes('localhost') || appBaseUrl.includes('127.0.0.1')) {
        if (forwardedHost && !forwardedHost.includes('localhost') && !forwardedHost.includes('127.0.0.1')) {
          appBaseUrl = `${forwardedProto}://${forwardedHost}`;
        }
      }
      if (!appBaseUrl) {
        appBaseUrl = `${forwardedProto}://${forwardedHost}`;
      }

      const result = await shopifyWebhook.autoRegisterShopifyWebhook(userId, siteId, appBaseUrl, customSecret);
      res.json(result);
    } catch (error: any) {
      console.error("[SHOPIFY WEBHOOK ERROR] Auto-register:", error);
      res.status(500).json({ error: error.message || "Failed to register webhook on Shopify" });
    }
  });

  // Diagnostic Test for Shopify Webhook
  app.post("/api/shopify/webhook/test", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId } = req.body;
      if (!siteId) {
        return res.status(400).json({ error: "siteId is required" });
      }

      const result = await shopifyWebhook.simulateShopifyWebhookTest(userId, siteId);
      res.json(result);
    } catch (error: any) {
      console.error("[SHOPIFY WEBHOOK ERROR] Diagnostic test:", error);
      res.status(500).json({ error: error.message || "Diagnostic test failed" });
    }
  });

  // Get Shopify Webhook Logs
  app.get("/api/shopify/webhook/logs", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const logs = await dbManager.readData(userId, 'shopify_webhook_logs');
      const sortedLogs = Array.isArray(logs)
        ? logs.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100)
        : [];
      res.json(sortedLogs);
    } catch (error: any) {
      console.error("[SHOPIFY WEBHOOK ERROR] GET logs:", error);
      res.status(500).json({ error: error.message || "Failed to fetch Shopify webhook logs" });
    }
  });

  // Clear Shopify Webhook Logs
  app.delete("/api/shopify/webhook/logs", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const logs = await dbManager.readData(userId, 'shopify_webhook_logs');
      if (Array.isArray(logs)) {
        for (const log of logs) {
          if (log.id) {
            await dbManager.deleteFromCollection(userId, 'shopify_webhook_logs', log.id);
          }
        }
      }
      res.json({ success: true, message: "Shopify webhook logs cleared successfully" });
    } catch (error: any) {
      console.error("[SHOPIFY WEBHOOK ERROR] DELETE logs:", error);
      res.status(500).json({ error: error.message || "Failed to clear webhook logs" });
    }
  });

  // Generate / Update Webhook Secret for Shopify store
  app.post("/api/shopify/webhook/secret", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, secret } = req.body;
      if (!siteId) {
        return res.status(400).json({ error: "siteId is required" });
      }

      const newSecret = secret || shopifyWebhook.generateShopifyWebhookSecret();
      const sites = await dbManager.readData(userId, 'shopify_sites');
      const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;

      if (!site) {
        return res.status(404).json({ error: "Shopify store not found" });
      }

      const updatedSite = {
        ...site,
        webhookSecret: newSecret,
        updatedAt: new Date().toISOString()
      };
      await dbManager.addToCollection(userId, 'shopify_sites', updatedSite);

      res.json({ success: true, webhookSecret: newSecret });
    } catch (error: any) {
      console.error("[SHOPIFY WEBHOOK ERROR] Update secret:", error);
      res.status(500).json({ error: error.message || "Failed to update webhook secret" });
    }
  });

  // Import / Sync Recent Orders from Shopify Store (Manual Batch Sync)
  app.post("/api/shopify/sync", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, limit = 50 } = req.body;

      const sites = await dbManager.readData(userId, 'shopify_sites');
      const targetSites = siteId
        ? (Array.isArray(sites) ? sites.filter((s: any) => s.id === siteId) : [])
        : (Array.isArray(sites) ? sites : []);

      if (targetSites.length === 0) {
        return res.status(400).json({ error: "No connected Shopify store found to sync" });
      }

      let newCount = 0;
      let updatedCount = 0;
      const existingOrders = await dbManager.readData(userId, 'woocommerce_orders');

      for (const site of targetSites) {
        try {
          const orders = await shopifyManager.fetchShopifyOrders(site, limit);

          // Collect unique product IDs across all fetched orders
          const allProductIds: Array<number | string> = [];
          for (const rawOrder of orders) {
            if (Array.isArray(rawOrder.line_items)) {
              for (const li of rawOrder.line_items) {
                if (li.product_id) allProductIds.push(li.product_id);
              }
            }
          }

          // Batch fetch product images from Shopify Product API
          let imageMap: Map<string, { mainImage: string; variantImages: Record<string, string> }> | undefined;
          if (allProductIds.length > 0) {
            try {
              imageMap = await shopifyManager.fetchProductImagesMap(site, allProductIds);
            } catch (imgErr: any) {
              console.warn(`[SHOPIFY SYNC] Image map fetch skipped for store ${site.name}:`, imgErr.message);
            }
          }

          for (const rawOrder of orders) {
            const orderKey = `shopify_${site.id}_${rawOrder.id}`;
            const existingOrder = Array.isArray(existingOrders) 
              ? existingOrders.find((o: any) => o.id === orderKey || (o.storeId === site.id && String(o.shopifyOrderId) === String(rawOrder.id)))
              : null;

            const existingCustomStatus = existingOrder?.custom_status || existingOrder?.customStatus || 'Processing';
            const mapped = shopifyWebhook.mapShopifyOrderToWebOrder(rawOrder, site, userId, existingCustomStatus, imageMap);

            await dbManager.addToCollection(userId, 'woocommerce_orders', mapped);

            if (existingOrder) {
              updatedCount++;
            } else {
              newCount++;
            }
          }

          // Update site lastSyncAt
          const updatedSite = {
            ...site,
            status: 'Connected',
            lastSyncAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await dbManager.addToCollection(userId, 'shopify_sites', updatedSite);
        } catch (siteErr: any) {
          console.error(`[SHOPIFY SYNC ERROR] Store ${site.name}:`, siteErr.message);
        }
      }

      res.json({
        success: true,
        newCount,
        updatedCount,
        totalSynced: newCount + updatedCount,
        lastSyncAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("[SHOPIFY SYNC ERROR]", error);
      res.status(500).json({ error: error.message || "Failed to sync Shopify orders" });
    }
  });

  // Sync Single Shopify Order
  app.post("/api/shopify/sync-order", authenticate, async (req: any, res) => {
    try {
      const userId = req.user.uid;
      const { siteId, shopifyOrderId } = req.body;

      if (!siteId || !shopifyOrderId) {
        return res.status(400).json({ error: "siteId and shopifyOrderId are required" });
      }

      const sites = await dbManager.readData(userId, 'shopify_sites');
      const site = Array.isArray(sites) ? sites.find((s: any) => s.id === siteId) : null;

      if (!site) {
        return res.status(404).json({ error: "Shopify store not found" });
      }

      const rawOrder = await shopifyManager.fetchSingleShopifyOrder(site, shopifyOrderId);
      if (!rawOrder) {
        return res.status(404).json({ error: `Shopify Order #${shopifyOrderId} not found on store ${site.name}` });
      }

      const existingOrders = await dbManager.readData(userId, 'woocommerce_orders');
      const orderKey = `shopify_${site.id}_${rawOrder.id}`;
      const existingOrder = Array.isArray(existingOrders) 
        ? existingOrders.find((o: any) => o.id === orderKey || (o.storeId === site.id && String(o.shopifyOrderId) === String(rawOrder.id)))
        : null;

      const existingCustomStatus = existingOrder?.custom_status || existingOrder?.customStatus || 'Processing';

      // Fetch product images for single order line items
      const productIds: Array<number | string> = [];
      if (Array.isArray(rawOrder.line_items)) {
        for (const li of rawOrder.line_items) {
          if (li.product_id) productIds.push(li.product_id);
        }
      }
      let imageMap: Map<string, { mainImage: string; variantImages: Record<string, string> }> | undefined;
      if (productIds.length > 0) {
        try {
          imageMap = await shopifyManager.fetchProductImagesMap(site, productIds);
        } catch (imgErr: any) {
          console.warn(`[SHOPIFY SINGLE SYNC] Image map fetch skipped:`, imgErr.message);
        }
      }

      const mappedOrder = shopifyWebhook.mapShopifyOrderToWebOrder(rawOrder, site, userId, existingCustomStatus, imageMap);

      await dbManager.addToCollection(userId, 'woocommerce_orders', mappedOrder);

      res.json({ success: true, order: mappedOrder });
    } catch (error: any) {
      console.error("[SHOPIFY SYNC-ORDER ERROR]", error);
      res.status(500).json({ error: error.message || "Failed to sync single Shopify order" });
    }
  });

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString(), uptime: process.uptime() });
  });

  // Pathao API Token Management
  let cachedToken: string | null = null;
  let refreshToken: string | null = null;
  let tokenExpiry: number = 0;

  async function getPathaoToken() {
    const currentTime = Math.floor(Date.now() / 1000);
    
    // Check if we have a valid cached token (with 2 minute buffer)
    if (cachedToken && tokenExpiry > currentTime + 120) {
      return cachedToken;
    }

    const baseUrl = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";
    const clientId = process.env.PATHAO_CLIENT_ID;
    const clientSecret = process.env.PATHAO_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error("Missing Pathao API credentials (CLIENT_ID or CLIENT_SECRET)");
    }

    let response;
    
    // Try refreshing if we have a refresh token
    if (refreshToken) {
      console.log("Refreshing Pathao access token...");
      try {
        response = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken
          })
        });
      } catch (e) {
        console.error("Pathao token refresh fetch failed:", e);
      }
    }

    // If no refresh token or refresh failed, use password grant
    if (!response || !response.ok) {
      console.log("Issuing new Pathao access token via password grant...");
      const username = process.env.PATHAO_USERNAME;
      const password = process.env.PATHAO_PASSWORD;

      if (!username || !password) {
        throw new Error("Missing Pathao API credentials (USERNAME or PASSWORD)");
      }

      try {
        response = await fetch(`${baseUrl}/aladdin/api/v1/issue-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            username: username,
            password: password,
            grant_type: "password"
          })
        });
      } catch (e) {
        console.error("Pathao new token fetch failed:", e);
        throw new Error(`Failed to connect to Pathao API: ${String(e)}`);
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Pathao Auth Failed: ${response.status} ${JSON.stringify(errorData)}`);
    }

    const data = await response.json() as any;
    cachedToken = data.access_token;
    refreshToken = data.refresh_token || refreshToken;
    tokenExpiry = currentTime + data.expires_in;
    return cachedToken;
  }

  // Pathao API Proxy Endpoint
  app.get("/api/order-info/:consignment_id", async (req, res) => {
    const { consignment_id } = req.params;
    const baseUrl = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";

    try {
      const token = await getPathaoToken();
      
      const response = await fetch(`${baseUrl}/aladdin/api/v1/orders/${consignment_id}/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // Safely parse JSON or return the raw text if parsing fails
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: "Non-JSON response received from Pathao", raw: text };
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Pathao API Proxy Error:", error.message);
      res.status(500).json({ 
        error: "Failed to communicate with Pathao API",
        details: error.message
      });
    }
  });

  // Pathao API Proxy Endpoint - Fetch list of recent orders (paginated)
  app.get("/api/pathao-orders", async (req, res) => {
    const page = req.query.page || 1;
    const limit = req.query.limit || 50;
    const baseUrl = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";

    try {
      const token = await getPathaoToken();
      
      const response = await fetch(`${baseUrl}/aladdin/api/v1/orders?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = { message: "Non-JSON response received from Pathao", raw: text };
      }

      res.status(response.status).json(data);
    } catch (error: any) {
      console.error("Pathao API List Proxy Error:", error.message);
      res.status(500).json({ 
        error: "Failed to communicate with Pathao API",
        details: error.message
      });
    }
  });

  // Pathao API Proxy Endpoint - Track by Merchant Order ID
  app.get("/api/order-info-by-order-id/:order_id", async (req, res) => {
    const { order_id } = req.params;
    
    if (!order_id || order_id === 'undefined') {
      return res.status(400).json({ error: "Invalid Order ID provided" });
    }

    const baseUrl = process.env.PATHAO_BASE_URL || "https://courier-api-sandbox.pathao.com";

    try {
      const token = await getPathaoToken();
      
      const response = await fetch(`${baseUrl}/aladdin/api/v1/orders?merchant_order_id=${order_id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const contentType = response.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        result = { message: "Non-JSON response received from Pathao", raw: text };
      }
      
      // If we found the order, return its info
      if (result.type === 'success' && result.data && result.data.length > 0) {
        res.status(200).json({
          type: 'success',
          data: result.data[0]
        });
      } else {
        res.status(404).json({ 
          error: "Not Found", 
          details: `Order [${order_id}] was not found in Pathao's system. Please check the ID or try again later.` 
        });
      }
    } catch (error: any) {
      console.error("Pathao API Proxy Error (by Order ID):", error.message);
      res.status(500).json({ 
        error: "Failed to communicate with Pathao API",
        details: error.message
      });
    }
  });

  // Courier Fraud Checker module routes
  app.use('/api', createFraudCheckerRouter(authenticate));

  // Final fallback for API routes to avoid returning index.html
  app.use('/api', (req, res) => {
    console.warn(`[API 404] No route matched for ${req.method} ${req.url}`);
    res.status(404).json({ 
      error: "API endpoint not found",
      path: req.originalUrl 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to initialize Vite server:", e);
    }
  } else if (!process.env.VERCEL) {
    // Only serve static files if NOT on Vercel (e.g. Docker or local production test)
    // Vercel handles static serving via its own CDN
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  // Final fallback for all other routes
  app.use((req, res) => {
    res.status(404).send("Not Found");
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Server Error:", err);
    res.status(500).json({ error: "Internal Server Error", details: err.message });
  });

  return app;
}

async function startServer() {
  try {
    const app = await createServer();
    const PORT = parseInt(process.env.PORT || "3000", 10);
    
    // Create HTTP Server & Mount Socket.IO
    const httpServer = http.createServer(app);
    const io = new SocketIOServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    wooWebhook.setSocketIOInstance(io);
    shopifyWebhook.setShopifySocketIO(io);

    io.on('connection', (socket) => {
      console.log(`[SOCKET.IO] Real-time client connected: ${socket.id}`);
      
      socket.on('join_user', (userId: string) => {
        if (userId) {
          socket.join(`user_${userId}`);
          console.log(`[SOCKET.IO] Socket ${socket.id} joined user_${userId}`);
        }
      });

      socket.on('disconnect', () => {
        console.log(`[SOCKET.IO] Client disconnected: ${socket.id}`);
      });
    });

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`Server with Socket.IO running on port ${PORT}`);
      wooManager.initAutoSyncScheduler();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
