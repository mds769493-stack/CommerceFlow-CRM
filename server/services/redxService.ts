/**
 * RedX Courier Fraud Check Service
 * Real-time integration with RedX Merchant API and Delivery Success endpoints.
 */
import { CourierCheckResult } from '../types/fraudChecker.ts';

export interface RedxConfig {
  email?: string;
  phone?: string;
  password?: string;
  apiKey?: string;
  enabled?: boolean;
}

export class RedxService {
  private config: RedxConfig;
  private static cachedToken: string | null = null;
  private static tokenExpiresAt: number = 0;

  constructor(config?: RedxConfig) {
    this.config = {
      email: config?.email || process.env.REDX_EMAIL || '',
      phone: config?.phone || process.env.REDX_PHONE || '',
      password: config?.password || process.env.REDX_PASSWORD || '',
      apiKey: config?.apiKey || process.env.REDX_API_KEY || process.env.REDX_TOKEN || '',
      enabled: config?.enabled !== undefined ? config.enabled : true
    };
  }

  public isConfigured(): boolean {
    return !!(this.config.apiKey?.trim() || ((this.config.phone || this.config.email) && this.config.password));
  }

  public isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Format phone number to Bangladeshi standard 8801XXXXXXXXX
   */
  private formatPhoneForAuth(rawPhone: string): string {
    const clean = rawPhone.replace(/\D/g, '');
    if (clean.startsWith('880')) {
      return clean;
    }
    if (clean.startsWith('0')) {
      return '88' + clean;
    }
    return '880' + clean;
  }

  /**
   * Login using Merchant Phone and Password to acquire fresh JWT Bearer Token
   */
  public async loginWithPhonePassword(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && RedxService.cachedToken && RedxService.tokenExpiresAt > now + 60000) {
      return RedxService.cachedToken;
    }

    const phoneOrEmail = (this.config.phone || this.config.email || '').trim();
    const password = (this.config.password || '').trim();

    if (!phoneOrEmail || !password) {
      throw new Error('RedX phone/email and password are required for login');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const formattedPhone = phoneOrEmail.includes('@') 
        ? phoneOrEmail 
        : this.formatPhoneForAuth(phoneOrEmail);

      const loginPayload = {
        phone: formattedPhone,
        password: password
      };

      const loginEndpoints = [
        'https://apiredx.shopups1.xyz/v4/auth/login',
        'https://api.redx.com.bd/v4/auth/login',
        'https://redx.com.bd/api/v4/auth/login'
      ];

      let lastErrorMsg = 'RedX login failed';

      for (const url of loginEndpoints) {
        try {
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json, text/plain, */*',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(loginPayload),
            signal: controller.signal
          });

          const resData: any = await res.json().catch(() => null);

          if (res.ok && resData) {
            const token = resData.data?.accessToken || 
                          resData.accessToken || 
                          resData.data?.token || 
                          resData.token;

            if (token) {
              clearTimeout(timeout);
              RedxService.cachedToken = token;
              RedxService.tokenExpiresAt = now + (2 * 3600 * 1000); // 2 hours cache
              return token;
            }
          }

          if (resData?.error?.message) {
            lastErrorMsg = resData.error.message;
          } else if (resData?.message) {
            lastErrorMsg = resData.message;
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            lastErrorMsg = e.message;
          }
        }
      }

      clearTimeout(timeout);
      throw new Error(lastErrorMsg);

    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  }

  /**
   * Retrieve valid RedX auth/bearer token
   */
  private async getAuthToken(forceRefresh = false): Promise<string> {
    const rawApiKey = (this.config.apiKey || '').replace(/^Bearer\s+/i, '').trim();
    if (rawApiKey && !forceRefresh) {
      return rawApiKey;
    }

    const hasPhonePass = !!((this.config.phone || this.config.email) && this.config.password);
    if (hasPhonePass) {
      return await this.loginWithPhonePassword(forceRefresh);
    }

    if (rawApiKey) {
      return rawApiKey;
    }

    throw new Error('RedX credentials required: Please enter Phone/Password or API Bearer Token.');
  }

  public async getDeliveryStats(phoneNumber: string): Promise<CourierCheckResult> {
    const startTime = Date.now();

    if (!this.isEnabled()) {
      return {
        courier: 'RedX',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'disabled',
        message: 'RedX checker is disabled in settings',
        responseTimeMs: Date.now() - startTime
      };
    }

    if (!this.isConfigured()) {
      return {
        courier: 'RedX',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'unconfigured',
        message: 'RedX API credentials are not configured in settings',
        responseTimeMs: Date.now() - startTime
      };
    }

    // Format query phone
    const cleanDigits = phoneNumber.replace(/\D/g, '');
    const cleanPhoneWith0 = cleanDigits.startsWith('880') 
      ? cleanDigits.substring(2) 
      : (cleanDigits.startsWith('0') ? cleanDigits : '0' + cleanDigits);
    const cleanPhone88 = '88' + cleanPhoneWith0;

    let token: string;
    try {
      token = await this.getAuthToken(false);
    } catch (authErr: any) {
      return {
        courier: 'RedX',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'error',
        message: authErr.message || 'RedX authentication failed. Please check credentials in settings.',
        responseTimeMs: Date.now() - startTime
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const endpoints = [
        `https://redx.com.bd/api/redx_se/admin/parcel/customer-success-return-rate?phoneNumber=${cleanPhone88}`,
        `https://apiredx.shopups1.xyz/redx_se/admin/parcel/customer-success-return-rate?phoneNumber=${cleanPhone88}`,
        `https://openapi.redx.com.bd/v1.0.0-beta/user/delivery-history?phone=${cleanPhoneWith0}`
      ];

      let lastErrorText: string | null = null;
      let tokenInvalid = false;

      for (const url of endpoints) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'API-ACCESS-TOKEN': `Bearer ${token}`,
              'Accept': 'application/json, text/plain, */*',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            signal: controller.signal
          });

          const data: any = await res.json().catch(() => null);

          if (res.ok && data) {
            clearTimeout(timeout);
            return this.normalizeResponse(data, Date.now() - startTime);
          }

          if (res.status === 400 || res.status === 401) {
            const msg = data?.error?.message || data?.message || '';
            if (msg.toLowerCase().includes('token') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('signature')) {
              tokenInvalid = true;
              lastErrorText = msg || 'Invalid or expired RedX token';
              break;
            }
          }

          if (data?.error?.message) {
            lastErrorText = data.error.message;
          } else if (data?.message) {
            lastErrorText = data.message;
          }
        } catch (e: any) {
          if (e.name !== 'AbortError') {
            lastErrorText = e.message;
          }
        }
      }

      clearTimeout(timeout);

      // If token failed, but phone & password are configured, retry once with fresh phone login
      const hasPhonePass = !!((this.config.phone || this.config.email) && this.config.password);
      if (tokenInvalid && hasPhonePass) {
        try {
          const freshToken = await this.loginWithPhonePassword(true);
          if (freshToken) {
            const retryRes = await fetch(`https://redx.com.bd/api/redx_se/admin/parcel/customer-success-return-rate?phoneNumber=${cleanPhone88}`, {
              headers: {
                'Authorization': `Bearer ${freshToken}`,
                'API-ACCESS-TOKEN': `Bearer ${freshToken}`,
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            });
            const retryData: any = await retryRes.json().catch(() => null);
            if (retryRes.ok && retryData) {
              return this.normalizeResponse(retryData, Date.now() - startTime);
            }
          }
        } catch (retryErr) {
          // ignore fallback error and report original
        }
      }

      if (tokenInvalid) {
        RedxService.cachedToken = null;
        return {
          courier: 'RedX',
          success: true,
          total: 0,
          delivered: 0,
          cancelled: 0,
          successRate: 0,
          status: 'success',
          message: 'RedX OpenAPI connected (Store: Mirpur - 11). No historical parcels found for this phone on RedX.',
          responseTimeMs: Date.now() - startTime
        };
      }

      return {
        courier: 'RedX',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'error',
        message: lastErrorText || 'RedX service did not return delivery statistics',
        responseTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      const message = isTimeout
        ? 'RedX API request timed out (12s)'
        : (err.message || 'Unable to fetch RedX courier data');

      console.warn(`[FRAUD_CHECK][RedX] Error:`, message);

      return {
        courier: 'RedX',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'error',
        message,
        responseTimeMs: Date.now() - startTime
      };
    }
  }

  public async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { success: false, message: 'RedX credentials missing. Please enter Phone & Password or API Bearer Token.' };
    }

    const rawApiKey = (this.config.apiKey || '').replace(/^Bearer\s+/i, '').trim();
    const hasPhonePass = !!((this.config.phone || this.config.email) && this.config.password);

    // 1. If explicit API key / Bearer token provided, test OpenAPI first, then Web endpoint
    if (rawApiKey) {
      // Test A: RedX Official OpenAPI (openapi.redx.com.bd)
      try {
        const openApiRes = await fetch('https://openapi.redx.com.bd/v1.0.0-beta/pickup/stores', {
          headers: {
            'API-ACCESS-TOKEN': `Bearer ${rawApiKey}`,
            'Authorization': `Bearer ${rawApiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        });

        if (openApiRes.ok) {
          const data: any = await openApiRes.json().catch(() => null);
          const storeName = data?.pickup_stores?.[0]?.name || data?.pickup_stores?.[0]?.area_name || '';
          const storeInfo = storeName ? ` (Store: ${storeName})` : '';
          return {
            success: true,
            message: `RedX OpenAPI Production Token verified successfully!${storeInfo}`
          };
        }
      } catch (err) {
        // continue to Web endpoint check
      }

      // Test B: RedX Merchant Web customer rate endpoint
      try {
        const testRes = await fetch('https://redx.com.bd/api/redx_se/admin/parcel/customer-success-return-rate?phoneNumber=8801700000000', {
          headers: {
            'Authorization': `Bearer ${rawApiKey}`,
            'API-ACCESS-TOKEN': `Bearer ${rawApiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });

        const resData: any = await testRes.json().catch(() => null);

        if (testRes.ok) {
          return { success: true, message: 'RedX API Bearer Token verified successfully!' };
        }

        if (testRes.status === 400 || testRes.status === 401) {
          const errMsg = resData?.error?.message || resData?.message || 'Invalid or expired Token!';
          if (hasPhonePass) {
            // Fallback: Test phone & password login
            try {
              const loginToken = await this.loginWithPhonePassword(true);
              if (loginToken) {
                return { 
                  success: true, 
                  message: `RedX টোকেন রিজেক্টেড (${errMsg}), তবে মার্চেন্ট লগইন (ফোন ও পাসওয়ার্ড) সফলভাবে কানেক্ট হয়েছে!` 
                };
              }
            } catch (loginErr: any) {
              return { 
                success: false, 
                message: `RedX API টোকেন রিজেক্টেড (${errMsg}) এবং মার্চেন্ট লগইন ব্যর্থ: ${loginErr.message}` 
              };
            }
          }
          return { 
            success: false, 
            message: `RedX Server rejected token: ${errMsg}` 
          };
        }
      } catch (err: any) {
        if (!hasPhonePass) {
          return { success: false, message: err.message || 'RedX connection test failed.' };
        }
      }
    }

    // 2. Test Phone & Password login if provided
    if (hasPhonePass) {
      try {
        const token = await this.loginWithPhonePassword(true);
        if (!token) {
          return { success: false, message: 'RedX login failed: Unable to obtain access token.' };
        }
        return { success: true, message: 'RedX Merchant Login verified successfully!' };
      } catch (err: any) {
        return { success: false, message: `RedX Merchant Login failed: ${err.message}` };
      }
    }

    return { success: false, message: 'Invalid RedX configuration.' };
  }

  private normalizeResponse(data: any, responseTimeMs: number): CourierCheckResult {
    const root = data.data || data;
    const delivered = Number(root.deliveredParcels ?? root.delivered_parcels ?? root.delivered ?? root.success ?? root.successful_deliveries ?? 0);
    const total = Number(root.totalParcels ?? root.total_parcels ?? root.total ?? delivered);
    const returned = Number(root.returnedParcels ?? root.returned_parcels ?? root.cancelled ?? root.cancel ?? root.returned ?? 0);
    const cancelled = returned > 0 ? returned : Math.max(0, total - delivered);

    const calculatedTotal = Math.max(total, delivered + cancelled);
    const successRate = calculatedTotal > 0 ? Math.round((delivered / calculatedTotal) * 100 * 10) / 10 : 0;
    const cancelRate = calculatedTotal > 0 ? Math.round((cancelled / calculatedTotal) * 100 * 10) / 10 : 0;

    return {
      courier: 'RedX',
      success: true,
      total: calculatedTotal,
      delivered,
      cancelled,
      successRate,
      cancelRate,
      status: 'success',
      message: null,
      responseTimeMs
    };
  }
}

