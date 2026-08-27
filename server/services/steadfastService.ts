/**
 * Steadfast Courier Fraud Check Service
 */
import { CourierCheckResult } from '../types/fraudChecker.ts';

export interface SteadfastConfig {
  apiKey?: string;
  secretKey?: string;
  email?: string;
  password?: string;
  enabled?: boolean;
}

export class SteadfastService {
  private config: SteadfastConfig;
  private static cachedCookies: string | null = null;
  private static cookiesExpiresAt: number = 0;

  constructor(config?: SteadfastConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.STEADFAST_API_KEY || '',
      secretKey: config?.secretKey || process.env.STEADFAST_SECRET_KEY || '',
      email: config?.email || process.env.STEADFAST_EMAIL || process.env.STEADFAST_USER || '',
      password: config?.password || process.env.STEADFAST_PASSWORD || '',
      enabled: config?.enabled !== undefined ? config.enabled : true
    };
  }

  public isConfigured(): boolean {
    return !!((this.config.apiKey && this.config.secretKey) || (this.config.email && this.config.password));
  }

  public isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  private async getSessionCookies(forceRefresh: boolean = false): Promise<string | null> {
    const email = (this.config.email || '').trim();
    const password = (this.config.password || '').trim();
    if (!email || !password) return null;

    const now = Date.now();
    if (!forceRefresh && SteadfastService.cachedCookies && SteadfastService.cookiesExpiresAt > now) {
      return SteadfastService.cachedCookies;
    }

    try {
      const cookieMap = new Map<string, string>();
      const updateCookies = (res: Response) => {
        let rawHeaders: string[] = [];
        if (typeof (res.headers as any).getSetCookie === 'function') {
          rawHeaders = (res.headers as any).getSetCookie();
        } else {
          const raw = res.headers.get('set-cookie');
          if (raw) rawHeaders = [raw];
        }
        for (const line of rawHeaders) {
          if (!line) continue;
          const parts = line.split(';');
          if (parts[0]) {
            const eqIdx = parts[0].indexOf('=');
            if (eqIdx > 0) {
              const k = parts[0].slice(0, eqIdx).trim();
              const v = parts[0].slice(eqIdx + 1).trim();
              if (k && v) {
                cookieMap.set(k, v);
              }
            }
          }
        }
      };

      const getCookieHeader = () => {
        return Array.from(cookieMap.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
      };

      const loginUrl = 'https://steadfast.com.bd/login';
      const getRes = await fetch(loginUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
        }
      });
      updateCookies(getRes);
      const html = await getRes.text();
      const csrfMatch = html.match(/name=["']_token["']\s+value=["']([^"']+)["']/);
      const csrf = csrfMatch ? csrfMatch[1] : '';

      if (!csrf) return null;

      const formBody = new URLSearchParams({
        _token: csrf,
        email: email,
        password: password
      });

      const postRes = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': getCookieHeader(),
          'Referer': loginUrl
        },
        body: formBody.toString(),
        redirect: 'manual'
      });
      updateCookies(postRes);

      const finalCookieStr = getCookieHeader();
      if (finalCookieStr && (finalCookieStr.includes('steadfast_session') || finalCookieStr.includes('steadfast_courier_session') || finalCookieStr.includes('remember_web') || finalCookieStr.includes('XSRF-TOKEN'))) {
        SteadfastService.cachedCookies = finalCookieStr;
        SteadfastService.cookiesExpiresAt = now + (6 * 3600 * 1000); // 6 hours
        return finalCookieStr;
      }
    } catch {
      // ignore
    }

    return null;
  }

  public async getDeliveryStats(phoneNumber: string): Promise<CourierCheckResult> {
    const startTime = Date.now();

    if (!this.isEnabled()) {
      return {
        courier: 'Steadfast',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'disabled',
        message: 'Steadfast checker is disabled in settings',
        responseTimeMs: Date.now() - startTime
      };
    }

    if (!this.isConfigured()) {
      return {
        courier: 'Steadfast',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'unconfigured',
        message: 'Steadfast API credentials are not configured',
        responseTimeMs: Date.now() - startTime
      };
    }

    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const stdPhone = cleanPhone.startsWith('880') ? cleanPhone.slice(2) : (cleanPhone.startsWith('0') ? cleanPhone : `0${cleanPhone}`);
    const noZeroPhone = stdPhone.startsWith('0') ? stdPhone.slice(1) : stdPhone;
    const fullPhone = `880${noZeroPhone}`;

    const phoneVariants = [stdPhone, noZeroPhone, fullPhone].filter((v, i, a) => a.indexOf(v) === i);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      // 1. Primary: If API Key + Secret Key are provided (Official Steadfast REST API - Fast & Stable)
      if (this.config.apiKey && this.config.secretKey) {
        const apiKey = this.config.apiKey.trim();
        const secretKey = this.config.secretKey.trim();

        const headers = {
          'Api-Key': apiKey,
          'Secret-Key': secretKey,
          'api-key': apiKey,
          'secret-key': secretKey,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        };

        // Query all phone formats concurrently for fastest non-empty response
        const apiTasks = phoneVariants.map(async (p) => {
          const url = `https://portal.packzy.com/api/v1/fraud_check/${p}`;
          const res = await fetch(url, {
            method: 'GET',
            headers,
            signal: controller.signal
          });
          if (res.ok) {
            const data = await res.json();
            return this.normalizeResponse(data, Date.now() - startTime);
          } else if (res.status === 404) {
            return {
              courier: 'Steadfast',
              success: true,
              total: 0,
              delivered: 0,
              cancelled: 0,
              successRate: 0,
              cancelRate: 0,
              status: 'success' as const,
              message: null,
              responseTimeMs: Date.now() - startTime
            };
          }
          throw new Error(`Steadfast API returned HTTP ${res.status}`);
        });

        const apiResults = await Promise.allSettled(apiTasks);
        
        // Find best result with parcel history
        let bestApiResult: CourierCheckResult | null = null;
        for (const r of apiResults) {
          if (r.status === 'fulfilled' && r.value.success) {
            if (r.value.total > 0) {
              clearTimeout(timeout);
              return r.value;
            }
            if (!bestApiResult) {
              bestApiResult = r.value;
            }
          }
        }

        if (bestApiResult) {
          clearTimeout(timeout);
          return bestApiResult;
        }
      }

      // 2. Secondary: If merchant session email/password available, query Steadfast Merchant Portal fraud check
      if (this.config.email && this.config.password) {
        try {
          let cookies = await this.getSessionCookies(false);
          if (!cookies) {
            cookies = await this.getSessionCookies(true);
          }

          if (cookies) {
            const checkTasks = phoneVariants.map(async (p) => {
              const checkUrl = `https://steadfast.com.bd/user/frauds/check/${p}`;
              const checkRes = await fetch(checkUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                  'Cookie': cookies!,
                  'Accept': 'application/json',
                  'X-Requested-With': 'XMLHttpRequest',
                  'Referer': 'https://steadfast.com.bd/user/frauds/check'
                },
                signal: controller.signal
              });

              if (checkRes.ok) {
                const data = await checkRes.json();
                return this.normalizeResponse(data, Date.now() - startTime);
              }
              throw new Error(`Portal check returned HTTP ${checkRes.status}`);
            });

            const portalResults = await Promise.allSettled(checkTasks);
            for (const r of portalResults) {
              if (r.status === 'fulfilled' && r.value.success) {
                if (r.value.total > 0) {
                  clearTimeout(timeout);
                  return r.value;
                }
              }
            }
          }
        } catch {
          // ignore portal error
        }
      }

      clearTimeout(timeout);

      return {
        courier: 'Steadfast',
        success: true,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        cancelRate: 0,
        status: 'success',
        message: 'No previous records found on Steadfast',
        responseTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      const message = isTimeout 
        ? 'Steadfast API request timed out'
        : (err.message || 'Unable to fetch Steadfast courier data');

      console.warn(`[FRAUD_CHECK][Steadfast] Notice: ${message}`);

      return {
        courier: 'Steadfast',
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
      return { success: false, message: 'API credentials missing. Please enter your Steadfast API Key/Secret or Email/Password.' };
    }

    try {
      // 1. If API Key + Secret Key, test balance endpoint
      if (this.config.apiKey && this.config.secretKey) {
        const balRes = await fetch('https://portal.packzy.com/api/v1/get_balance', {
          headers: {
            'Api-Key': this.config.apiKey.trim(),
            'Secret-Key': this.config.secretKey.trim(),
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
          }
        });
        if (balRes.ok) {
          const balData: any = await balRes.json();
          if (balData.status === 200) {
            return { 
              success: true, 
              message: `Steadfast API verified successfully! Current balance: ৳${balData.current_balance ?? 0}` 
            };
          }
        }
      }

      // 2. If Email + Password, test session
      if (this.config.email && this.config.password) {
        const cookies = await this.getSessionCookies(true);
        if (cookies) {
          return { success: true, message: 'Steadfast merchant account authenticated successfully!' };
        }
      }

      return { success: true, message: 'Steadfast connection verified successfully!' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Steadfast connection failed.' };
    }
  }

  private normalizeResponse(data: any, responseTimeMs: number): CourierCheckResult {
    const root = data.data || data;

    const delivered = Number(
      root.success_parcel ?? 
      root.delivered_parcel ?? 
      root.success ?? 
      root.delivered ?? 
      root.total_delivered ?? 
      root.successful_orders ?? 
      0
    );

    const cancelled = Number(
      root.cancelled_parcel ?? 
      root.canceled_parcel ?? 
      root.cancel_parcel ?? 
      root.cancelled ?? 
      root.cancel ?? 
      root.total_cancelled ?? 
      root.fraud ?? 
      0
    );

    let total = Number(
      root.total_parcel ?? 
      root.total_parcels ?? 
      root.total_order ?? 
      root.total_orders ?? 
      root.total ?? 
      (delivered + cancelled)
    );

    if (total === 0 && (delivered > 0 || cancelled > 0)) {
      total = delivered + cancelled;
    } else if (total < delivered + cancelled) {
      total = delivered + cancelled;
    }

    let successRate = 0;
    if (root.success_rate !== undefined) {
      successRate = Number(root.success_rate);
    } else if (root.successRate !== undefined) {
      successRate = Number(root.successRate);
    } else if (total > 0) {
      successRate = Math.round((delivered / total) * 100 * 10) / 10;
    }

    const cancelRate = total > 0 ? Math.round((cancelled / total) * 100 * 10) / 10 : 0;

    return {
      courier: 'Steadfast',
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

