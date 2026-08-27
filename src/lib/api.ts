import { logout } from './firebase';

export const getApiUrl = (path: string): string => {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return cleanPath;
};

// Helper to get raw JWT ID Token with automatic retry/wait for custom Auth initialization
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Authorization': token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json'
  };
};

const handleUnauthorized = () => {
  console.warn("401 Unauthorized received. Token invalid or expired. Logging out...");
  logout();
};

export async function fetchFromApi(collectionName: string) {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(getApiUrl(`/api/data/${collectionName}`), {
      method: "GET",
      headers
    });
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error(`Unauthorized: Invalid or expired session. Please log in again.`);
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`GET /api/data/${collectionName} returned status ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      console.warn(`[API] Received non-JSON response for ${collectionName}:`, text.substring(0, 200));
      throw new Error(`Expected JSON but received ${contentType || 'unknown type'}`);
    }
  } catch (error) {
    console.error(`fetchFromApi failed for ${collectionName}:`, error);
    throw error;
  }
}

export async function saveToApi(collectionName: string, data: any) {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(getApiUrl(`/api/data/${collectionName}`), {
      method: "POST",
      headers,
      body: JSON.stringify(data)
    });
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error(`Unauthorized: Invalid or expired session. Please log in again.`);
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`POST /api/data/${collectionName} returned status ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      console.warn(`[API] Received non-JSON response for ${collectionName}:`, text.substring(0, 200));
      return { status: "success", raw: text };
    }
  } catch (error) {
    console.error(`saveToApi failed for ${collectionName}:`, error);
    throw error;
  }
}

export async function batchSaveToApi(collectionName: string, items: any[], strategy: 'skip' | 'replace' | 'keep' = 'keep') {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(getApiUrl(`/api/data/${collectionName}/batch`), {
      method: "POST",
      headers,
      body: JSON.stringify({ items, strategy })
    });
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error(`Unauthorized: Invalid or expired session. Please log in again.`);
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`POST /api/data/${collectionName}/batch returned status ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      return { status: "success", count: items.length, raw: text };
    }
  } catch (error) {
    console.error(`batchSaveToApi failed for ${collectionName}:`, error);
    throw error;
  }
}

export async function deleteFromApi(collectionName: string, id: string) {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(getApiUrl(`/api/data/${collectionName}/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers
    });
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error(`Unauthorized: Invalid or expired session. Please log in again.`);
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`DELETE /api/data/${collectionName}/${id} returned status ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      return { status: "success", raw: text };
    }
  } catch (error) {
    console.error(`deleteFromApi failed for ${collectionName}:`, error);
    throw error;
  }
}

export async function batchDeleteFromApi(collectionName: string, ids: string[]) {
  try {
    const headers = getAuthHeaders();
    const response = await fetch(getApiUrl(`/api/data/${collectionName}/batch-delete`), {
      method: "POST",
      headers,
      body: JSON.stringify({ ids })
    });
    if (response.status === 401) {
      handleUnauthorized();
      throw new Error(`Unauthorized: Invalid or expired session. Please log in again.`);
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`POST /api/data/${collectionName}/batch-delete returned status ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      const text = await response.text();
      return { status: "success", count: ids.length, raw: text };
    }
  } catch (error) {
    console.error(`batchDeleteFromApi failed for ${collectionName}:`, error);
    throw error;
  }
}
