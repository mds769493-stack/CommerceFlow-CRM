import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { fetchFromApi } from '../lib/api';
import { Order, CourierData, Product, Expense, AppSettings } from '../types';
import { User } from 'firebase/auth';

export function useAllData(user: User | null, enabled: boolean = true) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [courierData, setCourierData] = useState<CourierData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef<number>(0);

  const fetchAllData = useCallback(async (isManualRefresh = false) => {
    if (!user) {
      setOrders([]);
      setCourierData([]);
      setProducts([]);
      setExpenses([]);
      setSettings(null);
      setIsLoaded(true);
      return;
    }

    // Throttle automatic refreshes to once every 10 seconds minimum
    // Manual refreshes (like clicking retry) bypass this
    const now = Date.now();
    if (!isManualRefresh && now - lastFetchRef.current < 10000) {
      return;
    }

    if (isManualRefresh) setIsFetching(true);
    try {
      lastFetchRef.current = now;
      const [o, c, p, e, s] = await Promise.all([
        fetchFromApi('orders'),
        fetchFromApi('courierData'),
        fetchFromApi('products'),
        fetchFromApi('expenses'),
        fetchFromApi('settings')
      ]);

      setOrders(o || []);
      setCourierData(c || []);
      setProducts(p || []);
      setExpenses(e || []);
      
      if (s && s.length > 0) {
        setSettings(s[0]);
      } else {
        setSettings({ id: user.uid, userId: user.uid, dollarRate: 120, updatedAt: null });
      }

      setIsLoaded(true);
      setError(null);
    } catch (error: any) {
      console.error("Error fetching all data:", error);
      setError(error.message);
      setIsLoaded(true);
    } finally {
      setIsFetching(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchAllData(false);

      // Semi-live updates: check for changes every 20 seconds
      const poll = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchAllData(false);
        }
      }, 20000);

      return () => clearInterval(poll);
    }
  }, [user, fetchAllData]);

  const courierMap = useMemo(() => {
    const map = new Map<string, CourierData>();
    courierData.forEach(item => {
      if (item && item.merchantOrderId) {
        map.set((item.merchantOrderId || "").toLowerCase().trim(), item);
      }
    });
    return map;
  }, [courierData]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      if (p && p.name) {
        map.set((p.name || "").toLowerCase().trim(), p);
      }
      if (p && p.code) {
        map.set((p.code || "").toLowerCase().trim(), p);
      }
    });
    return map;
  }, [products]);

  return {
    allOrders: orders,
    allCourierData: courierData,
    allProducts: products,
    allExpenses: expenses,
    settings,
    courierMap,
    productMap,
    isLoaded,
    isFetching,
    error,
    refresh: () => fetchAllData(true)
  };
}
