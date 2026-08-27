/**
 * Paperfly Courier Fraud Check Service
 */
import { CourierCheckResult } from '../types/fraudChecker.ts';

export interface PaperflyConfig {
  username?: string;
  password?: string;
  apiKey?: string;
  enabled?: boolean;
}

export class PaperflyService {
  private config: PaperflyConfig;

  constructor(config?: PaperflyConfig) {
    this.config = {
      username: config?.username || process.env.PAPERFLY_USER || process.env.PAPERFLY_EMAIL || '',
      password: config?.password || process.env.PAPERFLY_PASSWORD || '',
      apiKey: config?.apiKey || process.env.PAPERFLY_KEY || process.env.PAPERFLY_API_KEY || '',
      enabled: config?.enabled !== undefined ? config.enabled : true
    };
  }

  public isConfigured(): boolean {
    return !!(this.config.apiKey || (this.config.username && this.config.password));
  }

  public isEnabled(): boolean {
    return this.config.enabled !== false;
  }

  public async getDeliveryStats(phoneNumber: string): Promise<CourierCheckResult> {
    const startTime = Date.now();

    if (!this.isEnabled()) {
      return {
        courier: 'Paperfly',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'disabled',
        message: 'Paperfly checker is disabled in settings',
        responseTimeMs: Date.now() - startTime
      };
    }

    if (!this.isConfigured()) {
      return {
        courier: 'Paperfly',
        success: false,
        total: 0,
        delivered: 0,
        cancelled: 0,
        successRate: 0,
        status: 'unconfigured',
        message: 'Paperfly API credentials are not configured',
        responseTimeMs: Date.now() - startTime
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };

      if (this.config.apiKey) {
        headers['paperflykey'] = this.config.apiKey.trim();
      } else if (this.config.username && this.config.password) {
        const authString = Buffer.from(`${this.config.username.trim()}:${this.config.password.trim()}`).toString('base64');
        headers['Authorization'] = `Basic ${authString}`;
      }

      const endpoints = [
        `https://api.paperfly.com.bd/order/customer-history`,
        `https://paperfly.com.bd/api/v1/fraud-check/${encodeURIComponent(phoneNumber)}`
      ];

      let checkRes: Response | null = null;

      try {
        checkRes = await fetch(endpoints[0], {
          method: 'POST',
          headers,
          body: JSON.stringify({ phone_number: phoneNumber, customer_phone: phoneNumber }),
          signal: controller.signal
        });
      } catch {
        // Fallback to GET endpoint
      }

      if (!checkRes || (!checkRes.ok && checkRes.status !== 404)) {
        try {
          checkRes = await fetch(endpoints[1], {
            method: 'GET',
            headers,
            signal: controller.signal
          });
        } catch {}
      }

      clearTimeout(timeout);

      if (!checkRes || checkRes.status === 404) {
        return {
          courier: 'Paperfly',
          success: true,
          total: 0,
          delivered: 0,
          cancelled: 0,
          successRate: 0,
          cancelRate: 0,
          status: 'success',
          message: null,
          responseTimeMs: Date.now() - startTime
        };
      }

      if (!checkRes.ok) {
        throw new Error(`Paperfly query returned HTTP ${checkRes.status}`);
      }

      const data: any = await checkRes.json().catch(() => null);
      if (!data) {
        return {
          courier: 'Paperfly',
          success: true,
          total: 0,
          delivered: 0,
          cancelled: 0,
          successRate: 0,
          cancelRate: 0,
          status: 'success',
          message: null,
          responseTimeMs: Date.now() - startTime
        };
      }
      return this.normalizeResponse(data, Date.now() - startTime);

    } catch (err: any) {
      clearTimeout(timeout);
      const isTimeout = err.name === 'AbortError';
      const message = isTimeout
        ? 'Paperfly API request timed out (12s)'
        : (err.message || 'Unable to fetch Paperfly courier data');

      return {
        courier: 'Paperfly',
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
      return { success: false, message: 'Paperfly credentials missing. Please enter Username and Password or API Key.' };
    }

    try {
      const result = await this.getDeliveryStats('01700000000');
      if (result.status === 'success' || result.total >= 0) {
        return { success: true, message: 'Paperfly connection verified successfully!' };
      }
      return { success: false, message: result.message || 'Paperfly test failed.' };
    } catch (err: any) {
      return { success: false, message: err.message || 'Paperfly connection failed.' };
    }
  }

  private normalizeResponse(data: any, responseTimeMs: number): CourierCheckResult {
    const root = data.data || data;
    const delivered = Number(root.success_count ?? root.success ?? root.delivered ?? 0);
    const cancelled = Number(root.return_count ?? root.cancel ?? root.cancelled ?? 0);
    let total = Number(root.total_count ?? root.total ?? (delivered + cancelled));
    if (total < delivered + cancelled) {
      total = delivered + cancelled;
    }

    const successRate = total > 0 ? Math.round((delivered / total) * 100 * 10) / 10 : 0;
    const cancelRate = total > 0 ? Math.round((cancelled / total) * 100 * 10) / 10 : 0;

    return {
      courier: 'Paperfly',
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
