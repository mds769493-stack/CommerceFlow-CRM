import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Product } from '../types';
import { Sparkles, Save, X, Edit2, RefreshCw, Trash2, HelpCircle, ArrowRight, DollarSign, Image as ImageIcon, Tag, Hash } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkEditProductsDialogProps {
  products: Product[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatesList: { id: string; updates: Partial<Product> }[]) => Promise<void>;
}

export function BulkEditProductsDialog({
  products,
  isOpen,
  onOpenChange,
  onSave,
}: BulkEditProductsDialogProps) {
  const [localItems, setLocalItems] = useState<Product[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Action form state
  const [actionField, setActionField] = useState<'purchasePrice' | 'saleAmount'>('saleAmount');
  const [actionType, setActionType] = useState<'set' | 'add' | 'subtract' | 'percent_add' | 'percent_subtract'>('set');
  const [actionValue, setActionValue] = useState<string>('');

  // Bulk Image state
  const [bulkImageUrl, setBulkImageUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      // Clone products to local state to allow safe edits
      setLocalItems(JSON.parse(JSON.stringify(products)));
      setBulkImageUrl('');
      setActionValue('');
    }
  }, [isOpen, products]);

  const handleFieldChange = (id: string, field: keyof Product, value: any) => {
    setLocalItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    setLocalItems(prev => prev.filter(item => item.id !== id));
  };

  const applyBulkAction = () => {
    const numericValue = parseFloat(actionValue);
    if (isNaN(numericValue)) return;

    setLocalItems(prev =>
      prev.map(item => {
        let currentValue = Number(item[actionField]) || 0;
        let newValue = currentValue;

        if (actionType === 'set') {
          newValue = numericValue;
        } else if (actionType === 'add') {
          newValue = currentValue + numericValue;
        } else if (actionType === 'subtract') {
          newValue = Math.max(0, currentValue - numericValue);
        } else if (actionType === 'percent_add') {
          newValue = currentValue + (currentValue * (numericValue / 100));
        } else if (actionType === 'percent_subtract') {
          newValue = Math.max(0, currentValue - (currentValue * (numericValue / 100)));
        }

        return {
          ...item,
          [actionField]: parseFloat(newValue.toFixed(2)),
        };
      })
    );

    setActionValue('');
  };

  const applyBulkImage = () => {
    if (!bulkImageUrl.trim()) return;
    setLocalItems(prev =>
      prev.map(item => ({
        ...item,
        image: bulkImageUrl.trim(),
      }))
    );
    setBulkImageUrl('');
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const updatesList = localItems.map(item => {
        const original = products.find(p => p.id === item.id);
        const updates: Partial<Product> = {};
        
        if (original) {
          if (item.name !== original.name) updates.name = item.name;
          if (item.code !== original.code) updates.code = item.code;
          if (item.purchasePrice !== original.purchasePrice) updates.purchasePrice = item.purchasePrice;
          if (item.saleAmount !== original.saleAmount) updates.saleAmount = item.saleAmount;
          if (item.image !== original.image) updates.image = item.image;
        }

        return { id: item.id, updates };
      }).filter(u => Object.keys(u.updates).length > 0);

      if (updatesList.length > 0) {
        await onSave(updatesList);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Error in bulk save:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white sm:rounded-[2.5rem] border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden w-full h-full sm:w-[95vw] sm:max-w-5xl sm:h-[90vh] sm:max-h-[850px] flex flex-col max-w-none rounded-none outline-none fixed sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 bg-slate-50/80 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <DialogTitle className="text-lg sm:text-xl font-extrabold text-slate-950 flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Sparkles className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-indigo-600 animate-pulse shrink-0" />
                <span>Bulk Edit Products</span>
                <span className="px-2 py-0.5 text-[10px] sm:text-xs bg-indigo-50 text-indigo-700 font-bold rounded-full border border-indigo-100">
                  {localItems.length} Products
                </span>
              </DialogTitle>
              <DialogDescription className="text-slate-500 text-[10px] sm:text-xs mt-0.5 font-medium uppercase tracking-wider truncate">
                Shopify-Style Spreadsheet & Automation
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="rounded-full hover:bg-slate-200 h-8 w-8 text-slate-400 hover:text-slate-600 shrink-0 ml-2"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body Split with Tabs */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-50/20">
          <Tabs defaultValue="grid" className="flex-1 flex flex-col min-h-0">
            <div className="px-4 sm:px-6 py-2 bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between shrink-0">
              <TabsList className="bg-slate-100 rounded-xl p-1 h-9 self-start">
                <TabsTrigger value="grid" className="rounded-lg text-xs font-bold px-3 sm:px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Spreadsheet Grid
                </TabsTrigger>
                <TabsTrigger value="actions" className="rounded-lg text-xs font-bold px-3 sm:px-4 py-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm">
                  Smart Adjustments
                </TabsTrigger>
              </TabsList>

              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden md:block">
                Double click or click any field to edit directly
              </p>
            </div>

            {/* Smart Adjustments Tab */}
            <TabsContent value="actions" className="p-4 sm:p-6 m-0 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                
                {/* Price Actions Card */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Bulk Price Adjustments</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-bold text-slate-600">Target Field</Label>
                      <Select value={actionField} onValueChange={(val: any) => setActionField(val)}>
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs">
                          <SelectValue placeholder="Select field" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="purchasePrice" className="text-xs font-semibold">Cost Price (৳)</SelectItem>
                          <SelectItem value="saleAmount" className="text-xs font-semibold">Sale Price (৳)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs font-bold text-slate-600">Adjustment Action</Label>
                      <Select value={actionType} onValueChange={(val: any) => setActionType(val)}>
                        <SelectTrigger className="h-10 rounded-xl border-slate-200 text-xs">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="set" className="text-xs font-semibold">Set Fixed Value (৳)</SelectItem>
                          <SelectItem value="add" className="text-xs font-semibold">Increase by Flat Amount (৳)</SelectItem>
                          <SelectItem value="subtract" className="text-xs font-semibold">Decrease by Flat Amount (৳)</SelectItem>
                          <SelectItem value="percent_add" className="text-xs font-semibold">Increase by Percentage (%)</SelectItem>
                          <SelectItem value="percent_subtract" className="text-xs font-semibold">Decrease by Percentage (%)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-1.5">
                      <Label className="text-xs font-bold text-slate-600">Value</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          placeholder="e.g. 10"
                          value={actionValue}
                          onChange={e => setActionValue(e.target.value)}
                          className="h-10 rounded-xl border-slate-200 focus:bg-white text-xs"
                        />
                        <Button 
                          onClick={applyBulkAction}
                          disabled={!actionValue}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4 text-xs font-bold shrink-0 shadow-lg shadow-indigo-100"
                        >
                          Apply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Media Actions Card */}
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                      <ImageIcon className="h-4 w-4" />
                    </div>
                    <h3 className="font-bold text-slate-800 text-sm">Bulk Image Assignment</h3>
                  </div>

                  <div className="space-y-3">
                    <div className="grid gap-1.5">
                      <Label className="text-xs font-bold text-slate-600">Common Product Image URL</Label>
                      <p className="text-[10px] text-slate-400">Apply a single image link for all selected products</p>
                      <div className="flex flex-col gap-2 mt-1">
                        <Input
                          placeholder="https://images.unsplash.com/photo-..."
                          value={bulkImageUrl}
                          onChange={e => setBulkImageUrl(e.target.value)}
                          className="h-10 rounded-xl border-slate-200 focus:bg-white text-xs"
                        />
                        <Button 
                          onClick={applyBulkImage}
                          disabled={!bulkImageUrl.trim()}
                          className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold py-2 w-full mt-1.5 h-10"
                        >
                          Apply Image to All
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Informational Box */}
              <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl flex items-start gap-3">
                <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-indigo-950">How adjustments work</p>
                  <p className="text-xs text-indigo-700 leading-relaxed font-medium">
                    Applying any action above instantly recalculates the values in the grid, but does not commit them to the database yet. You can inspect the updated list, make manual revisions, and finally click <strong>Save Changes</strong> below to push them live.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* Grid Spreadsheet Tab */}
            <TabsContent value="grid" className="flex-1 m-0 overflow-hidden flex flex-col min-h-0">
              <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar p-4 sm:p-6">
                
                {/* 1. Desktop View: Spreadsheet Table */}
                <div className="hidden md:block min-w-[900px]">
                  <table className="w-full border-separate border-spacing-y-1.5">
                    <thead>
                      <tr className="text-slate-400 text-[10px] uppercase font-bold tracking-widest text-left">
                        <th className="pb-2 pl-3 w-10">#</th>
                        <th className="pb-2 w-[150px]">Code</th>
                        <th className="pb-2 flex-1">Product Name</th>
                        <th className="pb-2 w-[140px] text-right">Cost Price (৳)</th>
                        <th className="pb-2 w-[140px] text-right">Sale Price (৳)</th>
                        <th className="pb-2 w-[200px]">Image URL</th>
                        <th className="pb-2 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {localItems.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="text-center py-12 text-slate-400 text-xs font-bold">
                            No products remaining in this bulk edit batch.
                          </td>
                        </tr>
                      ) : (
                        localItems.map((item, idx) => (
                          <tr key={item.id} className="bg-white hover:bg-slate-50 transition-colors border border-slate-100 rounded-xl overflow-hidden group shadow-sm">
                            {/* Counter */}
                            <td className="py-2.5 pl-3 text-slate-400 font-bold text-[10px] rounded-l-xl">
                              {idx + 1}
                            </td>

                            {/* Code / Sku */}
                            <td className="py-2.5 pr-2">
                              <div className="relative">
                                <Hash className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                  value={item.code}
                                  onChange={e => handleFieldChange(item.id, 'code', e.target.value)}
                                  className="h-9 rounded-xl border-slate-200/80 bg-slate-50/40 focus:bg-white text-[11px] font-mono font-bold uppercase pl-8"
                                />
                              </div>
                            </td>

                            {/* Name */}
                            <td className="py-2.5 pr-2">
                              <div className="relative">
                                <Tag className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input
                                  value={item.name}
                                  onChange={e => handleFieldChange(item.id, 'name', e.target.value)}
                                  className="h-9 rounded-xl border-slate-200/80 bg-slate-50/40 focus:bg-white text-xs font-semibold pl-8"
                                />
                              </div>
                            </td>

                            {/* Cost Price */}
                            <td className="py-2.5 pr-2">
                              <Input
                                type="number"
                                step="any"
                                value={item.purchasePrice}
                                onChange={e => handleFieldChange(item.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                                className="h-9 rounded-xl border-slate-200/80 bg-slate-50/40 focus:bg-white text-right font-bold text-xs tabular-nums text-slate-700"
                              />
                            </td>

                            {/* Sale Price */}
                            <td className="py-2.5 pr-2">
                              <Input
                                type="number"
                                step="any"
                                value={item.saleAmount}
                                onChange={e => handleFieldChange(item.id, 'saleAmount', parseFloat(e.target.value) || 0)}
                                className="h-9 rounded-xl border-slate-200/80 bg-slate-50/40 focus:bg-white text-right font-extrabold text-xs tabular-nums text-blue-700"
                              />
                            </td>

                            {/* Image URL */}
                            <td className="py-2.5 pr-2">
                              <div className="flex items-center gap-2">
                                {item.image && (
                                  <img
                                    src={item.image}
                                    alt="preview"
                                    className="h-7 w-7 rounded object-cover bg-slate-100 border border-slate-100 shrink-0"
                                    onError={e => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                )}
                                <Input
                                  value={item.image || ''}
                                  onChange={e => handleFieldChange(item.id, 'image', e.target.value)}
                                  className="h-9 rounded-xl border-slate-200/80 bg-slate-50/40 focus:bg-white text-[10px]"
                                  placeholder="Image Link"
                                />
                              </div>
                            </td>

                            {/* Delete/Remove button */}
                            <td className="py-2.5 pr-3 text-center rounded-r-xl">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveItem(item.id)}
                                className="h-8 w-8 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all shrink-0"
                                title="Remove from bulk session"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 2. Mobile View: Responsive Vertical Stack of Cards */}
                <div className="block md:hidden space-y-4">
                  {localItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs font-bold bg-white rounded-2xl border border-slate-100">
                      No products remaining in this bulk edit batch.
                    </div>
                  ) : (
                    localItems.map((item, idx) => (
                      <div key={item.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm space-y-3 relative">
                        {/* Header Row: item tracker and close button */}
                        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                            Product #{idx + 1}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(item.id)}
                            className="h-7 px-2 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0 text-xs font-semibold gap-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </Button>
                        </div>

                        {/* Image & Product Name */}
                        <div className="flex items-center gap-3">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt="preview"
                              className="h-10 w-10 rounded-lg object-cover bg-slate-50 border border-slate-200 shrink-0"
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Product Name</Label>
                            <Input
                              value={item.name}
                              onChange={e => handleFieldChange(item.id, 'name', e.target.value)}
                              className="h-8.5 rounded-lg border-slate-200/80 bg-slate-50/40 focus:bg-white text-xs font-semibold"
                            />
                          </div>
                        </div>

                        {/* Code/Sku and Image URL Fields */}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Code / SKU</Label>
                            <Input
                              value={item.code}
                              onChange={e => handleFieldChange(item.id, 'code', e.target.value)}
                              className="h-8.5 rounded-lg border-slate-200/80 bg-slate-50/40 focus:bg-white text-[11px] font-mono font-bold uppercase"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Image Link</Label>
                            <Input
                              value={item.image || ''}
                              onChange={e => handleFieldChange(item.id, 'image', e.target.value)}
                              className="h-8.5 rounded-lg border-slate-200/80 bg-slate-50/40 focus:bg-white text-[10px]"
                              placeholder="Image URL"
                            />
                          </div>
                        </div>

                        {/* Prices row */}
                        <div className="grid grid-cols-2 gap-3.5">
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Cost Price (৳)</Label>
                            <Input
                              type="number"
                              step="any"
                              value={item.purchasePrice}
                              onChange={e => handleFieldChange(item.id, 'purchasePrice', parseFloat(e.target.value) || 0)}
                              className="h-8.5 rounded-lg border-slate-200/80 bg-slate-50/40 focus:bg-white text-right font-bold text-xs tabular-nums text-slate-700"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[10px] font-bold text-slate-400 uppercase">Sale Price (৳)</Label>
                            <Input
                              type="number"
                              step="any"
                              value={item.saleAmount}
                              onChange={e => handleFieldChange(item.id, 'saleAmount', parseFloat(e.target.value) || 0)}
                              className="h-8.5 rounded-lg border-slate-200/80 bg-slate-50/40 focus:bg-white text-right font-extrabold text-xs tabular-nums text-blue-700"
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-between gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-slate-200 font-semibold text-xs h-10 px-5 w-full sm:w-auto"
          >
            Discard Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSubmitting || localItems.length === 0}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-6 text-xs font-extrabold h-10 gap-2 shadow-lg shadow-slate-200 flex items-center justify-center w-full sm:w-auto"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
