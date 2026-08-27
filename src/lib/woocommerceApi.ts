import { WooSite, WebOrder, WebhookLog } from '../types';
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

export async function fetchWooSites(): Promise<WooSite[]> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/sites'), {
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to fetch WooCommerce sites (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('fetchWooSites error:', error);
    throw error;
  }
}

export async function saveWooSite(data: {
  id?: string;
  name: string;
  storeUrl: string;
  consumerKey: string;
  consumerSecret?: string;
  webhookSecret?: string;
  autoSyncInterval?: string;
}): Promise<{ status: string; site: WooSite }> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/sites'), {
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
      throw new Error(err.error || `Failed to save store settings (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('saveWooSite error:', error);
    throw error;
  }
}

export async function testWooConnection(data: {
  siteId?: string;
  storeUrl?: string;
  consumerKey?: string;
  consumerSecret?: string;
}): Promise<{ success: boolean; message: string; storeName?: string; currency?: string; orderCount?: number }> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/sites/test'), {
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
      throw new Error(result.error || result.message || 'Connection test failed');
    }
    return result;
  } catch (error) {
    console.error('testWooConnection error:', error);
    throw error;
  }
}

export async function deleteWooSite(id: string): Promise<{ status: string; message: string }> {
  try {
    const res = await fetch(getApiUrl(`/api/woocommerce/sites/${encodeURIComponent(id)}`), {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to delete store (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('deleteWooSite error:', error);
    throw error;
  }
}

export async function syncWooOrders(siteId?: string, maxPages?: number): Promise<{
  success: boolean;
  newCount: number;
  updatedCount: number;
  totalSynced: number;
  lastSyncAt: string;
  siteResults: Array<{ siteId: string; siteName: string; count: number; error?: string }>;
}> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/sync'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ siteId, maxPages })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to sync WooCommerce orders (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('syncWooOrders error:', error);
    throw error;
  }
}

export async function syncSingleWooOrder(siteId: string, wooOrderId: number | string): Promise<{ success: boolean; order: WebOrder }> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/sync-order'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ siteId, wooOrderId })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to sync order (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('syncSingleWooOrder error:', error);
    throw error;
  }
}

// Manual Sync fallback for a single WooCommerce Order ID
export async function manualSyncSingleOrder(
  orderId: string | number,
  siteId?: string
): Promise<{ 
  success: boolean; 
  order?: WebOrder; 
  isNew?: boolean; 
  message?: string;
  error?: string;
}> {
  try {
    const cleanOrderId = String(orderId).trim().replace(/^#/, '');
    const url = siteId 
      ? getApiUrl(`/api/weborders/manual-sync/${encodeURIComponent(cleanOrderId)}?siteId=${encodeURIComponent(siteId)}`)
      : getApiUrl(`/api/weborders/manual-sync/${encodeURIComponent(cleanOrderId)}`);

    const res = await fetch(url, {
      method: 'POST',
      headers: getAuthHeaders()
    });

    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || data.message || `Failed to sync Order #${cleanOrderId}`);
    }

    return data;
  } catch (error: any) {
    console.error('manualSyncSingleOrder error:', error);
    throw error;
  }
}

export async function updateRemoteWooOrderStatus(orderId: string, status: string): Promise<{ success: boolean; order: WebOrder }> {
  try {
    const res = await fetch(getApiUrl(`/api/woocommerce/orders/${encodeURIComponent(orderId)}/status`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ status })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update order status (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('updateRemoteWooOrderStatus error:', error);
    throw error;
  }
}

export async function updateCustomOrderStatus(orderId: string, custom_status: string): Promise<{ success: boolean; order: WebOrder }> {
  try {
    const res = await fetch(getApiUrl(`/api/woocommerce/orders/${encodeURIComponent(orderId)}/custom-status`), {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ custom_status })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Failed to update custom order status (${res.status})`);
    }
    return await res.json();
  } catch (error) {
    console.error('updateCustomOrderStatus error:', error);
    throw error;
  }
}

// Fetch recent Webhook Logs
export async function fetchWebhookLogs(): Promise<WebhookLog[]> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/webhook/logs'), {
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
    console.error('fetchWebhookLogs error:', error);
    throw error;
  }
}

// Clear Webhook Logs
export async function clearWebhookLogs(): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/webhook/logs'), {
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
    console.error('clearWebhookLogs error:', error);
    throw error;
  }
}

// Auto-Register Webhook on WooCommerce Store
export async function autoRegisterWebhook(siteId: string, customSecret?: string): Promise<{
  success: boolean;
  webhookId?: number | string;
  deliveryUrl: string;
  message: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/webhook/register'), {
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
      throw new Error(result.error || result.message || `Failed to register webhook (${res.status})`);
    }
    return result;
  } catch (error) {
    console.error('autoRegisterWebhook error:', error);
    throw error;
  }
}

// Run Diagnostic Test for Webhook
export async function testWebhook(siteId: string): Promise<{
  success: boolean;
  message: string;
  log?: WebhookLog;
}> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/webhook/test'), {
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
    console.error('testWebhook error:', error);
    throw error;
  }
}

// Generate or Update Webhook Secret
export async function updateWebhookSecret(siteId: string, secret?: string): Promise<{
  success: boolean;
  webhookSecret: string;
}> {
  try {
    const res = await fetch(getApiUrl('/api/woocommerce/webhook/secret'), {
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
      throw new Error(result.error || result.message || `Failed to update secret (${res.status})`);
    }
    return result;
  } catch (error) {
    console.error('updateWebhookSecret error:', error);
    throw error;
  }
}

// Fetch single Web Order by dynamic ID (wooOrderId, orderNumber, or internal ID)
export async function fetchWebOrderById(orderId: string | number): Promise<{ success: boolean; order: WebOrder }> {
  try {
    const cleanId = String(orderId).trim();
    const res = await fetch(getApiUrl(`/api/web-orders/${encodeURIComponent(cleanId)}`), {
      headers: getAuthHeaders()
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 404) {
      throw new Error(data.message || data.error || `The requested web order #${cleanId} could not be found.`);
    }
    if (!res.ok) {
      throw new Error(data.error || `Unable to load order details (${res.status})`);
    }
    return data;
  } catch (error) {
    console.error('fetchWebOrderById error:', error);
    throw error;
  }
}

// Approve Web Order by dynamic ID
export async function approveWebOrder(
  orderId: string | number, 
  data?: { deliveryMethod?: string; note?: string }
): Promise<{ success: boolean; order: WebOrder; mainOrder?: any; message: string }> {
  try {
    const cleanId = String(orderId).trim();
    const res = await fetch(getApiUrl(`/api/web-orders/${encodeURIComponent(cleanId)}/approve`), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data || {})
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || result.message || `Failed to approve order #${cleanId}`);
    }
    return result;
  } catch (error) {
    console.error('approveWebOrder error:', error);
    throw error;
  }
}

// Bulk Approve Web Orders
export async function bulkApproveWebOrders(
  ids: (string | number)[],
  data?: { deliveryMethod?: string }
): Promise<{ success: boolean; count: number; orders: WebOrder[]; mainOrders: any[]; message: string }> {
  try {
    const res = await fetch(getApiUrl('/api/web-orders/bulk-approve'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ ids, ...(data || {}) })
    });
    if (res.status === 401) {
      handleUnauthorized();
      throw new Error('Unauthorized');
    }
    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || result.message || 'Failed to bulk approve orders');
    }
    return result;
  } catch (error) {
    console.error('bulkApproveWebOrders error:', error);
    throw error;
  }
}


