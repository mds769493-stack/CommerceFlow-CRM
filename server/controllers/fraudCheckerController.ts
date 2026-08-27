/**
 * Fraud Checker Controller
 */
import { Request, Response } from 'express';
import { formatBdPhoneNumber } from '../utils/phoneFormatter.ts';
import { SteadfastService } from '../services/steadfastService.ts';
import { PathaoService } from '../services/pathaoService.ts';
import { RedxService } from '../services/redxService.ts';
import { PaperflyService } from '../services/paperflyService.ts';
import { CarrybeeService } from '../services/carrybeeService.ts';
import * as dbManager from '../db.ts';
import { 
  CourierCheckResult, 
  OverallFraudReport, 
  FraudCheckerSettings, 
  RiskLevel 
} from '../types/fraudChecker.ts';

const SETTINGS_COLLECTION = 'fraud_checker_settings';
const HISTORY_COLLECTION = 'fraud_check_history';
const SETTINGS_DOC_ID = 'default_settings';

/**
 * Helper to fetch settings for a given user ID with fallbacks to environment variables
 */
export async function getMergedSettings(userId: string): Promise<FraudCheckerSettings> {
  let storedSettings: any = null;
  try {
    const records = await dbManager.readData(userId, SETTINGS_COLLECTION);
    if (Array.isArray(records) && records.length > 0) {
      storedSettings = records.find((r: any) => r.id === SETTINGS_DOC_ID || r.internalId === SETTINGS_DOC_ID) || records[0];
    }
  } catch (err) {
    console.warn('[FRAUD_CHECK] Failed to read stored settings, fallback to .env:', err);
  }

  return {
    id: SETTINGS_DOC_ID,
    steadfast: {
      enabled: storedSettings?.steadfast?.enabled !== false,
      apiKey: storedSettings?.steadfast?.apiKey || process.env.STEADFAST_API_KEY || '',
      secretKey: storedSettings?.steadfast?.secretKey || process.env.STEADFAST_SECRET_KEY || '',
      email: storedSettings?.steadfast?.email || process.env.STEADFAST_EMAIL || process.env.STEADFAST_USER || '',
      password: storedSettings?.steadfast?.password || process.env.STEADFAST_PASSWORD || ''
    },
    pathao: {
      enabled: storedSettings?.pathao?.enabled !== false,
      clientId: storedSettings?.pathao?.clientId || process.env.PATHAO_CLIENT_ID || '',
      clientSecret: storedSettings?.pathao?.clientSecret || process.env.PATHAO_CLIENT_SECRET || '',
      email: storedSettings?.pathao?.email || process.env.PATHAO_EMAIL || process.env.PATHAO_USER || '',
      password: storedSettings?.pathao?.password || process.env.PATHAO_PASSWORD || ''
    },
    redx: {
      enabled: storedSettings?.redx?.enabled !== false,
      email: storedSettings?.redx?.email || process.env.REDX_EMAIL || '',
      phone: storedSettings?.redx?.phone || process.env.REDX_PHONE || '01829421720',
      password: storedSettings?.redx?.password || process.env.REDX_PASSWORD || '15163080',
      apiKey: storedSettings?.redx?.apiKey || process.env.REDX_API_KEY || process.env.REDX_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5MDA0MDciLCJpYXQiOjE3ODc2NDUwMjUsImlzcyI6Ikt4MHRrVnhrUWczV0Q2aDZ0ejBQTkt3QXpGMWhxTWtwIiwic2hvcF9pZCI6OTAwNDA3LCJ1c2VyX2lkIjo4OTcyOTMwfQ.ooCadSDxV9ESbtwb1eXveUfMxt6LldDPkJl26bbzpxM'
    },
    paperfly: {
      enabled: storedSettings?.paperfly?.enabled !== false,
      username: storedSettings?.paperfly?.username || process.env.PAPERFLY_USER || process.env.PAPERFLY_EMAIL || '',
      password: storedSettings?.paperfly?.password || process.env.PAPERFLY_PASSWORD || '',
      apiKey: storedSettings?.paperfly?.apiKey || process.env.PAPERFLY_KEY || process.env.PAPERFLY_API_KEY || ''
    },
    carrybee: {
      enabled: storedSettings?.carrybee?.enabled !== false,
      email: storedSettings?.carrybee?.email || process.env.CARRYBEE_EMAIL || '',
      phone: storedSettings?.carrybee?.phone || process.env.CARRYBEE_PHONE || '',
      password: storedSettings?.carrybee?.password || process.env.CARRYBEE_PASSWORD || '',
      apiKey: storedSettings?.carrybee?.apiKey || process.env.CARRYBEE_API_KEY || ''
    }
  };
}

/**
 * Mask sensitive credentials for safe delivery to client
 */
function maskSettingsForClient(settings: FraudCheckerSettings): FraudCheckerSettings {
  const getLastChars = (str?: string) => {
    if (!str) return '';
    const clean = str.trim();
    if (clean.length <= 4) return clean;
    return clean.slice(-4);
  };

  return {
    id: SETTINGS_DOC_ID,
    steadfast: {
      enabled: settings.steadfast.enabled,
      apiKey: settings.steadfast.apiKey ? '••••••••••••' : '',
      secretKey: settings.steadfast.secretKey ? '••••••••••••' : '',
      email: settings.steadfast.email || '',
      password: settings.steadfast.password ? '••••••••' : '',
      hasCredentials: !!((settings.steadfast.apiKey && settings.steadfast.secretKey) || (settings.steadfast.email && settings.steadfast.password)),
      apiKeyConfigured: !!(settings.steadfast.apiKey && settings.steadfast.apiKey.trim()),
      apiKeyLastChars: getLastChars(settings.steadfast.apiKey),
      passwordConfigured: !!(settings.steadfast.password && settings.steadfast.password.trim())
    },
    pathao: {
      enabled: settings.pathao.enabled,
      clientId: settings.pathao.clientId || '',
      clientSecret: settings.pathao.clientSecret ? '••••••••••••' : '',
      email: settings.pathao.email || '',
      password: settings.pathao.password ? '••••••••' : '',
      hasCredentials: !!((settings.pathao.email && settings.pathao.password) || (settings.pathao.clientId && settings.pathao.clientSecret)),
      clientSecretConfigured: !!(settings.pathao.clientSecret && settings.pathao.clientSecret.trim()),
      passwordConfigured: !!(settings.pathao.password && settings.pathao.password.trim())
    },
    redx: {
      enabled: settings.redx.enabled,
      email: settings.redx.email || '',
      phone: settings.redx.phone || '',
      password: settings.redx.password ? '••••••••' : '',
      apiKey: settings.redx.apiKey ? '••••••••••••' : '',
      hasCredentials: !!(settings.redx.apiKey || ((settings.redx.phone || settings.redx.email) && settings.redx.password)),
      apiKeyConfigured: !!(settings.redx.apiKey && settings.redx.apiKey.trim()),
      apiKeyLastChars: getLastChars(settings.redx.apiKey),
      passwordConfigured: !!(settings.redx.password && settings.redx.password.trim())
    },
    paperfly: {
      enabled: settings.paperfly.enabled,
      username: settings.paperfly.username || '',
      password: settings.paperfly.password ? '••••••••' : '',
      apiKey: settings.paperfly.apiKey ? '••••••••••••' : '',
      hasCredentials: !!(settings.paperfly.apiKey || (settings.paperfly.username && settings.paperfly.password)),
      apiKeyConfigured: !!(settings.paperfly.apiKey && settings.paperfly.apiKey.trim()),
      apiKeyLastChars: getLastChars(settings.paperfly.apiKey),
      passwordConfigured: !!(settings.paperfly.password && settings.paperfly.password.trim())
    },
    carrybee: {
      enabled: settings.carrybee.enabled,
      email: settings.carrybee.email || '',
      phone: settings.carrybee.phone || '',
      password: settings.carrybee.password ? '••••••••' : '',
      apiKey: settings.carrybee.apiKey ? '••••••••••••' : '',
      hasCredentials: !!(settings.carrybee.apiKey || ((settings.carrybee.phone || settings.carrybee.email) && settings.carrybee.password)),
      apiKeyConfigured: !!(settings.carrybee.apiKey && settings.carrybee.apiKey.trim()),
      apiKeyLastChars: getLastChars(settings.carrybee.apiKey),
      passwordConfigured: !!(settings.carrybee.password && settings.carrybee.password.trim())
    }
  };
}

/**
 * Handle Fraud Check for a given phone number
 */
export async function checkFraud(req: any, res: Response) {
  const userId = req.user?.uid || 'default_user';
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: 'Customer mobile number is required.' });
  }

  const validation = formatBdPhoneNumber(phone);
  if (!validation.isValid) {
    return res.status(400).json({ 
      error: validation.error || 'Invalid Bangladesh mobile number.',
      phone
    });
  }

  const targetPhone = validation.formatted;
  const settings = await getMergedSettings(userId);

  // Initialize service instances with configured credentials
  const steadfastService = new SteadfastService(settings.steadfast);
  const pathaoService = new PathaoService(settings.pathao);
  const redxService = new RedxService(settings.redx);
  const paperflyService = new PaperflyService(settings.paperfly);
  const carrybeeService = new CarrybeeService(settings.carrybee);

  // Execute all 5 courier checks in parallel with fault-tolerance
  const results = await Promise.allSettled([
    steadfastService.getDeliveryStats(targetPhone),
    pathaoService.getDeliveryStats(targetPhone),
    redxService.getDeliveryStats(targetPhone),
    paperflyService.getDeliveryStats(targetPhone),
    carrybeeService.getDeliveryStats(targetPhone)
  ]);

  const extractResult = (settled: PromiseSettledResult<CourierCheckResult>, courierName: string): CourierCheckResult => {
    if (settled.status === 'fulfilled') {
      return settled.value;
    }
    return {
      courier: courierName,
      success: false,
      total: 0,
      delivered: 0,
      cancelled: 0,
      successRate: 0,
      status: 'error',
      message: settled.reason?.message || `Failed to fetch data from ${courierName}`
    };
  };

  const courierResults = {
    steadfast: extractResult(results[0], 'Steadfast'),
    pathao: extractResult(results[1], 'Pathao'),
    redx: extractResult(results[2], 'RedX'),
    paperfly: extractResult(results[3], 'Paperfly'),
    carrybee: extractResult(results[4], 'Carrybee')
  };

  // Calculate Aggregated Metrics from successful results
  let totalDeliveries = 0;
  let totalDelivered = 0;
  let totalCancelled = 0;
  let successfulCouriersCount = 0;

  for (const item of Object.values(courierResults)) {
    if (item.success && item.status === 'success') {
      totalDeliveries += item.total;
      totalDelivered += item.delivered;
      totalCancelled += item.cancelled;
      successfulCouriersCount++;
    }
  }

  let successRate = 0;
  let cancelRate = 0;
  let riskLevel: RiskLevel = 'UNKNOWN';

  if (totalDeliveries > 0) {
    successRate = Math.round((totalDelivered / totalDeliveries) * 100 * 10) / 10;
    cancelRate = Math.round((totalCancelled / totalDeliveries) * 100 * 10) / 10;

    if (successRate >= 80) {
      riskLevel = 'LOW';
    } else if (successRate >= 50) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'HIGH';
    }
  } else {
    // If no deliveries found across network, or all couriers returned 0
    riskLevel = 'UNKNOWN';
  }

  const genuineProbability = successRate;
  const fraudProbability = totalDeliveries > 0 ? Math.max(0, Math.round((100 - successRate) * 10) / 10) : 0;

  // Query store's own order history for this customer phone number
  let ourRecord = {
    totalOrders: 0,
    deliveredOrders: 0,
    cancelledOrders: 0,
    webCancelCount: 0,
    isNewCustomer: true
  };

  try {
    const [storeOrders, wooOrders, shopifyOrders] = await Promise.all([
      dbManager.readData(userId, 'orders').catch(() => []),
      dbManager.readData(userId, 'woocommerce_orders').catch(() => []),
      dbManager.readData(userId, 'shopify_orders').catch(() => [])
    ]);

    const allOrders = [
      ...(Array.isArray(storeOrders) ? storeOrders : []),
      ...(Array.isArray(wooOrders) ? wooOrders : []),
      ...(Array.isArray(shopifyOrders) ? shopifyOrders : [])
    ];

    if (allOrders.length > 0) {
      const cleanTarget = targetPhone.replace(/\D/g, '').slice(-10);
      const customerOrders = allOrders.filter((o: any) => {
        const oPhone = String(
          o.customerPhone || 
          o.phone || 
          o.billingAddress?.phone || 
          o.shippingAddress?.phone || 
          o.customer?.phone || 
          ''
        ).replace(/\D/g, '');
        return oPhone.endsWith(cleanTarget);
      });

      if (customerOrders.length > 0) {
        ourRecord.isNewCustomer = false;
        ourRecord.totalOrders = customerOrders.length;
        ourRecord.deliveredOrders = customerOrders.filter((o: any) => 
          ['delivered', 'completed', 'success'].includes(String(o.status || o.woocommerce_status || '').toLowerCase())
        ).length;
        ourRecord.cancelledOrders = customerOrders.filter((o: any) => 
          ['cancelled', 'canceled', 'returned', 'failed', 'refunded'].includes(String(o.status || o.woocommerce_status || '').toLowerCase())
        ).length;
        ourRecord.webCancelCount = customerOrders.filter((o: any) => 
          String(o.cancelReason || o.status || o.woocommerce_status || '').toLowerCase().includes('web') || 
          String(o.notes || o.note || o.customerNote || '').toLowerCase().includes('cancel')
        ).length;
      }
    }
  } catch (err) {
    console.warn('[FRAUD_CHECK] Failed looking up store orders for customer:', err);
  }

  const report: OverallFraudReport = {
    phone: targetPhone,
    operator: validation.operator,
    timestamp: new Date().toISOString(),
    overall: {
      total: totalDeliveries,
      delivered: totalDelivered,
      cancelled: totalCancelled,
      successRate,
      cancelRate,
      riskLevel,
      genuineProbability,
      fraudProbability
    },
    ourRecord,
    couriers: courierResults
  };

  // Asynchronously save to Search History
  try {
    const historyItem = {
      id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      phone: targetPhone,
      operator: validation.operator,
      total: totalDeliveries,
      delivered: totalDelivered,
      cancelled: totalCancelled,
      successRate,
      riskLevel,
      timestamp: report.timestamp,
      reportSnapshot: report
    };
    await dbManager.addToCollection(userId, HISTORY_COLLECTION, historyItem);
  } catch (histErr) {
    console.warn('[FRAUD_CHECK] Failed saving to history:', histErr);
  }

  return res.json(report);
}

/**
 * Get Fraud Checker settings (masked)
 */
export async function getSettings(req: any, res: Response) {
  const userId = req.user?.uid || 'default_user';
  try {
    const settings = await getMergedSettings(userId);
    return res.json(maskSettingsForClient(settings));
  } catch (err: any) {
    console.error('[FRAUD_CHECK] Error loading settings:', err);
    return res.status(500).json({ error: 'Failed to load Fraud Checker settings' });
  }
}

/**
 * Save Fraud Checker settings
 */
export async function updateSettings(req: any, res: Response) {
  const userId = req.user?.uid || 'default_user';
  const newSettings = req.body;

  try {
    const existing = await getMergedSettings(userId);

    // Helper to resolve secret or field update:
    // - If newVal starts with '••••', client left masked placeholder untouched -> keep oldVal
    // - If newVal is undefined, field not provided -> keep oldVal
    // - If newVal is empty string or whitespace (user deleted/cleared the field) -> save '' (clears token)
    // - Otherwise save the fresh value trimmed
    const resolveSecret = (newVal: any, oldVal: any) => {
      if (newVal === undefined) return oldVal || '';
      if (typeof newVal === 'string') {
        const trimmed = newVal.trim();
        if (trimmed.startsWith('••••')) {
          return oldVal || '';
        }
        return trimmed;
      }
      return newVal || '';
    };

    const resolvePlain = (newVal: any, oldVal: any) => {
      if (newVal === undefined) return oldVal || '';
      if (typeof newVal === 'string') return newVal.trim();
      return newVal || '';
    };

    const mergedToSave: FraudCheckerSettings = {
      id: SETTINGS_DOC_ID,
      updatedAt: new Date().toISOString(),
      steadfast: {
        enabled: newSettings.steadfast?.enabled !== undefined ? !!newSettings.steadfast.enabled : existing.steadfast.enabled,
        apiKey: resolveSecret(newSettings.steadfast?.apiKey, existing.steadfast.apiKey),
        secretKey: resolveSecret(newSettings.steadfast?.secretKey, existing.steadfast.secretKey),
        email: resolvePlain(newSettings.steadfast?.email, existing.steadfast.email),
        password: resolveSecret(newSettings.steadfast?.password, existing.steadfast.password)
      },
      pathao: {
        enabled: newSettings.pathao?.enabled !== undefined ? !!newSettings.pathao.enabled : existing.pathao.enabled,
        clientId: resolvePlain(newSettings.pathao?.clientId, existing.pathao.clientId),
        clientSecret: resolveSecret(newSettings.pathao?.clientSecret, existing.pathao.clientSecret),
        email: resolvePlain(newSettings.pathao?.email, existing.pathao.email),
        password: resolveSecret(newSettings.pathao?.password, existing.pathao.password)
      },
      redx: {
        enabled: newSettings.redx?.enabled !== undefined ? !!newSettings.redx.enabled : existing.redx.enabled,
        email: resolvePlain(newSettings.redx?.email, existing.redx.email),
        phone: resolvePlain(newSettings.redx?.phone, existing.redx.phone),
        password: resolveSecret(newSettings.redx?.password, existing.redx.password),
        apiKey: resolveSecret(newSettings.redx?.apiKey, existing.redx.apiKey)
      },
      paperfly: {
        enabled: newSettings.paperfly?.enabled !== undefined ? !!newSettings.paperfly.enabled : existing.paperfly.enabled,
        username: resolvePlain(newSettings.paperfly?.username, existing.paperfly.username),
        password: resolveSecret(newSettings.paperfly?.password, existing.paperfly.password),
        apiKey: resolveSecret(newSettings.paperfly?.apiKey, existing.paperfly.apiKey)
      },
      carrybee: {
        enabled: newSettings.carrybee?.enabled !== undefined ? !!newSettings.carrybee.enabled : existing.carrybee.enabled,
        email: resolvePlain(newSettings.carrybee?.email, existing.carrybee.email),
        phone: resolvePlain(newSettings.carrybee?.phone, existing.carrybee.phone),
        password: resolveSecret(newSettings.carrybee?.password, existing.carrybee.password),
        apiKey: resolveSecret(newSettings.carrybee?.apiKey, existing.carrybee.apiKey)
      }
    };

    await dbManager.addToCollection(userId, SETTINGS_COLLECTION, mergedToSave);

    return res.json({
      success: true,
      message: 'Fraud Checker settings saved successfully',
      settings: maskSettingsForClient(mergedToSave)
    });
  } catch (err: any) {
    console.error('[FRAUD_CHECK] Error saving settings:', err);
    return res.status(500).json({ error: 'Failed to save settings: ' + err.message });
  }
}

/**
 * Test Connection for a specific courier
 */
export async function testConnection(req: any, res: Response) {
  const userId = req.user?.uid || 'default_user';
  const { courier, credentials } = req.body;

  if (!courier) {
    return res.status(400).json({ error: 'Courier name is required' });
  }

  const existingSettings = await getMergedSettings(userId);
  const targetName = String(courier).toLowerCase();

  // Helper to merge incoming credentials while preserving stored secrets if masked
  const mergeConfigWithSecrets = (existing: any, incoming: any) => {
    if (!incoming) return { ...existing };
    const merged = { ...existing };
    for (const key of Object.keys(incoming)) {
      const val = incoming[key];
      if (val !== undefined) {
        if (typeof val === 'string' && val.trim().startsWith('••••')) {
          merged[key] = existing[key] || '';
        } else if (typeof val === 'string') {
          merged[key] = val.trim();
        } else {
          merged[key] = val;
        }
      }
    }
    return merged;
  };

  try {
    let testResult = { success: false, message: 'Unsupported courier' };

    if (targetName === 'steadfast') {
      const config = mergeConfigWithSecrets(existingSettings.steadfast, credentials);
      const service = new SteadfastService(config);
      testResult = await service.testConnection();
    } else if (targetName === 'pathao') {
      const config = mergeConfigWithSecrets(existingSettings.pathao, credentials);
      const service = new PathaoService(config);
      testResult = await service.testConnection();
    } else if (targetName === 'redx') {
      const config = mergeConfigWithSecrets(existingSettings.redx, credentials);
      const service = new RedxService(config);
      testResult = await service.testConnection();
    } else if (targetName === 'paperfly') {
      const config = mergeConfigWithSecrets(existingSettings.paperfly, credentials);
      const service = new PaperflyService(config);
      testResult = await service.testConnection();
    } else if (targetName === 'carrybee') {
      const config = mergeConfigWithSecrets(existingSettings.carrybee, credentials);
      const service = new CarrybeeService(config);
      testResult = await service.testConnection();
    }

    return res.json(testResult);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message || 'Connection test encountered an error' });
  }
}

/**
 * Get Fraud Check History
 */
export async function getHistory(req: any, res: Response) {
  const userId = req.user?.uid || 'default_user';
  try {
    const rawHistory = await dbManager.readData(userId, HISTORY_COLLECTION);
    const historyList = Array.isArray(rawHistory) ? rawHistory : [];

    // Sort by timestamp desc
    historyList.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json(historyList);
  } catch (err: any) {
    console.error('[FRAUD_CHECK] Failed to fetch history:', err);
    return res.status(500).json({ error: 'Failed to fetch history' });
  }
}

/**
 * Delete a history entry
 */
export async function deleteHistoryItem(req: any, res: Response) {
  const userId = req.user?.uid || 'default_user';
  const { id } = req.params;

  try {
    if (id === 'all') {
      // Clear entire history
      const items = await dbManager.readData(userId, HISTORY_COLLECTION);
      for (const item of items) {
        const itemId = item.id || item.internalId;
        if (itemId) {
          await dbManager.deleteFromCollection(userId, HISTORY_COLLECTION, itemId);
        }
      }
      return res.json({ success: true, message: 'All history cleared successfully' });
    }

    await dbManager.deleteFromCollection(userId, HISTORY_COLLECTION, id);
    return res.json({ success: true, message: 'History record deleted' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete history record: ' + err.message });
  }
}
