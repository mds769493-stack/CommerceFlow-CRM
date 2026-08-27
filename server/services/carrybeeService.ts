/**
 * Carrybee Courier Fraud Check Service
 */
import { CourierCheckResult } from '../types/fraudChecker.ts';

export interface CarrybeeConfig {
  phone?: string;
  email?: string;
  password?: string;
  apiKey?: string;
  businessId?: string;
  enabled?: boolean;
}

export class CarrybeeService {
  private config: CarrybeeConfig;
  private static cachedToken: string | null = null;
  private static cachedBusinessId: string | null = null;
  private static tokenExpiresAt: number = 0;

  constructor(config?: CarrybeeConfig) {
    this.config = {
      phone: config?.phone || process.env.CARRYBEE_PHONE || '',
      email: config?.email || process.env.CARRYBEE_EMAIL || '',
      password: config?.password || process.env.CARRYBEE_PASSWORD || '',
      apiKey: config?.apiKey || process.env.CARRYBEE_API_KEY || '',
      businessId: config?.businessId || process.env.CARRYBEE_BUSINESS_ID || '',
      enabled: config?.enabled !== undefined ? config.enabled : true
    };
  }

  public isConfigured(): boolean {
    return !!(this.config.apiKey?.trim() || ((this.config.phone?.trim() || this.config.email?.trim()) && this.config.password?.trim()));
  }

  public isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  /**
   * Safe fetch with timeout protection
   */
  private async safeFetch(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeout);
      return res;
    } catch {
      clearTimeout(timeout);
      return null;
    }
  }

  private async getAuthSession(forceRefresh = false): Promise<{ accessToken: string; businessId: string }> {
    const now = Date.now();
    if (!forceRefresh && CarrybeeService.cachedToken && CarrybeeService.tokenExpiresAt > now + 60000) {
      return {
        accessToken: CarrybeeService.cachedToken,
        businessId: CarrybeeService.cachedBusinessId || this.config.businessId || ''
      };
    }

    const rawKey = this.config.apiKey?.trim();

    // Case 1: NextAuth / Auth.js JWE Session cookie (e.g. starts with eyJhbGciOiJkaXIi...)
    if (rawKey && (rawKey.startsWith('eyJhbGciOiJkaXIi') || rawKey.length > 300)) {
      try {
        const sessionRes = await this.safeFetch('https://merchant.carrybee.com/api/auth/session', {
          headers: {
            'Cookie': `__Secure-authjs.session-token=${rawKey}; authjs.session-token=${rawKey}; __Host-authjs.session-token=${rawKey}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }, 10000);

        if (sessionRes && sessionRes.ok) {
          const sessionData: any = await sessionRes.json().catch(() => null);
          if (sessionData && sessionData.accessToken) {
            const token = sessionData.accessToken;
            const businessId = String(sessionData.user?.selectedBusinessId || sessionData.user?.businessIds?.[0] || '');
            CarrybeeService.cachedToken = token;
            CarrybeeService.cachedBusinessId = businessId;
            CarrybeeService.tokenExpiresAt = now + (24 * 3600 * 1000);
            return { accessToken: token, businessId };
          }
        }
      } catch (e) {
        console.warn('[CARRYBEE] Session token exchange failed:', e);
      }
    }

    // Case 2: Direct JWT Access Token provided
    if (rawKey && rawKey.startsWith('eyJ')) {
      const token = rawKey;
      CarrybeeService.cachedToken = token;
      CarrybeeService.tokenExpiresAt = now + (24 * 3600 * 1000);
      
      let businessId = this.config.businessId || CarrybeeService.cachedBusinessId || '';
      if (!businessId) {
        try {
          const bRes = await this.safeFetch('https://api-merchant.carrybee.com/api/v2/businesses', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
          }, 8000);
          if (bRes && bRes.ok) {
            const bData: any = await bRes.json().catch(() => null);
            const firstBiz = bData?.data?.businesses?.[0] || bData?.data?.[0];
            if (firstBiz?.id) {
              businessId = String(firstBiz.id);
              CarrybeeService.cachedBusinessId = businessId;
            }
          }
        } catch {}
      }
      return { accessToken: token, businessId };
    }

    // Case 3: Phone / Password or Email / Password login
    const password = this.config.password?.trim();
    if (!password) {
      throw new Error('Carrybee password is required');
    }

    const rawPhone = this.config.phone?.trim();
    const email = this.config.email?.trim();

    const phoneVariants: string[] = [];
    if (rawPhone) {
      const clean = rawPhone.replace(/\D/g, '');
      const std = clean.startsWith('880') ? clean.slice(2) : (clean.startsWith('0') ? clean : '0' + clean);
      phoneVariants.push(std);
      if (!phoneVariants.includes(clean)) phoneVariants.push(clean);
    }

    let lastErrorMessage = 'Carrybee authentication failed';

    // Try login with phone variants or email
    const loginCandidates: { phone?: string; email?: string; password: string }[] = [];
    if (phoneVariants.length > 0) {
      for (const p of phoneVariants) {
        loginCandidates.push({ phone: p, password });
      }
    } else if (email) {
      loginCandidates.push({ email, password });
    }

    for (const payload of loginCandidates) {
      try {
        const res = await this.safeFetch('https://api-merchant.carrybee.com/api/v2/login', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify(payload)
        }, 10000);

        if (res) {
          const data: any = await res.json().catch(() => null);
          if (res.ok && data) {
            const token = data.access_token || data.token || data.data?.access_token || data.data?.token || data.accessToken;
            if (token) {
              CarrybeeService.cachedToken = token;
              CarrybeeService.tokenExpiresAt = now + (24 * 3600 * 1000);

              let businessId = this.config.businessId || '';
              if (!businessId) {
                try {
                  const bRes = await this.safeFetch('https://api-merchant.carrybee.com/api/v2/businesses', {
                    headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
                  }, 8000);
                  if (bRes && bRes.ok) {
                    const bData: any = await bRes.json().catch(() => null);
                    const firstBiz = bData?.data?.businesses?.[0] || bData?.data?.[0];
                    if (firstBiz?.id) {
                      businessId = String(firstBiz.id);
                      CarrybeeService.cachedBusinessId = businessId;
                    }
                  }
                } catch {}
              }

              return { accessToken: token, businessId };
            }
          } else if (data?.message) {
            lastErrorMessage = data.message;
          } else if (data?.error) {
            lastErrorMessage = typeof data.error === 'string' ? data.error : 'Invalid Carrybee credentials';
          }
        }
      } catch (e: any) {
        lastErrorMessage = e.message || 'Connection error during Carrybee login';
      }
    }

    throw new Error(lastErrorMessage);
  }

  public async getDeliveryStats(phoneNumber: string): Promise<CourierCheckResult> {
    const startTime = Date.now();

    if (!this.isEnabled()) {
      return {
        courier: 'Carrybee',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'disabled',
        message: 'Carrybee checker is disabled in settings',
        responseTimeMs: Date.now() - startTime
      };
    }

    if (!this.isConfigured()) {
      return {
        courier: 'Carrybee',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'unconfigured',
        message: 'Carrybee API credentials are not configured',
        responseTimeMs: Date.now() - startTime
      };
    }

    try {
      const auth = await this.getAuthSession(false).catch(async () => {
        // Try one force refresh if cached session failed
        return await this.getAuthSession(true);
      });

      const { accessToken, businessId } = auth;
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      const stdPhone = cleanPhone.startsWith('880') ? cleanPhone.slice(2) : (cleanPhone.startsWith('0') ? cleanPhone : '0' + cleanPhone);
      const fullPhone = cleanPhone.startsWith('88') ? cleanPhone : ('880' + (cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone));

      const phoneVariants = [stdPhone, cleanPhone, fullPhone];
      let customerData: any = null;
      let fraudCount = 0;

      // 1. Check Customer Info (with total_order, cancelled_order, success_rate)
      if (businessId) {
        for (const p of phoneVariants) {
          try {
            const cRes = await this.safeFetch(`https://api-merchant.carrybee.com/api/v2/businesses/${businessId}/customers/${p}`, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
              }
            }, 8000);

            if (cRes && cRes.ok) {
              const resJson: any = await cRes.json().catch(() => null);
              if (resJson && resJson.data && (resJson.data.total_order !== undefined || resJson.data.id)) {
                customerData = resJson.data;
                break;
              }
            }
          } catch {}
        }
      }

      // 2. Check Fraud Reports Count
      for (const p of phoneVariants) {
        try {
          const fRes = await this.safeFetch(`https://api-merchant.carrybee.com/api/v2/fraud-check/${p}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Accept': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }, 8000);

          if (fRes && fRes.ok) {
            const fJson: any = await fRes.json().catch(() => null);
            if (fJson && fJson.data && fJson.data.count !== undefined) {
              fraudCount = Number(fJson.data.count || 0);
              break;
            }
          }
        } catch {}
      }

      if (customerData) {
        const total = Number(customerData.total_order ?? customerData.total ?? 0);
        const cancelled = Number(customerData.cancelled_order ?? 0) + fraudCount;
        const delivered = Math.max(0, total - Number(customerData.cancelled_order ?? 0));
        let successRate = 0;
        if (customerData.success_rate !== undefined) {
          successRate = Number(customerData.success_rate);
        } else if (total > 0) {
          successRate = Math.round((delivered / total) * 100 * 10) / 10;
        }

        const cancelRate = total > 0 ? Math.round((cancelled / total) * 100 * 10) / 10 : 0;

        return {
          courier: 'Carrybee',
          success: true,
          total,
          delivered,
          cancelled,
          successRate,
          cancelRate,
          status: 'success',
          message: null,
          responseTimeMs: Date.now() - startTime
        };
      }

      // If no customer data found but fraud check responded
      return {
        courier: 'Carrybee',
        success: true,
        total: 0,
        delivered: 0,
        cancelled: fraudCount,
        successRate: 0,
        cancelRate: 0,
        status: 'success',
        message: null,
        responseTimeMs: Date.now() - startTime
      };

    } catch (err: any) {
      const message = err?.message || 'Unable to connect to Carrybee API';

      return {
        courier: 'Carrybee',
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
      return { success: false, message: 'Carrybee credentials missing. Please configure Phone/Email and Password or Bearer Token.' };
    }

    try {
      const { accessToken, businessId } = await this.getAuthSession(true);
      if (accessToken) {
        return { 
          success: true, 
          message: `Carrybee connection verified successfully! ${businessId ? `(Business ID: ${businessId})` : ''}` 
        };
      }
      return { success: false, message: 'Carrybee authentication failed.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Carrybee connection failed.' };
    }
  }
}

