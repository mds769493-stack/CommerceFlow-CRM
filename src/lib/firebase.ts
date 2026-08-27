import { getApiUrl } from './api';

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  emailVerified?: boolean;
  photoURL?: string | null;
}

type AuthListener = (user: User | null) => void;
const listeners: AuthListener[] = [];

let currentUser: User | null = null;

// Initialize current user from LocalStorage
try {
  const storedUser = localStorage.getItem('auth_user');
  const storedToken = localStorage.getItem('auth_token');
  if (storedUser && storedToken) {
    currentUser = JSON.parse(storedUser);
  } else {
    localStorage.removeItem('auth_user');
    localStorage.removeItem('auth_token');
    currentUser = null;
  }
} catch (e) {
  console.error("Failed to parse stored user:", e);
  localStorage.removeItem('auth_user');
  localStorage.removeItem('auth_token');
  currentUser = null;
}

const triggerListeners = () => {
  listeners.forEach(l => {
    try {
      l(currentUser);
    } catch (e) {
      console.error("Error in auth listener:", e);
    }
  });
};

export const onAuthStateChanged = (authInstance: any, callback: AuthListener) => {
  listeners.push(callback);
  // Send current state instantly
  callback(currentUser);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
};

export const loginWithUsernamePassword = async (username: string, password: string) => {
  try {
    const response = await fetch(getApiUrl('/api/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    if (!response.ok) {
      // Try to parse error from JSON
      let errorMessage = 'লগইন করতে সমস্যা হচ্ছে।';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        // If JSON parsing fails, use status text
        errorMessage = `সার্ভার ইরর: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    currentUser = data.user;
    triggerListeners();
    return data;
  } catch (error: any) {
    console.error("loginWithUsernamePassword Error:", error);
    throw error;
  }
};

export const registerWithUsernamePassword = async (username: string, password: string, email: string) => {
  try {
    const response = await fetch(getApiUrl('/api/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, email })
    });
    
    if (!response.ok) {
      let errorMessage = 'অ্যাকাউন্ট তৈরি করতে সমস্যা হচ্ছে।';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch (e) {
        errorMessage = `সার্ভার ইরর: ${response.status} ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    
    const data = await response.json();
    localStorage.setItem('auth_token', data.token);
    localStorage.setItem('auth_user', JSON.stringify(data.user));
    currentUser = data.user;
    triggerListeners();
    return data;
  } catch (error: any) {
    console.error("registerWithUsernamePassword Error:", error);
    throw error;
  }
};

export const auth = {
  get currentUser() {
    return currentUser;
  }
};

export const db = {};
export const googleProvider = {};

export const loginWithGoogle = async () => {
  throw new Error("Google login is removed. Please use Username and Password.");
};

export const logout = async () => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  currentUser = null;
  triggerListeners();
};

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: any, operationType: FirestoreErrorInfo['operationType'], path: string | null = null): never {
  throw error;
}
