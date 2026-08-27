import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Pagination } from './Pagination';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, TrendingDown, Banknote, Calendar, Clock, Loader2 } from 'lucide-react';
import { Expense, ExpenseGroup } from '../types';
import { cn } from '@/lib/utils';
import { safeDate } from '../lib/date-utils';
import { format } from 'date-fns';

interface ExpensesTableProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
  
  // Pagination & Server-side props
  currentPage: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  activeGroup: ExpenseGroup | 'all';
  onGroupChange: (group: ExpenseGroup | 'all') => void;
  isFetching: boolean;
}

export const ExpensesTable: React.FC<ExpensesTableProps> = ({ 
  expenses, 
  onDelete,
  currentPage,
  totalRecords,
  pageSize,
  onPageChange,
  onPageSizeChange,
  activeGroup,
  onGroupChange,
  isFetching
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const totalPages = Math.ceil(totalRecords / pageSize);

  const rowVirtualizer = useVirtualizer({
    count: expenses.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  if (!isFetching && expenses.length === 0 && totalRecords === 0) {
    return (
      <div className="space-y-6">
        <div className="flex justify-center p-1 bg-slate-100 rounded-xl w-fit mx-auto">
          {(['Daily', 'Dollar', 'Monthly'] as ExpenseGroup[]).map((g) => (
            <button
              key={g}
              onClick={() => onGroupChange(g)}
              className={cn(
                "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                activeGroup === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              {g === 'Daily' && <Clock className="w-4 h-4" />}
              {g === 'Dollar' && <Banknote className="w-4 h-4" />}
              {g === 'Monthly' && <Calendar className="w-4 h-4" />}
              {g}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 animate-pulse">
            <TrendingDown className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">No expenses found</h3>
          <p className="text-slate-500 mt-2 max-w-[260px] text-center text-sm leading-relaxed">
            Record your business costs to track your net profitability accurately.
          </p>
        </div>
      </div>
    );
  }

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex justify-center p-1 bg-slate-100 rounded-xl w-fit mx-auto">
        {(['Daily', 'Dollar', 'Monthly'] as ExpenseGroup[]).map((g) => (
          <button
            key={g}
            onClick={() => {
              onGroupChange(g);
              onPageChange(1);
            }}
            className={cn(
              "px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
              activeGroup === g ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {g === 'Daily' && <Clock className="w-4 h-4" />}
            {g === 'Dollar' && <Banknote className="w-4 h-4" />}
            {g === 'Monthly' && <Calendar className="w-4 h-4" />}
            {g}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden transition-all hover:shadow-md relative">
        <div ref={scrollContainerRef} className="custom-scrollbar scroll-smooth overflow-x-auto overflow-y-auto relative max-h-[600px]">
          <Table className="table-fixed border-separate border-spacing-0 w-full">
            <TableHeader className="sticky top-0 z-30 bg-white shadow-sm transition-shadow">
              <TableRow className="hover:bg-transparent border-b border-slate-100 flex w-full">
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 px-6 h-12 flex items-center grow-0 shrink-0 w-[160px] min-w-[160px] max-w-[160px] border-r border-slate-50">
                  {activeGroup === 'Monthly' ? 'Month Period' : 'Transaction Date'}
                </TableHead>
                {activeGroup !== 'Dollar' ? (
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 px-6 h-12 flex items-center grow shrink-0 min-w-[200px] border-r border-slate-50">Description Details</TableHead>
                ) : (
                  <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 px-6 h-12 flex items-center grow shrink-0 min-w-[200px] border-r border-slate-50">Operational Cost (USD)</TableHead>
                )}
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 px-6 h-12 flex items-center justify-end grow-0 shrink-0 w-[200px] min-w-[200px] max-w-[200px] border-r border-slate-50 text-right">Settlement Amount</TableHead>
                <TableHead className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400 px-6 h-12 flex items-center justify-end grow-0 shrink-0 w-[100px] min-w-[100px] max-w-[100px] sticky right-0 z-40 bg-white shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-100 px-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const expense = expenses[virtualRow.index];
                if (!expense) return null;
                
                return (
                  <TableRow 
                    key={virtualRow.key} 
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="group hover:bg-slate-50/50 transition-colors border-b border-slate-50 absolute w-full flex"
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <TableCell className="px-6 h-14 flex items-center grow-0 shrink-0 w-[160px] min-w-[160px] max-w-[160px] font-black text-slate-600 text-[11px] uppercase tracking-tighter border-r border-slate-50 tabular-nums">
                      <div className="flex items-center gap-2">
                         <Calendar className="w-3 h-3 opacity-30" />
                         {activeGroup === 'Monthly' 
                           ? (() => {
                               const d = safeDate(expense.date + (expense.date.length === 7 ? '-01' : ''));
                               return d ? format(d, 'MMM yyyy') : 'Invalid Date';
                             })()
                           : (() => {
                               const d = safeDate(expense.date);
                               return d ? format(d, 'dd MMM yy') : 'Invalid Date';
                             })()
                         }
                      </div>
                    </TableCell>
                    {activeGroup !== 'Dollar' ? (
                      <TableCell className="px-6 h-14 flex items-center grow shrink-0 min-w-[200px] border-r border-slate-50 overflow-hidden">
                        <div className="font-black text-slate-900 text-xs truncate w-full uppercase tracking-tight">{expense.description}</div>
                      </TableCell>
                    ) : (
                      <TableCell className="px-6 h-14 flex items-center grow shrink-0 min-w-[200px] border-r border-slate-50 overflow-hidden">
                        {expense.usdAmount && (
                          <div className="flex flex-col min-w-0">
                            <span className="font-black text-indigo-600 text-sm tracking-tighter truncate">${expense.usdAmount.toFixed(2)} USD</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Conversion: {expense.dollarRate} BDT</span>
                          </div>
                        )}
                      </TableCell>
                    )}
                    <TableCell className={cn(
                      "px-6 h-14 flex items-center justify-end grow-0 shrink-0 w-[200px] min-w-[200px] max-w-[200px] font-black tabular-nums border-r border-slate-50 text-right",
                      activeGroup === 'Dollar' ? "text-indigo-600" : "text-rose-600"
                    )}>
                      <div className="flex items-baseline gap-1">
                        <span className="text-base">{activeGroup === 'Dollar' ? '' : '-'}{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <span className="text-[9px] font-black uppercase opacity-40">BDT</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 h-14 flex items-center justify-end grow-0 shrink-0 w-[100px] min-w-[100px] max-w-[100px] sticky right-0 z-10 bg-white group-hover:bg-slate-50 transition-colors shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-100 px-4">
                      <button
                        onClick={() => onDelete(expense.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all rounded-xl opacity-0 group-hover:opacity-100 focus:opacity-100 active:scale-90"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {isFetching && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-50">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">Fetching Expenses...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalRecords={totalRecords}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </div>
  );
};
