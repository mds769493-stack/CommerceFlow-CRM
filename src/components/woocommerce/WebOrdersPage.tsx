import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Globe, 
  Store, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  X,
  Clock,
  UserCheck,
  PhoneMissed,
  CreditCard,
  PauseCircle,
  XCircle,
  Layers,
  Zap,
  Radio,
  Sliders,
  Volume2,
  Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WebOrder, WooSite, ShopifySite } from '../../types';
import { fetchWooSites, syncWooOrders, syncSingleWooOrder, bulkApproveWebOrders } from '../../lib/woocommerceApi';
import { fetchShopifySites, syncShopifyOrders, syncSingleShopifyOrder } from '../../lib/shopifyApi';
import { fetchFromApi, batchDeleteFromApi, deleteFromApi } from '../../lib/api';
import { useAppContext } from '../../context/AppContext';
import { onNewOrderReceived, onOrderUpdatedReceived, onWebhookTestReceived, playNewOrderChime } from '../../lib/socket';
import { WebOrdersTable } from './WebOrdersTable';
import { WebOrderDetailDrawer } from './WebOrderDetailDrawer';
import { WooSettingsModal } from './WooSettingsModal';
import { ShopifySettingsModal } from '../shopify/ShopifySettingsModal';
import { OrderTableToolbar } from './OrderTableToolbar';
import { ManualSyncModal } from './ManualSyncModal';
import { cn } from '@/lib/utils';
import { ShoppingBag as ShopifyIcon } from 'lucide-react';

// Status Tab Configuration with Lucide Icons in requested order
const TABS_CONFIG = [
  { id: 'Processing', label: 'Processing', icon: Clock },
  { id: 'Incomplete', label: 'Incomplete', icon: AlertCircle },
  { id: 'Good But No Response', label: 'Good But No Response', icon: UserCheck },
  { id: 'No Response', label: 'No Response', icon: PhoneMissed },
  { id: 'Advance Payment', label: 'Advance Payment', icon: CreditCard },
  { id: 'On Hold', label: 'On Hold', icon: PauseCircle },
  { id: 'Approved', label: 'Approved', icon: CheckCircle2 },
  { id: 'Cancel', label: 'Cancel', icon: XCircle },
  { id: 'All', label: 'All', icon: Layers },
];

interface WebOrdersPageProps {
  initialStatus?: string;
  autoOpenManualSync?: boolean;
}

export function WebOrdersPage({ initialStatus, autoOpenManualSync }: WebOrdersPageProps = {}) {
  const navigate = useNavigate();
  const { refreshAllData } = useAppContext();
  // Data states
  const [sites, setSites] = useState<WooSite[]>([]);
  const [shopifySites, setShopifySites] = useState<ShopifySite[]>([]);
  const [orders, setOrders] = useState<WebOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<{ message: string; type: 'success' | 'error' | 'realtime'; subtitle?: string } | null>(null);

  // Real-time highlight state
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Modal / Drawer states
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShopifySettingsOpen, setIsShopifySettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<'rest' | 'webhook' | 'logs'>('rest');
  const [shopifyDefaultTab, setShopifyDefaultTab] = useState<'api' | 'webhook' | 'logs'>('api');
  const [isManualSyncOpen, setIsManualSyncOpen] = useState(!!autoOpenManualSync);
  const [selectedOrder, setSelectedOrder] = useState<WebOrder | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Active Tab state for filtering, Search query & Pagination states
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initialStatus) {
      const match = TABS_CONFIG.find(t => t.id.toLowerCase() === initialStatus.toLowerCase());
      if (match) return match.id;
    }
    return 'All';
  });

  useEffect(() => {
    if (initialStatus) {
      const match = TABS_CONFIG.find(t => t.id.toLowerCase() === initialStatus.toLowerCase());
      if (match) {
        setActiveTab(match.id);
        setCurrentPage(1);
      }
    }
  }, [initialStatus]);

  useEffect(() => {
    if (autoOpenManualSync) {
      setIsManualSyncOpen(true);
    }
  }, [autoOpenManualSync]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);

  // Load sites and orders
  const loadData = async () => {
    try {
      setIsLoading(true);
      const [sitesData, shopifySitesData, ordersData] = await Promise.all([
        fetchWooSites().catch(() => []),
        fetchShopifySites().catch(() => []),
        fetchFromApi('woocommerce_orders').catch(() => [])
      ]);
      setSites(Array.isArray(sitesData) ? sitesData : []);
      setShopifySites(Array.isArray(shopifySitesData) ? shopifySitesData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err: any) {
      console.error("Error loading web orders data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Real-time Socket.IO Webhook event listeners
  useEffect(() => {
    // 1. Listen for new orders pushed instantly via Webhook
    const cleanupNewOrder = onNewOrderReceived((payload) => {
      console.log('[REAL-TIME HOOK] New order received in UI:', payload);
      const incomingOrder = payload.order;
      if (!incomingOrder || !incomingOrder.id) return;

      // Update or prepend to orders state
      setOrders((prev) => {
        const existingIndex = prev.findIndex((o) => o.id === incomingOrder.id || (o.wooOrderId && o.wooOrderId === incomingOrder.wooOrderId && o.wooSiteId === incomingOrder.wooSiteId));
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = incomingOrder;
          return updated;
        }
        // Prepend to top of orders list
        return [incomingOrder, ...prev];
      });

      // Highlight new order row
      setHighlightedOrderId(incomingOrder.id);
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedOrderId(null);
      }, 9000);

      // Show real-time flash toast notification
      const customerName = incomingOrder.customerName || 'Customer';
      const orderNum = incomingOrder.orderNumber || incomingOrder.wooOrderId || incomingOrder.id;
      const totalAmount = incomingOrder.total ? `৳${incomingOrder.total}` : '';
      const storeName = payload.siteName || incomingOrder.wooSiteName || 'WooCommerce';

      setSyncToast({
        type: 'realtime',
        message: `⚡ Real-Time Webhook: New Order #${orderNum} Received!`,
        subtitle: `${customerName} • ${totalAmount} • Store: ${storeName}`
      });
    });

    // 2. Listen for order updates
    const cleanupOrderUpdated = onOrderUpdatedReceived((payload) => {
      const incomingOrder = payload.order;
      if (!incomingOrder || !incomingOrder.id) return;

      setOrders((prev) =>
        prev.map((o) => (o.id === incomingOrder.id ? incomingOrder : o))
      );

      if (selectedOrder && selectedOrder.id === incomingOrder.id) {
        setSelectedOrder(incomingOrder);
      }
    });

    // 3. Listen for diagnostic test events
    const cleanupTestEvent = onWebhookTestReceived((data) => {
      setSyncToast({
        type: 'realtime',
        message: '⚡ Webhook Diagnostic Test Event Received!',
        subtitle: `Real-time channel is active and audio alerts are working.`
      });
    });

    return () => {
      cleanupNewOrder();
      cleanupOrderUpdated();
      cleanupTestEvent();
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, [selectedOrder]);

  // Handle Sync Orders
  const handleSyncOrders = async (targetSiteId?: string) => {
    if (sites.length === 0) {
      setSettingsDefaultTab('rest');
      setIsSettingsOpen(true);
      return;
    }

    setIsSyncing(true);
    setSyncToast(null);

    try {
      const result = await syncWooOrders(targetSiteId);
      
      setSyncToast({
        type: 'success',
        message: `Sync completed! ${result.newCount} new orders, ${result.updatedCount} updated (${result.totalSynced} total).`
      });

      // Reload fresh orders & sites
      await loadData();
    } catch (err: any) {
      setSyncToast({
        type: 'error',
        message: err.message || 'Failed to sync orders from WooCommerce.'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle single order sync from table row action
  const handleSyncSingleOrder = async (order: WebOrder) => {
    try {
      if (order.source === 'shopify') {
        const storeId = order.store_id || order.storeId || order.wooSiteId || '';
        const res = await syncSingleShopifyOrder(storeId, String(order.shopifyOrderId || order.wooOrderId || order.id));
        if (res.order) {
          setOrders(prev => prev.map(o => o.id === res.order.id ? res.order : o));
          if (selectedOrder && selectedOrder.id === res.order.id) {
            setSelectedOrder(res.order);
          }
          setSyncToast({
            type: 'success',
            message: `✓ Shopify Order #${order.wooOrderId || order.orderNumber} synced successfully.`
          });
        }
      } else {
        const res = await syncSingleWooOrder(order.wooSiteId, order.wooOrderId);
        if (res.order) {
          setOrders(prev => prev.map(o => o.id === res.order.id ? res.order : o));
          if (selectedOrder && selectedOrder.id === res.order.id) {
            setSelectedOrder(res.order);
          }
          setSyncToast({
            type: 'success',
            message: `✓ WooCommerce Order #${order.wooOrderId} synced successfully.`
          });
        }
      }
    } catch (err: any) {
      setSyncToast({
        type: 'error',
        message: `✕ Unable to sync Order #${order.wooOrderId || order.orderNumber}.`,
        subtitle: err.message || 'Please check store connection.'
      });
    }
  };

  // Handle order synced via Manual Sync Modal
  const handleManualOrderSynced = (syncedOrder: WebOrder, isNew: boolean) => {
    setOrders((prev) => {
      const exists = prev.some((o) => o.id === syncedOrder.id);
      if (exists) {
        return prev.map((o) => (o.id === syncedOrder.id ? syncedOrder : o));
      } else {
        return [syncedOrder, ...prev];
      }
    });

    // Highlight row
    setHighlightedOrderId(syncedOrder.id);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedOrderId(null);
    }, 6000);

    setSyncToast({
      type: 'success',
      message: isNew 
        ? `✓ Order #${syncedOrder.wooOrderId || syncedOrder.orderNumber} synced successfully.` 
        : `✓ Order #${syncedOrder.wooOrderId || syncedOrder.orderNumber} updated successfully.`,
      subtitle: `${syncedOrder.customerName || 'Customer'} • ৳${(syncedOrder.total || 0).toLocaleString()} • ${syncedOrder.wooSiteName || 'WooCommerce'}`
    });
  };

  // 1. Fix Handler Function (handleRemoveSelected)
  const handleRemoveSelected = async (targetIds?: string[]) => {
    const idsToRemove = targetIds && targetIds.length > 0 ? targetIds : selectedOrderIds;
    if (!idsToRemove || idsToRemove.length === 0) return;

    // Filter out selected items from the main orders state:
    setOrders((prevOrders) => prevOrders.filter((order) => !idsToRemove.includes(order.id)));

    // 2. Reset Selection State:
    setSelectedOrderIds([]);

    // Optional background persistence
    try {
      if (idsToRemove.length === 1) {
        await deleteFromApi('woocommerce_orders', idsToRemove[0]);
      } else {
        await batchDeleteFromApi('woocommerce_orders', idsToRemove);
      }
    } catch (err: any) {
      console.warn("Backend deletion warning (local state updated):", err);
    }
  };

  // Handle delete orders from local cache
  const handleDeleteOrders = async (orderIds: string[]) => {
    await handleRemoveSelected(orderIds);
  };

  // Handle Bulk Approve Orders -> Creates orders in Order List (Pending)
  const handleBulkApprove = async () => {
    if (selectedOrderIds.length === 0) return;
    try {
      const res = await bulkApproveWebOrders(selectedOrderIds);
      setOrders(prev => prev.map(o => selectedOrderIds.includes(o.id) ? { ...o, custom_status: 'Approved', customStatus: 'Approved' } : o));
      const count = res.count || selectedOrderIds.length;
      setSelectedOrderIds([]);
      refreshAllData();
      setSyncToast({
        type: 'success',
        message: `✓ ${count} Web Order(s) Approved & Added to Order List (Pending)`,
        subtitle: 'The approved orders have been converted to Pending orders in your Order List.'
      });
    } catch (err: any) {
      setSyncToast({
        type: 'error',
        message: 'Failed to bulk approve orders',
        subtitle: err.message || 'Please try again.'
      });
    }
  };

  // Handle order update in drawer
  const handleOrderUpdated = (updatedOrder: WebOrder) => {
    setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    setSelectedOrder(updatedOrder);
    if ((updatedOrder.custom_status || updatedOrder.customStatus)?.toLowerCase() === 'approved') {
      refreshAllData();
    }
  };

  // Dynamic counts for each status tab
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      'All': orders.length,
      'Processing': 0,
      'Incomplete': 0,
      'Good But No Response': 0,
      'No Response': 0,
      'Advance Payment': 0,
      'On Hold': 0,
      'Approved': 0,
      'Cancel': 0,
    };

    orders.forEach(order => {
      const status = order.custom_status || order.customStatus || 'Processing';
      const matchKey = Object.keys(counts).find(k => k.toLowerCase() === status.toLowerCase());
      if (matchKey && matchKey !== 'All') {
        counts[matchKey] = (counts[matchKey] || 0) + 1;
      } else {
        counts['Processing'] = (counts['Processing'] || 0) + 1;
      }
    });

    return counts;
  }, [orders]);

  // Filtered orders by active tab and search query
  const filteredOrders = useMemo(() => {
    let result = orders;

    // Filter by tab
    if (activeTab && activeTab !== 'All') {
      result = result.filter(order => {
        const currentStatus = order.custom_status || order.customStatus || 'Processing';
        return currentStatus.toLowerCase() === activeTab.toLowerCase();
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(order => {
        const orderNumber = String(order.number || order.id || '').toLowerCase();
        const name = (order.customerName || '').toLowerCase();
        const phone = (order.customerPhone || '').toLowerCase();
        const email = (order.customerEmail || '').toLowerCase();
        const city = (order.shipping?.city || order.billing?.city || '').toLowerCase();
        const address = (order.shipping?.address_1 || order.billing?.address_1 || '').toLowerCase();
        const items = order.items?.map(i => i.name.toLowerCase()).join(' ') || '';
        const payment = (order.paymentMethodTitle || '').toLowerCase();

        return (
          orderNumber.includes(q) ||
          name.includes(q) ||
          phone.includes(q) ||
          email.includes(q) ||
          city.includes(q) ||
          address.includes(q) ||
          items.includes(q) ||
          payment.includes(q)
        );
      });
    }

    return result;
  }, [orders, activeTab, searchQuery]);

  // Paginated records
  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      
      {/* Real-time Order Alert Toast / Notification Banner */}
      {syncToast && (
        <div className={cn(
          "p-4 rounded-2xl border text-xs flex items-center justify-between shadow-xl transition-all duration-300 animate-in slide-in-from-top-3",
          syncToast.type === 'realtime'
            ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white border-emerald-500 shadow-emerald-500/20"
            : syncToast.type === 'success' 
              ? "bg-emerald-50 text-emerald-900 border-emerald-200" 
              : "bg-rose-50 text-rose-900 border-rose-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
              syncToast.type === 'realtime' 
                ? "bg-white/20 text-white animate-bounce" 
                : syncToast.type === 'success'
                  ? "bg-emerald-100 text-emerald-600"
                  : "bg-rose-100 text-rose-600"
            )}>
              {syncToast.type === 'realtime' ? (
                <Zap className="w-5 h-5" />
              ) : syncToast.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{syncToast.message}</p>
              {syncToast.subtitle && (
                <p className={cn("text-xs mt-0.5 opacity-90", syncToast.type === 'realtime' ? "text-emerald-100" : "text-slate-600")}>
                  {syncToast.subtitle}
                </p>
              )}
            </div>
          </div>
          <button 
            onClick={() => setSyncToast(null)}
            className={cn(
              "p-1.5 rounded-lg transition-colors cursor-pointer ml-4",
              syncToast.type === 'realtime' ? "text-white/80 hover:text-white hover:bg-white/10" : "text-slate-400 hover:text-slate-700"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}



      {/* Horizontal Scrolling Status Tabs with border-b-2 border-purple-600 highlight */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs px-3 pt-1 pb-0 overflow-hidden">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-none py-1">
          {TABS_CONFIG.map((tab) => {
            const isActive = activeTab === tab.id;
            const count = statusCounts[tab.id] ?? 0;
            const IconComponent = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setCurrentPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2.5 text-xs transition-all cursor-pointer select-none border-b-2 -mb-[1px] rounded-t-lg",
                  isActive
                    ? "border-purple-600 text-purple-600 font-bold bg-purple-50/40"
                    : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300 font-medium hover:bg-slate-50/50"
                )}
              >
                <IconComponent className={cn("w-3.5 h-3.5 shrink-0", isActive ? "text-purple-600" : "text-slate-400")} />
                <span>{tab.label}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[11px] font-semibold transition-colors",
                  isActive
                    ? "bg-purple-100 text-purple-700"
                    : "bg-slate-100 text-slate-600"
                )}>
                  ({count.toLocaleString()})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Empty State when no stores are connected */}
      {sites.length === 0 && shopifySites.length === 0 && !isLoading && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center flex flex-col items-center justify-center max-w-lg mx-auto shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
            <Store className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Connect Your Online Store</h3>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed max-w-sm">
            Import and manage your online orders from Shopify and WooCommerce with automated synchronization and real-time instant webhooks.
          </p>
          <div className="flex items-center gap-3 mt-5">
            <Button
              onClick={() => {
                setShopifyDefaultTab('api');
                setIsShopifySettingsOpen(true);
              }}
              className="h-10 px-5 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <ShopifyIcon className="w-4 h-4 mr-1.5" />
              Connect Shopify Store
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSettingsDefaultTab('rest');
                setIsSettingsOpen(true);
              }}
              className="h-10 px-5 text-xs font-semibold rounded-xl border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer"
            >
              <Globe className="w-4 h-4 mr-1.5" />
              Connect WooCommerce
            </Button>
          </div>
        </div>
      )}

      {/* Orders Table & Toolbar */}
      {(sites.length > 0 || shopifySites.length > 0 || orders.length > 0) && (
        <div className="flex flex-col gap-3">
          {/* Order Management Table Toolbar / Action Bar */}
          <OrderTableToolbar
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            onNewClick={() => {
              setIsManualSyncOpen(true);
            }}
            onManualSyncClick={() => {
              setIsManualSyncOpen(true);
            }}
            onSyncOrders={() => setIsManualSyncOpen(true)}
            isSyncing={isSyncing}
            selectedCount={selectedOrderIds.length}
            onSettingsClick={() => {
              setSettingsDefaultTab('rest');
              setIsSettingsOpen(true);
            }}
            onBulkActionSelect={async (action) => {
              if (action === 'sync') {
                setIsManualSyncOpen(true);
              } else if (action === 'delete') {
                handleRemoveSelected();
              } else if (action === 'mark_approved') {
                await handleBulkApprove();
              } else if (action === 'mark_processing') {
                setOrders(prev => prev.map(o => selectedOrderIds.includes(o.id) ? { ...o, custom_status: 'Processing', customStatus: 'Processing' } : o));
                setSelectedOrderIds([]);
              }
            }}
          />

          <WebOrdersTable
            orders={paginatedOrders}
            selectedOrderIds={selectedOrderIds}
            onSelectedOrderIdsChange={setSelectedOrderIds}
            onRemoveSelected={handleRemoveSelected}
            highlightedOrderId={highlightedOrderId}
            onViewOrder={(order) => {
              const targetId = String(order.wooOrderId || order.orderNumber || order.shopifyOrderId || order.id).replace(/^#/, '');
              navigate(`/web-order/${encodeURIComponent(targetId)}`);
            }}
            onSyncOrder={handleSyncSingleOrder}
            onDeleteOrders={handleRemoveSelected}
            currentPage={currentPage}
            pageSize={pageSize}
            totalRecords={filteredOrders.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Order Detail Drawer */}
      <WebOrderDetailDrawer
        order={selectedOrder}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onOrderUpdated={handleOrderUpdated}
      />

      {/* Manual Order Sync Fallback Modal */}
      <ManualSyncModal
        isOpen={isManualSyncOpen}
        onClose={() => setIsManualSyncOpen(false)}
        sites={sites}
        onOrderSynced={handleManualOrderSynced}
        onOpenSettings={() => {
          setSettingsDefaultTab('rest');
          setIsSettingsOpen(true);
        }}
      />

      {/* WooCommerce Settings Modal */}
      <WooSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        sites={sites}
        onSitesUpdated={loadData}
        defaultTab={settingsDefaultTab}
      />

      {/* Shopify Settings Modal */}
      <ShopifySettingsModal
        isOpen={isShopifySettingsOpen}
        onClose={() => setIsShopifySettingsOpen(false)}
        sites={shopifySites}
        onSitesUpdated={loadData}
        defaultTab={shopifyDefaultTab}
      />
    </div>
  );
}
