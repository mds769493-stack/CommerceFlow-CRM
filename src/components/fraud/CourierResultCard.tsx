import React from 'react';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Truck, 
  ExternalLink,
  PackageCheck,
  PackageX,
  Layers
} from 'lucide-react';
import { CourierCheckResult } from '../../../server/types/fraudChecker';

interface CourierResultCardProps {
  name: 'Steadfast' | 'Pathao' | 'RedX' | 'Paperfly' | 'Carrybee';
  result?: CourierCheckResult;
  isLoading?: boolean;
}

const courierMetadata: Record<string, { brandColor: string; bgAccent: string; logoText: string; lightBg: string }> = {
  Steadfast: {
    brandColor: 'text-emerald-700 dark:text-emerald-400',
    bgAccent: 'from-emerald-600 to-teal-700',
    lightBg: 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200/80 dark:border-emerald-900/40',
    logoText: 'SF'
  },
  Pathao: {
    brandColor: 'text-rose-700 dark:text-rose-400',
    bgAccent: 'from-rose-600 to-red-700',
    lightBg: 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/80 dark:border-rose-900/40',
    logoText: 'PT'
  },
  RedX: {
    brandColor: 'text-red-700 dark:text-red-400',
    bgAccent: 'from-red-600 to-orange-700',
    lightBg: 'bg-red-50/70 dark:bg-red-950/20 border-red-200/80 dark:border-red-900/40',
    logoText: 'RX'
  },
  Paperfly: {
    brandColor: 'text-blue-700 dark:text-blue-400',
    bgAccent: 'from-blue-600 to-cyan-700',
    lightBg: 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200/80 dark:border-blue-900/40',
    logoText: 'PF'
  },
  Carrybee: {
    brandColor: 'text-amber-700 dark:text-amber-400',
    bgAccent: 'from-amber-500 to-yellow-600',
    lightBg: 'bg-amber-50/70 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40',
    logoText: 'CB'
  }
};

export function CourierResultCard({ name, result, isLoading = false }: CourierResultCardProps) {
  const meta = courierMetadata[name] || {
    brandColor: 'text-slate-700 dark:text-slate-300',
    bgAccent: 'from-slate-600 to-slate-700',
    lightBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    logoText: name.substring(0, 2).toUpperCase()
  };

  const isSuccess = result?.status === 'success';
  const isError = result?.status === 'error';
  const isDisabled = result?.status === 'disabled';
  const isUnconfigured = result?.status === 'unconfigured';

  return (
    <div
      id={`courier-card-${name.toLowerCase()}`}
      className={`relative rounded-xl border p-4.5 transition-all duration-200 shadow-sm hover:shadow-md bg-white dark:bg-slate-900/90 ${
        isSuccess ? meta.lightBg : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${meta.bgAccent} flex items-center justify-center text-white font-black text-sm shadow-sm`}>
            {meta.logoText}
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight">
              {name}
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              BD Courier Network
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div>
          {isLoading ? (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 animate-pulse font-medium bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-900">
              <Clock className="w-3 h-3 animate-spin" />
              <span>Checking...</span>
            </span>
          ) : isSuccess ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100/70 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="w-3 h-3" />
              <span>Active</span>
            </span>
          ) : isError ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-900">
              <XCircle className="w-3 h-3" />
              <span>Failed</span>
            </span>
          ) : isDisabled ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
              <span>Disabled</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900">
              <AlertCircle className="w-3 h-3" />
              <span>Not Configured</span>
            </span>
          )}
        </div>
      </div>

      {/* Metrics Section */}
      {isLoading ? (
        <div className="space-y-2.5 py-3 animate-pulse">
          <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-3/4"></div>
          <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded"></div>
          <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded"></div>
        </div>
      ) : isSuccess && result ? (
        <div>
          {/* Main Numbers */}
          <div className="grid grid-cols-3 gap-2 py-2 mb-3 bg-white/80 dark:bg-slate-800/60 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <Layers className="w-3 h-3 text-slate-400" />
                <span>Total</span>
              </div>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {result.total}
              </p>
            </div>

            <div className="text-center border-x border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <PackageCheck className="w-3 h-3" />
                <span>Delivered</span>
              </div>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {result.delivered}
              </p>
            </div>

            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                <PackageX className="w-3 h-3" />
                <span>Cancelled</span>
              </div>
              <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {result.cancelled}
              </p>
            </div>
          </div>

          {/* Success Rate Progress */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs font-semibold">
              <span className="text-slate-600 dark:text-slate-400">Success Rate</span>
              {result.total > 0 ? (
                <span className={result.successRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : result.successRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>
                  {result.successRate}%
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  No Record (রেকর্ড নেই)
                </span>
              )}
            </div>
            
            {result.total > 0 ? (
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${result.successRate}%` }}
                />
                <div
                  className="bg-rose-500 h-full transition-all duration-500"
                  style={{ width: `${result.cancelRate || (100 - result.successRate)}%` }}
                />
              </div>
            ) : (
              <div className="w-full bg-slate-100 dark:bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
                <div className="w-full h-full bg-slate-200 dark:bg-slate-700/50" />
              </div>
            )}
          </div>

          {/* Latency / Notice Footer */}
          <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>{result.total === 0 ? 'No parcel history on this network' : 'Latency'}</span>
            {result.responseTimeMs !== undefined && <span>{result.responseTimeMs} ms</span>}
          </div>
        </div>
      ) : (
        <div className="py-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium line-clamp-2">
            {result?.message || (isDisabled ? 'Courier check is disabled in settings.' : isUnconfigured ? 'Please configure credentials in settings.' : 'No parcel history found.')}
          </p>
        </div>
      )}
    </div>
  );
}
