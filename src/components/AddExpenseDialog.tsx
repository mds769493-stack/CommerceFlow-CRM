import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExpenseGroup, ExpenseCategory } from '../types';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AddExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  defaultDollarRate?: number;
  onAdd: (expense: { 
    description: string; 
    amount: number; 
    group: ExpenseGroup; 
    category: ExpenseCategory;
    date: string;
    usdAmount?: number;
    dollarRate?: number;
  }) => void;
}

const GROUPS: ExpenseGroup[] = ['Daily', 'Dollar', 'Monthly'];
const CATEGORIES: ExpenseCategory[] = ['Office', 'Ads', 'Others'];

export const AddExpenseDialog: React.FC<AddExpenseDialogProps> = ({ isOpen, onClose, onAdd, defaultDollarRate = 120 }) => {
  const [description, setDescription] = useState('');
  const [bdtAmount, setBdtAmount] = useState('');
  const [usdAmount, setUsdAmount] = useState('');
  const [dollarRate, setDollarRate] = useState(defaultDollarRate.toString());
  const [group, setGroup] = useState<ExpenseGroup>('Daily');
  const [category, setCategory] = useState<ExpenseCategory>('Others');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  // Sync dollar rate when default changes or group changes
  React.useEffect(() => {
    if (isOpen) {
      setDollarRate(defaultDollarRate.toString());
      if (group === 'Dollar') setCategory('Ads'); // Default Ads for Dollar expenses
    }
  }, [isOpen, defaultDollarRate, group]);

  const calculateBdt = (usd: string, rate: string) => {
    const u = parseFloat(usd);
    const r = parseFloat(rate);
    if (!isNaN(u) && !isNaN(r)) {
      setBdtAmount((u * r).toFixed(2));
    }
  };

  const calculateUsd = (bdt: string, rate: string) => {
    const b = parseFloat(bdt);
    const r = parseFloat(rate);
    if (!isNaN(b) && !isNaN(r) && r > 0) {
      setUsdAmount((b / r).toFixed(2));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // For Dollar group, description is not required. For others, it is.
    if (group !== 'Dollar' && !description) return;
    if (!bdtAmount) return;

    const amountVal = parseFloat(bdtAmount);
    const usdAmountVal = group === 'Dollar' ? parseFloat(usdAmount) : undefined;
    const dollarRateVal = group === 'Dollar' ? parseFloat(dollarRate) : undefined;

    if (isNaN(amountVal)) return;

    const expenseData: any = {
      description: group === 'Dollar' ? 'Dollar Expense' : description,
      amount: amountVal,
      group,
      category,
      date: group === 'Monthly' ? date.substring(0, 7) : date,
    };

    if (group === 'Dollar') {
      if (!isNaN(usdAmountVal as number)) expenseData.usdAmount = usdAmountVal;
      if (!isNaN(dollarRateVal as number)) expenseData.dollarRate = dollarRateVal;
    }

    onAdd(expenseData);

    setDescription('');
    setBdtAmount('');
    setUsdAmount('');
    setGroup('Daily');
    setCategory('Others');
    setDate(new Date().toISOString().split('T')[0]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">Add New Expense</h2>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expense Type</Label>
                  <select 
                    value={group} 
                    onChange={(e) => setGroup(e.target.value as ExpenseGroup)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  >
                    {GROUPS.map(g => <option key={g} value={g}>{g} Expenses</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select 
                    value={category} 
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">{group === 'Monthly' ? 'Month' : 'Date'}</Label>
                <Input
                  id="date"
                  type={group === 'Monthly' ? 'month' : 'date'}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="rounded-xl h-11"
                />
              </div>

              {group !== 'Dollar' && (
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    placeholder="e.g. Office Rent, Supplies"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    className="rounded-xl h-11"
                  />
                </div>
              )}

              {group === 'Dollar' ? (
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="usdAmount">Dollar Cost (USD)</Label>
                      <Input
                        id="usdAmount"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={usdAmount}
                        onChange={(e) => {
                          setUsdAmount(e.target.value);
                          calculateBdt(e.target.value, dollarRate);
                        }}
                        required
                        className="rounded-xl h-11 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dollarRate">Dollar Rate (BDT)</Label>
                      <Input
                        id="dollarRate"
                        type="number"
                        step="0.1"
                        value={dollarRate}
                        onChange={(e) => {
                          setDollarRate(e.target.value);
                          calculateBdt(usdAmount, e.target.value);
                        }}
                        required
                        className="rounded-xl h-11 bg-white"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="bdtAmount">Total BDT Amount</Label>
                    <Input
                      id="bdtAmount"
                      type="number"
                      step="0.01"
                      placeholder="Calculated automatically"
                      value={bdtAmount}
                      onChange={(e) => {
                        setBdtAmount(e.target.value);
                        calculateUsd(e.target.value, dollarRate);
                      }}
                      required
                      className="rounded-xl h-11 bg-white font-bold text-rose-600"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="bdtAmount">Amount (BDT)</Label>
                  <Input
                    id="bdtAmount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={bdtAmount}
                    onChange={(e) => setBdtAmount(e.target.value)}
                    required
                    className="rounded-xl h-11"
                  />
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-50">
                <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6 h-11">
                  Cancel
                </Button>
                <Button type="submit" className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-8 h-11 font-semibold">
                  Save Expense
                </Button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
