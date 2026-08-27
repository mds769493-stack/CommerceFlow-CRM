import { useState, useEffect, useCallback } from 'react';
import { Expense, AppSettings, ExpenseGroup } from '../types';
import { fetchFromApi, saveToApi, deleteFromApi, batchDeleteFromApi } from '../lib/api';
import { handleFirestoreError } from '../lib/firebase';
import { User } from 'firebase/auth';

interface UseExpensesOptions {
  page?: number;
  pageSize?: number;
  group?: ExpenseGroup | 'all';
  enabled?: boolean;
}

export function useExpenses(user: User | null, options: UseExpensesOptions = {}) {
  const [unfilteredExpenses, setUnfilteredExpenses] = useState<Expense[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, pageSize = 20, group = 'all', enabled = true } = options;

  const fetchExpenses = useCallback(async (isManualRefresh = false) => {
    if (!user || !enabled) {
      setExpenses([]);
      setTotalRecords(0);
      if (!enabled) setIsLoaded(true);
      return;
    }

    setIsFetching(true);
    try {
      const data = await fetchFromApi('expenses');
      const entries = data as Expense[];
      
      // Sort in memory (newest date first)
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setUnfilteredExpenses(entries);

      // Group filter
      let filtered = [...entries];
      if (group !== 'all') {
        filtered = filtered.filter(e => e.group === group);
      }

      setTotalRecords(filtered.length);

      // Slicing/Pagination
      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);
      setExpenses(paginated);

      setIsLoaded(true);
      setError(null);
    } catch (error: any) {
      console.error("Fetch Error (Expenses):", error);
      setError(error.message);
      setIsLoaded(true);
    } finally {
      setIsFetching(false);
    }
  }, [user, page, pageSize, group, enabled]);

  useEffect(() => {
    fetchExpenses(false);
  }, [fetchExpenses]);

  const addExpense = async (data: Omit<Expense, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    try {
      const newExpense = {
        ...data,
        id: `exp_${Date.now()}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await saveToApi('expenses', newExpense);
      await fetchExpenses(true);
    } catch (e) {
      handleFirestoreError(e, 'create', 'expenses');
    }
  };

  const updateDollarRate = async (rate: number) => {
    if (!user) return;
    try {
      const setting = {
        userId: user.uid,
        dollarRate: rate,
        updatedAt: new Date().toISOString()
      };
      await saveToApi('settings', setting);
    } catch (e) {
      handleFirestoreError(e, 'update', `settings/${user.uid}`);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!user) return;
    setIsFetching(true);
    try {
      await deleteFromApi('expenses', id);
      await fetchExpenses(true);
      setError(null);
    } catch (e: any) {
      setError(`Delete Failed: ${e.message || String(e)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const deleteExpenses = async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setIsFetching(true);
    try {
      await batchDeleteFromApi('expenses', ids);
      await fetchExpenses(true);
      setError(null);
    } catch (e: any) {
      setError(`Bulk Delete Failed: ${e.message || String(e)}`);
    } finally {
      setIsFetching(false);
    }
  };

  return {
    expenses,
    settings,
    totalRecords,
    isFetching,
    error,
    addExpense,
    updateDollarRate,
    deleteExpense,
    deleteExpenses,
    isLoaded,
    refresh: () => fetchExpenses(true)
  };
}
