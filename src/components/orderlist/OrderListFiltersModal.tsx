import React, { useState } from 'react';
import { X, Filter, RotateCcw, Calendar, Phone, DollarSign, User, Globe, Truck } from 'lucide-react';

export interface OrderListFilters {
  startDate?: string;
  endDate?: string;
  courier?: string;
  source?: string;
  user?: string;
  minAmount?: string;
  maxAmount?: string;
  phone?: string;
  product?: string;
  hasNote?: boolean;
  statusTag?: string;
}

interface OrderListFiltersModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: OrderListFilters;
  onApplyFilters: (filters: OrderListFilters) => void;
  onResetFilters: () => void;
}

export function OrderListFiltersModal({
  isOpen,
  onClose,
  filters,
  onApplyFilters,
  onResetFilters
}: OrderListFiltersModalProps) {
  const [localFilters, setLocalFilters] = useState<OrderListFilters>(filters);

  if (!isOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    onApplyFilters(localFilters);
    onClose();
  };

  const handleReset = () => {
    setLocalFilters({});
    onResetFilters();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/80 dark:bg-slate-800/80">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Order Filter</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/50 dark:hover:bg-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters Form */}
        <form onSubmit={handleApply} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Date Range */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" /> Date Range
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-gray-500 block mb-0.5">Start Date</span>
                <input
                  type="date"
                  value={localFilters.startDate || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, startDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block mb-0.5">End Date</span>
                <input
                  type="date"
                  value={localFilters.endDate || ''}
                  onChange={(e) => setLocalFilters({ ...localFilters, endDate: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Courier & Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" /> Courier
              </label>
              <select
                value={localFilters.courier || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, courier: e.target.value })}
                className="w-full px-2.5 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">All Couriers</option>
                <option value="Pathao">Pathao</option>
                <option value="Steadfast">Steadfast</option>
                <option value="RedX">RedX</option>
                <option value="Carrybee">Carrybee</option>
                <option value="Paperfly">Paperfly</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-indigo-600" /> Order Source
              </label>
              <select
                value={localFilters.source || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, source: e.target.value })}
                className="w-full px-2.5 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              >
                <option value="">All Sources</option>
                <option value="Website">Website</option>
                <option value="WooCommerce">WooCommerce</option>
                <option value="Shopify">Shopify</option>
                <option value="Facebook">Facebook</option>
                <option value="Manual">Manual</option>
              </select>
            </div>
          </div>

          {/* Amount Range */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-indigo-600" /> Amount Range (৳)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                placeholder="Min ৳"
                value={localFilters.minAmount || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, minAmount: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
              />
              <input
                type="number"
                placeholder="Max ৳"
                value={localFilters.maxAmount || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, maxAmount: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Phone & Product */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-indigo-600" /> Customer Phone
              </label>
              <input
                type="text"
                placeholder="e.g. 018..."
                value={localFilters.phone || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, phone: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" /> Processed By
              </label>
              <input
                type="text"
                placeholder="e.g. Masuma"
                value={localFilters.user || ''}
                onChange={(e) => setLocalFilters({ ...localFilters, user: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Product / SKU */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Product Title or SKU</label>
            <input
              type="text"
              placeholder="e.g. Robot Dog or KN-1347"
              value={localFilters.product || ''}
              onChange={(e) => setLocalFilters({ ...localFilters, product: e.target.value })}
              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
