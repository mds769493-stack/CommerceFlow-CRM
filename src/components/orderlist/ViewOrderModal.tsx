import React from 'react';
import { X, Phone, MapPin, Package, Calendar, User, Truck, Tag, ExternalLink, Printer, Edit2, ShieldAlert } from 'lucide-react';
import { Order } from '../../types';

interface ViewOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (order: Order) => void;
  onPrint: (order: Order) => void;
}

export function ViewOrderModal({ order, isOpen, onClose, onEdit, onPrint }: ViewOrderModalProps) {
  if (!isOpen || !order) return null;

  const formattedDate = order.date || order.created_at
    ? new Date(order.date || order.created_at).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'N/A';

  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.salePrice || item.price || 0) * Number(item.qty || 1)),
    0
  ) || order.total || 0;

  const deliveryCharge = Number(order.deliveryCharge || order.delivery || 0);
  const discount = Number(order.discount || 0);
  const advance = Number(order.advance || 0);
  const grandTotal = Number(order.total || (subtotal + deliveryCharge - discount));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 text-xs font-mono font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg">
              {order.invoice || order.id}
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                Order Overview
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                  {order.status || 'Pending'}
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400">Created on {formattedDate}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onPrint(order)}
              className="p-2 text-gray-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Print Invoice"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                onClose();
                onEdit(order);
              }}
              className="p-2 text-gray-600 dark:text-slate-300 hover:text-indigo-600 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title="Edit Order"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Customer & Delivery Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 border border-gray-200 dark:border-slate-800 space-y-2">
              <h3 className="font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" /> Customer Information
              </h3>
              <p className="font-semibold text-sm text-gray-900 dark:text-white">
                {order.customer || order.customerName || 'N/A'}
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-gray-700 dark:text-slate-300">{order.phone}</span>
                {order.phoneSuccessRate !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    order.phoneSuccessRate >= 80
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    {order.phoneSuccessRate}% Success
                  </span>
                )}
              </div>
              <p className="text-gray-500 dark:text-slate-400">
                Source: <span className="font-medium text-gray-700 dark:text-slate-200">{order.source || 'Website'}</span>
              </p>
              <p className="text-gray-500 dark:text-slate-400">
                Processed By: <span className="font-medium text-gray-700 dark:text-slate-200">{order.user || 'Masuma Aktar'}</span>
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-slate-800/40 rounded-xl p-4 border border-gray-200 dark:border-slate-800 space-y-2">
              <h3 className="font-bold text-gray-800 dark:text-slate-200 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-indigo-600" /> Courier & Shipping
              </h3>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900 dark:text-white">Courier:</span>
                <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-medium">
                  {order.courier || 'Pathao'}
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-600 dark:text-slate-400">Status: {order.uploadStatus || 'Pending'}</span>
              </div>
              <p className="text-gray-700 dark:text-slate-300 flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                {order.address || 'Address not provided'}
              </p>
              {order.city && (
                <p className="text-gray-500 dark:text-slate-400">City / District: {order.city}</p>
              )}
              {order.note && (
                <div className="p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded text-amber-900 dark:text-amber-200">
                  <span className="font-bold">Order Note:</span> {order.note}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-gray-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 font-semibold text-gray-800 dark:text-slate-200 flex items-center justify-between">
              <span>Order Items ({(order.items || []).length || 1})</span>
              <span>Total Qty: {order.qty || (order.items || []).reduce((s, i) => s + (i.qty || 1), 0) || 1}</span>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-slate-800">
              {(order.items && order.items.length > 0 ? order.items : [
                {
                  name: order.productName || 'Order Item',
                  sku: order.sku || order.code || 'KN-0001',
                  qty: order.qty || 1,
                  salePrice: order.total || 0,
                  price: order.total || 0,
                  image: ''
                }
              ]).map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-slate-700" />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-gray-400">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                      <p className="text-gray-500 font-mono text-[11px]">SKU: {item.sku || item.code || '—'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900 dark:text-white font-mono">
                      ৳{Number(item.salePrice || item.price || 0).toLocaleString()} × {item.qty || 1}
                    </p>
                    <p className="text-gray-500 text-[11px] font-mono">
                      = ৳{(Number(item.salePrice || item.price || 0) * Number(item.qty || 1)).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="flex justify-end">
            <div className="w-72 bg-gray-50 dark:bg-slate-800/60 p-4 rounded-xl border border-gray-200 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Subtotal</span>
                <span className="font-mono">৳{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-slate-400">
                <span>Delivery Charge</span>
                <span className="font-mono">৳{deliveryCharge.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                  <span>Discount</span>
                  <span className="font-mono">-৳{discount.toLocaleString()}</span>
                </div>
              )}
              {advance > 0 && (
                <div className="flex justify-between text-indigo-600 dark:text-indigo-400">
                  <span>Advance</span>
                  <span className="font-mono">-৳{advance.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-slate-700 pt-2 flex justify-between font-bold text-sm text-gray-900 dark:text-white">
                <span>Total Payable</span>
                <span className="font-mono text-indigo-600 dark:text-indigo-400">৳{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-800 flex justify-end gap-2 bg-gray-50/50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
