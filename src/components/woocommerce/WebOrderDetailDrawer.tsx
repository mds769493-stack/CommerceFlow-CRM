import React, { useState } from 'react';
import { 
  X, 
  Store, 
  ExternalLink, 
  RefreshCw, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  CreditCard, 
  ShoppingBag, 
  Copy, 
  Check, 
  Truck, 
  MessageSquare,
  FileText,
  User,
  Package,
  ArrowUpRight,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  WebOrder, 
  WOO_STATUS_COLORS, 
  WooOrderStatus,
  CUSTOM_ORDER_STATUSES,
  CUSTOM_ORDER_STATUS_META,
  CustomOrderStatus
} from '../../types';
import { updateRemoteWooOrderStatus, updateCustomOrderStatus, syncSingleWooOrder } from '../../lib/woocommerceApi';
import { syncSingleShopifyOrder } from '../../lib/shopifyApi';
import { cn } from '@/lib/utils';

interface WebOrderDetailDrawerProps {
  order: WebOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: WebOrder) => void;
}

const ALL_WOO_STATUSES: { id: string; label: string }[] = [
  { id: 'pending', label: 'Pending payment' },
  { id: 'processing', label: 'Processing' },
  { id: 'on-hold', label: 'On hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'failed', label: 'Failed' },
];

export function WebOrderDetailDrawer({
  order,
  isOpen,
  onClose,
  onOrderUpdated
}: WebOrderDetailDrawerProps) {
  const [isUpdatingCustomStatus, setIsUpdatingCustomStatus] = useState(false);
  const [isUpdatingWooStatus, setIsUpdatingWooStatus] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showWooStatusSection, setShowWooStatusSection] = useState(false);

  if (!isOpen || !order) return null;

  const currentCustomStatus = (order.custom_status || order.customStatus || 'Processing') as CustomOrderStatus;
  const currentCustomStatusMeta = CUSTOM_ORDER_STATUS_META[currentCustomStatus] || {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200/80',
    label: currentCustomStatus || 'Processing'
  };

  const currentWooStatusMeta = WOO_STATUS_COLORS[(order.woocommerce_status || order.status || 'pending').toLowerCase()] || {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    label: order.woocommerce_status || order.status
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleCustomStatusChange = async (newStatus: CustomOrderStatus) => {
    if (newStatus === currentCustomStatus) return;
    setIsUpdatingCustomStatus(true);
    setActionError(null);

    try {
      const res = await updateCustomOrderStatus(order.id, newStatus);
      if (res.order) {
        onOrderUpdated(res.order);
      } else {
        onOrderUpdated({ ...order, custom_status: newStatus, customStatus: newStatus });
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update custom order status.');
    } finally {
      setIsUpdatingCustomStatus(false);
    }
  };

  const handleWooStatusChange = async (newStatus: string) => {
    const activeStatus = (order.woocommerce_status || order.status || '').toLowerCase();
    if (newStatus === activeStatus) return;
    setIsUpdatingWooStatus(true);
    setActionError(null);

    try {
      const res = await updateRemoteWooOrderStatus(order.id, newStatus);
      if (res.order) {
        onOrderUpdated(res.order);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update status on WooCommerce store.');
    } finally {
      setIsUpdatingWooStatus(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActionError(null);

    try {
      if (order.source === 'shopify') {
        const storeId = order.store_id || order.storeId || order.wooSiteId || '';
        const res = await syncSingleShopifyOrder(storeId, String(order.shopifyOrderId || order.wooOrderId || order.id));
        if (res.order) {
          onOrderUpdated(res.order);
        }
      } else {
        const res = await syncSingleWooOrder(order.wooSiteId, order.wooOrderId);
        if (res.order) {
          onOrderUpdated(res.order);
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to sync latest order info.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const cleanPhone = (order.customerPhone || '').replace(/[^0-9+]/g, '');
  const formattedDate = new Date(order.orderDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const fullShippingAddress = [
    order.shippingAddress?.address1,
    order.shippingAddress?.address2,
    order.shippingAddress?.city,
    order.shippingAddress?.state,
    order.shippingAddress?.postcode,
    order.shippingAddress?.country
  ].filter(Boolean).join(', ') || 'No shipping address provided';

  const fullBillingAddress = [
    order.billingAddress?.address1,
    order.billingAddress?.address2,
    order.billingAddress?.city,
    order.billingAddress?.state,
    order.billingAddress?.postcode,
    order.billingAddress?.country
  ].filter(Boolean).join(', ') || 'No billing address provided';

  const isShopify = order.source === 'shopify';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-2xl bg-white shadow-2xl border-l border-slate-200/80 flex flex-col">
          
          {/* Header */}
          <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-2xl text-white shadow-sm", isShopify ? "bg-emerald-600 shadow-emerald-500/20" : "bg-blue-600 shadow-blue-500/20")}>
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">
                    Order #{order.orderNumber || order.wooOrderId}
                  </h2>
                  <span className={cn(
                    "px-2 py-0.5 text-[11px] font-bold rounded-lg border",
                    isShopify 
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                      : "bg-blue-50 text-blue-700 border-blue-200/60"
                  )}>
                    {order.wooSiteName || (isShopify ? 'Shopify' : 'WooCommerce')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{formattedDate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                title={isShopify ? "Sync single order with Shopify" : "Sync single order with WooCommerce"}
                className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 rounded-xl"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isRefreshing && "animate-spin")} />
                Sync
              </Button>
              {order.viewOrderUrl && (
                <a
                  href={order.viewOrderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center h-8 px-3 text-xs font-semibold rounded-xl transition-colors",
                    isShopify
                      ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      : "text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100"
                  )}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                  {isShopify ? 'View in Shopify' : 'View in WP'}
                </a>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Drawer Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {actionError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between animate-in fade-in">
                <span>{actionError}</span>
                <button onClick={() => setActionError(null)} className="text-rose-500 hover:text-rose-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Custom Order Status Selector */}
            <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Custom Order Status</span>
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-xl text-xs font-bold border shadow-2xs",
                  currentCustomStatusMeta.bg,
                  currentCustomStatusMeta.text,
                  currentCustomStatusMeta.border
                )}>
                  {currentCustomStatusMeta.label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                {CUSTOM_ORDER_STATUSES.map((statusName) => {
                  const isActive = currentCustomStatus === statusName;
                  const meta = CUSTOM_ORDER_STATUS_META[statusName];
                  return (
                    <button
                      key={statusName}
                      type="button"
                      disabled={isUpdatingCustomStatus}
                      onClick={() => handleCustomStatusChange(statusName)}
                      className={cn(
                        "px-2.5 py-2 text-xs font-bold rounded-xl border text-center transition-all duration-150 cursor-pointer",
                        isActive
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-slate-900/20"
                          : cn("bg-white hover:bg-slate-50 border-slate-200 text-slate-700", meta.text)
                      )}
                    >
                      {statusName}
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400">
                Custom status updates are saved permanently and maintained separately from WooCommerce sync.
              </p>
            </div>

            {/* WooCommerce Remote Status Accordion / Sub-card */}
            <div className="p-4 rounded-2xl border border-slate-200/70 bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold text-slate-600">WooCommerce Store Status:</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-lg text-[11px] font-bold border",
                    currentWooStatusMeta.bg,
                    currentWooStatusMeta.text,
                    currentWooStatusMeta.border
                  )}>
                    {currentWooStatusMeta.label}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWooStatusSection(!showWooStatusSection)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                >
                  {showWooStatusSection ? 'Hide remote sync' : 'Sync remote status'}
                </button>
              </div>

              {showWooStatusSection && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Update status directly on the live WooCommerce store via REST API:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ALL_WOO_STATUSES.map((st) => {
                      const isActive = (order.woocommerce_status || order.status || '').toLowerCase() === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          disabled={isUpdatingWooStatus || isActive}
                          onClick={() => handleWooStatusChange(st.id)}
                          className={cn(
                            "px-2.5 py-1 text-[11px] font-semibold rounded-lg border transition-all duration-150 cursor-pointer",
                            isActive
                              ? "bg-slate-800 text-white border-slate-800"
                              : "bg-slate-50 text-slate-600 hover:text-slate-900 hover:bg-slate-100 border-slate-200"
                          )}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Customer Information Card */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Customer Details</h3>
                </div>
                {order.customerPhone && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${cleanPhone}`}
                      className="p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                      title="Call customer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </a>
                    <a
                      href={`https://wa.me/${cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone.startsWith('0') ? '88' + cleanPhone : cleanPhone}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                      title="WhatsApp Chat"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-slate-400 font-medium">Customer Name:</span>
                  <p className="font-bold text-slate-800 mt-0.5">{order.customerName}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium">Phone Number:</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="font-bold text-slate-800 font-mono">{order.customerPhone || 'Not provided'}</p>
                    {order.customerPhone && (
                      <button
                        onClick={() => copyToClipboard(order.customerPhone, 'phone')}
                        className="text-slate-400 hover:text-slate-700"
                        title="Copy phone"
                      >
                        {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                {order.customerEmail && (
                  <div className="sm:col-span-2">
                    <span className="text-slate-400 font-medium">Email:</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="font-medium text-slate-800">{order.customerEmail}</p>
                      <button
                        onClick={() => copyToClipboard(order.customerEmail, 'email')}
                        className="text-slate-400 hover:text-slate-700"
                        title="Copy email"
                      >
                        {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Delivery & Shipping Address */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Delivery Details</h3>
                </div>
                <button
                  onClick={() => copyToClipboard(fullShippingAddress, 'shipping')}
                  className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1"
                >
                  {copiedField === 'shipping' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>Copy Address</span>
                </button>
              </div>

              <div className="text-xs space-y-2">
                <div>
                  <span className="text-slate-400 font-medium">Shipping Address:</span>
                  <p className="font-medium text-slate-800 mt-0.5 leading-relaxed">{fullShippingAddress}</p>
                </div>
                {order.customerNote && (
                  <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900 text-xs">
                    <span className="font-bold">Customer Note:</span> {order.customerNote}
                  </div>
                )}
              </div>
            </div>

            {/* Order Items */}
            <div className="p-4 rounded-2xl border border-slate-200/80 bg-white shadow-sm space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Ordered Products ({order.itemCount})</h3>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                        {item.image ? (
                          <img 
                            src={item.image} 
                            alt={item.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover" 
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Package className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{item.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          Qty: {item.quantity} × ৳{Number(item.price || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900">
                      ৳{Number(item.total || 0).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Order Calculation Summary */}
              <div className="pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal</span>
                  <span>৳{Number(order.subtotal || order.total).toLocaleString()}</span>
                </div>
                {order.shippingTotal > 0 && (
                  <div className="flex justify-between text-slate-500">
                    <span>Shipping Fee ({order.shippingMethodTitle || 'Delivery'})</span>
                    <span>৳{Number(order.shippingTotal).toLocaleString()}</span>
                  </div>
                )}
                {order.discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span>-৳{Number(order.discountTotal).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-900 font-bold text-sm pt-2 border-t border-slate-100">
                  <span>Total Amount</span>
                  <span className="text-blue-600">৳{Number(order.total).toLocaleString()}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Drawer Footer */}
          <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-200/80 flex items-center justify-between">
            <span className="text-xs text-slate-400 font-mono">ID: {order.id}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="rounded-xl text-xs px-4"
            >
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
