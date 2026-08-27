import React, { useState } from 'react';
import { 
  X, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Store, 
  Hash, 
  HelpCircle,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WooSite, WebOrder } from '../../types';
import { manualSyncSingleOrder } from '../../lib/woocommerceApi';
import { cn } from '@/lib/utils';

interface ManualSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: WooSite[];
  onOrderSynced: (order: WebOrder, isNew: boolean) => void;
  onOpenSettings?: () => void;
}

export function ManualSyncModal({
  isOpen,
  onClose,
  sites,
  onOrderSynced,
  onOpenSettings
}: ManualSyncModalProps) {
  const [orderIdInput, setOrderIdInput] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState<{
    type: 'success' | 'updated' | 'error';
    text: string;
    details?: string;
  } | null>(null);

  // Auto-select site if only 1 site exists or none selected
  React.useEffect(() => {
    if (sites.length > 0) {
      if (!selectedSiteId || !sites.some(s => s.id === selectedSiteId)) {
        setSelectedSiteId(sites[0].id);
      }
    }
  }, [sites, selectedSiteId]);

  // Reset state when opening
  React.useEffect(() => {
    if (isOpen) {
      setOrderIdInput('');
      setResultMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrderId = orderIdInput.trim().replace(/^#/, '');

    if (!cleanOrderId) {
      setResultMessage({
        type: 'error',
        text: 'Please enter a valid WooCommerce Order ID.'
      });
      return;
    }

    if (sites.length === 0) {
      setResultMessage({
        type: 'error',
        text: 'No connected WooCommerce store found. Please connect your store first.'
      });
      return;
    }

    setIsSubmitting(true);
    setResultMessage(null);

    try {
      const targetSiteId = selectedSiteId || (sites.length === 1 ? sites[0].id : undefined);
      const res = await manualSyncSingleOrder(cleanOrderId, targetSiteId);

      if (res.success && res.order) {
        setResultMessage({
          type: res.isNew ? 'success' : 'updated',
          text: res.message || (res.isNew ? `✓ Order #${cleanOrderId} synced successfully.` : `✓ Order #${cleanOrderId} updated successfully.`)
        });
        
        onOrderSynced(res.order, !!res.isNew);
      } else {
        setResultMessage({
          type: 'error',
          text: res.message || `✕ Unable to sync Order #${cleanOrderId}.`,
          details: 'Please check the Order ID and WooCommerce connection.'
        });
      }
    } catch (err: any) {
      setResultMessage({
        type: 'error',
        text: `✕ Unable to sync Order #${cleanOrderId}.`,
        details: err.message || 'Please check the Order ID and WooCommerce connection.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      id="manual-sync-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        id="manual-sync-modal-container"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shadow-xs">
              <RefreshCw className={cn("w-4 h-4", isSubmitting && "animate-spin")} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">Manual Sync Order</h2>
              <p className="text-xs text-slate-500 font-medium">Single-Order Webhook Fallback</p>
            </div>
          </div>
          <button
            id="close-manual-sync-modal-btn"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {/* Informational banner explaining single sync behavior */}
          <div className="p-3 bg-purple-50/60 border border-purple-100 rounded-xl flex items-start gap-2.5 text-xs text-purple-900">
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Automatic sync is exclusively managed via <strong>Webhooks</strong>. Use this manual tool strictly if an individual order was not delivered by your webhook.
            </div>
          </div>

          {sites.length === 0 ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">No Store Connected</p>
                <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
                  Connect your WooCommerce store REST API keys before performing manual order syncs.
                </p>
              </div>
              {onOpenSettings && (
                <Button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenSettings();
                  }}
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-9 rounded-xl font-semibold"
                >
                  Configure WooCommerce
                </Button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* If multiple stores connected, show store selector */}
              {sites.length > 1 && (
                <div className="space-y-1.5">
                  <label htmlFor="manual-sync-site-select" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 text-slate-500" />
                    Target WooCommerce Store
                  </label>
                  <select
                    id="manual-sync-site-select"
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    className="w-full h-10 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all font-medium text-slate-800"
                  >
                    {sites.map(site => (
                      <option key={site.id} value={site.id}>
                        {site.name} ({site.storeUrl})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Order ID Input */}
              <div className="space-y-1.5">
                <label htmlFor="manual-sync-order-id-input" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-slate-500" />
                    WooCommerce Order ID
                  </span>
                  <span className="text-[11px] font-normal text-slate-400">e.g. 15234</span>
                </label>
                <div className="relative">
                  <Input
                    id="manual-sync-order-id-input"
                    type="text"
                    placeholder="Enter Order ID (e.g. 15234)"
                    value={orderIdInput}
                    onChange={(e) => {
                      setOrderIdInput(e.target.value);
                      if (resultMessage) setResultMessage(null);
                    }}
                    className="h-11 px-3.5 font-mono text-sm bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-purple-500"
                    disabled={isSubmitting}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Feedback messages */}
              {resultMessage && (
                <div 
                  id="manual-sync-result-alert"
                  className={cn(
                    "p-3.5 rounded-xl border text-xs flex items-start gap-2.5 transition-all animate-in fade-in slide-in-from-top-1",
                    resultMessage.type === 'success' || resultMessage.type === 'updated'
                      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                      : "bg-rose-50 border-rose-200 text-rose-900"
                  )}
                >
                  {resultMessage.type === 'success' || resultMessage.type === 'updated' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="font-bold">{resultMessage.text}</p>
                    {resultMessage.details && (
                      <p className="mt-1 text-[11px] opacity-90">{resultMessage.details}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <Button
                  id="cancel-manual-sync-btn"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="h-9 px-4 text-xs font-semibold rounded-xl border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  id="submit-manual-sync-btn"
                  type="submit"
                  disabled={isSubmitting || !orderIdInput.trim()}
                  className="h-9 px-5 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Syncing Order...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                      Sync Order
                    </>
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
