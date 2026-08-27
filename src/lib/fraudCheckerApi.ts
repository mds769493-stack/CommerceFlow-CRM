/**
 * Fraud Checker API Client
 */
import { getApiUrl } from './api';
import { logout } from './firebase';
import { 
  OverallFraudReport, 
  FraudCheckerSettings, 
  FraudCheckHistoryItem 
} from '../../server/types/fraudChecker';

const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
};

const handleUnauthorized = () => {
  console.warn("401 Unauthorized received in Fraud Checker API.");
  logout();
};

/**
 * Execute Fraud Check against all 5 courier APIs
 */
export async function checkFraud(phone: string): Promise<OverallFraudReport> {
  const res = await fetch(getApiUrl('/api/fraud-check'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ phone })
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('অনুগ্রহ করে আবার লগইন করুন (Unauthorized)');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Fraud check failed with status ${res.status}`);
  }

  return await res.json();
}

/**
 * Fetch masked fraud checker settings
 */
export async function fetchFraudCheckerSettings(): Promise<FraudCheckerSettings> {
  const res = await fetch(getApiUrl('/api/fraud-checker/settings'), {
    headers: getAuthHeaders()
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch Fraud Checker settings (${res.status})`);
  }

  return await res.json();
}

/**
 * Save fraud checker settings
 */
export async function saveFraudCheckerSettings(settings: Partial<FraudCheckerSettings>): Promise<{ success: boolean; message: string; settings: FraudCheckerSettings }> {
  const res = await fetch(getApiUrl('/api/fraud-checker/settings'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(settings)
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to save Fraud Checker settings (${res.status})`);
  }

  return await res.json();
}

/**
 * Test courier connection
 */
export async function testCourierConnection(
  courier: 'steadfast' | 'pathao' | 'redx' | 'paperfly' | 'carrybee',
  credentials?: any
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(getApiUrl('/api/fraud-checker/test-connection'), {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ courier, credentials })
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  const data = await res.json().catch(() => ({ success: false, message: `Server error (${res.status})` }));
  return data;
}

/**
 * Fetch search history
 */
export async function fetchFraudCheckHistory(): Promise<FraudCheckHistoryItem[]> {
  const res = await fetch(getApiUrl('/api/fraud-checker/history'), {
    headers: getAuthHeaders()
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to fetch history (${res.status})`);
  }

  return await res.json();
}

/**
 * Delete a history item or clear all
 */
export async function deleteFraudCheckHistoryItem(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(getApiUrl(`/api/fraud-checker/history/${id}`), {
    method: 'DELETE',
    headers: getAuthHeaders()
  });

  if (res.status === 401) {
    handleUnauthorized();
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete record (${res.status})`);
  }

  return await res.json();
}
