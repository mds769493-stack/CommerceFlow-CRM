import React, { useState } from 'react';
import {
  MoreVertical,
  Printer,
  Edit2,
  Eye,
  Trash2,
  Copy,
  Check,
  Phone,
  MessageSquare,
  MapPin,
  Tag,
  Plus,
  ArrowUpDown,
  ExternalLink,
  Package,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { Order } from '../../types';

interface OrderListTableProps {
  orders: Order[];
  selectedOrders: string[];
  onToggleSelectOrder: (orderId: string) => void;
  onSelectAll: () => void;
  onViewOrder: (order: Order) => void;
  onEditOrder: (order: Order) => void;
  onPrintInvoice: (order: Order) => void;
  onDeleteOrder: (orderId: string) => void;
  onQuickUpdateStatus: (orderId: string, newStatus: string) => void;
  onQuickAddTag: (orderId: string, tag: string) => void;
  onQuickUpdateNote: (orderId: string, note: string) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (field: string) => void;
}

export function OrderListTable({
  orders,
  selectedOrders,
  onToggleSelectOrder,
  onSelectAll,
  onViewOrder,
  onEditOrder,
  onPrintInvoice,
  onDeleteOrder,
  onQuickUpdateStatus,
  onQuickAddTag,
  onQuickUpdateNote,
  sortField,
  sortDirection,
  onSort
}: OrderListTableProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<string>('');
  const [addingTagId, setAddingTagId] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState<string>('');

  const isAllSelected = orders.length > 0 && selectedOrders.length === orders.length;
  const isPartiallySelected = selectedOrders.length > 0 && selectedOrders.length < orders.length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(id);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { formatted: 'N/A', relative: 'Recently' };
    const date = new Date(dateStr);
    const formatted = date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const diffHours = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60));
    let relative = 'Updated recently';
    if (diffHours < 1) relative = 'Updated just now';
    else if (diffHours === 1) relative = 'Updated 1 hour ago';
    else if (diffHours < 24) relative = `Updated about ${diffHours} hours ago`;
    else {
      const diffDays = Math.round(diffHours / 24);
      relative = `Updated ${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    }

    return { formatted, relative };
  };

  const getSuccessRateColor = (rate?: number) => {
    if (rate === undefined) return 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300';
    if (rate >= 90) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    if (rate >= 70) return 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300';
    if (rate >= 50) return 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    return 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-xs overflow-hidden">
      <div className="overflow-x-auto min-h-[400px]">
        <table className="w-full text-left text-xs border-collapse">
          {/* Table Header */}
          <thead className="bg-gray-50/90 dark:bg-slate-800/90 text-gray-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] border-b border-gray-200 dark:border-slate-700 sticky top-0 z-20 backdrop-blur-xs">
            <tr>
              <th className="py-3 px-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = isPartiallySelected;
                  }}
                  onChange={onSelectAll}
                  className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                />
              </th>
              <th className="py-3 px-3 min-w-[140px]">Date</th>
              <th className="py-3 px-3 min-w-[110px]">Invoice</th>
              <th className="py-3 px-3 min-w-[240px]">Customer</th>
              <th className="py-3 px-3 min-w-[130px]">Note</th>
              <th className="py-3 px-3 min-w-[200px]">Products</th>
              <th className="py-3 px-3 min-w-[160px]">productName</th>
              <th className="py-3 px-3 min-w-[90px] text-center">sku</th>
              <th className="py-3 px-3 min-w-[70px] text-center">qty</th>
              <th className="py-3 px-3 min-w-[110px]">Tags</th>
              <th className="py-3 px-3 min-w-[110px]">Custom Tags</th>
              <th className="py-3 px-3 min-w-[140px]">Status Tags</th>
              <th className="py-3 px-3 min-w-[70px] text-center">Print</th>
              <th className="py-3 px-3 min-w-[90px] text-right">Total</th>
              <th className="py-3 px-3 min-w-[90px] text-center">Upload</th>
              <th className="py-3 px-3 min-w-[90px] text-center">isCrossSale</th>
              <th className="py-3 px-3 min-w-[110px]">User</th>
              <th className="py-3 px-3 min-w-[90px]">Source</th>
              <th className="py-3 px-3 min-w-[120px]">Shipping Note</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800 text-gray-800 dark:text-slate-200">
            {orders.length === 0 ? (
              <tr>
                <td colSpan={19} className="py-16 text-center text-gray-400 dark:text-slate-500">
                  <Package className="w-10 h-10 mx-auto mb-2 text-gray-300 dark:text-slate-600" />
                  <p className="text-sm font-semibold text-gray-600 dark:text-slate-400">No orders found</p>
                  <p className="text-xs text-gray-400">Try adjusting your search or filters.</p>
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const isSelected = selectedOrders.includes(order.id);
                const { formatted, relative } = formatDateTime(order.date || order.created_at);
                const primaryItem = (order.items && order.items.length > 0) ? order.items[0] : null;
                const productName = primaryItem?.name || order.productName || 'Product Title';
                const sku = primaryItem?.sku || order.sku || order.code || 'KN-1000';
                const qty = primaryItem?.qty || order.qty || 1;
                const totalQty = (order.items && order.items.length > 0)
                  ? order.items.reduce((s, it) => s + (Number(it.qty) || 1), 0)
                  : qty;

                return (
                  <tr
                    key={order.id}
                    className={`hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 transition-colors ${
                      isSelected ? 'bg-indigo-50/60 dark:bg-indigo-950/30' : ''
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => onToggleSelectOrder(order.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                      />
                    </td>

                    {/* Date */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-gray-900 dark:text-white">{formatted}</div>
                      <div className="text-[10px] text-gray-400 dark:text-slate-400">{relative}</div>
                    </td>

                    {/* Invoice + 3 Dots Menu */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => onViewOrder(order)}
                          className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 px-2 py-0.5 rounded text-xs border border-indigo-200 dark:border-indigo-800 transition-colors cursor-pointer"
                        >
                          {order.invoice || order.id}
                        </button>

                        {/* Action dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === order.id ? null : order.id)}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 rounded hover:bg-gray-100 dark:hover:bg-slate-800"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === order.id && (
                            <>
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setActiveMenuId(null)}
                              />
                              <div className="absolute left-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 py-1.5 z-40 text-xs">
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    onViewOrder(order);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-600" /> View Order
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    onEditOrder(order);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-amber-600" /> Edit Order
                                </button>
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    onPrintInvoice(order);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center gap-2 cursor-pointer"
                                >
                                  <Printer className="w-3.5 h-3.5 text-emerald-600" /> Print Invoice
                                </button>
                                <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
                                <div className="px-3 py-1 text-[10px] font-semibold text-gray-400 uppercase">
                                  Change Status
                                </div>
                                {['Pending', 'RTS', 'Shipped', 'Delivered', 'Cancelled'].map((st) => (
                                  <button
                                    key={st}
                                    onClick={() => {
                                      setActiveMenuId(null);
                                      onQuickUpdateStatus(order.id, st);
                                    }}
                                    className="w-full px-3 py-1 text-left text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 flex items-center justify-between text-[11px]"
                                  >
                                    <span>{st}</span>
                                    {order.status === st && <Check className="w-3 h-3 text-indigo-600" />}
                                  </button>
                                ))}
                                <div className="border-t border-gray-100 dark:border-slate-700 my-1" />
                                <button
                                  onClick={() => {
                                    setActiveMenuId(null);
                                    if (confirm('Are you sure you want to delete this order?')) {
                                      onDeleteOrder(order.id);
                                    }
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Order
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Customer */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                          <span>{order.customer || order.customerName || 'N/A'}</span>
                        </div>

                        {/* Phone + Delivery Success Rate */}
                        <div className="flex items-center gap-1.5 font-mono text-gray-700 dark:text-slate-300">
                          <button
                            onClick={() => handleCopy(order.phone, order.id)}
                            className="p-0.5 text-gray-400 hover:text-indigo-600 rounded transition-colors"
                            title="Copy phone"
                          >
                            {copiedPhone === order.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <span>{order.phone}</span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${getSuccessRateColor(
                              order.phoneSuccessRate
                            )}`}
                          >
                            {order.phoneSuccessRate !== undefined ? `${order.phoneSuccessRate}%` : '100%'}
                          </span>

                          <a
                            href={`tel:${order.phone}`}
                            className="p-0.5 text-gray-400 hover:text-indigo-600"
                            title="Call customer"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                          <a
                            href={`https://wa.me/${order.phone.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-0.5 text-gray-400 hover:text-emerald-600"
                            title="WhatsApp"
                          >
                            <MessageSquare className="w-3 h-3" />
                          </a>
                        </div>

                        {/* Address */}
                        <div className="text-[11px] text-gray-500 dark:text-slate-400 flex items-start gap-1 line-clamp-1">
                          <MapPin className="w-3 h-3 text-gray-400 shrink-0 mt-0.5" />
                          <span className="truncate">{order.address || 'Address not provided'}</span>
                        </div>
                      </div>
                    </td>

                    {/* Note */}
                    <td className="py-3 px-3">
                      {editingNoteId === order.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteInput}
                            onChange={(e) => setNoteInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                onQuickUpdateNote(order.id, noteInput);
                                setEditingNoteId(null);
                              } else if (e.key === 'Escape') {
                                setEditingNoteId(null);
                              }
                            }}
                            className="w-28 px-1.5 py-1 text-xs border border-indigo-400 rounded bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
                            autoFocus
                          />
                          <button
                            onClick={() => {
                              onQuickUpdateNote(order.id, noteInput);
                              setEditingNoteId(null);
                            }}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => {
                            setEditingNoteId(order.id);
                            setNoteInput(order.note || '');
                          }}
                          className="group flex items-center gap-1 cursor-pointer"
                        >
                          <span className="text-gray-600 dark:text-slate-400 line-clamp-2 italic">
                            {order.note || '—'}
                          </span>
                          <Edit2 className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </div>
                      )}
                    </td>

                    {/* Products (Thumbnail + Title + SKU • Qty) */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Status bullet" />
                        {primaryItem?.image ? (
                          <img
                            src={primaryItem.image}
                            alt={productName}
                            className="w-9 h-9 object-cover rounded-lg border border-gray-200 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-gray-400 shrink-0">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate max-w-[180px]">
                            {productName}
                          </p>
                          <p className="text-[10px] text-gray-500 font-mono">
                            {sku} • Qty: {totalQty}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* productName */}
                    <td className="py-3 px-3">
                      <span className="text-gray-700 dark:text-slate-300 font-medium truncate block max-w-[160px]">
                        {productName}
                      </span>
                    </td>

                    {/* sku */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 rounded font-mono text-[11px] border border-gray-200 dark:border-slate-700">
                        {sku}
                      </span>
                    </td>

                    {/* qty */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded-full font-bold text-xs">
                        {totalQty}
                      </span>
                    </td>

                    {/* Tags */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap items-center gap-1">
                        {(order.tags || ['REPEAT']).map((t, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 rounded text-[10px] font-bold"
                          >
                            {t}
                          </span>
                        ))}
                        {addingTagId === order.id ? (
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && tagInput.trim()) {
                                onQuickAddTag(order.id, tagInput.trim());
                                setAddingTagId(null);
                                setTagInput('');
                              } else if (e.key === 'Escape') {
                                setAddingTagId(null);
                              }
                            }}
                            placeholder="Tag"
                            className="w-16 px-1 py-0.5 text-[10px] border border-indigo-400 rounded bg-white dark:bg-slate-800"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setAddingTagId(order.id);
                              setTagInput('');
                            }}
                            className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                            title="Add Tag"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Custom Tags */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        {(order.customTags || []).map((ct, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 rounded text-[10px]"
                          >
                            {ct}
                          </span>
                        ))}
                        <button
                          onClick={() => {
                            const newTag = prompt('Enter custom tag:');
                            if (newTag) onQuickAddTag(order.id, newTag);
                          }}
                          className="p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>

                    {/* Status Tags */}
                    <td className="py-3 px-3">
                      <div className="flex flex-wrap gap-1">
                        {(order.statusTags || ['Employee Discount Order']).map((st, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 rounded-md text-[10px] font-medium whitespace-nowrap"
                          >
                            {st}
                          </span>
                        ))}
                      </div>
                    </td>

                    {/* Print */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => onPrintInvoice(order)}
                        className="p-1.5 text-gray-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Print Invoice"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </td>

                    {/* Total */}
                    <td className="py-3 px-3 text-right font-bold text-gray-900 dark:text-white font-mono whitespace-nowrap">
                      ৳{Number(order.total || 0).toLocaleString()}
                    </td>

                    {/* Upload */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-full text-[10px] font-medium border border-emerald-200 dark:border-emerald-900">
                        {order.uploadStatus || 'pending'}
                      </span>
                    </td>

                    {/* isCrossSale */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400 rounded text-[10px] font-mono">
                        {order.isCrossSale ? 'true' : 'false'}
                      </span>
                    </td>

                    {/* User */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="text-gray-800 dark:text-slate-200 font-medium">
                        {order.user || 'Masuma Aktar'}
                      </span>
                    </td>

                    {/* Source */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 rounded font-medium text-[11px]">
                        {order.source || 'Website'}
                      </span>
                    </td>

                    {/* Shipping Note */}
                    <td className="py-3 px-3 whitespace-nowrap text-gray-500 dark:text-slate-400">
                      {order.shippingNote || '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
