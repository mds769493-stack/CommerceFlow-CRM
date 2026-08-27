import React, { useState } from 'react';
import { 
  Calendar, 
  ChevronDown, 
  Clock,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Check,
  CalendarDays,
  Filter,
  Download,
  ShoppingCart,
  DollarSign,
  LayoutGrid
} from 'lucide-react';
import { 
  format, 
  startOfToday, 
  endOfToday, 
  startOfYesterday, 
  endOfYesterday, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  subMonths, 
  startOfYear, 
  endOfYear, 
  subYears
} from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Order, Expense, CourierData, Product } from '../types';
import { Calendar as CustomCalendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DashboardProps {
  orders: Order[];
  expenses: Expense[];
  courierData: CourierData[];
  products: Product[];
  dateRange: { start: Date; end: Date };
  setDateRange: (range: { start: Date; end: Date }) => void;
  onStatusClick?: (status: string) => void;
  activeStatus?: string;
  activeRange?: string;
  setActiveRange?: (range: string) => void;
}

type QuickRange = 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'lastMonth' | 'year' | 'lastYear' | 'lifetime' | 'custom';

export const Dashboard: React.FC<DashboardProps> = ({ 
  orders, 
  expenses, 
  courierData, 
  products,
  dateRange,
  setDateRange,
  onStatusClick,
  activeRange: propActiveRange,
  setActiveRange: propSetActiveRange
}) => {
  const [filterOpen, setFilterOpen] = useState(false);
  const [localActiveRange, setLocalActiveRange] = useState<QuickRange>('30d');

  const activeRange = propActiveRange || localActiveRange;
  const setActiveRange = (range: QuickRange) => {
    if (propSetActiveRange) {
      propSetActiveRange(range);
    } else {
      setLocalActiveRange(range);
    }
  };

  const handleRangeSelect = (range: QuickRange) => {
    setActiveRange(range);
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        start = startOfToday();
        end = endOfToday();
        break;
      case 'yesterday':
        start = startOfYesterday();
        end = endOfYesterday();
        break;
      case '7d':
        start = subDays(new Date(), 7);
        break;
      case '30d':
        start = subDays(new Date(), 30);
        break;
      case 'month':
        start = startOfMonth(new Date());
        end = endOfMonth(new Date());
        break;
      case 'lastMonth':
        const lastMonth = subMonths(new Date(), 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'year':
        start = startOfYear(new Date());
        end = endOfYear(new Date());
        break;
      case 'lastYear':
        const lastYear = subYears(new Date(), 1);
        start = startOfYear(lastYear);
        end = endOfYear(lastYear);
        break;
      case 'lifetime':
        start = new Date(2020, 0, 1);
        break;
    }

    if (range !== 'custom') {
      setDateRange({ start, end });
      setFilterOpen(false);
    }
  };

  const getRangeLabel = () => {
    if (activeRange === 'custom') {
      return `${format(dateRange.start, 'MMM dd')} - ${format(dateRange.end, 'MMM dd')}`;
    }
    switch (activeRange) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case 'month': return 'This month';
      case 'lastMonth': return 'Last month';
      case 'year': return 'This year';
      case 'lastYear': return 'Last year';
      case 'lifetime': return 'Lifetime';
      case 'custom': return `${format(dateRange.start, 'MMM dd')} - ${format(dateRange.end, 'MMM dd')}`;
      default: return 'Last 30 days';
    }
  };

  const totalSales = orders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 bg-white p-6 rounded-xl border border-[#e1e3e5] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all shadow-sm group"
            >
              <Calendar className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition-transform" />
              <span>{getRangeLabel()}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${filterOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-3 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden ring-1 ring-slate-200"
                  >
                    <div className="p-3">
                      <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Select</div>
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { id: 'today', label: 'Today', icon: Clock },
                          { id: 'yesterday', label: 'Yesterday', icon: Clock },
                          { id: '7d', label: 'Last 7 days', icon: CalendarDays },
                          { id: '30d', label: 'Last 30 days', icon: CalendarDays },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleRangeSelect(item.id as QuickRange)}
                            className={`flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all ${
                              activeRange === item.id ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className={`w-4 h-4 ${activeRange === item.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                              <span>{item.label}</span>
                            </div>
                            {activeRange === item.id && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>

                      <div className="border-t border-slate-100 my-2" />
                      <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Extended Range</div>
                      <div className="grid grid-cols-1 gap-1">
                        {[
                          { id: 'month', label: 'This month', icon: Calendar },
                          { id: 'lastMonth', label: 'Last month', icon: Calendar },
                          { id: 'year', label: 'This year', icon: TrendingUp },
                          { id: 'lastYear', label: 'Last year', icon: TrendingUp },
                          { id: 'lifetime', label: 'Lifetime', icon: ArrowUpRight },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleRangeSelect(item.id as QuickRange)}
                            className={`flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all ${
                              activeRange === item.id ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className={`w-4 h-4 ${activeRange === item.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                              <span>{item.label}</span>
                            </div>
                            {activeRange === item.id && <Check className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                      
                      <div className="border-t border-slate-100 my-2" />
                      <Popover>
                        <PopoverTrigger
                          render={
                            <button
                              className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all ${
                                activeRange === 'custom' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Filter className={`w-4 h-4 ${activeRange === 'custom' ? 'text-indigo-600' : 'text-slate-400'}`} />
                                <span>Custom Range</span>
                              </div>
                              {activeRange === 'custom' && <Check className="w-4 h-4" />}
                            </button>
                          }
                        />
                        <PopoverContent className="w-auto p-0 z-[100]" align="end">
                          <CustomCalendar mode="range" selected={{ from: dateRange.start, to: dateRange.end }} onSelect={(range) => { 
                            if (range) {
                              const from = range.from;
                              const to = range.to;
                              setDateRange({
                                start: from || dateRange.start,
                                end: to || from || dateRange.end
                              });
                              if (from && to) {
                                setActiveRange('custom');
                                setFilterOpen(false);
                              }
                            }
                          }} />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <button className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 hover:shadow-indigo-200">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Basic Metrics for Preview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Sales" value={`৳${totalSales.toLocaleString()}`} icon={DollarSign} color="indigo" />
        <StatCard title="Total Orders" value={orders.length} icon={ShoppingCart} color="amber" />
        <StatCard title="Pending Orders" value={pendingOrders} icon={Clock} color="rose" />
        <StatCard title="Products" value={products.length} icon={LayoutGrid} color="emerald" />
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon }: any) => {
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</span>
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-600">
          <Icon className="w-4 h-4 text-slate-600" />
        </div>
      </div>
      <div>
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
      </div>
    </motion.div>
  );
};
