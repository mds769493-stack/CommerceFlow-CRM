import crypto from 'crypto';
import * as dbManager from './db.ts';

export interface ShopifySiteRecord {
  id: string;
  userId: string;
  name: string;
  shopDomain: string; // normalized e.g. "myshop.myshopify.com"
  storeUrl?: string; // full URL e.g. "https://myshop.myshopify.com"
  accessToken: string;
  apiKey?: string;
  apiSecret?: string;
  webhookSecret?: string;
  webhookId?: number | string;
  webhookStatus?: 'active' | 'inactive' | 'paused';
  webhookDeliveryUrl?: string;
  status: 'Connected' | 'Disconnected' | 'Error';
  lastSyncAt?: string;
  currency?: string;
  currencyCode?: string;
  errorMessage?: string;
  totalOrdersCount?: number;
  lastWebhookReceivedAt?: string;
  lastOrderReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const SHOPIFY_API_VERSION = '2024-04';

/**
 * Clean and normalize a Shopify domain string
 * Examples:
 * - "https://my-store.myshopify.com/" -> "my-store.myshopify.com"
 * - "my-store.myshopify.com" -> "my-store.myshopify.com"
 * - "my-store" -> "my-store.myshopify.com"
 */
export function normalizeShopDomain(input: string): string {
  if (!input) return '';
  let domain = input.trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '');
  domain = domain.replace(/\/.*$/, '');
  domain = domain.replace(/:[0-9]+$/, '');

  if (!domain.includes('.')) {
    domain = `${domain}.myshopify.com`;
  }
  return domain;
}

/**
 * Mask sensitive credentials for safe client display
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '';
  if (secret.length <= 8) return '••••••••';
  return secret.slice(0, 4) + '••••••••' + secret.slice(-4);
}

/**
 * Build headers for Shopify Admin REST API requests
 */
export function getShopifyHeaders(accessToken: string) {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Shopify-Access-Token': accessToken.trim(),
    'User-Agent': 'CommerceFlow-Shopify-Hub/1.0'
  };
}

/**
 * Test Shopify API connection using Shop endpoint
 */
export async function testShopifyConnection(params: {
  shopDomain: string;
  accessToken: string;
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
  const domain = normalizeShopDomain(params.shopDomain);
  const token = params.accessToken?.trim();

  if (!domain) {
    throw new Error('Shopify store domain is required');
  }
  if (!token) {
    throw new Error('Shopify Admin API Access Token is required');
  }

  const endpoint = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`;

  try {
    console.log(`[SHOPIFY API] Testing connection to ${endpoint}...`);
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: getShopifyHeaders(token)
    });

    const responseText = await response.text();
    let data: any = {};
    try {
      data = JSON.parse(responseText);
    } catch {
      // response wasn't JSON
    }

    if (!response.ok) {
      let errMsg = data.errors 
        ? (typeof data.errors === 'string' ? data.errors : JSON.stringify(data.errors))
        : `Shopify API returned HTTP ${response.status}: ${response.statusText}`;

      // If custom domain failed with 404/endpoint not found, give specific helpful guidance
      if (response.status === 404 || errMsg.toLowerCase().includes('not found')) {
        errMsg = `API endpoint not found. Please use your Shopify permanent domain (e.g. "yourstore.myshopify.com" instead of custom domain) and make sure your Admin Access Token starts with "shpat_".`;
      } else if (response.status === 401 || response.status === 403) {
        errMsg = `Invalid or unauthorized Access Token (${response.status}). Please check that your token starts with "shpat_" and has read_orders / write_orders scopes enabled.`;
      }
      
      console.warn(`[SHOPIFY API ERROR] Connection test failed for ${domain}:`, errMsg);
      return {
        success: false,
        message: errMsg,
        error: errMsg
      };
    }

    const shop = data.shop;
    if (!shop) {
      return {
        success: false,
        message: 'Invalid response from Shopify (no shop object found)',
        error: 'No shop data returned'
      };
    }

    // Optional: Fetch order count
    let orderCount = 0;
    try {
      const countRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/orders/count.json?status=any`, {
        headers: getShopifyHeaders(token)
      });
      if (countRes.ok) {
        const countData = await countRes.json();
        orderCount = countData.count || 0;
      }
    } catch (countErr) {
      console.log(`[SHOPIFY API] Count fetch skipped for ${domain}`);
    }

    console.log(`[SHOPIFY API SUCCESS] Store verified: "${shop.name}" (${shop.myshopify_domain}), Currency: ${shop.currency}, Orders: ${orderCount}`);

    return {
      success: true,
      message: `Successfully connected to Shopify Store: ${shop.name}!`,
      shop: {
        id: shop.id,
        name: shop.name,
        email: shop.email,
        domain: shop.domain || domain,
        myshopifyDomain: shop.myshopify_domain || domain,
        currency: shop.currency || 'BDT',
        countryName: shop.country_name,
        orderCount
      }
    };
  } catch (err: any) {
    console.error(`[SHOPIFY API ERROR] Connection exception for ${domain}:`, err.message);
    return {
      success: false,
      message: `Could not connect to Shopify: ${err.message}`,
      error: err.message
    };
  }
}

/**
 * Fetch a single Shopify order by Order ID or Order Name/Number
 */
export async function fetchSingleShopifyOrder(
  site: ShopifySiteRecord,
  orderIdOrNumber: string | number
): Promise<any | null> {
  const domain = normalizeShopDomain(site.shopDomain);
  const token = site.accessToken?.trim();
  const cleanId = String(orderIdOrNumber).trim().replace(/^#/, '');

  if (!domain || !token) {
    throw new Error('Shopify store domain or token is missing');
  }

  // 1. Try direct ID endpoint if cleanId is purely numeric
  if (/^\d+$/.test(cleanId)) {
    try {
      const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/orders/${cleanId}.json`;
      const res = await fetch(url, { headers: getShopifyHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.order) return data.order;
      }
    } catch (e: any) {
      console.warn(`[SHOPIFY API] Direct order fetch failed for ID ${cleanId}:`, e.message);
    }
  }

  // 2. Try searching by name / order_number query
  try {
    const searchUrl = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?name=${encodeURIComponent(cleanId)}&status=any&limit=5`;
    const searchRes = await fetch(searchUrl, { headers: getShopifyHeaders(token) });
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData && Array.isArray(searchData.orders) && searchData.orders.length > 0) {
        return searchData.orders[0];
      }
    }
  } catch (e: any) {
    console.warn(`[SHOPIFY API] Order search failed for query ${cleanId}:`, e.message);
  }

  return null;
}

/**
 * Fetch recent orders from Shopify store for manual sync / import
 */
export async function fetchShopifyOrders(
  site: ShopifySiteRecord,
  limit: number = 50
): Promise<any[]> {
  const domain = normalizeShopDomain(site.shopDomain);
  const token = site.accessToken?.trim();

  if (!domain || !token) {
    throw new Error('Shopify store domain or token is missing');
  }

  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&limit=${Math.min(limit, 250)}`;
  const res = await fetch(url, { headers: getShopifyHeaders(token) });

  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    throw new Error(`Shopify API error (${res.status}): ${errBody || res.statusText}`);
  }

  const data = await res.json();
  return Array.isArray(data.orders) ? data.orders : [];
}

/**
 * Register webhooks on Shopify store via Admin REST API
 */
export async function registerShopifyWebhook(
  site: ShopifySiteRecord,
  deliveryUrl: string,
  topic: string = 'orders/create'
): Promise<{
  success: boolean;
  webhookId?: number | string;
  topic: string;
  address: string;
  message: string;
  error?: string;
}> {
  const domain = normalizeShopDomain(site.shopDomain);
  const token = site.accessToken?.trim();

  if (!domain || !token) {
    throw new Error('Shopify store domain or token is missing');
  }

  // 1. First, check existing webhooks on the store to avoid creating exact duplicate
  let existingWebhooks: any[] = [];
  try {
    const listRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
      headers: getShopifyHeaders(token)
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      existingWebhooks = Array.isArray(listData.webhooks) ? listData.webhooks : [];
    }
  } catch (e) {
    console.warn(`[SHOPIFY API] Could not list existing webhooks:`, e);
  }

  // If already registered with this exact delivery URL and topic
  const matching = existingWebhooks.find((w: any) => w.topic === topic && w.address === deliveryUrl);
  if (matching) {
    console.log(`[SHOPIFY API] Webhook "${topic}" is already registered on ${domain} (ID: ${matching.id})`);
    return {
      success: true,
      webhookId: matching.id,
      topic,
      address: deliveryUrl,
      message: `Webhook already active on Shopify store (ID: ${matching.id})`
    };
  }

  // 2. Create new webhook subscription
  const payload = {
    webhook: {
      topic,
      address: deliveryUrl,
      format: 'json'
    }
  };

  const createRes = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
    method: 'POST',
    headers: getShopifyHeaders(token),
    body: JSON.stringify(payload)
  });

  const resText = await createRes.text();
  let resData: any = {};
  try {
    resData = JSON.parse(resText);
  } catch {}

  if (!createRes.ok) {
    const errorMsg = resData.errors 
      ? (typeof resData.errors === 'string' ? resData.errors : JSON.stringify(resData.errors))
      : `HTTP ${createRes.status} (${resText})`;
    
    // Check if error is "address has already been taken"
    if (errorMsg.includes('already been taken') || errorMsg.includes('already exists')) {
      return {
        success: true,
        topic,
        address: deliveryUrl,
        message: 'Webhook subscription already exists on Shopify.'
      };
    }

    throw new Error(`Failed to register webhook on Shopify: ${errorMsg}`);
  }

  const created = resData.webhook;
  return {
    success: true,
    webhookId: created?.id,
    topic: created?.topic || topic,
    address: created?.address || deliveryUrl,
    message: `Shopify Real-Time Webhook registered successfully! (ID: ${created?.id})`
  };
}

/**
 * List all registered webhooks for a Shopify store
 */
export async function listShopifyWebhooks(site: ShopifySiteRecord): Promise<any[]> {
  const domain = normalizeShopDomain(site.shopDomain);
  const token = site.accessToken?.trim();

  if (!domain || !token) return [];

  const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
    headers: getShopifyHeaders(token)
  });

  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.webhooks) ? data.webhooks : [];
}

/**
 * Delete a registered webhook from a Shopify store
 */
export async function deleteShopifyWebhook(
  site: ShopifySiteRecord,
  webhookId: number | string
): Promise<boolean> {
  const domain = normalizeShopDomain(site.shopDomain);
  const token = site.accessToken?.trim();

  if (!domain || !token || !webhookId) return false;

  const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/webhooks/${webhookId}.json`, {
    method: 'DELETE',
    headers: getShopifyHeaders(token)
  });

  return res.ok;
}

// In-memory cache for product images
const productImageCache = new Map<string, { mainImage: string; variantImages: Record<string, string> }>();

/**
 * Fetch product images batch from Shopify Admin REST API
 */
export async function fetchProductImagesMap(
  site: ShopifySiteRecord,
  productIds: Array<number | string>
): Promise<Map<string, { mainImage: string; variantImages: Record<string, string> }>> {
  const domain = normalizeShopDomain(site.shopDomain);
  const token = site.accessToken?.trim();
  const resultMap = new Map<string, { mainImage: string; variantImages: Record<string, string> }>();

  if (!domain || !token || !productIds || productIds.length === 0) {
    return resultMap;
  }

  // Filter unique valid product IDs
  const cleanIds = Array.from(new Set(
    productIds
      .map(id => String(id).trim())
      .filter(id => id && /^\d+$/.test(id))
  ));

  const missingIds: string[] = [];
  for (const id of cleanIds) {
    const cacheKey = `${domain}_${id}`;
    if (productImageCache.has(cacheKey)) {
      resultMap.set(id, productImageCache.get(cacheKey)!);
    } else {
      missingIds.push(id);
    }
  }

  if (missingIds.length === 0) {
    return resultMap;
  }

  // Fetch in batches of 50
  const CHUNK_SIZE = 50;
  for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
    const chunk = missingIds.slice(i, i + CHUNK_SIZE);
    try {
      const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/products.json?ids=${chunk.join(',')}&fields=id,image,images,variants`;
      const res = await fetch(url, { headers: getShopifyHeaders(token) });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.products)) {
          for (const prod of data.products) {
            const prodIdStr = String(prod.id);
            const mainImg = prod.image?.src || (Array.isArray(prod.images) && prod.images[0]?.src) || '';
            const variantImages: Record<string, string> = {};

            if (Array.isArray(prod.variants) && Array.isArray(prod.images)) {
              for (const variant of prod.variants) {
                if (variant.image_id) {
                  const matchedImg = prod.images.find((img: any) => img.id === variant.image_id);
                  if (matchedImg && matchedImg.src) {
                    variantImages[String(variant.id)] = matchedImg.src;
                  }
                }
              }
            }

            const entry = { mainImage: mainImg, variantImages };
            resultMap.set(prodIdStr, entry);
            productImageCache.set(`${domain}_${prodIdStr}`, entry);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[SHOPIFY PRODUCT IMAGE] Failed fetching images for ${chunk.join(',')}:`, err.message);
    }
  }

  return resultMap;
}
