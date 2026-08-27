import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Order, CourierData, Product } from '../types';
import { fetchFromApi, saveToApi, deleteFromApi, batchSaveToApi, batchDeleteFromApi } from '../lib/api';
import { handleFirestoreError } from '../lib/firebase';
import { User } from 'firebase/auth';
import { getDisplayStatus, getOrderWarningType } from '../lib/order-utils';

interface UseOrdersOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  date?: Date;
  syncStatus?: 'all' | 'synced' | 'not_synced';
  warningFilter?: string;
  products?: Product[];
  enabled?: boolean;
}

export function useOrders(user: User | null, options: UseOrdersOptions = {}) {
  const [unfilteredOrders, setUnfilteredOrders] = useState<Order[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [courierDataMap, setCourierDataMap] = useState<Map<string, CourierData>>(new Map());
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { 
    page = 1, 
    pageSize = 20, 
    search = '', 
    status = 'all', 
    date, 
    syncStatus = 'all',
    warningFilter = 'all',
    products = [],
    enabled = true 
  } = options;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const fetchOrders = useCallback(async (isManualRefresh = false) => {
    if (!user || !enabled) {
      if (user && !enabled) setIsLoaded(true);
      return;
    }

    setIsFetching(true);
    try {
      // 1. Fetch courier data first to use for filtering if needed
      let currentCourierMap = new Map<string, CourierData>();
      try {
        const courierDataRaw = await fetchFromApi('courierData');
        (courierDataRaw as CourierData[]).forEach(item => {
          if (item && item.merchantOrderId) {
            currentCourierMap.set((item.merchantOrderId || "").toLowerCase().trim(), item);
          }
        });
        setCourierDataMap(currentCourierMap);
      } catch (courierError) {
        console.warn("Failed to fetch courier data, continuing with empty map:", courierError);
        setCourierDataMap(new Map());
      }

      // 2. Fetch orders
      const data = await fetchFromApi('orders');
      let entries = data as Order[];
      
      entries.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());
      setUnfilteredOrders(entries);

      // 3. Apply Filters
      if (status !== 'all') {
        entries = entries.filter(o => getDisplayStatus(o, currentCourierMap) === status);
      }

      if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        entries = entries.filter(o => {
          const d = new Date(o.createdAt as any);
          return d >= startOfDay && d <= endOfDay;
        });
      }

      if (syncStatus !== 'all') {
        entries = entries.filter(o => {
          const isSynced = currentCourierMap.has((o.invoice || "").toLowerCase().trim());
          return syncStatus === 'synced' ? isSynced : !isSynced;
        });
      }

      if (warningFilter && warningFilter !== 'all') {
        if (warningFilter === 'has_warning') {
          entries = entries.filter(o => getOrderWarningType(o, products, currentCourierMap) !== null);
        } else {
          entries = entries.filter(o => getOrderWarningType(o, products, currentCourierMap) === warningFilter);
        }
      }

      if (search) {
        const s = (search || "").toLowerCase().trim();
        // Special case for the warning button
        if (s === 'not synced') {
          entries = entries.filter(o => !currentCourierMap.has((o.invoice || "").toLowerCase().trim()));
        } else {
          entries = entries.filter(o => 
            (o.invoice || "").toLowerCase().includes(s) || 
            (o.customer || "").toLowerCase().includes(s) ||
            (o.phone || "")?.toLowerCase().includes(s)
          );
        }
      }

      // Sort
      entries.sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime());

      setTotalRecords(entries.length);
      
      // Pagination
      const start = (page - 1) * pageSize;
      const paginated = entries.slice(start, start + pageSize);

      setOrders(paginated);
      
      setIsLoaded(true);
      setError(null);
    } catch (error: any) {
      console.error("Fetch Error:", error);
      setError(error.message);
      setIsLoaded(true);
    } finally {
      setIsFetching(false);
    }
  }, [user, page, pageSize, search, status, date, syncStatus, warningFilter, products, enabled]);

  useEffect(() => {
    fetchOrders(false);
  }, [fetchOrders]);

  const addOrder = async (data: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    try {
      const newOrder = {
        ...data,
        id: `ord_${Date.now()}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await saveToApi('orders', newOrder);
      fetchOrders(); 
    } catch (e) {
      handleFirestoreError(e, 'create', 'orders');
    }
  };

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    if (!user) return;
    try {
      const existing = unfilteredOrders.find(o => o.id === id);
      if (!existing) return;
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await saveToApi('orders', updated);
      setUnfilteredOrders(prev => prev.map(o => o.id === id ? updated : o));
      setOrders(prev => prev.map(o => o.id === id ? updated : o));
    } catch (e) {
      handleFirestoreError(e, 'update', `orders/${id}`);
    }
  };

  const deleteOrder = async (id: string) => {
    if (!user) return;
    setIsFetching(true);
    try {
      await deleteFromApi('orders', id);
      await fetchOrders(true);
      setError(null);
    } catch (e: any) {
      setError(`Delete Failed: ${e.message || String(e)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const deleteOrders = async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setIsFetching(true);
    try {
      await batchDeleteFromApi('orders', ids);
      await fetchOrders(true);
      setError(null);
    } catch (e: any) {
      setError(`Bulk Delete Failed: ${e.message || String(e)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const importOrders = async (newOrders: Omit<Order, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[], strategy: 'skip' | 'replace' | 'keep') => {
    if (!user || newOrders.length === 0) return;
    setIsFetching(true);
    setError(null);
    try {
      const items = newOrders.map(order => ({
        ...order,
        id: `ord_${order.invoice}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      await batchSaveToApi('orders', items, strategy);
      fetchOrders();
      setError(null);
    } catch (e: any) {
      setError(`Import Failed: ${e.message}`);
    } finally {
      setIsFetching(false);
    }
  };

  // Compute stats across the UNFILTERED dataset
  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    let totalUnsynced = 0;
    let totalSales = 0;
    let totalAdvance = 0;

    const warningCounts: Record<string, number> = {
      has_warning: 0,
      Advance: 0,
      Discount: 0,
      'Over Charges': 0,
      'Update Qty': 0,
      'Price Required': 0,
    };

    unfilteredOrders.forEach(o => {
      const displayStatus = getDisplayStatus(o, courierDataMap);
      if (displayStatus) {
        counts[displayStatus] = (counts[displayStatus] || 0) + 1;
      }
      if (!(o.invoice && courierDataMap.has(o.invoice.toLowerCase().trim()))) {
        totalUnsynced++;
      }
      totalSales += o.total || 0;
      totalAdvance += o.advance || 0;

      const wType = getOrderWarningType(o, products, courierDataMap);
      if (wType) {
        warningCounts.has_warning = (warningCounts.has_warning || 0) + 1;
        warningCounts[wType] = (warningCounts[wType] || 0) + 1;
      }
    });

    return {
      statusCounts: counts,
      totalUnsynced,
      totalCount: unfilteredOrders.length,
      totalSales,
      totalAdvance,
      warningCounts
    };
  }, [unfilteredOrders, courierDataMap, products]);

  return {
    orders,
    unfilteredOrders,
    courierDataMap,
    addOrder,
    updateOrder,
    deleteOrder,
    deleteOrders,
    importOrders,
    isLoaded,
    totalRecords,
    isFetching,
    error,
    stats,
    refresh: () => fetchOrders(true)
  };
}
