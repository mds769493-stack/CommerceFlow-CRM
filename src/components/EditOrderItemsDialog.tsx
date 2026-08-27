import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Order, Product, OrderItem, OrderStatus } from '../types';
import { 
  Trash2, 
  Plus, 
  Package, 
  Hash, 
  Calculator, 
  Truck, 
  Copy, 
  Search, 
  User, 
  Phone, 
  Settings2, 
  CreditCard,
  ChevronRight,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface EditOrderItemsDialogProps {
  order: Order;
  products: Product[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<Order>) => void;
}

export function EditOrderItemsDialog({ order, products, open, onOpenChange, onSave }: EditOrderItemsDialogProps) {
  const [items, setItems] = useState<OrderItem[]>(() => {
    return (order.items || []).map(item => {
      const searchName = (item.name || "").toLowerCase().trim();
      const product = products.find(p => 
        (p.name || "").toLowerCase().trim() === searchName ||
        (p.code || "").toLowerCase().trim() === searchName
      );
      return {
        ...item,
        purchasePrice: item.purchasePrice ?? product?.purchasePrice ?? 0,
        salePrice: item.salePrice ?? product?.saleAmount ?? 0
      };
    });
  });
  const [delivery, setDelivery] = useState(order.delivery || 0);
  const [advance, setAdvance] = useState(order.advance || 0);
  const [customer, setCustomer] = useState(order.customer || '');
  const [phone, setPhone] = useState(order.phone || '');
  const [invoice, setInvoice] = useState(order.invoice || '');
  const [codAmount, setCodAmount] = useState(order.codAmount || 0);
  const [code, setCode] = useState(order.code || '');
  const [status, setStatus] = useState<OrderStatus>(order.status || 'Pending');
  const [searchTerm, setSearchTerm] = useState('');

  const addItem = () => {
    setItems([...items, { name: '', qty: 1, purchasePrice: 0, salePrice: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<OrderItem>) => {
    const newItems = [...items];
    const item = { ...newItems[index], ...updates };

    if (updates.name) {
      const searchName = (updates.name || "").toLowerCase().trim();
      const product = products.find(p => 
        (p.name || "").toLowerCase().trim() === searchName ||
        (p.code || "").toLowerCase().trim() === searchName
      );
      
      if (product) {
        item.purchasePrice = product.purchasePrice || 0;
        item.salePrice = product.saleAmount || 0;
        item.name = product.name;
      }
    }

    newItems[index] = item;
    setItems(newItems);
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + (item.salePrice || 0) * item.qty, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal() + delivery;
  };

  const handleSave = () => {
    const total = calculateTotal();
    onSave(order.id, {
      items,
      total,
      delivery,
      advance,
      customer,
      phone,
      invoice,
      codAmount,
      status,
      code
    });
    onOpenChange(false);
  };

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items.map((item, originalIndex) => ({ ...item, originalIndex }));
    return items.map((item, originalIndex) => ({ ...item, originalIndex }))
      .filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [items, searchTerm]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-5xl lg:max-w-7xl bg-white rounded-[2.5rem] border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden outline-none fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
        <div className="flex flex-col h-[92vh] md:h-[85vh]">
          {/* Header */}
          <div className="p-5 md:p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white shrink-0">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="h-10 w-10 md:h-14 md:w-14 rounded-xl md:rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100 rotate-3 transition-transform hover:rotate-0">
                <Package className="h-5 w-5 md:h-7 md:w-7" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-black text-slate-900 tracking-tight">Edit Order Details</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Order ID:</span>
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg text-[9px] md:text-[10px] font-mono font-black">#{order.invoice}</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end">
              <div className={cn(
                "px-3 md:px-4 py-1.5 md:py-2 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase tracking-wider border transition-all mr-8",
                status === 'Delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                status === 'Return' ? "bg-rose-50 text-rose-600 border-rose-100" :
                "bg-indigo-50 text-indigo-600 border-indigo-100"
              )}>
                {status}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr]">
            {/* Sidebar: Details */}
            <div className="border-r border-slate-100 bg-slate-50/50 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600">
                  <User className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Customer Info</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">Full Name</label>
                    <Input 
                      value={customer} 
                      onChange={(e) => setCustomer(e.target.value)}
                      placeholder="Customer name"
                      className="bg-white border-slate-200 rounded-2xl h-11 text-sm font-bold shadow-sm focus:ring-4 focus:ring-indigo-100 transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">Phone Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                      <Input 
                        value={phone} 
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone number"
                        className="bg-white border-slate-200 rounded-2xl h-11 text-sm font-bold pl-10 shadow-sm focus:ring-4 focus:ring-indigo-100 transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-slate-200/50" />

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Settings2 className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Order Config</span>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">Invoice Label</label>
                    <Input 
                      value={invoice} 
                      onChange={(e) => setInvoice(e.target.value)}
                      className="bg-white border-slate-200 rounded-2xl h-11 text-xs font-mono font-black uppercase shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">Internal Code</label>
                    <Input 
                      value={code} 
                      onChange={(e) => setCode(e.target.value)}
                      className="bg-white border-slate-200 rounded-2xl h-11 text-xs font-bold shadow-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 ml-1">System Status</label>
                    <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                      <SelectTrigger className="bg-white border-slate-200 rounded-2xl h-11 text-xs font-bold shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="In Review">In Review</SelectItem>
                        <SelectItem value="Exchange">Exchange</SelectItem>
                        <SelectItem value="Partial Delivery">Partial Delivery</SelectItem>
                        <SelectItem value="Return">Return</SelectItem>
                        <SelectItem value="Paid Return">Paid Return</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-600 rounded-[24px] text-white space-y-4 shadow-lg shadow-indigo-200 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10">
                  <Calculator className="h-16 w-16" />
                </div>
                <div className="relative z-10">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60">Final Settlement</span>
                  <div className="text-2xl font-black mt-0.5 tabular-nums">৳{(codAmount || 0).toLocaleString()}</div>
                  <p className="text-[10px] text-white/50 font-medium mt-1">Cash on Delivery amount</p>
                </div>
                <Input 
                  type="number"
                  value={codAmount} 
                  onChange={(e) => setCodAmount(Number(e.target.value))}
                  className="bg-white/10 border-white/20 rounded-xl h-9 text-xs font-black text-white focus:ring-white/30 placeholder:text-white/40"
                  placeholder="COD amount..."
                />
              </div>
            </div>

            {/* Main Content: Items List */}
            <div className="flex flex-col bg-white overflow-hidden">
              <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white/80 backdrop-blur shrink-0">
                <div className="flex items-center gap-3 flex-1 max-w-full md:max-w-md relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Find item by name or SKU..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-11 pr-4 bg-slate-50 border-transparent rounded-xl md:rounded-[20px] h-10 md:h-11 text-sm font-medium focus:bg-white focus:ring-4 focus:ring-indigo-100 transition-all border-slate-100"
                  />
                </div>
                <Button 
                  onClick={addItem}
                  className="h-10 md:h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl md:rounded-[20px] font-bold gap-2 shadow-lg shadow-indigo-100 shrink-0 transition-all hover:scale-105 active:scale-95 text-xs md:text-sm"
                >
                  <Plus className="h-4 w-4" />
                  Add Product
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 custom-scrollbar">
                <AnimatePresence initial={false}>
                  {filteredItems.map((item, index) => {
                    const actualIndex = item.originalIndex;
                    
                    return (
                      <motion.div 
                        key={`${actualIndex}-${item.name}`}
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        layout
                        className="group relative bg-white border border-slate-100 rounded-2xl md:rounded-[28px] p-4 md:p-5 hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-50/50 transition-all"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center gap-5">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <div className="h-12 w-12 md:h-14 md:w-14 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                              {products.find(p => p.name === item.name)?.image ? (
                                <img 
                                  src={products.find(p => p.name === item.name)?.image} 
                                  alt={item.name} 
                                  className="h-full w-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <Package className="h-5 w-5 text-slate-300" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">Select Product</span>
                                <div className="flex items-center gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full text-slate-300 hover:text-indigo-600 hover:bg-indigo-50"
                                    onClick={() => navigator.clipboard.writeText(item.name)}
                                    title="Copy name"
                                  >
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full text-slate-300 hover:text-rose-600 hover:bg-rose-50"
                                    onClick={() => removeItem(actualIndex)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <Select 
                                value={item.name} 
                                onValueChange={(v) => updateItem(actualIndex, { name: v })}
                              >
                                <SelectTrigger className="bg-slate-50/50 border-transparent rounded-xl h-10 text-xs md:text-sm font-bold focus:bg-white transition-all">
                                  <SelectValue placeholder="Select product..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-slate-100 shadow-2xl">
                                  {products.map(p => (
                                    <SelectItem key={p.id} value={p.name} className="py-2.5 px-4 focus:bg-indigo-50 rounded-xl">
                                      <div className="flex items-center justify-between w-full gap-4">
                                        <div className="flex items-center gap-3">
                                          <div className="h-7 w-7 rounded-lg border border-slate-100 overflow-hidden bg-white shrink-0">
                                            {p.image ? (
                                              <img src={p.image} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                            ) : (
                                              <div className="h-full w-full flex items-center justify-center text-slate-300"><Package className="h-3 w-3" /></div>
                                            )}
                                          </div>
                                          <div>
                                            <div className="font-bold text-slate-800 text-xs">{p.name}</div>
                                            <div className="text-[9px] text-slate-400 font-mono">CODE: {p.code || 'N/A'}</div>
                                          </div>
                                        </div>
                                        <div className="text-[10px] font-black text-indigo-600">৳{p.saleAmount}</div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 md:gap-8 shrink-0 justify-end">
                            <div className="space-y-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Quantity</span>
                              <div className="flex items-center bg-slate-50 rounded-xl p-0.5 border border-slate-100">
                                <button 
                                  onClick={() => updateItem(actualIndex, { qty: Math.max(1, item.qty - 1) })}
                                  className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                >-</button>
                                <input 
                                  type="number"
                                  value={item.qty}
                                  onChange={(e) => updateItem(actualIndex, { qty: Number(e.target.value) })}
                                  className="w-8 text-center bg-transparent border-none focus:ring-0 text-xs font-black text-slate-900"
                                />
                                <button 
                                  onClick={() => updateItem(actualIndex, { qty: item.qty + 1 })}
                                  className="h-7 w-7 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                >+</button>
                              </div>
                            </div>

                            <div className="space-y-1 w-full sm:w-28">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Cost Price</span>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">৳</span>
                                <Input 
                                  type="number"
                                  value={item.purchasePrice ?? 0}
                                  onChange={(e) => updateItem(actualIndex, { purchasePrice: Number(e.target.value) })}
                                  className="pl-7 bg-slate-50 border-transparent rounded-xl h-9 text-xs font-black text-amber-600 focus:bg-white transition-all"
                                />
                              </div>
                            </div>

                            <div className="space-y-1 w-full sm:w-28">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Unit Price</span>
                              <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300">৳</span>
                                <Input 
                                  type="number"
                                  value={item.salePrice}
                                  onChange={(e) => updateItem(actualIndex, { salePrice: Number(e.target.value) })}
                                  className="pl-7 bg-slate-50 border-transparent rounded-xl h-9 text-xs font-black text-indigo-600 focus:bg-white transition-all"
                                />
                              </div>
                            </div>

                            <div className="space-y-1 w-full sm:w-24 text-left sm:text-right col-span-2 sm:col-span-1">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-1">Total</span>
                              <div className="h-9 flex items-center justify-start sm:justify-end font-black text-slate-900 tabular-nums text-sm md:text-base">
                                ৳{(item.salePrice * item.qty).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {filteredItems.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50 rounded-[32px] border-2 border-dashed border-slate-200">
                    <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 mb-4">
                      <Search className="h-8 w-8" />
                    </div>
                    <p className="text-slate-500 font-bold tracking-tight">No products found matching your search</p>
                    <button 
                      onClick={() => setSearchTerm('')}
                      className="mt-2 text-xs font-black text-indigo-600 hover:underline"
                    >Clear search filter</button>
                  </div>
                )}
              </div>

              {/* Summary Footer */}
              <div className="p-8 border-t border-slate-100 bg-slate-50/30 shrink-0">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-slate-400">
                        <Truck className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Shipping Fee</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm font-black text-slate-300">৳</span>
                        <input 
                          type="number"
                          value={delivery}
                          onChange={(e) => setDelivery(Number(e.target.value))}
                          className="w-full pl-6 bg-transparent border-none focus:ring-0 text-xl font-black text-slate-900 p-0"
                        />
                      </div>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-2">
                      <div className="flex items-center gap-2 text-emerald-500">
                        <CreditCard className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Advance Paid</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm font-black text-emerald-300">৳</span>
                        <input 
                          type="number"
                          value={advance}
                          onChange={(e) => setAdvance(Number(e.target.value))}
                          className="w-full pl-6 bg-transparent border-none focus:ring-0 text-xl font-black text-emerald-600 p-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="md:w-64 bg-slate-900 rounded-3xl p-6 text-white shadow-xl shadow-slate-200">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] font-black uppercase tracking-widest">Subtotal</span>
                        <span className="text-sm font-bold tabular-nums">৳{calculateSubtotal().toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[10px] font-black uppercase tracking-widest">Delivery</span>
                        <span className="text-sm font-bold tabular-nums">+ ৳{delivery.toLocaleString()}</span>
                      </div>
                      <div className="h-px bg-slate-800" />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-400">Grand Total</span>
                        <span className="text-2xl font-black tabular-nums">৳{calculateTotal().toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="p-4 md:p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 shrink-0">
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="px-6 md:px-8 h-10 md:h-12 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl md:rounded-[20px] font-bold text-xs md:text-sm"
            >
              Discard Changes
            </Button>
            <Button 
              onClick={handleSave}
              className="px-6 md:px-10 h-10 md:h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl md:rounded-[20px] font-black shadow-xl shadow-slate-200 border-b-4 border-slate-950 active:border-b-0 active:translate-y-1 transition-all group text-xs md:text-sm"
            >
              Update Order Details
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
