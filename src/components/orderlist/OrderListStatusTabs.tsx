import React from 'react';
import { Package, Truck, CheckCircle2, RotateCcw, XCircle, Clock, AlertTriangle, AlertCircle } from 'lucide-react';

export interface StatusCount {
  status: string;
  count: number;
}

export interface CourierCount {
  courier: string;
  count: number;
}

interface OrderListStatusTabsProps {
  statusTabs: string[];
  activeStatus: string;
  onSelectStatus: (status: string) => void;
  statusCounts: Record<string, number>;
  courierTabs: string[];
  activeCourier: string;
  onSelectCourier: (courier: string) => void;
  courierCounts: Record<string, number>;
}

export function OrderListStatusTabs({
  statusTabs,
  activeStatus,
  onSelectStatus,
  statusCounts,
  courierTabs,
  activeCourier,
  onSelectCourier,
  courierCounts
}: OrderListStatusTabsProps) {
  return (
    <div className="space-y-2.5">
      {/* Top Status Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin border-b border-gray-200 dark:border-slate-700/80">
        {statusTabs.map((status) => {
          const isActive = activeStatus.toLowerCase() === status.toLowerCase();
          const count = statusCounts[status] || 0;

          return (
            <button
              key={status}
              onClick={() => onSelectStatus(status)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-t-lg transition-all whitespace-nowrap border-b-2 -mb-[1px] ${
                isActive
                  ? 'border-indigo-600 dark:border-indigo-400 text-indigo-700 dark:text-indigo-300 bg-indigo-50/70 dark:bg-indigo-950/40 shadow-xs'
                  : 'border-transparent text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-100/70 dark:hover:bg-slate-800/60'
              }`}
            >
              <span>{status}</span>
              <span
                className={`px-1.5 py-0.5 text-[11px] font-bold rounded-full transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white dark:bg-indigo-500'
                    : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                {count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-level Courier Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {courierTabs.map((courier) => {
          const isActive = activeCourier.toLowerCase() === courier.toLowerCase();
          const count = courierCounts[courier] || 0;

          return (
            <button
              key={courier}
              onClick={() => onSelectCourier(courier)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white font-semibold shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/60'
              }`}
            >
              <span>{courier}</span>
              {courier !== 'All' && (
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                    isActive
                      ? 'bg-indigo-700 text-indigo-100'
                      : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
