import React, { useState, useRef, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  ChevronsUpDown, 
  ListChecks, 
  SlidersHorizontal, 
  Settings,
  X,
  Check,
  Plus,
  RefreshCw,
  Trash2,
  Download,
  Eye,
  Sliders
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ColumnOption {
  id: string;
  label: string;
  visible: boolean;
}

export interface OrderTableToolbarProps {
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onFilterClick?: () => void;
  onNewClick?: () => void;
  onManualSyncClick?: () => void;
  onBulkActionSelect?: (action: string) => void;
  onSyncOrders?: () => void;
  isSyncing?: boolean;
  onCustomizeColumnsClick?: () => void;
  onSettingsClick?: () => void;
  selectedCount?: number;
  columns?: ColumnOption[];
  onToggleColumn?: (columnId: string) => void;
  className?: string;
}

export function OrderTableToolbar({
  searchQuery = '',
  onSearchChange,
  onFilterClick,
  onNewClick,
  onManualSyncClick,
  onBulkActionSelect,
  onSyncOrders,
  isSyncing = false,
  onCustomizeColumnsClick,
  onSettingsClick,
  selectedCount = 0,
  columns = [],
  onToggleColumn,
  className,
}: OrderTableToolbarProps) {
  const [internalSearch, setInternalSearch] = useState(searchQuery);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [isNewMenuOpen, setIsNewMenuOpen] = useState(false);
  const [isBulkMenuOpen, setIsBulkMenuOpen] = useState(false);
  const [isColumnsMenuOpen, setIsColumnsMenuOpen] = useState(false);

  const filterRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);
  const bulkRef = useRef<HTMLDivElement>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInternalSearch(searchQuery);
  }, [searchQuery]);

  // Click outside listener to close dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
      if (newRef.current && !newRef.current.contains(event.target as Node)) {
        setIsNewMenuOpen(false);
      }
      if (bulkRef.current && !bulkRef.current.contains(event.target as Node)) {
        setIsBulkMenuOpen(false);
      }
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) {
        setIsColumnsMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInternalSearch(val);
    onSearchChange?.(val);
  };

  const handleClearSearch = () => {
    setInternalSearch('');
    onSearchChange?.('');
  };

  return (
    <div
      id="order-table-toolbar"
      className={cn(
        "flex justify-between items-center py-2 px-4 bg-white rounded-xl border border-slate-200 shadow-xs flex-wrap gap-2.5",
        className
      )}
    >
      {/* Left Side Items */}
      <div className="flex items-center gap-2 flex-1 min-w-[260px] max-w-lg">
        {/* Search Input Field */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            id="orders-filter-input"
            type="text"
            value={internalSearch}
            onChange={handleSearchChange}
            placeholder="Filter orders..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all"
          />
          {internalSearch && (
            <button
              onClick={handleClearSearch}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Button with optional dropdown menu */}
        <div className="relative" ref={filterRef}>
          <button
            id="toolbar-filter-btn"
            type="button"
            onClick={() => {
              setIsFilterMenuOpen(prev => !prev);
              onFilterClick?.();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors cursor-pointer select-none"
          >
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Filter</span>
          </button>

          {isFilterMenuOpen && (
            <div className="absolute left-0 mt-1.5 w-56 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-30 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Filter Quick Presets
              </div>
              <div className="space-y-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange({ target: { value: 'COD' } } as any);
                    setIsFilterMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-between"
                >
                  <span>Payment: Cash on Delivery</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange({ target: { value: 'bKash' } } as any);
                    setIsFilterMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-between"
                >
                  <span>Payment: bKash / Online</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleSearchChange({ target: { value: 'Dhaka' } } as any);
                    setIsFilterMenuOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors flex items-center justify-between"
                >
                  <span>Shipping: Inside Dhaka</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Side Items */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Manual Sync Order Button (Webhook Fallback) */}
        {onManualSyncClick && (
          <button
            id="toolbar-manual-sync-btn"
            type="button"
            onClick={onManualSyncClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 rounded-lg text-xs font-semibold transition-colors cursor-pointer select-none"
            title="Manual Single Order Sync (Webhook Fallback)"
          >
            <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
            <span>Manual Sync Order</span>
          </button>
        )}

        {/* New Button: Icon + "New" */}
        <div className="relative" ref={newRef}>
          <button
            id="toolbar-new-btn"
            type="button"
            onClick={() => {
              setIsNewMenuOpen(prev => !prev);
              onNewClick?.();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors cursor-pointer select-none"
          >
            <Plus className="w-3.5 h-3.5 text-slate-600" />
            <span>New</span>
          </button>

          {isNewMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 animate-in fade-in zoom-in-95">
              <button
                type="button"
                onClick={() => {
                  setIsNewMenuOpen(false);
                  onNewClick?.();
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 text-xs transition-colors flex items-center gap-2"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>Create Manual Order</span>
              </button>
              {onManualSyncClick && (
                <button
                  type="button"
                  onClick={() => {
                    setIsNewMenuOpen(false);
                    onManualSyncClick();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-purple-50 text-purple-700 text-xs transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                  <span>Manual Sync Order ID</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Bulk Actions Button with ListChecks & Dropdown */}
        <div className="relative" ref={bulkRef}>
          <button
            id="toolbar-bulk-actions-btn"
            type="button"
            onClick={() => setIsBulkMenuOpen(prev => !prev)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 transition-colors cursor-pointer select-none",
              selectedCount > 0 && "border-purple-300 bg-purple-50/50 text-purple-700 font-semibold"
            )}
          >
            <ListChecks className="w-3.5 h-3.5 text-slate-500" />
            <span>Bulk Actions</span>
            {selectedCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.2 bg-purple-600 text-white rounded text-[10px] font-bold">
                {selectedCount}
              </span>
            )}
          </button>

          {isBulkMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-30 animate-in fade-in zoom-in-95">
              <div className="px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                {selectedCount > 0 ? `${selectedCount} order(s) selected` : 'Batch Actions'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsBulkMenuOpen(false);
                  onBulkActionSelect?.('mark_approved');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 text-xs transition-colors flex items-center gap-2"
              >
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Mark as Approved</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsBulkMenuOpen(false);
                  onBulkActionSelect?.('mark_processing');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 text-xs transition-colors flex items-center gap-2"
              >
                <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                <span>Mark as Processing</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsBulkMenuOpen(false);
                  onBulkActionSelect?.('export');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 text-xs transition-colors flex items-center gap-2"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export to CSV</span>
              </button>
              <div className="h-px bg-slate-100 my-1" />
              <button
                type="button"
                onClick={() => {
                  setIsBulkMenuOpen(false);
                  onBulkActionSelect?.('delete');
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 text-rose-600 text-xs transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Remove Selected</span>
              </button>
            </div>
          )}
        </div>

        {/* Sliders / Customize Column Icon Button */}
        <div className="relative" ref={columnsRef}>
          <button
            id="toolbar-customize-columns-btn"
            type="button"
            onClick={() => {
              if (columns.length > 0) {
                setIsColumnsMenuOpen(prev => !prev);
              }
              onCustomizeColumnsClick?.();
            }}
            title="Customize Columns"
            className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 transition-colors cursor-pointer select-none"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
          </button>

          {isColumnsMenuOpen && columns.length > 0 && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-30 animate-in fade-in zoom-in-95">
              <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Toggle Columns</span>
              </div>
              <div className="space-y-1 mt-1">
                {columns.map(col => (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => onToggleColumn?.(col.id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-700 hover:bg-slate-50 rounded-lg transition-colors"
                  >
                    <span>{col.label}</span>
                    <span className={cn(
                      "w-4 h-4 rounded flex items-center justify-center border",
                      col.visible ? "bg-purple-600 border-purple-600 text-white" : "border-slate-300 bg-white"
                    )}>
                      {col.visible && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Settings Icon Button (borderless) */}
        <button
          id="toolbar-settings-btn"
          type="button"
          onClick={onSettingsClick}
          title="WooCommerce Settings"
          className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer select-none"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
