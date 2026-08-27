import { ShopifySite, WebOrder, WebhookLog } from '../types';
import { getApiUrl } from './api';
import { logout } from './firebase';

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
};

const handleUnauthorized = () => {
  console.warn("401 Unauthorized received. Logging out...");
  logout();
};

/**
 * Fetch all connected Shopify sites
 */
export async function fetchShopifySites(): Promise<ShopifySite[]> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/sites'), {
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch Shopify sites (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('fetchShopifySites error:', error);
    throw error;
  }
}

/**
 * Save or update a Shopify store configuration
 */
export async function saveShopifySite(data: {
  id?: string;
  name: string;
  shopDomain: string;
  storeUrl?: string;
  accessToken: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
}): Promise<{ status: string; site: ShopifySite }> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/sites'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to save Shopify store (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('saveShopifySite error:', error);
    throw error;
  }
}

/**
 * Test Shopify API connection
 */
export async function testShopifyConnection(data: {
  siteId?: string;
  shopDomain?: string;
  accessToken?: string;
}): Promise<{
  success: boolean;
  message: string;
  shop?: {
    id: number | string;
    name: string;
    email?: string;
    domain: string;
    myshopifyDomain: string;
    currency: string;
    countryName?: string;
    orderCount?: number;
  };
  error?: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/sites/test'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || result.message || 'Shopify connection test failed');
    }
    return result;
  } catch (error) {
    console.error('testShopifyConnection error:', error);
    throw error;
  }
}

/**
 * Delete a connected Shopify store
 */
export async function deleteShopifySite(id: string): Promise<{ status: string; message: string }> {
  try {
    const res = await fetch(getApiUrl(`/api/shopify/sites/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete Shopify store (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('deleteShopifySite error:', error);
    throw error;
  }
}

/**
 * Auto-Register Webhooks in Shopify Store
 */
export async function autoRegisterShopifyWebhook(siteId: string, customSecret?: string): Promise<{
  success: boolean;
  webhookId?: number | string;
  deliveryUrl: string;
  message: string;
  results?: any[];
}> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/webhook/register'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ siteId, customSecret })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || result.message || `Failed to register webhook on Shopify (${res.status})`);
    }
    return result;
  } catch (error) {
    console.error('autoRegisterShopifyWebhook error:', error);
    throw error;
  }
}

/**
 * Run Diagnostic Test for Shopify Webhook
 */
export async function testShopifyWebhook(siteId: string): Promise<{
  success: boolean;
  message: string;
  log?: WebhookLog;
  order?: WebOrder;
  steps?: Array<{ step: string; status: 'ok' | 'error'; detail: string }>;
}> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/webhook/test'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ siteId })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || result.message || `Diagnostic test failed (${res.status})`);
    }
    return result;
  } catch (error) {
    console.error('testShopifyWebhook error:', error);
    throw error;
  }
}

/**
 * Generate or Update Shopify Webhook Secret
 */
export async function updateShopifyWebhookSecret(siteId: string, secret?: string): Promise<{
  success: boolean;
  webhookSecret: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/webhook/secret'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ siteId, secret })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || result.message || `Failed to update webhook secret (${res.status})`);
    }
    return result;
  } catch (error) {
    console.error('updateShopifyWebhookSecret error:', error);
    throw error;
  }
}

/**
 * Fetch Shopify Webhook Logs
 */
export async function fetchShopifyWebhookLogs(): Promise<WebhookLog[]> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/webhook/logs'), {
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch webhook logs (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('fetchShopifyWebhookLogs error:', error);
    throw error;
  }
}

/**
 * Clear Shopify Webhook Logs
 */
export async function clearShopifyWebhookLogs(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/webhook/logs'), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to clear webhook logs (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('clearShopifyWebhookLogs error:', error);
    throw error;
  }
}

/**
 * Import Recent Orders from Shopify Store
 */
export async function syncShopifyOrders(siteId?: string, limit?: number): Promise<{
  success: boolean;
  newCount: number;
  updatedCount: number;
  totalSynced: number;
  lastSyncAt: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/sync'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ siteId, limit })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to sync Shopify orders (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('syncShopifyOrders error:', error);
    throw error;
  }
}

/**
 * Sync Single Order from Shopify Store by Order ID
 */
export async function syncSingleShopifyOrder(
  siteId: string,
  shopifyOrderId: string | number
): Promise<{ success: boolean; order: WebOrder }> {
  try {
    const res = await fetch(getApiUrl('/api/shopify/sync-order'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ siteId, shopifyOrderId })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to sync Shopify order (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('syncSingleShopifyOrder error:', error);
    throw error;
  }
}
