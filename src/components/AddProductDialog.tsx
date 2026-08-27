import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Package } from 'lucide-react';
import { Product } from '../types';
import { cn } from '@/lib/utils';

interface AddProductDialogProps {
  onAdd: (product: Omit<Product, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function AddProductDialog({ onAdd }: AddProductDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    purchasePrice: '',
    saleAmount: '',
    image: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.code || !formData.name) return;

    setIsSubmitting(true);
    try {
      await onAdd({
        code: formData.code,
        name: formData.name,
        purchasePrice: Number(formData.purchasePrice) || 0,
        saleAmount: Number(formData.saleAmount) || 0,
        image: formData.image || undefined,
      });
      setFormData({ code: '', name: '', purchasePrice: '', saleAmount: '', image: '' });
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={true} render={
        <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-black hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer">
          <Plus className="h-3.5 w-3.5 text-white" />
          <span>Add Product</span>
        </button>
      } />
      <DialogContent className="sm:max-w-[450px] bg-white rounded-[2.5rem] border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] p-0 overflow-hidden outline-none fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-2xl font-bold text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
              <Package className="h-6 w-6" />
            </div>
            Add New Product
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="code" className="text-sm font-bold text-slate-700 ml-1">Product Code</Label>
              <Input
                id="code"
                placeholder="PROD-001"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all uppercase"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="name" className="text-sm font-bold text-slate-700 ml-1">Product Name</Label>
              <Input
                id="name"
                placeholder="Product Description"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="image" className="text-sm font-bold text-slate-700 ml-1">Product Image URL</Label>
              <Input
                id="image"
                placeholder="https://example.com/image.png"
                value={formData.image}
                onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                className="h-12 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="purchasePrice" className="text-sm font-bold text-slate-700 ml-1">Purchase Price</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">BDT</span>
                  <Input
                    id="purchasePrice"
                    type="number"
                    placeholder="0.00"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="h-12 pl-8 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="saleAmount" className="text-sm font-bold text-slate-700 ml-1">Sale Amount</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">BDT</span>
                  <Input
                    id="saleAmount"
                    type="number"
                    placeholder="0.00"
                    value={formData.saleAmount}
                    onChange={(e) => setFormData({ ...formData, saleAmount: e.target.value })}
                    className="h-12 pl-8 rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4 mt-6 border-t border-slate-100 flex gap-3">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)} 
              className="flex-1 rounded-xl h-12 font-bold border-slate-200 text-slate-500"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12 font-bold shadow-lg shadow-blue-100"
            >
              {isSubmitting ? 'Adding...' : 'Create Product'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
