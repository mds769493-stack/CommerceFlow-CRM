import React, { useMemo, useState } from 'react';
import { Order, Product, CourierData, Expense, AppSettings, OrderStatus, ORDER_STATUS_COLORS } from '../types';
import { safeDate } from '../lib/date-utils';
import { 
  format, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  differenceInDays, 
  eachDayOfInterval,
  subMonths,
  subYears,
  getHours,
  eachHourOfInterval,
  isSameHour,
  startOfWeek
} from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Wallet, 
  Calendar as CalendarIcon, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock, 
  BarChart3, 
  PieChart as PieChartIcon, 
  Percent, 
  Truck, 
  FileText, 
  ChevronRight, 
  Download,
  Filter,
  Users,
  Search,
  Globe,
  Smartphone,
  Store,
  Share2,
  Zap,
  AlertCircle,
  MoreVertical,
  Activity,
  Check,
  CalendarDays,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend
} from 'recharts';

interface FinancialDashboardProps {
  orders: Order[];
  products: Product[];
  courierData: CourierData[];
  expenses: Expense[];
  settings: AppSettings | null;
  dateRange?: { start: Date; end: Date };
  setDateRange?: (range: { start: Date; end: Date }) => void;
  activeRange?: string;
  setActiveRange?: (range: string) => void;
}

const COLORS = {
  primary: '#0F766E', // Teal-700
  success: '#10B981', // Emerald-500
  warning: '#F59E0B', // Amber-500
  danger: '#EF4444', // Red-500
  info: '#3B82F6', // Blue-500
  slate: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  }
};

export function FinancialDashboard({ 
  orders, 
  products, 
  courierData, 
  expenses, 
  settings, 
  dateRange, 
  setDateRange,
  activeRange: propActiveRange,
  setActiveRange: propSetActiveRange
}: FinancialDashboardProps) {
  const [internalStartDate, setInternalStartDate] = useState<Date>(() => {
    const saved = localStorage.getItem('fin_dash_start');
    return saved ? new Date(saved) : subDays(new Date(), 30);
  });
  const [internalEndDate, setInternalEndDate] = useState<Date>(() => {
    const saved = localStorage.getItem('fin_dash_end');
    return saved ? new Date(saved) : new Date();
  });

  const startDate = dateRange?.start || internalStartDate;
  const endDate = dateRange?.end || internalEndDate;
  const setStartDate = (d: Date) => setDateRange ? setDateRange({ start: d, end: endDate }) : setInternalStartDate(d);
  const setEndDate = (d: Date) => setDateRange ? setDateRange({ start: startDate, end: d }) : setInternalEndDate(d);

  const [filterOpen, setFilterOpen] = useState(false);
  const [localActiveRange, setLocalActiveRange] = useState<string>('30d');

  const activeRange = propActiveRange || localActiveRange;
  const setActiveRange = propSetActiveRange || setLocalActiveRange;

  const handleRangeSelect = (range: string) => {
    setActiveRange(range);
    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (range) {
      case 'today':
        start = startOfDay(now);
        end = endOfDay(now);
        break;
      case 'yesterday':
        start = startOfDay(subDays(now, 1));
        end = endOfDay(subDays(now, 1));
        break;
      case '7d':
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
        break;
      case '30d':
        start = startOfDay(subDays(now, 29));
        end = endOfDay(now);
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'lastMonth':
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case 'year':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case 'lastYear':
        const lastYear = subYears(now, 1);
        start = startOfYear(lastYear);
        end = endOfYear(lastYear);
        break;
      case 'lifetime':
        start = new Date(2020, 0, 1);
        end = endOfDay(now);
        break;
    }

    if (range !== 'custom') {
      if (setDateRange) {
        setDateRange({ start, end });
      } else {
        setInternalStartDate(start);
        setInternalEndDate(end);
      }
      setFilterOpen(false);
    }
  };

  const getRangeLabel = () => {
    if (activeRange === 'custom') return `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')}`;
    const labels: Record<string, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      '7d': 'Last 7 days',
      '30d': 'Last 30 days',
      month: 'This month',
      lastMonth: 'Last month',
      year: 'This year',
      lastYear: 'Last year',
      lifetime: 'Lifetime',
      custom: `${format(startDate, 'MMM dd')} - ${format(endDate, 'MMM dd')}`
    };
    return labels[activeRange] || 'Last 30 days';
  };

  const [statusFilter, setStatusFilter] = useState<string>('All Status');

  // Lookup Maps
  const courierMap = useMemo(() => {
    const map = new Map<string, CourierData>();
    courierData.forEach(c => {
      const id = (c.merchantOrderId || "").toLowerCase().trim();
      if (id) map.set(id, c);
    });
    return map;
  }, [courierData]);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => {
      const code = (p.code || "").toLowerCase().trim();
      const name = (p.name || "").toLowerCase().trim();
      if (code) map.set(code, p);
      if (name) map.set(name, p);
    });
    return map;
  }, [products]);

  // Persistence
  React.useEffect(() => {
    localStorage.setItem('fin_dash_start', startDate.toISOString());
    localStorage.setItem('fin_dash_end', endDate.toISOString());
  }, [startDate, endDate]);

  const stats = useMemo(() => {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);
    const daysCount = differenceInDays(end, start) + 1;
    
    // Previous period
    const prevStart = subDays(start, daysCount);
    const prevEnd = subDays(end, daysCount);

    // Parse each order's date exactly once for maximum efficiency and speed
    const ordersWithDates = orders.map(o => {
      const date = safeDate(o.courier_date || o.created_at || o.createdAt);
      return { order: o, date };
    });

    const currentOrders: Order[] = [];
    const previousOrders: Order[] = [];
    const currentOrdersWithParsedDate: { order: Order; dateObj: Date; dayStr: string; hour: number }[] = [];

    ordersWithDates.forEach(({ order, date }) => {
      if (!date) return;
      if (isWithinInterval(date, { start, end })) {
        currentOrders.push(order);
        currentOrdersWithParsedDate.push({
          order,
          dateObj: date,
          dayStr: format(date, 'yyyy-MM-dd'),
          hour: getHours(date)
        });
      } else if (isWithinInterval(date, { start: prevStart, end: prevEnd })) {
        previousOrders.push(order);
      }
    });

    const calculateMetrics = (orderList: Order[]) => {
      let sales = 0;
      let cost = 0;
      let pendingAmount = 0;
      
      orderList.forEach(order => {
        const inv = (order.invoice || "").toLowerCase().trim();
        const courier = courierMap.get(inv);
        const orderSales = courier?.collectedAmount || order.total || 0;
        sales += orderSales;
        
        if (order.status === 'Pending') {
          pendingAmount += orderSales;
        }
        
        order.items?.forEach(item => {
          const itemName = (item.name || "").toLowerCase().trim();
          const prod = productMap.get(itemName);
          cost += (item.purchasePrice ?? prod?.purchasePrice ?? 0) * (item.qty || 0);
        });
      });
      return { sales, cost, count: orderList.length, aov: orderList.length > 0 ? sales / orderList.length : 0, pendingAmount };
    };

    const currentMetrics = calculateMetrics(currentOrders);
    const prevMetrics = calculateMetrics(previousOrders);

    const getTrend = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    // 1. Calculate monthly sums for Office Related costs to handle pro-rata correctly across any range
    const isOfficeRelated = (cat: string, group?: string) => {
        const c = (cat || "").toLowerCase().trim();
        const g = (group || "").toLowerCase().trim();
        return g === 'monthly' || c === 'office' || c === 'salary' || c === 'rent' || c === 'utilities' || c === 'office cost' || c === 'office expenses' || c === 'office cost ';
    };
    const isAds = (cat: string) => {
        const c = (cat || "").toLowerCase().trim();
        return c === 'ads' || c === 'marketing' || c === 'google ads' || c === 'facebook ads';
    };

    const monthlySums: Record<string, number> = {};
    const prevMonthlySums: Record<string, number> = {};

    expenses.forEach(e => {
        const d = safeDate(e.date || e.createdAt);
        if (!d) return;
        const category = (e.category || "").toLowerCase().trim();
        if (isOfficeRelated(category, e.group)) {
            const mKey = format(d, 'yyyy-MM');
            monthlySums[mKey] = (monthlySums[mKey] || 0) + (Number(e.amount) || 0);
        }
    });

    // 2. Calculate interval-based costs
    let adsCost = 0;
    let othersCost = 0;
    let prevAdsCost = 0;
    let prevOthersCost = 0;

    expenses.forEach(e => {
        const d = safeDate(e.date || e.createdAt);
        if (!d) return;
        const category = (e.category || "").toLowerCase().trim();
        const amount = Number(e.amount) || 0;

        if (isWithinInterval(d, { start, end })) {
            if (isAds(category)) {
                adsCost += amount;
            } else if (!isOfficeRelated(category, e.group)) {
                othersCost += amount;
            }
        } else if (isWithinInterval(d, { start: prevStart, end: prevEnd })) {
            if (isAds(category)) {
                prevAdsCost += amount;
            } else if (!isOfficeRelated(category, e.group)) {
                prevOthersCost += amount;
            }
        }
    });

    // 3. Apply Pro-rata for Office Cost based on the user's Excel-like formula:
    // Office Cost = Sum of (MonthlyTotalForDay / 30) for each day in range, capped at 30 days total
    let officeCost = 0;
    let prevOfficeCost = 0;

    const currentIntervalDays = eachDayOfInterval({ start, end });
    currentIntervalDays.forEach((date, index) => {
        if (index < 30) {
            const mKey = format(date, 'yyyy-MM');
            officeCost += (monthlySums[mKey] || 0) / 30;
        }
    });

    const prevIntervalDays = eachDayOfInterval({ start: prevStart, end: prevEnd });
    prevIntervalDays.forEach((date, index) => {
        if (index < 30) {
            const mKey = format(date, 'yyyy-MM');
            prevOfficeCost += (monthlySums[mKey] || 0) / 30;
        }
    });

    const totalExpenses = officeCost + adsCost + othersCost;
    const prevExpensesSum = prevOfficeCost + prevAdsCost + prevOthersCost;

    // Productivity / Conversion (Mock conversion since we don't have traffic data)
    // We'll base it on order volume as a proxy for the demo's visual density
    const conversionRate = 3.2 + (Math.random() * 0.8);
    const prevConversionRate = 3.0 + (Math.random() * 0.6);

    const grossProfit = currentMetrics.sales - currentMetrics.cost;
    const prevGrossProfit = prevMetrics.sales - prevMetrics.cost;
    const netProfit = grossProfit - totalExpenses;
    const prevNetProfit = prevGrossProfit - prevExpensesSum;

    // Top Products
    const productSales: Record<string, { name: string; qty: number; revenue: number; prevRevenue: number }> = {};
    currentOrders.forEach(o => {
      o.items?.forEach(item => {
        if (!item.name) return;
        if (!productSales[item.name]) productSales[item.name] = { name: item.name, qty: 0, revenue: 0, prevRevenue: 0 };
        productSales[item.name].qty += item.qty;
        const itemName = (item.name || "").toLowerCase().trim();
        const prod = productMap.get(itemName);
        productSales[item.name].revenue += (item.salePrice || prod?.saleAmount || 0) * item.qty;
      });
    });
    // Add prev period revenue for growth calculation (simplified)
    previousOrders.forEach(o => {
      o.items?.forEach(item => {
        if (item.name && productSales[item.name]) {
             const itemName = (item.name || "").toLowerCase().trim();
             const prod = productMap.get(itemName);
             productSales[item.name].prevRevenue += (item.salePrice || prod?.saleAmount || 0) * item.qty;
        }
      });
    });

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5)
      .map(p => ({
        ...p,
        growth: getTrend(p.revenue, p.prevRevenue)
      }));

    // Grouping for Daily Trend - O(N + D) complexity instead of O(N * D)
    const dailyOrdersMap: Record<string, { count: number; sales: number; expenses: number }> = {};
    currentOrdersWithParsedDate.forEach(item => {
      if (item.dayStr) {
        if (!dailyOrdersMap[item.dayStr]) {
          dailyOrdersMap[item.dayStr] = { count: 0, sales: 0, expenses: 0 };
        }
        dailyOrdersMap[item.dayStr].count += 1;
        dailyOrdersMap[item.dayStr].sales += item.order.total || 0;
      }
    });

    // Group other expenses (Ads, others, inventory) by day for the chart
    expenses.forEach(e => {
        const d = safeDate(e.date || e.createdAt);
        if (d && isWithinInterval(d, { start, end })) {
            const category = (e.category || "").toLowerCase().trim();
            // Exclude office related categories, they are added pro-rata per day
            if (isOfficeRelated(category, e.group)) return;
            
            const dayStr = format(d, 'yyyy-MM-dd');
            if (!dailyOrdersMap[dayStr]) {
                dailyOrdersMap[dayStr] = { count: 0, sales: 0, expenses: 0 };
            }
            dailyOrdersMap[dayStr].expenses += Number(e.amount) || 0;
        }
    });

    const dateRangeInterval = eachDayOfInterval({ start, end });
    const dailyTrend = dateRangeInterval.map((date, index) => {
      const dayStr = format(date, 'yyyy-MM-dd');
      const statsForDay = dailyOrdersMap[dayStr] || { count: 0, sales: 0, expenses: 0 };
      
      const mKey = format(date, 'yyyy-MM');
      const dailyOfficeCostShare = (monthlySums[mKey] || 0) / 30;
      
      // Add daily office cost share for up to 30 days total to respect the monthly cap
      const finalExpensesForDay = statsForDay.expenses + (index < 30 ? dailyOfficeCostShare : 0);
      
      return {
        date: format(date, 'MMM dd'),
        fullDate: date,
        orders: statsForDay.count,
        sales: statsForDay.sales,
        expenses: finalExpensesForDay,
        profit: statsForDay.sales - finalExpensesForDay
      };
    });

    // Weekly Trend
    const weeklyMap: Record<string, { weekLabel: string; orders: number; expenses: number }> = {};
    dailyTrend.forEach(day => {
        const weekStart = startOfWeek(day.fullDate);
        const weekKey = format(weekStart, 'yyyy-MM-dd');
        if (!weeklyMap[weekKey]) {
            weeklyMap[weekKey] = { 
                weekLabel: `Week of ${format(weekStart, 'MMM dd')}`, 
                orders: 0, 
                expenses: 0 
            };
        }
        weeklyMap[weekKey].orders += day.orders;
        weeklyMap[weekKey].expenses += day.expenses;
    });
    
    const weeklyTrend = Object.values(weeklyMap);

    // Grouping for Hourly Performance - O(N) complexity instead of O(N) nested for 24 hours
    const hourlyOrdersCounts = Array(24).fill(0);
    currentOrdersWithParsedDate.forEach(item => {
      if (item.hour !== null && item.hour >= 0 && item.hour < 24) {
        hourlyOrdersCounts[item.hour] += 1;
      }
    });

    const hourlyPerformance = Array.from({ length: 24 }).map((_, hour) => {
        const volume = hourlyOrdersCounts[hour];
        return {
            hour: `${hour}:00`,
            volume: volume,
            target: Math.floor(currentOrders.length / 24) + (Math.sin(hour / 4) * 5) // Mock comparative line
        };
    });

    // Source Distribution (Mocking based on ID)
    const sources = {
        Web: 0,
        'Mobile App': 0,
        Marketplace: 0,
        'Social Commerce': 0
    };
    currentOrders.forEach(o => {
        const hash = o.id.charCodeAt(0) % 4;
        if (hash === 0) sources.Web++;
        else if (hash === 1) sources['Mobile App']++;
        else if (hash === 2) sources.Marketplace++;
        else sources['Social Commerce']++;
    });

    const sourceData = Object.entries(sources).map(([name, value]) => ({ name, value }));

    // Status Distribution
    const statuses: Record<string, number> = {};
    currentOrders.forEach(o => {
        statuses[o.status] = (statuses[o.status] || 0) + 1;
    });
    const statusData = Object.entries(statuses).map(([name, value]) => ({ name, value }));

    // Sort recent activities securely without redundant date parsing inside the comparison function
    const sortedActivities = [...currentOrdersWithParsedDate]
      .sort((a, b) => (b.dateObj?.getTime() || 0) - (a.dateObj?.getTime() || 0))
      .slice(0, 10)
      .map(item => item.order);

    return {
      currentMetrics,
      prevMetrics,
      trends: {
        sales: getTrend(currentMetrics.sales, prevMetrics.sales),
        count: getTrend(currentMetrics.count, prevMetrics.count),
        aov: getTrend(currentMetrics.aov, prevMetrics.aov),
        profit: getTrend(netProfit, prevNetProfit),
        grossProfit: getTrend(grossProfit, prevGrossProfit),
        conversion: getTrend(conversionRate, prevConversionRate),
        cost: getTrend(currentMetrics.cost, prevMetrics.cost),
        office: getTrend(officeCost, prevOfficeCost),
        ads: getTrend(adsCost, prevAdsCost),
        others: getTrend(othersCost, prevOthersCost)
      },
      conversionRate,
      totalExpenses,
      officeCost,
      adsCost,
      othersCost,
      grossProfit,
      netProfit,
      loss: netProfit < 0 ? Math.abs(netProfit) : 0,
      dailyTrend,
      hourlyPerformance,
      sourceData,
      statusData,
      topProducts,
      weeklyTrend,
      recentActivity: sortedActivities
    };
  }, [orders, courierData, products, expenses, startDate, endDate]);

  const handlePreset = (preset: 'today' | 'yesterday' | '7d' | '30d' | 'month' | 'year') => {
    const now = new Date();
    if (preset === 'today') { setStartDate(startOfDay(now)); setEndDate(endOfDay(now)); }
    if (preset === 'yesterday') { setStartDate(startOfDay(subDays(now, 1))); setEndDate(endOfDay(subDays(now, 1))); }
    if (preset === '7d') { setStartDate(startOfDay(subDays(now, 6))); setEndDate(endOfDay(now)); }
    if (preset === '30d') { setStartDate(startOfDay(subDays(now, 29))); setEndDate(endOfDay(now)); }
    if (preset === 'month') { setStartDate(startOfMonth(now)); setEndDate(endOfMonth(now)); }
    if (preset === 'year') { setStartDate(startOfYear(now)); setEndDate(endOfYear(now)); }
  };

  const exportData = () => {
    alert("Exporting analytics report as CSV...");
  };

  const statusColorsList = ['#3B1F43', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#EC4899'];
  const sourceColorsList = ['#3B1F43', '#0F766E', '#D97706', '#2563EB', '#8B5CF6'];

  return (
    <div className="flex flex-col gap-6 pb-12 animate-in fade-in duration-500 font-sans text-slate-800">
      
      {/* Top Right Controls (Compact) */}
      <div className="flex items-center justify-end gap-2.5 mb-1">
        {/* Date Range Selector Dropdown */}
        <div className="relative">
          <button 
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200/90 hover:border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-xs group cursor-pointer"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-[#3B1F43] group-hover:scale-110 transition-transform" />
            <span>{getRangeLabel()}</span>
            <ChevronRight className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${filterOpen ? 'rotate-90' : ''}`} />
          </button>

          <AnimatePresence>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setFilterOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-72 bg-white border border-slate-200 rounded-2xl shadow-2xl z-20 overflow-hidden ring-1 ring-slate-200"
                >
                  <div className="p-3">
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Quick Select</div>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { id: 'today', label: 'Today', icon: Clock },
                        { id: 'yesterday', label: 'Yesterday', icon: Clock },
                        { id: '7d', label: 'Last 7 days', icon: CalendarDays },
                        { id: '30d', label: 'Last 30 days', icon: CalendarDays },
                      ].map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => handleRangeSelect(item.id)}
                          className={`flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all ${
                            activeRange === item.id ? 'bg-[#3B1F43]/10 text-[#3B1F43] font-bold' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className={`w-4 h-4 ${activeRange === item.id ? 'text-[#3B1F43]' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </div>
                          {activeRange === item.id && <Check className="w-4 h-4 text-[#3B1F43]" />}
                        </button>
                      ))}
                    </div>

                    <div className="border-t border-slate-100 my-2" />
                    <div className="px-3 py-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Extended Range</div>
                    <div className="grid grid-cols-1 gap-1">
                      {[
                        { id: 'month', label: 'This month', icon: CalendarIcon },
                        { id: 'lastMonth', label: 'Last month', icon: CalendarIcon },
                        { id: 'year', label: 'This year', icon: TrendingUp },
                        { id: 'lastYear', label: 'Last year', icon: TrendingUp },
                        { id: 'lifetime', label: 'Lifetime', icon: ArrowUpRight },
                      ].map((item: any) => (
                        <button
                          key={item.id}
                          onClick={() => handleRangeSelect(item.id)}
                          className={`flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all ${
                            activeRange === item.id ? 'bg-[#3B1F43]/10 text-[#3B1F43] font-bold' : 'text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className={`w-4 h-4 ${activeRange === item.id ? 'text-[#3B1F43]' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </div>
                          {activeRange === item.id && <Check className="w-4 h-4 text-[#3B1F43]" />}
                        </button>
                      ))}
                    </div>
                    
                    <div className="border-t border-slate-100 my-2" />
                    <Popover>
                      <PopoverTrigger
                        render={
                          <button
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded-xl transition-all ${
                              activeRange === 'custom' ? 'bg-[#3B1F43]/10 text-[#3B1F43] font-bold' : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Filter className={`w-4 h-4 ${activeRange === 'custom' ? 'text-[#3B1F43]' : 'text-slate-400'}`} />
                              <span>Custom Range</span>
                            </div>
                            {activeRange === 'custom' && <Check className="w-4 h-4 text-[#3B1F43]" />}
                          </button>
                        }
                      />
                      <PopoverContent className="w-auto p-0 z-[100]" align="end">
                        <Calendar mode="range" selected={{ from: startDate, to: endDate }} onSelect={(range) => { 
                          if (range) {
                            const from = range.from;
                            const to = range.to;
                            if (setDateRange) {
                              setDateRange({
                                start: from || startDate,
                                end: to || from || endDate
                              });
                            } else {
                              if (from) setInternalStartDate(from);
                              if (to) {
                                setInternalEndDate(to);
                              } else if (from) {
                                setInternalEndDate(from);
                              }
                            }
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

        <Button onClick={exportData} size="sm" className="h-8 bg-[#3B1F43] hover:bg-[#2A1530] text-white rounded-xl text-xs font-bold gap-1 px-3 shadow-xs transition-all active:scale-95 cursor-pointer">
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </div>

      {/* Primary KPI Overview Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
        <KpiCard 
          title="Total Sales" 
          value={`৳${stats.currentMetrics.sales.toLocaleString()}`} 
          trend={stats.trends.sales} 
          icon={<DollarSign className="h-4 w-4" />}
          color="primary"
        />
        <KpiCard 
          title="Product Purchase" 
          value={`৳${stats.currentMetrics.cost.toLocaleString()}`} 
          trend={stats.trends.cost} 
          icon={<Package className="h-4 w-4" />}
          color="info"
        />
        <KpiCard 
          title="Gross Profit" 
          value={`৳${stats.grossProfit.toLocaleString()}`} 
          trend={stats.trends.grossProfit} 
          icon={<TrendingUp className="h-4 w-4" />}
          color="success"
        />
        <KpiCard 
          title="Pending Amount" 
          value={`৳${stats.currentMetrics.pendingAmount.toLocaleString()}`} 
          trend={0} 
          icon={<Clock className="h-4 w-4" />}
          color="warning"
        />
        <KpiCard 
          title="Office Cost" 
          value={`৳${stats.officeCost.toLocaleString()}`} 
          trend={stats.trends.office} 
          icon={<Store className="h-4 w-4" />}
          color="slate"
        />
        <KpiCard 
          title="Ads Cost" 
          value={`৳${stats.adsCost.toLocaleString()}`} 
          trend={stats.trends.ads} 
          icon={<Globe className="h-4 w-4" />}
          color="info"
        />
        <KpiCard 
          title="Others Cost" 
          value={`৳${stats.othersCost.toLocaleString()}`} 
          trend={stats.trends.others} 
          icon={<MoreVertical className="h-4 w-4" />}
          color="slate"
        />
        <KpiCard 
          title="Net Profit" 
          value={`৳${Math.max(0, stats.netProfit).toLocaleString()}`} 
          trend={stats.trends.profit} 
          icon={<TrendingUp className="h-4 w-4" />}
          color={stats.netProfit > 0 ? "success" : "slate"}
        />
        {stats.loss > 0 && (
          <KpiCard 
            title="Net Loss" 
            value={`৳${stats.loss.toLocaleString()}`} 
            trend={0} 
            icon={<TrendingDown className="h-4 w-4" />}
            color="danger"
          />
        )}
      </section>

      {/* Order Trends Bar Chart */}
      <Card className="p-6" title="Order Trends">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.dailyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Bar 
                dataKey="orders" 
                fill="#3B1F43" 
                radius={[6, 6, 0, 0]} 
                barSize={32}
                animationDuration={1500}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Top Selling Products Table */}
      <Card className="p-6" title="Top Selling Products">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Product</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Sales</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Revenue</th>
                <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Growth</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {stats.topProducts.map((p, i) => (
                <tr key={i} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#3B1F43]/10 group-hover:text-[#3B1F43] transition-colors">
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">{p.name}</div>
                        <div className="text-[10px] font-medium text-slate-400">SKU: {p.name.slice(0, 3).toUpperCase()}-{100 + i}</div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 text-center">
                    <div className="text-sm font-bold text-slate-700">{p.qty}</div>
                    <div className="w-20 mx-auto bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                      <div 
                        className="bg-[#3B1F43] h-full rounded-full" 
                        style={{ width: `${(p.qty / (stats.topProducts[0]?.qty || 1)) * 100}%` }} 
                      />
                    </div>
                  </td>
                  <td className="py-4 text-right font-bold text-slate-900">৳{p.revenue.toLocaleString()}</td>
                  <td className="py-4 text-right">
                    <div className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold",
                      p.growth >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    )}>
                      {p.growth >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {Math.abs(p.growth || 0).toFixed(1)}%
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Floating Action / Support Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button 
          onClick={() => alert("Dashboard Assistance & Customization")}
          className="w-12 h-12 bg-[#3B1F43] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all group"
          title="Dashboard Assistance"
        >
          <Zap className="w-5 h-5 text-amber-300 group-hover:rotate-12 transition-transform" />
        </button>
      </div>
    </div>
  );
}

function KpiCard({ title, value, trend, icon }: { title: string; value: string | number; trend: number; icon: React.ReactNode; color?: keyof typeof COLORS }) {
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
          {React.cloneElement(icon as React.ReactElement, { className: "h-4 w-4 text-slate-600" })}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{value}</h3>
        {trend !== 0 && (
          <div className={cn(
            "flex items-center gap-1 text-[11px] font-bold mt-1",
            trend > 0 ? "text-emerald-600" : "text-rose-600"
          )}>
            {trend > 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            <span>{Math.abs(trend || 0).toFixed(1)}% vs last period</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}


function Card({ title, children, className, footer }: { title: string; children: React.ReactNode; className?: string; footer?: React.ReactNode }) {
  return (
    <div className={cn("bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden", className)}>
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">{title}</h3>
        <MoreVertical className="h-4 w-4 text-slate-300 hover:text-slate-500 cursor-pointer transition-colors" />
      </div>
      <div className="flex-1 p-6">
        {children}
      </div>
      {footer && (
        <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100">
          {footer}
        </div>
      )}
    </div>
  );
}


