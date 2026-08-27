import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useFollowUps } from '../hooks/useFollowUps';
import { useAnimatedFavicon } from '../hooks/useAnimatedFavicon';
import { useOrders } from '../hooks/useOrders';
import { useProducts } from '../hooks/useProducts';
import { useExpenses } from '../hooks/useExpenses';
import { useAllData } from '../hooks/useAllData';
import { useDebounce } from '../hooks/useDebounce';
import { auth, onAuthStateChanged, User, logout } from '../lib/firebase';
import { subDays } from 'date-fns';
import { ExpenseGroup, FollowUp, LOCKED_STATUSES } from '../types';

interface AppContextType {
  user: User | null;
  isAuthLoading: boolean;
  handleLogout: () => Promise<void>;
  
  // Layout & UI
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  isMobileSidebarOpen: boolean;
  setIsMobileSidebarOpen: (v: boolean) => void;

  // Global aggregate data
  allOrders: any[];
  allCourierData: any[];
  allProducts: any[];
  allExpenses: any[];
  allSettings: any;
  isAllDataLoaded: boolean;
  allDataError: string | null;
  refreshAllData: () => void;

  // Global Dialogs & Modals
  isAddFollowUpOpen: boolean;
  setIsAddFollowUpOpen: (v: boolean) => void;

  // Orders State & Hook
  orders: any[];
  courierDataMap: any;
  totalOrders: number;
  isOrdersFetching: boolean;
  isOrdersLoaded: boolean;
  ordersError: string | null;
  ordersPage: number;
  setOrdersPage: (p: number | ((prev: number) => number)) => void;
  ordersPageSize: number;
  setOrdersPageSize: (s: number) => void;
  ordersSearch: string;
  setOrdersSearch: (s: string) => void;
  ordersStatus: string;
  setOrdersStatus: (s: string) => void;
  ordersWarningFilter: string;
  setOrdersWarningFilter: (s: string) => void;
  ordersDate: Date | undefined;
  setOrdersDate: (d: Date | undefined) => void;
  ordersSyncStatus: 'all' | 'synced' | 'not_synced';
  setOrdersSyncStatus: (s: 'all' | 'synced' | 'not_synced') => void;
  addOrder: (data: any) => Promise<any>;
  updateOrder: (id: string, updates: any) => Promise<any>;
  deleteOrder: (id: string) => Promise<any>;
  deleteOrders: (ids: string[]) => Promise<any>;
  importOrders: (orders: any[], strategy?: any) => Promise<any>;
  refreshOrders: () => void;
  enrichedOrdersStats: any;
  showOrdersDashboard: boolean;
  setShowOrdersDashboard: (v: boolean | ((prev: boolean) => boolean)) => void;

  // Products State & Hook
  products: any[];
  totalProducts: number;
  isProductsFetching: boolean;
  isProductsLoaded: boolean;
  productsError: string | null;
  productsPage: number;
  setProductsPage: (p: number | ((prev: number) => number)) => void;
  productsPageSize: number;
  setProductsPageSize: (s: number) => void;
  productsSearch: string;
  setProductsSearch: (s: string) => void;
  addProduct: (data: any) => Promise<any>;
  updateProduct: (id: string, updates: any) => Promise<any>;
  updateProducts: (updates: any[]) => Promise<any>;
  deleteProduct: (id: string) => Promise<any>;
  deleteProducts: (ids: string[]) => Promise<any>;
  bulkImportProducts: (items: any[]) => Promise<any>;
  refreshProducts: () => void;

  // Expenses State & Hook
  expenses: any[];
  totalExpenses: number;
  isExpensesFetching: boolean;
  isExpensesLoaded: boolean;
  expensesError: string | null;
  expensesPage: number;
  setExpensesPage: (p: number | ((prev: number) => number)) => void;
  expensesPageSize: number;
  setExpensesPageSize: (s: number) => void;
  expensesGroup: ExpenseGroup | 'all';
  setExpensesGroup: (g: ExpenseGroup | 'all') => void;
  addExpense: (data: any) => Promise<any>;
  updateDollarRate: (rate: number) => Promise<any>;
  deleteExpense: (id: string) => Promise<any>;
  refreshExpenses: () => void;
  isAddExpenseOpen: boolean;
  setIsAddExpenseOpen: (v: boolean) => void;
  localDollarRate: string;
  setLocalDollarRate: (s: string) => void;

  // Follow-ups State & Hook
  followUps: FollowUp[];
  statusLogs: any[];
  isAutoSyncing: boolean;
  isFollowUpsLoaded: boolean;
  followUpsError: string | null;
  activeFollowUpSubTab: 'main' | 'others';
  setActiveFollowUpSubTab: (t: 'main' | 'others') => void;
  followUpCounts: { main: number; others: number };
  addFollowUp: (data: any) => Promise<any>;
  updateFollowUp: (id: string, updates: any) => Promise<any>;
  deleteFollowUp: (id: string) => Promise<any>;
  deleteMultipleFollowUps: (ids: string[]) => Promise<any>;
  updateMultipleFollowUps: (updates: any[]) => Promise<any>;
  syncOrderStatus: (item: any) => Promise<any>;
  bulkSync: () => Promise<any>;
  bulkImport: (items: any[]) => Promise<any>;
  preFetchRecentOrders: (count: number) => Promise<any>;
  refreshFollowUps: () => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  isBulkSyncing: boolean;
  setIsBulkSyncing: (v: boolean) => void;

  // Dashboard Filters & Toggle
  dashboardType: 'followups' | 'financial';
  setDashboardType: (t: 'followups' | 'financial') => void;
  dateRange: { start: Date; end: Date };
  setDateRange: (r: { start: Date; end: Date }) => void;
  activeRange: string;
  setActiveRange: (r: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('isSidebarCollapsed');
    return saved !== null ? saved === 'true' : false;
  });

  useEffect(() => {
    localStorage.setItem('isSidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
      setIsMobileSidebarOpen(false);
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Orders Filter States
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersPageSize, setOrdersPageSize] = useState(50);
  const [ordersSearch, setOrdersSearch] = useState('');
  const [ordersStatus, setOrdersStatus] = useState('all');
  const [ordersWarningFilter, setOrdersWarningFilter] = useState('all');
  const [ordersDate, setOrdersDate] = useState<Date | undefined>(undefined);
  const [ordersSyncStatus, setOrdersSyncStatus] = useState<'all' | 'synced' | 'not_synced'>('all');
  const debouncedOrdersSearch = useDebounce(ordersSearch, 500);

  useEffect(() => {
    setOrdersPage(1);
  }, [debouncedOrdersSearch, ordersStatus, ordersSyncStatus, ordersWarningFilter, ordersDate]);

  // Products Filter States
  const [productsPage, setProductsPage] = useState(1);
  const [productsPageSize, setProductsPageSize] = useState(50);
  const [productsSearch, setProductsSearch] = useState('');
  const debouncedProductsSearch = useDebounce(productsSearch, 500);

  // Expenses Filter States
  const [expensesPage, setExpensesPage] = useState(1);
  const [expensesPageSize, setExpensesPageSize] = useState(50);
  const [expensesGroup, setExpensesGroup] = useState<ExpenseGroup | 'all'>('Daily');

  // Follow-ups Filter States
  const [activeFollowUpSubTab, setActiveFollowUpSubTab] = useState<'main' | 'others'>('main');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);
  const [isAddFollowUpOpen, setIsAddFollowUpOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  // Dashboard Settings
  const [dashboardType, setDashboardType] = useState<'followups' | 'financial'>('financial');
  const [localDollarRate, setLocalDollarRate] = useState('120');
  const [showOrdersDashboard, setShowOrdersDashboard] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: subDays(new Date(), 30),
    end: new Date()
  });
  const [activeRange, setActiveRange] = useState<string>('30d');

  // Data Hooks
  const {
    allOrders,
    allCourierData,
    allProducts,
    allExpenses,
    settings: allSettings,
    isLoaded: isAllDataLoaded,
    error: allDataError,
    refresh: refreshAllData
  } = useAllData(user, !!user);

  const { 
    followUps, 
    statusLogs,
    isAutoSyncing,
    addFollowUp, 
    updateFollowUp, 
    deleteFollowUp, 
    deleteMultipleFollowUps, 
    updateMultipleFollowUps,
    syncOrderStatus, 
    bulkSync, 
    bulkImport, 
    preFetchRecentOrders,
    isLoaded: isFollowUpsLoaded,
    error: followUpsError,
    refresh: refreshFollowUps
  } = useFollowUps(user, { enabled: !!user });

  const followUpCounts = useMemo(() => {
    return {
      main: followUps.filter(f => !LOCKED_STATUSES.includes(f.status)).length,
      others: followUps.filter(f => LOCKED_STATUSES.includes(f.status)).length
    };
  }, [followUps]);

  const {
    orders,
    courierDataMap,
    totalRecords: totalOrders,
    isFetching: isOrdersFetching,
    addOrder,
    updateOrder,
    deleteOrder,
    deleteOrders,
    importOrders,
    isLoaded: isOrdersLoaded,
    error: ordersError,
    refresh: refreshOrders,
    stats: ordersStats
  } = useOrders(user, { 
    page: ordersPage, 
    pageSize: ordersPageSize, 
    search: debouncedOrdersSearch,
    status: ordersStatus,
    warningFilter: ordersWarningFilter,
    date: ordersDate,
    syncStatus: ordersSyncStatus,
    products: allProducts,
    enabled: !!user
  });

  const {
    products,
    totalRecords: totalProducts,
    isFetching: isProductsFetching,
    addProduct,
    updateProduct,
    updateProducts,
    deleteProduct,
    deleteProducts,
    bulkImportProducts,
    isLoaded: isProductsLoaded,
    error: productsError,
    refresh: refreshProducts
  } = useProducts(user, {
    page: productsPage,
    pageSize: productsPageSize,
    search: debouncedProductsSearch,
    enabled: !!user
  });

  const {
    expenses,
    totalRecords: totalExpenses,
    isFetching: isExpensesFetching,
    addExpense,
    updateDollarRate,
    deleteExpense,
    isLoaded: isExpensesLoaded,
    error: expensesError,
    refresh: refreshExpenses
  } = useExpenses(user, {
    page: expensesPage,
    pageSize: expensesPageSize,
    group: expensesGroup,
    enabled: !!user
  });

  useEffect(() => {
    if (allSettings?.dollarRate) {
      setLocalDollarRate(allSettings.dollarRate.toString());
    }
  }, [allSettings]);

  // Auto-correct page numbers when a deletion or active filter makes the current page empty
  useEffect(() => {
    if (isOrdersLoaded && orders.length === 0 && ordersPage > 1) {
      setOrdersPage(prev => Math.max(1, prev - 1));
    }
  }, [orders.length, ordersPage, isOrdersLoaded]);

  useEffect(() => {
    if (isProductsLoaded && products.length === 0 && productsPage > 1) {
      setProductsPage(prev => Math.max(1, prev - 1));
    }
  }, [products.length, productsPage, isProductsLoaded]);

  useEffect(() => {
    if (isExpensesLoaded && expenses.length === 0 && expensesPage > 1) {
      setExpensesPage(prev => Math.max(1, prev - 1));
    }
  }, [expenses.length, expensesPage, isExpensesLoaded]);

  useAnimatedFavicon();

  const enrichedOrdersStats = useMemo(() => {
    if (!ordersStats) return null;
    
    let totalProfit = 0;
    allOrders.forEach(order => {
      const itemSalesTotal = order.items?.reduce((sum: number, item: any) => {
        const product = allProducts.find(p => {
          const pName = (p.name || "").toLowerCase().trim();
          const iName = (item.name || "").toLowerCase().trim();
          const pCode = (p.code || "").toLowerCase().trim();
          const iCode = (item.name || "").toLowerCase().trim();
          return pName === iName || pCode === iCode;
        });
        
        const sPrice = item.salePrice || product?.saleAmount || 0;
        return sum + (sPrice * (item.qty || 0));
      }, 0) || 0;

      const itemPurchaseTotal = order.items?.reduce((sum: number, item: any) => {
        const product = allProducts.find(p => {
          const pName = (p.name || "").toLowerCase().trim();
          const iName = (item.name || "").toLowerCase().trim();
          const pCode = (p.code || "").toLowerCase().trim();
          const iCode = (item.name || "").toLowerCase().trim();
          return pName === iName || pCode === iCode;
        });
        
        const pPrice = item.purchasePrice ?? product?.purchasePrice ?? 0;
        return sum + (pPrice * (item.qty || 0));
      }, 0) || 0;

      const delivery = order.delivery || 0;
      const profit = itemSalesTotal - itemPurchaseTotal - delivery;
      totalProfit += profit;
    });

    return {
      ...ordersStats,
      totalProfit
    };
  }, [ordersStats, allOrders, allProducts]);

  return (
    <AppContext.Provider
      value={{
        user,
        isAuthLoading,
        handleLogout,
        isSidebarCollapsed,
        setIsSidebarCollapsed,
        isMobileSidebarOpen,
        setIsMobileSidebarOpen,
        allOrders,
        allCourierData,
        allProducts,
        allExpenses,
        allSettings,
        isAllDataLoaded,
        allDataError,
        refreshAllData,
        isAddFollowUpOpen,
        setIsAddFollowUpOpen,
        orders,
        courierDataMap,
        totalOrders,
        isOrdersFetching,
        isOrdersLoaded,
        ordersError,
        ordersPage,
        setOrdersPage,
        ordersPageSize,
        setOrdersPageSize,
        ordersSearch,
        setOrdersSearch,
        ordersStatus,
        setOrdersStatus,
        ordersWarningFilter,
        setOrdersWarningFilter,
        ordersDate,
        setOrdersDate,
        ordersSyncStatus,
        setOrdersSyncStatus,
        addOrder,
        updateOrder,
        deleteOrder,
        deleteOrders,
        importOrders,
        refreshOrders,
        enrichedOrdersStats,
        showOrdersDashboard,
        setShowOrdersDashboard,
        products,
        totalProducts,
        isProductsFetching,
        isProductsLoaded,
        productsError,
        productsPage,
        setProductsPage,
        productsPageSize,
        setProductsPageSize,
        productsSearch,
        setProductsSearch,
        addProduct,
        updateProduct,
        updateProducts,
        deleteProduct,
        deleteProducts,
        bulkImportProducts,
        refreshProducts,
        expenses,
        totalExpenses,
        isExpensesFetching,
        isExpensesLoaded,
        expensesError,
        expensesPage,
        setExpensesPage,
        expensesPageSize,
        setExpensesPageSize,
        expensesGroup,
        setExpensesGroup,
        addExpense,
        updateDollarRate,
        deleteExpense,
        refreshExpenses,
        isAddExpenseOpen,
        setIsAddExpenseOpen,
        localDollarRate,
        setLocalDollarRate,
        followUps,
        statusLogs,
        isAutoSyncing,
        isFollowUpsLoaded,
        followUpsError,
        activeFollowUpSubTab,
        setActiveFollowUpSubTab,
        followUpCounts,
        addFollowUp,
        updateFollowUp,
        deleteFollowUp,
        deleteMultipleFollowUps,
        updateMultipleFollowUps,
        syncOrderStatus,
        bulkSync,
        bulkImport,
        preFetchRecentOrders,
        refreshFollowUps,
        statusFilter,
        setStatusFilter,
        isBulkSyncing,
        setIsBulkSyncing,
        dashboardType,
        setDashboardType,
        dateRange,
        setDateRange,
        activeRange,
        setActiveRange
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
