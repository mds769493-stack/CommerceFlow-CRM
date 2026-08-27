import React from 'react';
import { X, Calendar, Phone, CheckCircle2, XCircle, Layers, ShieldCheck, ArrowRight } from 'lucide-react';
import { FraudCheckHistoryItem } from '../../../server/types/fraudChecker';
import { RiskBadge } from './RiskBadge';
import { CourierResultCard } from './CourierResultCard';

interface FraudHistoryModalProps {
  item: FraudCheckHistoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onRecheck?: (phone: string) => void;
}

export function FraudHistoryModal({ item, isOpen, onClose, onRecheck }: FraudHistoryModalProps) {
  if (!isOpen || !item) return null;

  const report = item.reportSnapshot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white font-mono">
                  {item.phone}
                </h2>
                <RiskBadge level={item.riskLevel} size="sm" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Checked on {new Date(item.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                {item.operator && <span className="font-semibold text-slate-700 dark:text-slate-300">({item.operator})</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Summary Metric Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                <Layers className="w-3 h-3 text-slate-400" />
                Total Orders
              </span>
              <p className="text-lg font-black text-slate-900 dark:text-white mt-0.5">
                {item.total}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Delivered
              </span>
              <p className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {item.delivered}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Cancelled
              </span>
              <p className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5">
                {item.cancelled}
              </p>
            </div>
            <div>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Success Rate
              </span>
              <p className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {item.successRate}%
              </p>
            </div>
          </div>

          {/* Courier Breakdowns */}
          <div>
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
              Courier Network Records Snapshot
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {report?.couriers && (
                <>
                  <CourierResultCard name="Steadfast" result={report.couriers.steadfast} />
                  <CourierResultCard name="Pathao" result={report.couriers.pathao} />
                  <CourierResultCard name="RedX" result={report.couriers.redx} />
                  <CourierResultCard name="Paperfly" result={report.couriers.paperfly} />
                  <CourierResultCard name="Carrybee" result={report.couriers.carrybee} />
                </>
              )}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
          >
            Close
          </button>
          {onRecheck && (
            <button
              onClick={() => {
                onClose();
                onRecheck(item.phone);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 hover:bg-slate-800 rounded-lg shadow-sm transition"
            >
              <span>Live Re-check</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
