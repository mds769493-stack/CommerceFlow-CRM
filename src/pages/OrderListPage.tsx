import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useParams } from 'react-router-dom';
import {
  Search,
  Filter,
  RotateCcw,
  Calendar,
  Download,
  Printer,
  RefreshCw,
  Plus,
  ChevronDown,
  Layers,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Tag,
  AlertCircle
} from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { fetchFromApi, saveToApi, deleteFromApi, batchSaveToApi, batchDeleteFromApi } from '../lib/api';
import { useAppContext } from '../context/AppContext';
import { OrderListStatusTabs } from '../components/orderlist/OrderListStatusTabs';
import { OrderListTable } from '../components/orderlist/OrderListTable';
import { PrintInvoiceModal } from '../components/orderlist/PrintInvoiceModal';
import { ViewOrderModal } from '../components/orderlist/ViewOrderModal';
import { EditOrderModal } from '../components/orderlist/EditOrderModal';
import { OrderListFiltersModal, OrderListFilters } from '../components/orderlist/OrderListFiltersModal';

const STATUS_TABS = [
  'Pending',
  'RTS',
  'Shipped',
  'Delivered',
  'Pending Return',
  'Returned',
  'Partial',
  'Cancelled',
  'Pending Cancel',
  'Preorder',
  'Lost'
];

const COURIER_TABS = ['All', 'Pathao', 'Steadfast', 'RedX', 'Carrybee', 'Paperfly'];

export function OrderListPage() {
  const { allOrders, refreshAllData } = useAppContext();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();
  const routeParams = useParams<{ status?: string }>();

  // Search, Status, and Courier states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [activeStatus, setActiveStatus] = useState<string>('Pending');
  const [activeCourier, setActiveCourier] = useState<string>('All');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

  // Sync URL search parameters
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== searchTerm) {
      setSearchTerm(q);
    }
    const statusQuery = searchParams.get('status') || routeParams.status;
    if (statusQuery) {
      const match = STATUS_TABS.find(t => t.toLowerCase() === statusQuery.toLowerCase());
      if (match && match !== activeStatus) {
        setActiveStatus(match);
      }
    }
  }, [searchParams, routeParams]);

  // Advanced Filters
  const [filters, setFilters] = useState<OrderListFilters>({});
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

  // Modals
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  // Bulk action dropdown
  const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Load orders from API
  const loadOrders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchFromApi('orders');
      if (Array.isArray(data) && data.length > 0) {
        setOrders(data);
      } else if (Array.isArray(allOrders) && allOrders.length > 0) {
        setOrders(allOrders);
      } else {
        setOrders(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      console.warn('API fetch orders failed, falling back to context orders:', err);
      if (Array.isArray(allOrders) && allOrders.length > 0) {
        setOrders(allOrders);
        setError(null);
      } else {
        setError(err.message || 'Failed to fetch order list');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Compute status counts
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_TABS.forEach((st) => (counts[st] = 0));
    orders.forEach((ord) => {
      const st = ord.status || 'Pending';
      // Match case-insensitively or normalized
      const matchedTab = STATUS_TABS.find((t) => t.toLowerCase() === st.toLowerCase()) || 'Pending';
      counts[matchedTab] = (counts[matchedTab] || 0) + 1;
    });
    return counts;
  }, [orders]);

  // Compute courier counts for active status
  const courierCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    COURIER_TABS.forEach((c) => (counts[c] = 0));

    orders.forEach((ord) => {
      const st = ord.status || 'Pending';
      if (st.toLowerCase() === activeStatus.toLowerCase()) {
        counts['All'] = (counts['All'] || 0) + 1;
        const cr = ord.courier || 'Pathao';
        const matchedCourier = COURIER_TABS.find((c) => c.toLowerCase() === cr.toLowerCase());
        if (matchedCourier) {
          counts[matchedCourier] = (counts[matchedCourier] || 0) + 1;
        }
      }
    });

    return counts;
  }, [orders, activeStatus]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // 1. Status Filter
      const ordStatus = ord.status || 'Pending';
      if (ordStatus.toLowerCase() !== activeStatus.toLowerCase()) {
        return false;
      }

      // 2. Courier Filter
      if (activeCourier !== 'All') {
        const ordCourier = ord.courier || 'Pathao';
        if (ordCourier.toLowerCase() !== activeCourier.toLowerCase()) {
          return false;
        }
      }

      // 3. Search Term (invoice, customer, phone, product, SKU, address, note)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const invoiceMatch = ord.invoice?.toLowerCase().includes(q);
        const nameMatch = (ord.customer || ord.customerName)?.toLowerCase().includes(q);
        const phoneMatch = ord.phone?.includes(q);
        const productMatch = ord.productName?.toLowerCase().includes(q) ||
          ord.items?.some((i) => i.name?.toLowerCase().includes(q) || i.sku?.toLowerCase().includes(q));
        const skuMatch = ord.sku?.toLowerCase().includes(q) || ord.code?.toLowerCase().includes(q);
        const noteMatch = ord.note?.toLowerCase().includes(q);
        const addressMatch = ord.address?.toLowerCase().includes(q);

        if (!invoiceMatch && !nameMatch && !phoneMatch && !productMatch && !skuMatch && !noteMatch && !addressMatch) {
          return false;
        }
      }

      // 4. Advanced Filter Modal checks
      if (filters.courier && ord.courier?.toLowerCase() !== filters.courier.toLowerCase()) {
        return false;
      }
      if (filters.source && ord.source?.toLowerCase() !== filters.source.toLowerCase()) {
        return false;
      }
      if (filters.user && !ord.user?.toLowerCase().includes(filters.user.toLowerCase())) {
        return false;
      }
      if (filters.phone && !ord.phone?.includes(filters.phone)) {
        return false;
      }
      if (filters.minAmount && Number(ord.total || 0) < Number(filters.minAmount)) {
        return false;
      }
      if (filters.maxAmount && Number(ord.total || 0) > Number(filters.maxAmount)) {
        return false;
      }
      if (filters.startDate) {
        const ordDate = new Date(ord.date || ord.created_at || 0).getTime();
        const startDate = new Date(filters.startDate).getTime();
        if (ordDate < startDate) return false;
      }
      if (filters.endDate) {
        const ordDate = new Date(ord.date || ord.created_at || 0).getTime();
        const endDate = new Date(filters.endDate).setHours(23, 59, 59, 999);
        if (ordDate > endDate) return false;
      }

      return true;
    });
  }, [orders, activeStatus, activeCourier, searchTerm, filters]);

  // Paginated orders
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredOrders.slice(startIndex, startIndex + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize) || 1;

  // Selection handlers
  const handleToggleSelectOrder = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === paginatedOrders.length && paginatedOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(paginatedOrders.map((o) => o.id));
    }
  };

  // Quick Action handlers
  const handleQuickUpdateStatus = async (orderId: string, newStatus: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    const updated = { ...target, status: newStatus as OrderStatus, updatedAt: new Date().toISOString() };

    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

    try {
      await saveToApi('orders', updated);
      refreshAllData?.();
    } catch (e) {
      console.error('Failed to sync status update:', e);
    }
  };

  const handleQuickAddTag = async (orderId: string, tag: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    const currentTags = target.tags || [];
    if (currentTags.includes(tag)) return;

    const updated = { ...target, tags: [...currentTags, tag], updatedAt: new Date().toISOString() };
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

    try {
      await saveToApi('orders', updated);
      refreshAllData?.();
    } catch (e) {
      console.error('Failed to sync tag:', e);
    }
  };

  const handleQuickUpdateNote = async (orderId: string, note: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;
    const updated = { ...target, note, updatedAt: new Date().toISOString() };
    setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));

    try {
      await saveToApi('orders', updated);
      refreshAllData?.();
    } catch (e) {
      console.error('Failed to sync note:', e);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setSelectedOrders((prev) => prev.filter((id) => id !== orderId));

    try {
      await deleteFromApi('orders', orderId);
      refreshAllData?.();
    } catch (e) {
      console.error('Failed to delete order:', e);
    }
  };

  const handleSaveEditOrder = async (updatedOrder: Order) => {
    setOrders((prev) => prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o)));
    try {
      await saveToApi('orders', updatedOrder);
      refreshAllData?.();
    } catch (e) {
      console.error('Failed to save order edit:', e);
    }
  };

  // Bulk Actions
  const handleBulkStatus = async (status: string) => {
    if (selectedOrders.length === 0) return;
    const nextOrders = orders.map((o) =>
      selectedOrders.includes(o.id) ? { ...o, status: status as OrderStatus, updatedAt: new Date().toISOString() } : o
    );
    setOrders(nextOrders);
    const updatedItems = nextOrders.filter((o) => selectedOrders.includes(o.id));
    setSelectedOrders([]);
    setIsBulkDropdownOpen(false);

    try {
      await batchSaveToApi('orders', updatedItems, 'replace');
      refreshAllData?.();
    } catch (e) {
      console.error('Bulk status update failed:', e);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedOrders.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedOrders.length} selected orders?`)) return;

    const toDelete = [...selectedOrders];
    setOrders((prev) => prev.filter((o) => !toDelete.includes(o.id)));
    setSelectedOrders([]);
    setIsBulkDropdownOpen(false);

    try {
      await batchDeleteFromApi('orders', toDelete);
      refreshAllData?.();
    } catch (e) {
      console.error('Bulk delete failed:', e);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredOrders.length === 0) return;
    const headers = ['Invoice', 'Date', 'Customer', 'Phone', 'Address', 'Products', 'SKU', 'Qty', 'Total', 'Status', 'Courier', 'User', 'Note'];
    const rows = filteredOrders.map((o) => [
      `"${o.invoice || o.id}"`,
      `"${o.date || o.created_at || ''}"`,
      `"${o.customer || o.customerName || ''}"`,
      `"${o.phone || ''}"`,
      `"${(o.address || '').replace(/"/g, '""')}"`,
      `"${(o.productName || o.items?.[0]?.name || '').replace(/"/g, '""')}"`,
      `"${o.sku || o.items?.[0]?.sku || ''}"`,
      o.qty || 1,
      o.total || 0,
      `"${o.status || 'Pending'}"`,
      `"${o.courier || 'Pathao'}"`,
      `"${o.user || 'Masuma Aktar'}"`,
      `"${(o.note || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Order_List_${activeStatus}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const hasActiveFilters = Boolean(
    filters.startDate ||
    filters.endDate ||
    filters.courier ||
    filters.source ||
    filters.user ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.phone ||
    filters.product
  );

  return (
    <div className="w-full min-h-screen bg-gray-50 dark:bg-slate-950 p-4 md:p-6 space-y-4">
      {/* Top Action & Control Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Search & Filter controls */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          {/* Search Input */}
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search here..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800/80 text-gray-900 dark:text-white placeholder-gray-400 focus:bg-white dark:focus:bg-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Order Filter Button */}
          <button
            onClick={() => setIsFilterModalOpen(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
              hasActiveFilters
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Order Filter</span>
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400" />
            )}
          </button>

          {/* Filter Reset Button */}
          {(hasActiveFilters || searchTerm) && (
            <button
              onClick={() => {
                setFilters({});
                setSearchTerm('');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Filter Reset</span>
            </button>
          )}

          {/* Date Selector Display */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 dark:text-slate-300 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg font-mono">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>
              {filters.startDate || '2026-03-01'} to {filters.endDate || '2026-03-02'}
            </span>
          </div>
        </div>

        {/* Right: Bulk Action, Download Excel, Invoice Print, Sync */}
        <div className="flex items-center gap-2">
          {/* Select All Checkbox Indicator */}
          <button
            onClick={handleSelectAll}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
              selectedOrders.length > 0
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800 font-semibold'
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50'
            }`}
          >
            <span>Select All {filteredOrders.length}</span>
            {selectedOrders.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                {selectedOrders.length}
              </span>
            )}
          </button>

          {/* Bulk Action Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsBulkDropdownOpen(!isBulkDropdownOpen)}
              disabled={selectedOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors shadow-xs"
            >
              <span>Bulk Action</span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            </button>

            {isBulkDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setIsBulkDropdownOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 z-40 text-xs">
                  <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase">
                    Change Status ({selectedOrders.length})
                  </div>
                  {['Pending', 'RTS', 'Shipped', 'Delivered', 'Cancelled'].map((st) => (
                    <button
                      key={st}
                      onClick={() => handleBulkStatus(st)}
                      className="w-full px-3 py-1.5 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between"
                    >
                      <span>Mark as {st}</span>
                    </button>
                  ))}
                  <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
                  <button
                    onClick={handleBulkDelete}
                    className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Download Excel Button */}
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Download Excel</span>
          </button>

          {/* Invoice Print Button */}
          <button
            onClick={() => {
              if (selectedOrders.length > 0) {
                const firstSelected = orders.find((o) => o.id === selectedOrders[0]);
                if (firstSelected) setPrintingOrder(firstSelected);
              } else if (filteredOrders.length > 0) {
                setPrintingOrder(filteredOrders[0]);
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/80 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Invoice Print</span>
          </button>

          {/* Reload / Sync Button */}
          <button
            onClick={loadOrders}
            disabled={isLoading}
            className="p-2 text-gray-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh Order List"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Top Status & Courier Tabs */}
      <OrderListStatusTabs
        statusTabs={STATUS_TABS}
        activeStatus={activeStatus}
        onSelectStatus={(st) => {
          setActiveStatus(st);
          setCurrentPage(1);
          setSelectedOrders([]);
        }}
        statusCounts={statusCounts}
        courierTabs={COURIER_TABS}
        activeCourier={activeCourier}
        onSelectCourier={(cr) => {
          setActiveCourier(cr);
          setCurrentPage(1);
          setSelectedOrders([]);
        }}
        courierCounts={courierCounts}
      />

      {/* Order List Table */}
      {isLoading && orders.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-12 text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-indigo-600" />
          <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Loading Order List...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/80 rounded-xl p-6 text-center text-rose-800 dark:text-rose-300">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-600" />
          <p className="font-semibold">{error}</p>
          <button
            onClick={loadOrders}
            className="mt-3 px-4 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 cursor-pointer"
          >
            Try Again
          </button>
        </div>
      ) : (
        <OrderListTable
          orders={paginatedOrders}
          selectedOrders={selectedOrders}
          onToggleSelectOrder={handleToggleSelectOrder}
          onSelectAll={handleSelectAll}
          onViewOrder={(ord) => setViewingOrder(ord)}
          onEditOrder={(ord) => setEditingOrder(ord)}
          onPrintInvoice={(ord) => setPrintingOrder(ord)}
          onDeleteOrder={handleDeleteOrder}
          onQuickUpdateStatus={handleQuickUpdateStatus}
          onQuickAddTag={handleQuickAddTag}
          onQuickUpdateNote={handleQuickUpdateNote}
        />
      )}

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 px-4 py-3 text-xs text-gray-600 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>Showing</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {filteredOrders.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
          </span>
          <span>to</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {Math.min(currentPage * pageSize, filteredOrders.length)}
          </span>
          <span>of</span>
          <span className="font-semibold text-gray-900 dark:text-white">{filteredOrders.length}</span>
          <span>records</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-gray-200 dark:border-slate-700 rounded-lg bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white"
            >
              <option value={10}>10</option>
              <option value={17}>17</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-gray-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-2 font-mono">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-gray-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Modals */}
      <PrintInvoiceModal
        order={printingOrder}
        isOpen={Boolean(printingOrder)}
        onClose={() => setPrintingOrder(null)}
      />

      <ViewOrderModal
        order={viewingOrder}
        isOpen={Boolean(viewingOrder)}
        onClose={() => setViewingOrder(null)}
        onEdit={(ord) => setEditingOrder(ord)}
        onPrint={(ord) => setPrintingOrder(ord)}
      />

      <EditOrderModal
        order={editingOrder}
        isOpen={Boolean(editingOrder)}
        onClose={() => setEditingOrder(null)}
        onSave={handleSaveEditOrder}
      />

      <OrderListFiltersModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onApplyFilters={(newFilters) => {
          setFilters(newFilters);
          setCurrentPage(1);
        }}
        onResetFilters={() => {
          setFilters({});
          setCurrentPage(1);
        }}
      />
    </div>
  );
}
