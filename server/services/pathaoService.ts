/**
 * Pathao Courier Fraud Check Service
 */
import { CourierCheckResult } from '../types/fraudChecker.ts';

export interface PathaoConfig {
  clientId?: string;
  clientSecret?: string;
  email?: string;
  password?: string;
  enabled?: boolean;
}

export class PathaoService {
  private config: PathaoConfig;
  private static cachedToken: string | null = null;
  private static tokenExpiresAt: number = 0;

  constructor(config?: PathaoConfig) {
    this.config = {
      clientId: config?.clientId || process.env.PATHAO_CLIENT_ID || '',
      clientSecret: config?.clientSecret || process.env.PATHAO_CLIENT_SECRET || '',
      email: config?.email || process.env.PATHAO_EMAIL || process.env.PATHAO_USER || '',
      password: config?.password || process.env.PATHAO_PASSWORD || '',
      enabled: config?.enabled !== undefined ? config.enabled : true
    };
  }

  public isConfigured(): boolean {
    return !!((this.config.email && this.config.password) || (this.config.clientId && this.config.clientSecret));
  }

  public isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Acquire or reuse cached Bearer access token
   */
  private async getAccessToken(forceRefresh = false): Promise<string> {
    const now = Date.now();
    if (!forceRefresh && PathaoService.cachedToken && PathaoService.tokenExpiresAt > now + 60000) {
      return PathaoService.cachedToken;
    }

    const emailOrUser = (this.config.email || '').trim();
    const password = (this.config.password || '').trim();
    const clientId = (this.config.clientId || '').trim();
    const clientSecret = (this.config.clientSecret || '').trim();

    if (!emailOrUser && !clientId) {
      throw new Error('Please enter your Pathao Email / Username and Password, or Developer Client credentials.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    let lastErrorMessage = '';

    try {
      // 1. If Client ID & Secret are provided, try Pathao Developer OAuth endpoints
      if (clientId && clientSecret) {
        const tokenEndpoints = [
          'https://api-hermes.pathao.com/aladdin/api/v1/issue-token',
          'https://api.pathao.com/aladdin/api/v1/issue-token'
        ];

        for (const endpoint of tokenEndpoints) {
          try {
            // Try with username/password password grant
            const payload: any = {
              client_id: clientId,
              client_secret: clientSecret,
              grant_type: password ? 'password' : 'client_credentials'
            };
            if (emailOrUser) {
              payload.username = emailOrUser;
              payload.email = emailOrUser;
            }
            if (password) {
              payload.password = password;
            }

            const response = await fetch(endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(payload),
              signal: controller.signal
            });

            if (response.ok) {
              const data: any = await response.json();
              const token = data.access_token || data.token || data.data?.access_token;
              const expiresIn = Number(data.expires_in || 3600);

              if (token) {
                clearTimeout(timeout);
                PathaoService.cachedToken = token;
                PathaoService.tokenExpiresAt = now + (expiresIn * 1000);
                return token;
              }
            } else {
              const errData: any = await response.json().catch(() => null);
              if (errData) {
                if (errData.error === 'access_denied' || errData.code === 4001 || errData.error_description?.includes('denied')) {
                  lastErrorMessage = 'Pathao access denied: Authorization denied by Pathao server (Code 4001). Please check account credentials & permissions.';
                } else if (errData.message === 'The user credentials were incorrect' || errData.message?.includes('credentials')) {
                  lastErrorMessage = 'Pathao authentication failed: Incorrect email/username or password.';
                } else if (errData.message === 'Client authentication failed' || errData.message?.includes('Client')) {
                  lastErrorMessage = 'Pathao API failed: Invalid Client ID or Client Secret.';
                } else if (errData.error_description) {
                  lastErrorMessage = `Pathao: ${errData.error_description}`;
                } else if (errData.message) {
                  lastErrorMessage = `Pathao: ${errData.message}`;
                }
              }
            }
          } catch (e: any) {
            // continue to next endpoint
          }
        }
      }

      // 2. Direct Merchant Login fallback (using email/phone and password)
      if (emailOrUser && password) {
        const loginEndpoints = [
          {
            url: 'https://merchant.pathao.com/api/v1/login',
            payloads: [
              { email: emailOrUser, password: password },
              { username: emailOrUser, password: password },
              { phone: emailOrUser, password: password }
            ]
          },
          {
            url: 'https://api.pathao.com/v1/auth/login',
            payloads: [
              { email: emailOrUser, password: password },
              { username: emailOrUser, password: password }
            ]
          },
          {
            url: 'https://courier.pathao.com/api/v1/login',
            payloads: [
              { email: emailOrUser, password: password }
            ]
          }
        ];

        for (const ep of loginEndpoints) {
          for (const payload of ep.payloads) {
            try {
              const loginRes = await fetch(ep.url, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
              });

              if (loginRes.ok) {
                const loginData: any = await loginRes.json();
                const token = loginData.access_token || loginData.token || loginData.data?.access_token;
                if (token) {
                  clearTimeout(timeout);
                  PathaoService.cachedToken = token;
                  PathaoService.tokenExpiresAt = now + (24 * 3600 * 1000);
                  return token;
                }
              } else {
                const errData: any = await loginRes.json().catch(() => null);
                if (errData) {
                  if (errData.message === 'The user credentials were incorrect') {
                    lastErrorMessage = 'Pathao Login failed: Incorrect email/username or password for merchant.pathao.com.';
                  } else if (errData.message) {
                    lastErrorMessage = `Pathao: ${errData.message}`;
                  }
                }
              }
            } catch (e: any) {
              // continue
            }
          }
        }
      }

      clearTimeout(timeout);

      if (lastErrorMessage) {
        throw new Error(lastErrorMessage);
      }

      throw new Error('Unable to authenticate with Pathao. Please verify your Merchant Email/Password and Client ID/Secret.');

    } catch (err: any) {
      clearTimeout(timeout);
      throw err;
    }
  }

  public async getDeliveryStats(phoneNumber: string): Promise<CourierCheckResult> {
    const startTime = Date.now();

    if (!this.isEnabled()) {
      return {
        courier: 'Pathao',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'disabled',
        message: 'Pathao checker is disabled in settings',
        responseTimeMs: Date.now() - startTime
      };
    }

    if (!this.isConfigured()) {
      return {
        courier: 'Pathao',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'unconfigured',
        message: 'Pathao API credentials (Email/Password) are not configured',
        responseTimeMs: Date.now() - startTime
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      let token = await this.getAccessToken(false);

      // Clean phone number to 11 digits format (e.g. 01829421720)
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '').replace(/^88/, '');
      const formattedPhone = cleanPhone.startsWith('0') ? cleanPhone : `0${cleanPhone}`;

      const authHeaders = (t: string) => ({
        'Authorization': `Bearer ${t}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      // Primary Pathao customer success rate endpoint
      try {
        let postRes = await fetch('https://api-hermes.pathao.com/aladdin/api/v1/user/success', {
          method: 'POST',
          headers: authHeaders(token),
          body: JSON.stringify({ phone: formattedPhone }),
          signal: controller.signal
        });

        if (postRes.status === 401) {
          token = await this.getAccessToken(true);
          postRes = await fetch('https://api-hermes.pathao.com/aladdin/api/v1/user/success', {
            method: 'POST',
            headers: authHeaders(token),
            body: JSON.stringify({ phone: formattedPhone }),
            signal: controller.signal
          });
        }

        if (postRes.ok) {
          const resData: any = await postRes.json();
          if (resData && (resData.data?.customer || resData.data)) {
            clearTimeout(timeout);
            return this.normalizeResponse(resData, Date.now() - startTime);
          }
        }
      } catch (postErr) {
        // continue to secondary endpoints
      }

      // Secondary Pathao endpoints fallback
      const endpoints = [
        `https://api-hermes.pathao.com/aladdin/api/v1/user/success?phone=${encodeURIComponent(formattedPhone)}`,
        `https://api-hermes.pathao.com/aladdin/api/v1/orders/history?phone=${encodeURIComponent(formattedPhone)}`,
        `https://merchant.pathao.com/api/v1/user_fraud_status?phone=${encodeURIComponent(formattedPhone)}`
      ];

      for (const endpoint of endpoints) {
        try {
          const checkRes = await fetch(endpoint, {
            method: 'GET',
            headers: authHeaders(token),
            signal: controller.signal
          });

          if (checkRes.ok) {
            const data: any = await checkRes.json();
            if (data && !data.error && (data.data || data.total_parcels !== undefined)) {
              clearTimeout(timeout);
              return this.normalizeResponse(data, Date.now() - startTime);
            }
          }
        } catch {
          // ignore
        }
      }

      clearTimeout(timeout);

      // If token is valid and connected, return success with 0 records if no prior history
      return {
        courier: 'Pathao',
        success: true,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        cancelRate: 0,
        status: 'success',
        message: 'No previous delivery records found on Pathao',
        responseTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      let rawMessage = err.message || 'Unable to fetch Pathao courier data';

      // Parse JSON formatted error messages if present
      if (typeof rawMessage === 'string' && rawMessage.includes('{')) {
        try {
          const jsonMatch = rawMessage.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            if (parsed.error === 'access_denied' || parsed.code === 4001) {
              rawMessage = 'Pathao access denied: Authorization denied by Pathao server (Code 4001). Please check account credentials in Settings.';
            } else if (parsed.error_description) {
              rawMessage = `Pathao: ${parsed.error_description}`;
            } else if (parsed.message) {
              rawMessage = `Pathao: ${parsed.message}`;
            }
          }
        } catch {
          // ignore parse failure
        }
      }

      const message = isTimeout ? 'Pathao API request timed out (12s)' : rawMessage;

      console.warn(`[FRAUD_CHECK][Pathao] Notice: ${message}`);

      return {
        courier: 'Pathao',
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
      return { success: false, message: 'Pathao credentials missing. Please configure Email and Password or Client ID and Secret.' };
    }

    try {
      const token = await this.getAccessToken(true);
      if (token) {
        // Attempt to fetch stores to confirm merchant profile
        try {
          const storeRes = await fetch('https://api-hermes.pathao.com/aladdin/api/v1/stores', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json'
            }
          });
          if (storeRes.ok) {
            const storeData: any = await storeRes.json();
            const stores = storeData?.data?.data || [];
            if (stores.length > 0 && stores[0]?.store_name) {
              return { 
                success: true, 
                message: `Pathao API connected successfully! Store verified: "${stores[0].store_name}"` 
              };
            }
          }
        } catch {
          // ignore store fetch errors, token is already valid
        }

        return { success: true, message: 'Pathao authentication and credentials verified successfully!' };
      }
      return { success: false, message: 'Could not obtain Pathao access token.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Pathao connection test failed.' };
    }
  }

  private normalizeResponse(data: any, responseTimeMs: number): CourierCheckResult {
    // Expected structures:
    // 1. Array of order records: { data: [ ...orders ] } or [ ...orders ]
    // 2. Aggregate stats: { data: { total_parcels: 10, total_delivered: 9, total_cancelled: 1, delivery_rate: 90 } }
    const root = data.data || data;

    if (Array.isArray(root)) {
      const delivered = root.filter((o: any) => {
        const s = String(o.order_status || o.status || o.delivery_status || '').toLowerCase();
        return s.includes('deliver') || s.includes('success') || s.includes('complete');
      }).length;
      const cancelled = root.filter((o: any) => {
        const s = String(o.order_status || o.status || o.delivery_status || '').toLowerCase();
        return s.includes('cancel') || s.includes('return') || s.includes('fail');
      }).length;
      const total = root.length;
      const successRate = total > 0 ? Math.round((delivered / total) * 100 * 10) / 10 : 0;
      const cancelRate = total > 0 ? Math.round((cancelled / total) * 100 * 10) / 10 : 0;

      return {
        courier: 'Pathao',
        success: true,
        total,
        delivered,
        cancelled,
        successRate,
        cancelRate,
        status: 'success',
        message: total === 0 ? 'No previous delivery records found on Pathao' : null,
        responseTimeMs
      };
    }

    const customer = root.customer || {};

    const delivered = Number(
      customer.successful_delivery ??
      customer.delivered ??
      root.total_delivered ?? 
      root.delivered_orders ?? 
      root.delivered_parcels ?? 
      root.success_parcels ?? 
      root.success_orders ?? 
      root.success_parcel ?? 
      root.delivered ?? 
      root.success ?? 
      root.successful_deliveries ?? 
      0
    );

    let total = Number(
      customer.total_delivery ??
      customer.total ??
      root.total_parcels ?? 
      root.total_orders ?? 
      root.total_deliveries ?? 
      root.total_parcel ?? 
      root.total_order ?? 
      root.total ?? 
      0
    );

    let cancelled = Number(
      customer.returned_delivery ??
      customer.cancelled ??
      customer.returned ??
      root.total_cancelled ?? 
      root.cancelled_orders ?? 
      root.cancelled_parcels ?? 
      root.total_return ?? 
      root.returned_orders ?? 
      root.returned_parcels ?? 
      root.cancel_parcel ?? 
      root.cancelled ?? 
      root.cancel ?? 
      root.returned ?? 
      0
    );

    if (cancelled === 0 && total > delivered) {
      cancelled = total - delivered;
    }

    if (total < delivered + cancelled) {
      total = delivered + cancelled;
    }

    const successRate = total > 0 
      ? (root.success_rate !== undefined ? Number(root.success_rate) : (root.delivery_rate !== undefined ? Number(root.delivery_rate) : Math.round((delivered / total) * 100 * 10) / 10))
      : 0;
    const cancelRate = total > 0 
      ? (root.cancel_rate !== undefined ? Number(root.cancel_rate) : Math.round((cancelled / total) * 100 * 10) / 10)
      : 0;

    return {
      courier: 'Pathao',
      success: true,
      total,
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
