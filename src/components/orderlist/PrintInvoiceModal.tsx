import React, { useRef } from 'react';
import { X, Printer, Download, CheckCircle2, Phone, MapPin, Package, Calendar } from 'lucide-react';
import { Order } from '../../types';

interface PrintInvoiceModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PrintInvoiceModal({ order, isOpen, onClose }: PrintInvoiceModalProps) {
  const printContentRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = order.date || order.created_at
    ? new Date(order.date || order.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('en-GB');

  const subtotal = (order.items || []).reduce(
    (sum, item) => sum + (Number(item.salePrice || item.price || 0) * Number(item.qty || 1)),
    0
  ) || order.total || 0;

  const deliveryCharge = Number(order.deliveryCharge || order.delivery || 0);
  const discount = Number(order.discount || 0);
  const advance = Number(order.advance || 0);
  const grandTotal = Number(order.total || (subtotal + deliveryCharge - discount));
  const dueAmount = grandTotal - advance;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Controls (Hidden during print) */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50 dark:bg-slate-800/80 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Invoice Preview — {order.invoice || order.id}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Invoice
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Area */}
        <div className="p-8 overflow-y-auto bg-white text-gray-900 print:p-0 print:m-0" ref={printContentRef}>
          {/* Invoice Header */}
          <div className="flex justify-between items-start border-b border-gray-200 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-black text-lg">
                  C
                </span>
                <span className="text-xl font-bold tracking-tight text-gray-900">
                  CommerceFlow
                </span>
              </div>
              <p className="text-xs text-gray-500">Premium E-Commerce Logistics & Fulfillment</p>
              <p className="text-xs text-gray-500">Hotline: +880 1800-000000 • Email: support@commerceflow.io</p>
            </div>

            <div className="text-right">
              <div className="inline-block bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider mb-2">
                INVOICE: {order.invoice || order.id}
              </div>
              <p className="text-xs text-gray-500 flex items-center justify-end gap-1">
                <Calendar className="w-3.5 h-3.5" /> Date: {formattedDate}
              </p>
              <p className="text-xs font-semibold text-gray-700 mt-1">
                Courier: <span className="text-indigo-600">{order.courier || 'Pathao'}</span>
              </p>
            </div>
          </div>

          {/* Customer & Shipping Details */}
          <div className="grid grid-cols-2 gap-6 bg-gray-50/80 border border-gray-100 rounded-xl p-4 mb-6 text-xs">
            <div>
              <h3 className="font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-2">
                Customer Information:
              </h3>
              <p className="font-semibold text-sm text-gray-900">{order.customer || order.customerName || 'N/A'}</p>
              <p className="text-gray-600 mt-0.5 flex items-center gap-1.5 font-mono">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                {order.phone || 'N/A'}
              </p>
              {order.source && (
                <p className="text-gray-500 mt-1">Source: <span className="font-medium text-gray-700">{order.source}</span></p>
              )}
            </div>

            <div>
              <h3 className="font-bold text-gray-700 uppercase tracking-wider text-[11px] mb-2">
                Delivery Address:
              </h3>
              <p className="text-gray-700 flex items-start gap-1.5 leading-relaxed">
                <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                {order.address || 'Address not provided'}
              </p>
              {order.note && (
                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px]">
                  <span className="font-bold">Delivery Note:</span> {order.note}
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-gray-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100/80 text-gray-700 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-3 border-b border-gray-200">#</th>
                  <th className="py-2.5 px-3 border-b border-gray-200">Item Description</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 text-center">SKU</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 text-center">Qty</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 text-right">Price</th>
                  <th className="py-2.5 px-3 border-b border-gray-200 text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {(order.items && order.items.length > 0 ? order.items : [
                  {
                    name: order.productName || 'Order Item',
                    sku: order.sku || order.code || 'KN-0001',
                    qty: order.qty || 1,
                    salePrice: order.total || 0,
                    price: order.total || 0
                  }
                ]).map((item, idx) => {
                  const itemPrice = Number(item.salePrice || item.price || 0);
                  const itemQty = Number(item.qty || 1);
                  const lineTotal = itemPrice * itemQty;

                  return (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{item.name}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-gray-600">{item.sku || item.code || '—'}</td>
                      <td className="py-2.5 px-3 text-center font-semibold">{itemQty}</td>
                      <td className="py-2.5 px-3 text-right text-gray-600 font-mono">৳{itemPrice.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900 font-mono">৳{lineTotal.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Totals Calculation */}
          <div className="flex justify-end mb-6">
            <div className="w-64 space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span className="font-mono font-medium">৳{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Delivery Charge:</span>
                <span className="font-mono font-medium">৳{deliveryCharge.toLocaleString()}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Discount:</span>
                  <span className="font-mono font-medium">-৳{discount.toLocaleString()}</span>
                </div>
              )}
              {advance > 0 && (
                <div className="flex justify-between text-indigo-600">
                  <span>Advance Paid:</span>
                  <span className="font-mono font-medium">-৳{advance.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-1.5 flex justify-between font-bold text-sm text-gray-900">
                <span>Cash on Delivery (COD):</span>
                <span className="font-mono text-indigo-700">৳{dueAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Footer note & barcode representation */}
          <div className="border-t border-dashed border-gray-200 pt-4 flex items-center justify-between text-[11px] text-gray-500">
            <div>
              <p className="font-medium text-gray-700">Thank you for ordering with us!</p>
              <p>Please inspect product in front of delivery officer.</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-xs font-bold tracking-widest text-gray-800">
                * {order.invoice || order.id} *
              </div>
              <p className="text-[10px] text-gray-400">Authorized System Generated Invoice</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
