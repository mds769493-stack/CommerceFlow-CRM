import { useState, useEffect, useCallback } from 'react';
import { Product } from '../types';
import { fetchFromApi, saveToApi, deleteFromApi, batchSaveToApi, batchDeleteFromApi } from '../lib/api';
import { handleFirestoreError } from '../lib/firebase';
import { User } from 'firebase/auth';

interface UseProductsOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  enabled?: boolean;
}

export function useProducts(user: User | null, options: UseProductsOptions = {}) {
  const [unfilteredProducts, setUnfilteredProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { page = 1, pageSize = 20, search = '', enabled = true } = options;

  const fetchProducts = useCallback(async (isManualRefresh = false) => {
    if (!user || !enabled) {
      if (user && !enabled) setIsLoaded(true); 
      return;
    }

    setIsFetching(true);
    try {
      const data = await fetchFromApi('products');
      const entries = data as Product[];
      
      // Sort newest first
      entries.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      setUnfilteredProducts(entries);

      // Filters
      let filtered = [...entries];
      if (search) {
        const s = search.toLowerCase().trim();
        filtered = filtered.filter(p => 
          (p.name || '').toLowerCase().includes(s) || 
          (p.code || '').toLowerCase().includes(s)
        );
      }

      setTotalRecords(filtered.length);

      // Slicing/Pagination
      const start = (page - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);
      setProducts(paginated);

      setIsLoaded(true);
      setError(null);
    } catch (error: any) {
      console.error("Fetch Error (Products):", error);
      setError(error.message);
      setIsLoaded(true);
    } finally {
      setIsFetching(false);
    }
  }, [user, page, pageSize, search, enabled]);

  useEffect(() => {
    fetchProducts(false);
  }, [fetchProducts]);

  const addProduct = async (data: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => {
    if (!user) return;
    try {
      const newProduct = {
        ...data,
        id: `prod_${Date.now()}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await saveToApi('products', newProduct);
      await fetchProducts(true);
    } catch (e) {
      handleFirestoreError(e, 'create', 'products');
    }
  };

  const updateProduct = async (id: string, updates: Partial<Product>) => {
    if (!user) return;
    try {
      const existing = unfilteredProducts.find(p => p.id === id);
      if (!existing) return;
      const updated = {
        ...existing,
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await saveToApi('products', updated);
      await fetchProducts(true);
    } catch (e) {
      handleFirestoreError(e, 'update', `products/${id}`);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!user) return;
    setIsFetching(true);
    try {
      await deleteFromApi('products', id);
      await fetchProducts(true);
      setError(null);
    } catch (e: any) {
      setError(`Delete Failed: ${e.message || String(e)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const deleteProducts = async (ids: string[]) => {
    if (!user || ids.length === 0) return;
    setIsFetching(true);
    try {
      await batchDeleteFromApi('products', ids);
      await fetchProducts(true);
      setError(null);
    } catch (e: any) {
      setError(`Bulk Delete Failed: ${e.message || String(e)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const updateProducts = async (updatesList: { id: string; updates: Partial<Product> }[]) => {
    if (!user || updatesList.length === 0) return;
    setIsFetching(true);
    try {
      const updatedItems = updatesList.map(({ id, updates }) => {
        const existing = unfilteredProducts.find(p => p.id === id);
        if (!existing) return null;
        return {
          ...existing,
          ...updates,
          updatedAt: new Date().toISOString()
        };
      }).filter((item): item is Product => item !== null);

      if (updatedItems.length > 0) {
        await batchSaveToApi('products', updatedItems, 'replace');
        await fetchProducts(true);
      }
      setError(null);
    } catch (e: any) {
      console.error("Bulk Update Error:", e);
      setError(`Bulk Update Failed: ${e.message || String(e)}`);
    } finally {
      setIsFetching(false);
    }
  };

  const bulkImportProducts = async (newProducts: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[]) => {
    if (!user || newProducts.length === 0) return;
    try {
      const items = newProducts.map(p => ({
        ...p,
        id: `prod_${p.code}`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      await batchSaveToApi('products', items, 'replace');
      await fetchProducts(true);
    } catch (e) {
      handleFirestoreError(e, 'create', 'products/bulk');
    }
  };

  return {
    products,
    addProduct,
    updateProduct,
    updateProducts,
    deleteProduct,
    deleteProducts,
    bulkImportProducts,
    isLoaded,
    totalRecords,
    isFetching,
    error,
    refresh: () => fetchProducts(true)
  };
}
