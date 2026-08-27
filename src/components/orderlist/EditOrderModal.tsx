import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { Order, OrderItem } from '../../types';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedOrder: Order) => Promise<void>;
}

export function EditOrderModal({ order, isOpen, onClose, onSave }: EditOrderModalProps) {
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (order) {
      setFormData({
        ...order,
        customerName: order.customerName || order.customer || '',
        customer: order.customer || order.customerName || '',
        phone: order.phone || '',
        address: order.address || '',
        city: order.city || '',
        note: order.note || '',
        shippingNote: order.shippingNote || '',
        status: order.status || 'Pending',
        courier: order.courier || 'Pathao',
        deliveryCharge: order.deliveryCharge !== undefined ? order.deliveryCharge : (order.delivery || 130),
        discount: order.discount || 0,
        advance: order.advance || 0,
        total: order.total || 0,
        user: order.user || 'Masuma Aktar'
      });

      const initialItems = (order.items && order.items.length > 0)
        ? [...order.items]
        : [{
            name: order.productName || 'Product Item',
            sku: order.sku || order.code || 'KN-0001',
            qty: order.qty || 1,
            salePrice: order.total || 0,
            price: order.total || 0
          }];
      setItems(initialItems);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const nextItems = [...items];
    nextItems[index] = { ...nextItems[index], [field]: value };
    setItems(nextItems);
  };

  const handleAddItem = () => {
    setItems([...items, { name: 'New Item', sku: 'KN-0000', qty: 1, salePrice: 0, price: 0 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Recalculate total when items or charges change
  const itemsSubtotal = items.reduce((sum, it) => sum + (Number(it.salePrice || it.price || 0) * Number(it.qty || 1)), 0);
  const deliveryCharge = Number(formData.deliveryCharge || 0);
  const discount = Number(formData.discount || 0);
  const calculatedTotal = itemsSubtotal + deliveryCharge - discount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const primaryItem = items[0] || { name: 'Item', sku: 'KN-0001', qty: 1 };
      const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 1), 0);

      const updated: Order = {
        ...order,
        ...formData,
        customer: formData.customerName || formData.customer || 'Customer',
        customerName: formData.customerName || formData.customer || 'Customer',
        phone: formData.phone || '',
        address: formData.address || '',
        city: formData.city || '',
        note: formData.note || '',
        shippingNote: formData.shippingNote || '—',
        status: formData.status || 'Pending',
        courier: formData.courier || 'Pathao',
        items,
        productName: primaryItem.name,
        sku: primaryItem.sku,
        code: primaryItem.sku,
        qty: totalQty,
        deliveryCharge,
        delivery: deliveryCharge,
        discount,
        advance: Number(formData.advance || 0),
        total: calculatedTotal,
        updatedAt: new Date().toISOString()
      };

      await onSave(updated);
      onClose();
    } catch (err) {
      console.error('Failed to save order edit:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between bg-gray-50/70 dark:bg-slate-800/70">
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">
              Edit Order — {order.invoice || order.id}
            </h2>
            <p className="text-xs text-gray-500 dark:text-slate-400">Modify customer, items, and status</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-200/50 dark:hover:bg-slate-700/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Customer & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Customer Name</label>
              <input
                type="text"
                value={formData.customerName || ''}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value, customer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Phone Number</label>
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                required
              />
            </div>
          </div>

          {/* Address & City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Delivery Address</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                required
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">City / District</label>
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Status & Courier */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Order Status</label>
              <select
                value={formData.status || 'Pending'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {['Pending', 'RTS', 'Shipped', 'Delivered', 'Pending Return', 'Returned', 'Partial', 'Cancelled', 'Pending Cancel', 'Preorder', 'Lost'].map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Courier Partner</label>
              <select
                value={formData.courier || 'Pathao'}
                onChange={(e) => setFormData({ ...formData, courier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              >
                {['Pathao', 'Steadfast', 'RedX', 'Carrybee', 'Paperfly'].map(cr => (
                  <option key={cr} value={cr}>{cr}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-gray-200 dark:border-slate-800 rounded-xl p-3 bg-gray-50/50 dark:bg-slate-800/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-800 dark:text-slate-200">Line Items</span>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 rounded font-medium hover:bg-indigo-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-gray-200 dark:border-slate-700">
                  <input
                    type="text"
                    placeholder="Product Title"
                    value={item.name}
                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                    className="flex-1 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-xs"
                    required
                  />
                  <input
                    type="text"
                    placeholder="SKU"
                    value={item.sku || ''}
                    onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white font-mono text-xs"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="Qty"
                    value={item.qty}
                    onChange={(e) => handleItemChange(idx, 'qty', parseInt(e.target.value) || 1)}
                    className="w-14 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-center text-xs"
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Price"
                    value={item.salePrice !== undefined ? item.salePrice : item.price}
                    onChange={(e) => handleItemChange(idx, 'salePrice', parseFloat(e.target.value) || 0)}
                    className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-900 text-gray-900 dark:text-white text-right font-mono text-xs"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(idx)}
                    disabled={items.length <= 1}
                    className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Delivery Charge (৳)</label>
              <input
                type="number"
                value={formData.deliveryCharge || 0}
                onChange={(e) => setFormData({ ...formData, deliveryCharge: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Discount (৳)</label>
              <input
                type="number"
                value={formData.discount || 0}
                onChange={(e) => setFormData({ ...formData, discount: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Advance (৳)</label>
              <input
                type="number"
                value={formData.advance || 0}
                onChange={(e) => setFormData({ ...formData, advance: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white font-mono"
              />
            </div>
          </div>

          {/* Order Note */}
          <div>
            <label className="block font-semibold text-gray-700 dark:text-slate-300 mb-1">Order Note / Special Instructions</label>
            <input
              type="text"
              value={formData.note || ''}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="e.g. Deliver before 5 PM"
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white"
            />
          </div>

          {/* Calculated Grand Total Notice */}
          <div className="p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl flex items-center justify-between font-semibold">
            <span className="text-gray-700 dark:text-slate-300">Total Order Amount:</span>
            <span className="text-base text-indigo-700 dark:text-indigo-300 font-mono font-bold">
              ৳{calculatedTotal.toLocaleString()}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
