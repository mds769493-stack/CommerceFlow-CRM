import React from 'react';
import { useAppContext } from '../context/AppContext';
import { ExpensesTable } from '../components/ExpensesTable';
import { AddExpenseDialog } from '../components/AddExpenseDialog';
import { Button } from '@/components/ui/button';
import { Plus, DollarSign } from 'lucide-react';

export function ExpensesPage() {
  const {
    expenses,
    totalExpenses,
    isExpensesFetching,
    expensesPage,
    setExpensesPage,
    expensesPageSize,
    setExpensesPageSize,
    expensesGroup,
    setExpensesGroup,
    addExpense,
    updateDollarRate,
    deleteExpense,
    isAddExpenseOpen,
    setIsAddExpenseOpen,
    localDollarRate,
    setLocalDollarRate
  } = useAppContext();

  const handleSaveDollarRate = () => {
    const rate = parseFloat(localDollarRate);
    if (!isNaN(rate) && rate > 0) {
      updateDollarRate(rate);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            Expense & Purchase Tracker
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
              {totalExpenses.toLocaleString()} Records
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">Daily operations, monthly costs, marketing spend and USD rate configuration</p>
        </div>

        <div className="flex items-center gap-3">
          {/* USD Rate Input */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="text-xs font-bold text-slate-600">USD Rate:</span>
            <input
              type="number"
              value={localDollarRate}
              onChange={(e) => setLocalDollarRate(e.target.value)}
              onBlur={handleSaveDollarRate}
              className="w-16 px-1.5 py-0.5 text-xs font-bold text-slate-900 bg-white border border-slate-200 rounded-lg text-center outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-[11px] font-bold text-slate-400">৳</span>
          </div>

          <Button
            size="sm"
            onClick={() => setIsAddExpenseOpen(true)}
            className="h-9 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold gap-1.5 shadow-sm shadow-rose-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
        </div>
      </div>

      <ExpensesTable
        expenses={expenses}
        onDelete={deleteExpense}
        currentPage={expensesPage}
        totalRecords={totalExpenses}
        pageSize={expensesPageSize}
        onPageChange={setExpensesPage}
        onPageSizeChange={setExpensesPageSize}
        activeGroup={expensesGroup}
        onGroupChange={setExpensesGroup}
        isFetching={isExpensesFetching}
      />

      <AddExpenseDialog
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onAdd={addExpense}
        defaultDollarRate={parseFloat(localDollarRate) || 120}
      />
    </div>
  );
}
export default ExpensesPage;
