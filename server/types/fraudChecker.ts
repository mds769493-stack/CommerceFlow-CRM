/**
 * Shared types for Courier Fraud Checker module
 */

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';

export interface CourierCheckResult {
  courier: string;
  success: boolean;
  total: number;
  delivered: number;
  cancelled: number;
  successRate: number;
  cancelRate?: number;
  status: 'success' | 'error' | 'disabled' | 'unconfigured';
  message: string | null;
  responseTimeMs?: number;
}

export interface OverallFraudReport {
  phone: string;
  operator?: string;
  timestamp: string;
  overall: {
    total: number;
    delivered: number;
    cancelled: number;
    successRate: number;
    cancelRate: number;
    riskLevel: RiskLevel;
    genuineProbability: number;
    fraudProbability: number;
  };
  ourRecord?: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    webCancelCount: number;
    isNewCustomer: boolean;
  };
  couriers: {
    steadfast: CourierCheckResult;
    pathao: CourierCheckResult;
    redx: CourierCheckResult;
    paperfly: CourierCheckResult;
    carrybee: CourierCheckResult;
  };
}

export interface FraudCheckerSettings {
  id?: string;
  updatedAt?: string;
  steadfast: {
    enabled: boolean;
    apiKey?: string;
    secretKey?: string;
    email?: string;
    password?: string;
    hasCredentials?: boolean;
    apiKeyConfigured?: boolean;
    apiKeyLastChars?: string;
    passwordConfigured?: boolean;
  };
  pathao: {
    enabled: boolean;
    clientId?: string;
    clientSecret?: string;
    email?: string;
    password?: string;
    hasCredentials?: boolean;
    clientSecretConfigured?: boolean;
    passwordConfigured?: boolean;
  };
  redx: {
    enabled: boolean;
    email?: string;
    phone?: string;
    password?: string;
    apiKey?: string;
    hasCredentials?: boolean;
    apiKeyConfigured?: boolean;
    apiKeyLastChars?: string;
    passwordConfigured?: boolean;
  };
  paperfly: {
    enabled: boolean;
    username?: string;
    password?: string;
    apiKey?: string;
    hasCredentials?: boolean;
    apiKeyConfigured?: boolean;
    apiKeyLastChars?: string;
    passwordConfigured?: boolean;
  };
  carrybee: {
    enabled: boolean;
    email?: string;
    phone?: string;
    password?: string;
    apiKey?: string;
    hasCredentials?: boolean;
    apiKeyConfigured?: boolean;
    apiKeyLastChars?: string;
    passwordConfigured?: boolean;
  };
}

export interface FraudCheckHistoryItem {
  id: string;
  userId: string;
  phone: string;
  operator?: string;
  total: number;
  delivered: number;
  cancelled: number;
  successRate: number;
  riskLevel: RiskLevel;
  timestamp: string;
  reportSnapshot: OverallFraudReport;
}
