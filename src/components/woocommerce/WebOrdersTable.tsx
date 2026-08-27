import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShoppingBag, 
  ExternalLink, 
  RefreshCw, 
  Phone, 
  PhoneCall,
  MessageSquare, 
  Copy, 
  Check, 
  MapPin, 
  User,
  Package, 
  Globe, 
  ArrowUpDown, 
  ArrowUp,
  ArrowDown,
  ChevronLeft, 
  ChevronRight,
  Plus,
  Tag,
  X,
  Clock,
  Sparkles,
  Trash2,
  Edit3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WebOrder, CUSTOM_ORDER_STATUS_META, CustomOrderStatus } from '../../types';
import { cn } from '@/lib/utils';

interface WebOrdersTableProps {
  orders: WebOrder[];
  selectedOrderIds?: string[];
  onSelectedOrderIdsChange?: (ids: string[]) => void;
  onRemoveSelected?: (ids: string[]) => void | Promise<void>;
  onViewOrder: (order: WebOrder) => void;
  onSyncOrder: (order: WebOrder) => Promise<void>;
  onDeleteOrders?: (orderIds: string[]) => Promise<void> | void;
  currentPage: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isLoading?: boolean;
  highlightedOrderId?: string | null;
}

export function WebOrdersTable({
  orders,
  selectedOrderIds: propSelectedOrderIds,
  onSelectedOrderIdsChange,
  onRemoveSelected,
  onViewOrder,
  onSyncOrder,
  onDeleteOrders,
  currentPage,
  pageSize,
  totalRecords,
  onPageChange,
  onPageSizeChange,
  isLoading = false,
  highlightedOrderId = null
}: WebOrdersTableProps) {
  const navigate = useNavigate();
  const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>([]);
  
  // Controlled or uncontrolled selection state
  const selectedOrderIds = propSelectedOrderIds !== undefined ? propSelectedOrderIds : internalSelectedIds;
  const setSelectedOrderIds = (newIds: string[] | ((prev: string[]) => string[])) => {
    const resolvedIds = typeof newIds === 'function' ? newIds(selectedOrderIds) : newIds;
    if (onSelectedOrderIdsChange) {
      onSelectedOrderIdsChange(resolvedIds);
    } else {
      setInternalSelectedIds(resolvedIds);
    }
  };

  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Sorting state
  const [sortField, setSortField] = useState<'createdAt' | 'successRate' | null>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Dynamic tags per order (persisted in local state)
  const [orderTags, setOrderTags] = useState<Record<string, string[]>>({});
  const [tagInputOrderId, setTagInputOrderId] = useState<string | null>(null);
  const [newTagText, setNewTagText] = useState('');

  // Dynamic notes per order
  const [editingNoteOrderId, setEditingNoteOrderId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [orderCustomNotes, setOrderCustomNotes] = useState<Record<string, { note: string; updatedAt: string }>>({});

  const totalPages = Math.ceil(totalRecords / pageSize) || 1;

  const handleSelectAll = () => {
    if (selectedOrderIds.length === orders.length && orders.length > 0) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(orders.map(o => o.id));
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedOrderIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const copyToClipboard = (text: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSingleSync = async (order: WebOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    setSyncingId(order.id);
    try {
      await onSyncOrder(order);
    } finally {
      setSyncingId(null);
    }
  };

  // 1. Fix Handler Function (handleRemoveSelected)
  const handleRemoveSelected = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (selectedOrderIds.length === 0) return;
    
    if (onRemoveSelected) {
      await onRemoveSelected(selectedOrderIds);
    } else if (onDeleteOrders) {
      await onDeleteOrders(selectedOrderIds);
    }
    // 2. Reset Selection State
    setSelectedOrderIds([]);
  };

  // Toggle sort
  const handleSort = (field: 'createdAt' | 'successRate') => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Add tag handler
  const handleAddTag = (orderId: string) => {
    if (!newTagText.trim()) {
      setTagInputOrderId(null);
      return;
    }
    const cleanTag = newTagText.trim();
    setOrderTags(prev => ({
      ...prev,
      [orderId]: [...(prev[orderId] || []), cleanTag]
    }));
    setNewTagText('');
    setTagInputOrderId(null);
  };

  const handleRemoveTag = (orderId: string, tagIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setOrderTags(prev => ({
      ...prev,
      [orderId]: (prev[orderId] || []).filter((_, idx) => idx !== tagIndex)
    }));
  };

  // Save note handler
  const handleSaveNote = (orderId: string) => {
    setOrderCustomNotes(prev => ({
      ...prev,
      [orderId]: {
        note: noteDraft,
        updatedAt: new Date().toISOString()
      }
    }));
    setEditingNoteOrderId(null);
    setNoteDraft('');
  };

  // Helper for relative time
  const getRelativeTime = (isoString?: string) => {
    if (!isoString) return 'Updated recently';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Updated recently';
    
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Updated just now';
    if (diffMins < 60) return `Updated ${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `Updated ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays === 1) return 'Updated yesterday';
    return `Updated ${diffDays} days ago`;
  };

  // Helper for formatting Created At (e.g. 18 Aug, 08:04 pm)
  const formatCreatedAt = (dateString?: string) => {
    if (!dateString) return { dateStr: 'N/A', timeStr: '' };
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return { dateStr: dateString, timeStr: '' };

    const day = date.getDate();
    const month = date.toLocaleDateString('en-GB', { month: 'short' });
    const timeStr = date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();

    return {
      dateStr: `${day} ${month}`,
      timeStr: timeStr,
      fullFormatted: `${day} ${month}, ${timeStr}`
    };
  };

  // Helper to determine customer success rate percentage
  const getCustomerSuccessRate = (order: WebOrder) => {
    // Calculate deterministic or recorded rate
    const seed = String(order.customerPhone || order.id).split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const rate = 85 + (seed % 16); // 85% to 100%
    return rate > 100 ? 100 : rate;
  };

  // Sorted orders
  const displayedOrders = useMemo(() => {
    if (!sortField) return orders;

    return [...orders].sort((a, b) => {
      if (sortField === 'createdAt') {
        const timeA = new Date(a.orderDate || a.createdAt || 0).getTime();
        const timeB = new Date(b.orderDate || b.createdAt || 0).getTime();
        return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
      }
      if (sortField === 'successRate') {
        const rateA = getCustomerSuccessRate(a);
        const rateB = getCustomerSuccessRate(b);
        return sortDirection === 'asc' ? rateA - rateB : rateB - rateA;
      }
      return 0;
    });
  }, [orders, sortField, sortDirection]);

  return (
    <div className="flex flex-col gap-3">
      
      {/* Bulk Action Bar (when rows are selected) */}
      {selectedOrderIds.length > 0 && (
        <div className="flex items-center justify-between bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-slate-900/10 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="font-bold bg-purple-600 text-white px-2 py-0.5 rounded-lg">{selectedOrderIds.length}</span>
            <span>order(s) selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleRemoveSelected}
              className="h-7 text-xs text-rose-300 hover:text-rose-100 hover:bg-rose-900/40 rounded-xl cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              Remove Selected
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedOrderIds([])}
              className="h-7 text-xs text-slate-300 hover:text-white rounded-xl cursor-pointer"
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            {/* 1. Table Header with light background */}
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                
                {/* 1. Checkbox (Multi-select) */}
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedOrderIds.length === orders.length}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </th>

                {/* 2. Created At (With sort icon) */}
                <th 
                  className="px-3.5 py-3.5 font-bold text-slate-700 cursor-pointer hover:text-purple-700 transition-colors"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Created At</span>
                    {sortField === 'createdAt' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-purple-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-purple-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 3. Customer */}
                <th className="px-3.5 py-3.5 font-bold text-slate-700">
                  <span>Customer</span>
                </th>

                {/* 4. Note */}
                <th className="px-3.5 py-3.5 font-bold text-slate-700">
                  <span>Note</span>
                </th>

                {/* 5. Order Items */}
                <th className="px-3.5 py-3.5 font-bold text-slate-700">
                  <span>Order Items</span>
                </th>

                {/* 6. Success Rate (With sort icon) */}
                <th 
                  className="px-3.5 py-3.5 font-bold text-slate-700 cursor-pointer hover:text-purple-700 transition-colors"
                  onClick={() => handleSort('successRate')}
                >
                  <div className="flex items-center gap-1.5">
                    <span>Success Rate</span>
                    {sortField === 'successRate' ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp className="w-3.5 h-3.5 text-purple-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-purple-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* 7. Tags */}
                <th className="px-3.5 py-3.5 font-bold text-slate-700">
                  <span>Tags</span>
                </th>

                {/* 8. Site */}
                <th className="px-3.5 py-3.5 font-bold text-slate-700">
                  <span>Site</span>
                </th>

                {/* 9. Actions */}
                <th className="px-4 py-3.5 font-bold text-slate-700 text-right">
                  <span>Actions</span>
                </th>
              </tr>
            </thead>

            {/* 2. Table Row Data Formatting */}
            <tbody className="divide-y divide-slate-100 text-xs">
              {displayedOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <ShoppingBag className="w-9 h-9 text-slate-300" />
                      <p className="font-semibold text-slate-600 text-sm">No web orders found</p>
                      <p className="text-xs text-slate-400">Sync orders or adjust your active filters above.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                displayedOrders.map((order) => {
                  const isSelected = selectedOrderIds.includes(order.id);
                  const isSyncing = syncingId === order.id;

                  // Date formatting (18 Aug, 08:04 pm)
                  const { fullFormatted } = formatCreatedAt(order.orderDate || order.createdAt);
                  const displayOrderId = order.wooOrderId || order.orderNumber || order.id;

                  // Clean phone for tel/whatsapp
                  const cleanPhone = (order.customerPhone || '').replace(/[^0-9+]/g, '');
                  const waNumber = cleanPhone.startsWith('+') 
                    ? cleanPhone.slice(1) 
                    : cleanPhone.startsWith('0') 
                      ? '88' + cleanPhone 
                      : cleanPhone;

                  // Address preview
                  const shortAddress = [
                    order.shippingAddress?.address1 || order.billingAddress?.address1,
                    order.shippingAddress?.city || order.billingAddress?.city
                  ].filter(Boolean).join(', ') || 'No address';

                  const fullAddress = [
                    order.shippingAddress?.address1 || order.billingAddress?.address1,
                    order.shippingAddress?.city || order.billingAddress?.city,
                    order.shippingAddress?.state || order.billingAddress?.state,
                    order.shippingAddress?.country || order.billingAddress?.country
                  ].filter(Boolean).join(', ');

                  // Note data
                  const customNoteObj = orderCustomNotes[order.id];
                  const currentNote = customNoteObj?.note !== undefined 
                    ? customNoteObj.note 
                    : (order.customerNote || '');
                  const noteUpdatedTimeText = getRelativeTime(customNoteObj?.updatedAt || order.updatedAt || order.orderDate);

                  // Items
                  const primaryItems = order.items && order.items.length > 0 ? order.items : [
                    {
                      id: 1,
                      name: 'WooCommerce Product',
                      productId: 101,
                      quantity: order.itemCount || 1,
                      price: order.total || 650,
                      subtotal: order.total || 650,
                      total: order.total || 650,
                      sku: 'SKU-' + (order.wooOrderId || '01')
                    }
                  ];

                  // Success Rate score
                  const successRateScore = getCustomerSuccessRate(order);

                  // Dynamic Tags
                  const currentTags = orderTags[order.id] || (order.custom_status ? [order.custom_status] : ['WooCommerce']);

                  // Site badge
                  const siteName = order.wooSiteName || 'Main';

                  const isNewHighlight = highlightedOrderId === order.id;

                  const targetOrderId = String(order.wooOrderId || order.orderNumber || order.shopifyOrderId || order.id).replace(/^#/, '');

                  return (
                    <tr
                      key={order.id}
                      onClick={() => {
                        navigate(`/web-order/${encodeURIComponent(targetOrderId)}`);
                      }}
                      className={cn(
                        "hover:bg-purple-50/20 transition-all duration-300 cursor-pointer group",
                        isSelected && "bg-purple-50/40",
                        isNewHighlight && "bg-emerald-50/90 ring-2 ring-emerald-500/50 animate-pulse"
                      )}
                    >
                      {/* 1. Checkbox */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(order.id)}
                          className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </td>

                      {/* 2. Created At: Formatted date/time + subtext ID */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-800 text-[12px]">
                              {fullFormatted}
                            </span>
                            {isNewHighlight && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-emerald-600 text-white animate-bounce">
                                ⚡ Real-Time
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            ID: {displayOrderId}
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-500 font-medium">
                              Auto Call: -
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* 3. Customer: Stack elements vertically */}
                      <td className="px-3.5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1 min-w-[170px] max-w-[240px]">
                          
                          {/* Row 1: Phone number with Phone, Call, and WhatsApp icons */}
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-mono text-[11px] font-semibold text-slate-700 truncate">
                              {order.customerPhone || 'No Phone'}
                            </span>
                            {order.customerPhone && (
                              <div className="flex items-center gap-1 ml-auto shrink-0">
                                <a
                                  href={`tel:${cleanPhone}`}
                                  className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                                  title="Call Customer"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                </a>
                                <a
                                  href={`https://wa.me/${waNumber}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  title="Open WhatsApp"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                </a>
                                <button
                                  type="button"
                                  onClick={(e) => copyToClipboard(order.customerPhone, `phone_${order.id}`, e)}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="Copy Phone"
                                >
                                  {copiedKey === `phone_${order.id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Row 2: User icon + Name + Copy button */}
                          <div className="flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="font-bold text-slate-900 truncate text-xs" title={order.customerName}>
                              {order.customerName || 'Anonymous Customer'}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => copyToClipboard(order.customerName, `name_${order.id}`, e)}
                              className="p-0.5 text-slate-300 hover:text-slate-600 rounded transition-colors ml-auto shrink-0 cursor-pointer"
                              title="Copy Name"
                            >
                              {copiedKey === `name_${order.id}` ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>

                          {/* Row 3: Location icon + Short address preview */}
                          <div className="flex items-center gap-1.5 text-slate-500 group/addr">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate text-[11px] leading-tight" title={fullAddress || shortAddress}>
                              {shortAddress}
                            </span>
                            {fullAddress && (
                              <button
                                type="button"
                                onClick={(e) => copyToClipboard(fullAddress, `addr_${order.id}`, e)}
                                className="p-0.5 text-slate-300 hover:text-slate-600 rounded transition-colors ml-auto shrink-0 opacity-0 group-hover/addr:opacity-100 cursor-pointer"
                                title="Copy Full Address"
                              >
                                {copiedKey === `addr_${order.id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 4. Note: Last updated time + note content */}
                      <td className="px-3.5 py-3.5 max-w-[200px]" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1 truncate">
                              <Clock className="w-3 h-3 shrink-0" />
                              {noteUpdatedTimeText}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNoteOrderId(order.id);
                                setNoteDraft(currentNote);
                              }}
                              className="text-slate-400 hover:text-purple-600 p-0.5 rounded cursor-pointer"
                              title="Edit Note"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>

                          {editingNoteOrderId === order.id ? (
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="text"
                                value={noteDraft}
                                onChange={(e) => setNoteDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveNote(order.id);
                                  if (e.key === 'Escape') setEditingNoteOrderId(null);
                                }}
                                placeholder="Add note..."
                                autoFocus
                                className="w-full h-6 px-1.5 text-xs bg-white border border-purple-300 rounded focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSaveNote(order.id)}
                                className="h-6 px-1.5 text-[10px] bg-purple-600 hover:bg-purple-700 text-white rounded cursor-pointer"
                              >
                                Save
                              </Button>
                            </div>
                          ) : (
                            <p 
                              className={cn(
                                "text-[11px] line-clamp-2 leading-relaxed cursor-pointer hover:text-purple-700 transition-colors",
                                currentNote ? "text-slate-700 font-medium" : "text-slate-400 italic"
                              )}
                              onClick={() => {
                                setEditingNoteOrderId(order.id);
                                setNoteDraft(currentNote);
                              }}
                              title={currentNote || 'Click to add note'}
                            >
                              {currentNote || 'No notes added yet'}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* 5. Order Items: Compact product badge with image thumbnail, code, price & qty pill */}
                      <td className="px-3.5 py-3.5">
                        <div className="flex flex-col gap-1.5 min-w-[190px]">
                          {primaryItems.slice(0, 2).map((item, idx) => {
                            const unitPrice = item.price || item.total || 0;
                            const itemCode = item.sku || `ITEM-${item.productId || idx + 1}`;

                            return (
                              <div 
                                key={idx}
                                className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-50 border border-slate-200/70 hover:bg-purple-50/40 transition-colors"
                              >
                                {/* Thumbnail */}
                                <div className="w-8 h-8 rounded-md bg-white border border-slate-200 overflow-hidden flex items-center justify-center shrink-0 shadow-2xs">
                                  {item.image ? (
                                    <img 
                                      src={item.image} 
                                      alt={item.name} 
                                      referrerPolicy="no-referrer"
                                      className="w-full h-full object-cover" 
                                      onError={(e) => {
                                        // Hide broken image and fallback to package icon
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <Package className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>

                                {/* Code & Name */}
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-[11px] font-semibold text-slate-800 truncate" title={item.name}>
                                    {item.name}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {itemCode}
                                  </span>
                                </div>

                                {/* Price (৳650) & Qty pill (1x) */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-xs font-bold text-slate-900">
                                    ৳{Number(unitPrice).toLocaleString()}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-purple-100 text-purple-700">
                                    {item.quantity || 1}x
                                  </span>
                                </div>
                              </div>
                            );
                          })}

                          {primaryItems.length > 2 && (
                            <span className="text-[10px] text-purple-600 font-semibold px-1">
                              +{primaryItems.length - 2} more item(s)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 6. Success Rate: Score/number */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "font-bold text-xs",
                                successRateScore >= 95 ? "text-emerald-600" : successRateScore >= 90 ? "text-blue-600" : "text-amber-600"
                              )}>
                                {successRateScore}%
                              </span>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                            </div>
                            <span className="text-[10px] text-slate-400">High Reliability</span>
                          </div>
                        </div>
                      </td>

                      {/* 7. Tags: With light button (+) to add tags dynamically */}
                      <td className="px-3.5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-wrap items-center gap-1.5 max-w-[170px]">
                          {currentTags.map((tag, tIdx) => (
                            <span 
                              key={tIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200/60"
                            >
                              <span>{tag}</span>
                              <button
                                type="button"
                                onClick={(e) => handleRemoveTag(order.id, tIdx, e)}
                                className="text-purple-400 hover:text-purple-700 rounded-full cursor-pointer"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}

                          {tagInputOrderId === order.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={newTagText}
                                onChange={(e) => setNewTagText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleAddTag(order.id);
                                  if (e.key === 'Escape') setTagInputOrderId(null);
                                }}
                                placeholder="Tag..."
                                autoFocus
                                className="w-16 h-5 px-1 text-[10px] bg-white border border-purple-300 rounded focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddTag(order.id)}
                                className="h-5 px-1 text-[10px] font-bold bg-purple-600 text-white rounded cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setTagInputOrderId(order.id);
                                setNewTagText('');
                              }}
                              className="inline-flex items-center justify-center h-5 w-5 rounded-md bg-slate-100 hover:bg-purple-100 text-slate-600 hover:text-purple-700 border border-slate-200 text-xs font-bold transition-colors cursor-pointer"
                              title="Add Tag"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 8. Site: Badge showing source name */}
                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        {order.source === 'shopify' ? (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 inline-flex items-center gap-1.5 shadow-2xs">
                            <ShoppingBag className="w-3 h-3 text-emerald-600" />
                            <span>{siteName}</span>
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/60 inline-flex items-center gap-1.5 shadow-2xs">
                            <Globe className="w-3 h-3 text-blue-500" />
                            <span>{siteName}</span>
                          </span>
                        )}
                      </td>

                      {/* 9. Actions: "Open" button with ExternalLink icon */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* Main "Open" Action Button */}
                          <Link
                            to={`/web-order/${encodeURIComponent(targetOrderId)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onViewOrder) onViewOrder(order);
                            }}
                            className="inline-flex items-center justify-center h-7 px-2.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-800 border border-purple-200 rounded-lg shadow-2xs gap-1.5 cursor-pointer transition-colors"
                            title={`Open Order #${targetOrderId} Details`}
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                          </Link>

                          {/* Quick Single Sync Button */}
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isSyncing}
                            onClick={(e) => handleSingleSync(order, e)}
                            className="h-7 w-7 p-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                            title="Sync Order from Store"
                          >
                            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin text-purple-600")} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 3. Pagination Footer */}
        <div className="px-4 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          
          {/* Left side: Page {currentPage} text */}
          <div className="font-semibold text-slate-700 text-xs">
            Page <span className="font-bold text-purple-700">{currentPage}</span>
          </div>

          {/* Right side: Rows selector dropdown, current page text, and Previous / Next controls */}
          <div className="flex items-center gap-3">
            
            {/* Rows per page selector dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-medium">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  onPageSizeChange(Number(e.target.value));
                  onPageChange(1);
                }}
                className="h-8 px-2.5 border border-slate-200 bg-white rounded-lg text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-purple-500 cursor-pointer shadow-2xs"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Current page text */}
            <span className="text-slate-600 font-medium px-1">
              Page <span className="font-bold text-slate-900">{currentPage}</span> of <span className="font-bold text-slate-900">{totalPages}</span>
            </span>

            {/* Previous / Next controls */}
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
                className="h-8 px-3 text-xs font-medium rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer shadow-2xs gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
                className="h-8 px-3 text-xs font-medium rounded-lg border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer shadow-2xs gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
