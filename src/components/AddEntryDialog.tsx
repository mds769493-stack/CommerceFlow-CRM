import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { FollowUp, Priority, Status, CallStatus, ALL_STATUSES, PRIORITY_COLORS, STATUS_COLORS, CALL_STATUS_COLORS, ALL_CALL_STATUSES } from '../types';
import { format } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface AddEntryDialogProps {
  onAdd: (data: Omit<FollowUp, 'internalId' | 'createdAt' | 'updatedAt'>) => void;
  followUps: FollowUp[];
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}

export function AddEntryDialog({ onAdd, followUps, isOpen, onOpenChange, hideTrigger }: AddEntryDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isOpen !== undefined ? isOpen : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const [formData, setFormData] = useState({
    orderId: '',
    consignmentId: '',
    phone: '',
    product: '',
    total: '',
    priority: '' as unknown as Priority,
    date: new Date(),
    status: '' as unknown as Status,
    call: '' as unknown as CallStatus,
    callCount: 0,
    isMarked: false,
    note: '',
    raiderCall: '' as unknown as CallStatus,
    raiderNote: '',
  });

  const orderIdL = (formData.orderId || "").toLowerCase();
  const consignmentIdL = (formData.consignmentId || "").toLowerCase();

  const isDuplicate = !!formData.orderId && followUps.some(f => (f.orderId || "").toLowerCase() === orderIdL);
  const isDuplicateConsignment = !!formData.consignmentId && followUps.some(f => (f.consignmentId || "").toLowerCase() === consignmentIdL);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.orderId && !formData.consignmentId) return;
    
    if (isDuplicate || isDuplicateConsignment) {
      alert(isDuplicate 
        ? `Error: Merchant ID "${formData.orderId}" ইতিমধ্যে বিদ্যমান। ডুপ্লিকেট এন্ট্রি করা যাবে না।`
        : `Error: Consignment ID "${formData.consignmentId}" ইতিমধ্যে বিদ্যমান। ডুপ্লিকেট এন্ট্রি করা যাবে না।`
      );
      return;
    }

    onAdd({
      ...formData,
      isMarked: false,
      total: Number(formData.total) || 0,
      date: formData.date.toISOString(),
      // Use blank if still blank on submit
      priority: formData.priority,
      status: formData.status,
      call: formData.call,
      raiderCall: formData.raiderCall,
    });

    setFormData({
      orderId: '',
      consignmentId: '',
      phone: '',
      product: '',
      total: '',
      priority: '' as unknown as Priority,
      date: new Date(),
      status: '' as unknown as Status,
      call: '' as unknown as CallStatus,
      callCount: 0,
      isMarked: false,
      note: '',
      raiderCall: '' as unknown as CallStatus,
      raiderNote: '',
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!hideTrigger && (
        <DialogTrigger nativeButton={true} render={<button className={cn(buttonVariants({ className: "h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-[0_4px_14px_rgba(37,99,235,0.25)] transition-all active:scale-95 rounded-[14px] text-[11px] font-bold uppercase tracking-widest px-6 border-none ring-offset-2 focus:ring-2 focus:ring-blue-500" }))} />}>
          <Plus className="mr-2 h-4 w-4" />
          Record
        </DialogTrigger>
      )}
      <DialogContent className="w-[95vw] sm:max-w-[500px] bg-white border-none shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] rounded-[2.5rem] p-0 overflow-hidden outline-none fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
        <DialogHeader className="px-5 py-4 bg-slate-50 border-b border-slate-100">
          <DialogTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-600" />
            New Entry
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="orderId" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Merchant ID</Label>
              <Input
                id="orderId"
                placeholder="ID..."
                value={formData.orderId}
                onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                className={cn(
                  "h-8 text-xs bg-slate-50/50 border-slate-200 focus:ring-blue-500 rounded-lg font-bold",
                  isDuplicate && "border-amber-400 bg-amber-50/30"
                )}
              />
              {isDuplicate && (
                <div className="flex items-center gap-1 text-amber-600 px-0.5">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  <span className="text-[8px] font-black uppercase">Duplicate</span>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="consignmentId" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Consignment</Label>
              <Input
                id="consignmentId"
                placeholder="PT..."
                value={formData.consignmentId}
                onChange={(e) => setFormData({ ...formData, consignmentId: e.target.value })}
                className="h-8 text-xs bg-slate-50/50 border-slate-200 focus:ring-blue-500 rounded-lg font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="phone" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Customer Mobile</Label>
            <Input
              id="phone"
              placeholder="01xxxxxxxxx"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="h-8 text-xs bg-slate-50/50 border-slate-200 focus:ring-blue-500 rounded-lg font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="product" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Product Name</Label>
              <Input
                id="product"
                placeholder="Product details"
                value={formData.product}
                onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                className="h-8 text-xs bg-slate-50/50 border-slate-200 rounded-lg font-bold"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="total" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Amount (৳)</Label>
              <Input
                id="total"
                type="number"
                placeholder="Amount"
                value={formData.total}
                onChange={(e) => setFormData({ ...formData, total: e.target.value })}
                className="h-8 text-xs bg-slate-50/50 border-slate-200 rounded-lg font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(v: Priority) => setFormData({ ...formData, priority: v })}
              >
                <SelectTrigger className={cn("h-8 bg-slate-50/50 border-slate-200 rounded-lg text-xs font-bold", formData.priority && PRIORITY_COLORS[formData.priority])}>
                  <SelectValue placeholder="Scale" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v: Status) => setFormData({ ...formData, status: v })}
              >
                <SelectTrigger className={cn("h-8 bg-slate-50/50 border-slate-200 rounded-lg text-xs font-bold", formData.status && (STATUS_COLORS[formData.status] || 'bg-slate-100 text-slate-700 border-slate-200'))}>
                  <SelectValue placeholder="Phase" />
                </SelectTrigger>
                <SelectContent>
                  {ALL_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-bold uppercase", (status && STATUS_COLORS[status]) || 'bg-slate-100 text-slate-700 border-slate-200')}>
                        {status}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Follow-up Date</Label>
              <Popover>
                <PopoverTrigger nativeButton={true} render={
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline", className: "h-8 w-full justify-start text-left bg-slate-50/50 border-slate-200 rounded-lg px-3" }))}
                  >
                    <CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-50" />
                    <span className="text-xs font-bold">{formData.date ? format(formData.date, "dd MMM yy") : "Pick"}</span>
                  </button>
                } />
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData({ ...formData, date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Call Count</Label>
              <Input
                id="callCount"
                type="number"
                min="0"
                value={formData.callCount}
                onChange={(e) => setFormData({ ...formData, callCount: parseInt(e.target.value) || 0 })}
                className="h-8 text-xs bg-slate-50/50 border-slate-200 rounded-lg font-bold"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="note" className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Record Note</Label>
            <Textarea
              id="note"
              placeholder="Provide context..."
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              className="bg-slate-50/50 border-slate-200 rounded-xl text-xs font-medium min-h-[80px] focus:ring-blue-500"
            />
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="h-9 px-4 rounded-lg text-xs font-bold text-slate-400">
              Discard
            </Button>
            <Button 
              type="submit" 
              disabled={isDuplicate || isDuplicateConsignment}
              className={cn(
                "h-9 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-100",
                (isDuplicate || isDuplicateConsignment) && "opacity-50 cursor-not-allowed bg-slate-400"
              )}
            >
              Save Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
