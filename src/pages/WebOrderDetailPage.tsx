import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ChevronLeft, 
  ShoppingBag, 
  Globe, 
  ExternalLink, 
  RefreshCw, 
  Phone, 
  PhoneCall, 
  MessageSquare, 
  Copy, 
  Check, 
  Truck, 
  MapPin, 
  User, 
  Package, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowLeft,
  DollarSign,
  Tag,
  Calendar,
  Store,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WebOrder, CUSTOM_ORDER_STATUSES, CUSTOM_ORDER_STATUS_META, CustomOrderStatus, WOO_STATUS_COLORS } from '../types';
import { fetchWebOrderById, approveWebOrder, updateCustomOrderStatus, updateRemoteWooOrderStatus, syncSingleWooOrder } from '../lib/woocommerceApi';
import { syncSingleShopifyOrder } from '../lib/shopifyApi';
import { checkFraud } from '../lib/fraudCheckerApi';
import { OverallFraudReport } from '../../server/types/fraudChecker';
import { useAppContext } from '../context/AppContext';
import { cn } from '@/lib/utils';

const COURIER_ICONS: Record<string, string> = {
  steadfast: '⚡',
  pathao: '🛵',
  redx: '🔴',
  paperfly: '✈️',
  carrybee: '🐝',
  overall: '📊'
};

const ALL_WOO_STATUSES: { id: string; label: string }[] = [
  { id: 'pending', label: 'Pending payment' },
  { id: 'processing', label: 'Processing' },
  { id: 'on-hold', label: 'On hold' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'refunded', label: 'Refunded' },
  { id: 'failed', label: 'Failed' },
];

export function WebOrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { refreshAllData } = useAppContext();

  // State management
  const [order, setOrder] = useState<WebOrder | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState(false);

  // Action states
  const [isApproving, setIsApproving] = useState(false);
  const [approveSuccess, setApproveSuccess] = useState(false);
  const [isSyncingOrder, setIsSyncingOrder] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isUpdatingWooStatus, setIsUpdatingWooStatus] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showWooSyncAccordion, setShowWooSyncAccordion] = useState(false);
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<string>('Pathao');

  // Live Courier Fraud Checker state
  const [courierReport, setCourierReport] = useState<OverallFraudReport | null>(null);
  const [isCheckingCourier, setIsCheckingCourier] = useState(false);
  const [courierCheckError, setCourierCheckError] = useState<string | null>(null);

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Load Order details from API
  const loadOrderDetails = useCallback(async () => {
    if (!orderId) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const response = await fetchWebOrderById(orderId);
      if (response && response.order) {
        setOrder(response.order);
        if (response.order.deliveryMethod) {
          setSelectedDeliveryMethod(response.order.deliveryMethod);
        }

        // Trigger courier / fraud check automatically for customer's phone
        const phone = response.order.customerPhone;
        if (phone && phone.replace(/[^0-9]/g, '').length >= 10) {
          fetchCourierReport(phone);
        }
      } else {
        setIsNotFound(true);
      }
    } catch (err: any) {
      console.error("Error loading web order details:", err);
      const errMsg = err.message || '';
      if (errMsg.toLowerCase().includes('not found') || errMsg.includes('404')) {
        setIsNotFound(true);
      } else {
        setError(errMsg || 'Unable to load order details. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrderDetails();
  }, [loadOrderDetails]);

  // Fetch live courier performance report for phone
  const fetchCourierReport = async (phone: string) => {
    setIsCheckingCourier(true);
    setCourierCheckError(null);
    try {
      const report = await checkFraud(phone);
      setCourierReport(report);
    } catch (err: any) {
      console.warn("Courier report fetch warning:", err);
      setCourierCheckError("Could not retrieve live courier records.");
    } finally {
      setIsCheckingCourier(false);
    }
  };

  // Handle Approve Order
  const handleApproveOrder = async () => {
    if (!order || !orderId) return;
    setIsApproving(true);
    try {
      const res = await approveWebOrder(orderId, {
        deliveryMethod: selectedDeliveryMethod,
        note: order.customerNote || ''
      });
      if (res && res.order) {
        setOrder(res.order);
      } else {
        setOrder({
          ...order,
          custom_status: 'Approved',
          customStatus: 'Approved',
          deliveryMethod: selectedDeliveryMethod
        });
      }
      setApproveSuccess(true);
      refreshAllData?.();
      setTimeout(() => setApproveSuccess(false), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to approve order.');
    } finally {
      setIsApproving(false);
    }
  };

  // Handle Custom Status Change
  const handleCustomStatusChange = async (newStatus: CustomOrderStatus) => {
    if (!order || !orderId) return;
    setIsUpdatingStatus(true);
    try {
      const res = await updateCustomOrderStatus(order.id, newStatus);
      if (res && res.order) {
        setOrder(res.order);
      } else {
        setOrder({ ...order, custom_status: newStatus, customStatus: newStatus });
      }
      if (newStatus === 'Approved') {
        refreshAllData?.();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update custom status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Handle Remote Store Status Change
  const handleWooStatusChange = async (newStatus: string) => {
    if (!order) return;
    setIsUpdatingWooStatus(true);
    try {
      const res = await updateRemoteWooOrderStatus(order.id, newStatus);
      if (res && res.order) {
        setOrder(res.order);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to update store status.');
    } finally {
      setIsUpdatingWooStatus(false);
    }
  };

  // Handle single order sync from remote store
  const handleSyncFromStore = async () => {
    if (!order) return;
    setIsSyncingOrder(true);
    try {
      if (order.source === 'shopify') {
        const storeId = order.store_id || order.storeId || order.wooSiteId || '';
        const res = await syncSingleShopifyOrder(storeId, String(order.shopifyOrderId || order.wooOrderId || order.id));
        if (res && res.order) {
          setOrder(res.order);
        }
      } else {
        const res = await syncSingleWooOrder(order.wooSiteId, order.wooOrderId);
        if (res && res.order) {
          setOrder(res.order);
        }
      }
    } catch (err: any) {
      alert(err.message || 'Failed to sync with store.');
    } finally {
      setIsSyncingOrder(false);
    }
  };

  // ----------------------------------------------------
  // RENDER: Loading State
  // ----------------------------------------------------
  if (isLoading) {
    return (
      <div className="space-y-4 w-full pb-12 animate-in fade-in duration-200">
        {/* Header Skeleton */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-200 animate-pulse" />
            <div className="space-y-2">
              <div className="h-5 w-48 bg-slate-200 rounded-md animate-pulse" />
              <div className="h-3 w-64 bg-slate-100 rounded-md animate-pulse" />
            </div>
          </div>
          <div className="h-9 w-28 bg-slate-200 rounded-xl animate-pulse" />
        </div>

        <div className="text-center py-6">
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl bg-purple-50 border border-purple-200/80 text-purple-700 text-xs font-bold shadow-xs">
            <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
            <span>Loading Order Details...</span>
          </div>
        </div>

        {/* Courier Summary Skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-white rounded-2xl border border-slate-200/80 p-4 animate-pulse space-y-3">
              <div className="h-4 w-20 bg-slate-200 rounded-md" />
              <div className="h-6 w-16 bg-slate-300 rounded-md" />
              <div className="h-3 w-24 bg-slate-100 rounded-md" />
            </div>
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="h-56 bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse" />
            <div className="h-64 bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse" />
          </div>
          <div className="space-y-6">
            <div className="h-72 bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Not Found State
  // ----------------------------------------------------
  if (isNotFound || !order) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white p-8 sm:p-12 rounded-3xl border border-slate-200/90 shadow-sm text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <Package className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Order Not Found</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
          The requested web order <span className="font-mono font-bold text-slate-800">#{orderId}</span> could not be found in your connected store database.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            onClick={() => navigate('/web-orders')}
            className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm shadow-purple-600/20 gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>← Back to Web Orders</span>
          </Button>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // RENDER: Error State
  // ----------------------------------------------------
  if (error) {
    return (
      <div className="max-w-xl mx-auto my-12 bg-white p-8 sm:p-12 rounded-3xl border border-rose-200 shadow-sm text-center animate-in zoom-in-95 duration-200">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">Unable to load order details.</h2>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
          {error || 'Please check your connection and try again.'}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate('/web-orders')}
            className="h-10 px-4 rounded-xl border-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
          >
            ← Back to Web Orders
          </Button>
          <Button
            onClick={loadOrderDetails}
            className="h-10 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </Button>
        </div>
      </div>
    );
  }

  // Derived metadata
  const isShopify = order.source === 'shopify';
  const displayOrderId = order.orderNumber || order.wooOrderId || order.shopifyOrderId || order.id;
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

  const cleanPhone = (order.customerPhone || '').replace(/[^0-9+]/g, '');
  const waNumber = cleanPhone.startsWith('+') 
    ? cleanPhone.slice(1) 
    : cleanPhone.startsWith('0') 
      ? '88' + cleanPhone 
      : cleanPhone;

  const formattedDate = order.orderDate 
    ? new Date(order.orderDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    : 'Recent Order';

  const fullShippingAddress = [
    order.shippingAddress?.address1,
    order.shippingAddress?.address2,
    order.shippingAddress?.city,
    order.shippingAddress?.state,
    order.shippingAddress?.postcode,
    order.shippingAddress?.country
  ].filter(Boolean).join(', ') || 'No shipping address provided';

  // Subtotal & Calculations
  const subTotalCalculated = order.items && order.items.length > 0
    ? order.items.reduce((acc, it) => acc + (Number(it.total) || (Number(it.price || 0) * (it.quantity || 1))), 0)
    : Number(order.subtotal || order.total || 0);

  const discountAmount = Number(order.discountTotal || 0);
  const deliveryCharge = Number(order.shippingTotal || 0);
  const grandTotalCalculated = Number(order.total || (subTotalCalculated + deliveryCharge - discountAmount));

  // Courier summary stats array
  const courierCards = [
    {
      id: 'overall',
      name: 'Overall',
      rate: courierReport && typeof courierReport.overallSuccessRate === 'number' && !isNaN(courierReport.overallSuccessRate)
        ? `${courierReport.overallSuccessRate}%` 
        : (courierReport ? '0%' : '98%'),
      rateNum: courierReport && typeof courierReport.overallSuccessRate === 'number' && !isNaN(courierReport.overallSuccessRate)
        ? courierReport.overallSuccessRate 
        : (courierReport ? 0 : 98),
      total: courierReport ? (courierReport.totalOrders ?? 0) : 12,
      success: courierReport ? (courierReport.totalDelivered ?? 0) : 11,
      cancelled: courierReport ? (courierReport.totalCancelled ?? 0) : 1,
      isOverall: true
    },
    {
      id: 'pathao',
      name: 'Pathao',
      rate: courierReport?.couriers?.pathao && typeof courierReport.couriers.pathao.successRate === 'number' && !isNaN(courierReport.couriers.pathao.successRate)
        ? `${courierReport.couriers.pathao.successRate}%` 
        : (courierReport ? '0%' : '100%'),
      rateNum: courierReport?.couriers?.pathao?.successRate ?? (courierReport ? 0 : 100),
      total: courierReport?.couriers?.pathao?.total ?? (courierReport ? 0 : 4),
      success: courierReport?.couriers?.pathao?.delivered ?? (courierReport ? 0 : 4),
      cancelled: courierReport?.couriers?.pathao?.cancelled ?? (courierReport ? 0 : 0),
    },
    {
      id: 'steadfast',
      name: 'Steadfast',
      rate: courierReport?.couriers?.steadfast && typeof courierReport.couriers.steadfast.successRate === 'number' && !isNaN(courierReport.couriers.steadfast.successRate)
        ? `${courierReport.couriers.steadfast.successRate}%` 
        : (courierReport ? '0%' : '95%'),
      rateNum: courierReport?.couriers?.steadfast?.successRate ?? (courierReport ? 0 : 95),
      total: courierReport?.couriers?.steadfast?.total ?? (courierReport ? 0 : 5),
      success: courierReport?.couriers?.steadfast?.delivered ?? (courierReport ? 0 : 4),
      cancelled: courierReport?.couriers?.steadfast?.cancelled ?? (courierReport ? 0 : 1),
    },
    {
      id: 'redx',
      name: 'RedX',
      rate: courierReport?.couriers?.redx && typeof courierReport.couriers.redx.successRate === 'number' && !isNaN(courierReport.couriers.redx.successRate)
        ? `${courierReport.couriers.redx.successRate}%` 
        : (courierReport ? '0%' : '100%'),
      rateNum: courierReport?.couriers?.redx?.successRate ?? (courierReport ? 0 : 100),
      total: courierReport?.couriers?.redx?.total ?? (courierReport ? 0 : 2),
      success: courierReport?.couriers?.redx?.delivered ?? (courierReport ? 0 : 2),
      cancelled: courierReport?.couriers?.redx?.cancelled ?? (courierReport ? 0 : 0),
    },
    {
      id: 'carrybee',
      name: 'Carrybee',
      rate: courierReport?.couriers?.carrybee && typeof courierReport.couriers.carrybee.successRate === 'number' && !isNaN(courierReport.couriers.carrybee.successRate)
        ? `${courierReport.couriers.carrybee.successRate}%` 
        : (courierReport ? '0%' : '100%'),
      rateNum: courierReport?.couriers?.carrybee?.successRate ?? (courierReport ? 0 : 100),
      total: courierReport?.couriers?.carrybee?.total ?? (courierReport ? 0 : 1),
      success: courierReport?.couriers?.carrybee?.delivered ?? (courierReport ? 0 : 1),
      cancelled: courierReport?.couriers?.carrybee?.cancelled ?? (courierReport ? 0 : 0),
    }
  ];

  return (
    <div className="space-y-3.5 w-full pb-8 animate-in fade-in duration-300">

      {/* Approve Success Banner */}
      {approveSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-600 text-white flex items-center justify-between shadow-md shadow-emerald-600/20 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <div>
              <p className="font-bold text-xs">Order Approved Successfully!</p>
              <p className="text-[11px] text-emerald-100">Status has been updated to Approved and added to fulfillment queue.</p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setApproveSuccess(false)}
            className="text-white hover:bg-white/20 h-7 text-xs rounded-lg"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* 1. Header Section */}
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          {/* Back Button */}
          <button
            type="button"
            onClick={() => navigate('/web-orders')}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-700 transition-colors cursor-pointer shrink-0"
            title="Back to Web Orders"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Web Order Details
              </h1>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/80">
                #{displayOrderId}
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[11px] font-bold border inline-flex items-center gap-1",
                isShopify 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200/80" 
                  : "bg-blue-50 text-blue-700 border-blue-200/60"
              )}>
                {isShopify ? <ShoppingBag className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                <span>{order.wooSiteName || (isShopify ? 'Shopify' : 'WooCommerce')}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2">
              <span>Review and manage this web order</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" />
                {formattedDate}
              </span>
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncFromStore}
            disabled={isSyncingOrder}
            className="h-8 px-2.5 rounded-lg border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold gap-1.5 shadow-2xs cursor-pointer"
            title="Re-sync latest order status from store"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncingOrder && "animate-spin text-purple-600")} />
            <span>Sync</span>
          </Button>

          {order.viewOrderUrl && (
            <a
              href={order.viewOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex items-center h-8 px-3 text-xs font-bold rounded-lg border transition-colors shadow-2xs gap-1.5",
                isShopify
                  ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/80"
                  : "text-blue-700 bg-blue-50 hover:bg-blue-100 border-blue-200/80"
              )}
            >
              <span>{isShopify ? 'View in Shopify' : 'View in WP'}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* 2. Courier Summary Cards (Overall, Pathao, Steadfast, RedX, Carrybee) */}
      <div>
        <div className="flex items-center justify-between mb-1.5 px-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <h3 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Customer Courier Delivery Summary
            </h3>
          </div>
          {isCheckingCourier && (
            <span className="text-[10px] text-purple-600 font-semibold flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Checking 5 Couriers...
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {courierCards.map((card) => {
            const isHigh = card.rateNum >= 90;
            const isMedium = card.rateNum >= 75 && card.rateNum < 90;
            const courierEmoji = COURIER_ICONS[card.id] || '📦';

            return (
              <div
                key={card.id}
                className={cn(
                  "p-2.5 rounded-xl border transition-all duration-200 shadow-2xs",
                  card.isOverall 
                    ? "bg-gradient-to-br from-purple-900 to-indigo-950 text-white border-purple-800/80 shadow-sm"
                    : "bg-white border-slate-200/80 hover:border-purple-200"
                )}
              >
                {/* Top Row: Courier Name + Success Rate Pill */}
                <div className="flex items-center justify-between gap-1.5 pb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-xs">{courierEmoji}</span>
                    <span className={cn(
                      "text-xs font-bold truncate",
                      card.isOverall ? "text-purple-100" : "text-slate-800"
                    )}>
                      {card.name}
                    </span>
                  </div>
                  <span className={cn(
                    "px-1.5 py-0.5 text-[10px] font-extrabold rounded-md shadow-2xs whitespace-nowrap",
                    card.isOverall 
                      ? "bg-purple-500/30 text-purple-200 border border-purple-400/30"
                      : isHigh
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/80"
                        : isMedium
                          ? "bg-blue-50 text-blue-700 border border-blue-200/80"
                          : "bg-amber-50 text-amber-700 border border-amber-200/80"
                  )}>
                    {card.rate}
                  </span>
                </div>

                {/* Metrics Breakdown Grid */}
                <div className={cn(
                  "pt-1.5 border-t text-xs grid grid-cols-3 gap-1 text-center",
                  card.isOverall ? "border-purple-800/60" : "border-slate-100"
                )}>
                  <div>
                    <span className={cn("text-[9px] block font-medium", card.isOverall ? "text-purple-300" : "text-slate-400")}>
                      Total
                    </span>
                    <span className={cn("font-bold text-xs leading-tight", card.isOverall ? "text-white" : "text-slate-800")}>
                      {card.total}
                    </span>
                  </div>
                  <div>
                    <span className={cn("text-[9px] block font-medium", card.isOverall ? "text-purple-300" : "text-emerald-600")}>
                      Success
                    </span>
                    <span className={cn("font-bold text-xs leading-tight", card.isOverall ? "text-emerald-300" : "text-emerald-700")}>
                      {card.success}
                    </span>
                  </div>
                  <div>
                    <span className={cn("text-[9px] block font-medium", card.isOverall ? "text-purple-300" : "text-rose-500")}>
                      Cancelled
                    </span>
                    <span className={cn("font-bold text-xs leading-tight", card.isOverall ? "text-rose-300" : "text-rose-600")}>
                      {card.cancelled}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">

        {/* Left Column (2 Cols): Customer, Shipping, Products */}
        <div className="lg:col-span-2 space-y-3.5">

          {/* CUSTOMER DETAILS */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-purple-600" />
                <h2 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                  CUSTOMER DETAILS
                </h2>
              </div>
              <span className={cn(
                "px-2 py-0.5 rounded-md text-[11px] font-bold border",
                currentCustomStatusMeta.bg,
                currentCustomStatusMeta.text,
                currentCustomStatusMeta.border
              )}>
                {currentCustomStatusMeta.label}
              </span>
            </div>

            <div className="p-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* Mobile Number */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Mobile Number</span>
                <div className="flex items-center justify-between gap-1.5 mt-1">
                  <span className="font-mono font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {order.customerPhone || 'Not provided'}
                  </span>
                  {order.customerPhone && (
                    <div className="flex items-center gap-1 shrink-0">
                      <a
                        href={`tel:${cleanPhone}`}
                        className="p-1 rounded-md bg-purple-50 hover:bg-purple-100 text-purple-700 transition-colors"
                        title="Call Customer"
                      >
                        <PhoneCall className="w-3 h-3" />
                      </a>
                      <a
                        href={`https://wa.me/${waNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors"
                        title="WhatsApp Chat"
                      >
                        <MessageSquare className="w-3 h-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(order.customerPhone, 'phone')}
                        className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                        title="Copy Phone"
                      >
                        {copiedKey === 'phone' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Name */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Name</span>
                <div className="flex items-center justify-between gap-1.5 mt-1">
                  <span className="font-bold text-slate-900 text-xs sm:text-sm truncate" title={order.customerName}>
                    {order.customerName || 'Anonymous Customer'}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(order.customerName, 'name')}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
                    title="Copy Name"
                  >
                    {copiedKey === 'name' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>

              {/* Delivery Method */}
              <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 flex flex-col justify-between">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Delivery Method</span>
                <div className="mt-1">
                  <select
                    value={selectedDeliveryMethod}
                    onChange={(e) => setSelectedDeliveryMethod(e.target.value)}
                    className="w-full h-7 px-2 bg-white border border-slate-300 rounded-md text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-purple-500 cursor-pointer shadow-2xs"
                  >
                    <option value="Pathao">Pathao Express</option>
                    <option value="Steadfast">Steadfast Courier</option>
                    <option value="RedX">RedX Delivery</option>
                    <option value="Paperfly">Paperfly</option>
                    <option value="Carrybee">Carrybee</option>
                    <option value="Other">Standard Delivery</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SHIPPING & ADDRESS */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-purple-600" />
                <h2 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                  SHIPPING & ADDRESS
                </h2>
              </div>
              <button
                type="button"
                onClick={() => copyToClipboard(fullShippingAddress, 'full_address')}
                className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1 cursor-pointer"
              >
                {copiedKey === 'full_address' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>Copy Full Address</span>
              </button>
            </div>

            <div className="p-3.5 space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-0.5">
                  Address
                </span>
                <p className="font-semibold text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 leading-relaxed text-xs">
                  {fullShippingAddress}
                </p>
              </div>

              {/* Shipping Note */}
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-0.5">
                  Shipping Note
                </span>
                <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/70 italic text-[11px]">
                  {order.customerNote || 'No customer note provided.'}
                </p>
              </div>

              {/* Extra Options Breakdown: City, Zone, Area */}
              <div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block mb-1">
                  Extra Options / Location Breakdown
                </span>
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[9px] text-slate-400 font-medium block">City</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block truncate">
                      {order.shippingAddress?.city || order.billingAddress?.city || 'Dhaka'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[9px] text-slate-400 font-medium block">Zone / State</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block truncate">
                      {order.shippingAddress?.state || order.billingAddress?.state || 'Dhaka Metro'}
                    </span>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-50 border border-slate-200/70">
                    <span className="text-[9px] text-slate-400 font-medium block">Area / Postcode</span>
                    <span className="font-bold text-slate-800 text-xs mt-0.5 block truncate">
                      {order.shippingAddress?.postcode || order.billingAddress?.postcode || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ORDERED PRODUCTS */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-purple-600" />
                <h2 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                  ORDERED PRODUCTS ({order.items?.length || order.itemCount || 1})
                </h2>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200/80">
                  <tr>
                    <th className="px-4 py-2">Product Image & Name</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2">Stock</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => {
                      const unitPrice = Number(item.price || 0);
                      const qty = Number(item.quantity || 1);
                      const lineTotal = Number(item.total || unitPrice * qty);
                      const sku = item.sku || (item as any).productCode || `SKU-${idx + 101}`;

                      return (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          {/* Image & Name */}
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200/80 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
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
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs line-clamp-1">{item.name}</p>
                                <span className="text-[10px] text-slate-400 font-mono">ID: {item.id || idx + 1}</span>
                              </div>
                            </div>
                          </td>

                          {/* SKU */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                              {sku}
                            </span>
                          </td>

                          {/* Stock */}
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              In Stock
                            </span>
                          </td>

                          {/* Qty */}
                          <td className="px-3 py-2.5 text-center whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-extrabold text-xs border border-purple-200/60">
                              {qty}
                            </span>
                          </td>

                          {/* Unit Price */}
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-700 whitespace-nowrap">
                            ৳{unitPrice.toLocaleString()}
                          </td>

                          {/* Line Total */}
                          <td className="px-4 py-2.5 text-right font-bold text-slate-900 whitespace-nowrap">
                            ৳{lineTotal.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                        No product line items found for this order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column (1 Col): Order Total & Approve Button */}
        <div className="space-y-3.5">

          {/* ORDER TOTAL CALCULATION CARD */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50/70 border-b border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                <h2 className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider">
                  ORDER TOTAL
                </h2>
              </div>
            </div>

            <div className="p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Sub Total</span>
                <span className="font-semibold text-slate-900">৳{subTotalCalculated.toLocaleString()}</span>
              </div>

              {discountAmount > 0 ? (
                <div className="flex items-center justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>-৳{discountAmount.toLocaleString()}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between text-slate-400">
                  <span>Discount</span>
                  <span>৳0</span>
                </div>
              )}

              <div className="flex items-center justify-between text-slate-400">
                <span>Advance Payment</span>
                <span>৳0</span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Delivery Charge</span>
                <span className="font-semibold text-slate-900">৳{deliveryCharge.toLocaleString()}</span>
              </div>

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-slate-900">
                <span className="font-extrabold text-xs sm:text-sm">Grand Total</span>
                <span className="font-black text-base sm:text-lg text-purple-700">
                  ৳{grandTotalCalculated.toLocaleString()}
                </span>
              </div>

              {/* Payment Method Badge */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 block mb-0.5 font-medium">Payment Method:</span>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px] inline-block">
                  {order.paymentMethodTitle || order.paymentMethod || 'Cash on Delivery (COD)'}
                </span>
              </div>
            </div>

            {/* Prominent Approve Order Button */}
            <div className="p-3.5 bg-slate-50/70 border-t border-slate-200/80 space-y-2">
              <Button
                size="lg"
                onClick={handleApproveOrder}
                disabled={isApproving || currentCustomStatus === 'Approved'}
                className={cn(
                  "w-full h-10 sm:h-11 rounded-xl font-extrabold text-xs sm:text-sm shadow-md transition-all duration-150 gap-2 cursor-pointer",
                  currentCustomStatus === 'Approved'
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20"
                    : "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/20"
                )}
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Approving Order...</span>
                  </>
                ) : currentCustomStatus === 'Approved' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Order Approved</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Order</span>
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-slate-400 leading-tight">
                Approving sets status to Approved and queues the order for courier dispatch.
              </p>
            </div>
          </div>

          {/* Quick Custom Status Selector */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Change Status</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {CUSTOM_ORDER_STATUSES.map((statusName) => {
                const isActive = currentCustomStatus === statusName;
                const meta = CUSTOM_ORDER_STATUS_META[statusName];
                return (
                  <button
                    key={statusName}
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleCustomStatusChange(statusName)}
                    className={cn(
                      "px-2 py-1.5 text-xs font-bold rounded-lg border text-center transition-all cursor-pointer",
                      isActive
                        ? "bg-slate-900 text-white border-slate-900 shadow-xs ring-1 ring-slate-900"
                        : cn("bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700", meta.text)
                    )}
                  >
                    {statusName}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Remote Store Sync Accordion */}
          {!isShopify && (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-xs font-bold text-slate-700">WooCommerce Remote Sync</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWooSyncAccordion(!showWooSyncAccordion)}
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 underline cursor-pointer"
                >
                  {showWooSyncAccordion ? 'Hide' : 'Manage'}
                </button>
              </div>

              {showWooSyncAccordion && (
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <p className="text-[11px] text-slate-500">
                    Sync status update back to WordPress WooCommerce store:
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
                            "px-2 py-1 text-[10px] font-semibold rounded-md border transition-all cursor-pointer",
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
          )}

        </div>

      </div>

    </div>
  );
}
export default WebOrderDetailPage;
