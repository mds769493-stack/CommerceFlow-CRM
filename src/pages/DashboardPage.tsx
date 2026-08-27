import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { FinancialDashboard } from '../components/FinancialDashboard';
import { Dashboard } from '../components/Dashboard';
import { Button } from '@/components/ui/button';
import { RefreshCw, LayoutDashboard, Wallet, BellDot, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export function DashboardPage() {
  const {
    allOrders,
    allExpenses,
    allCourierData,
    allProducts,
    settings,
    refreshAllData,
    isAllDataLoaded,
    bulkSync,
    isBulkSyncing,
    setIsBulkSyncing
  } = useAppContext();

  const [dashboardType, setDashboardType] = useState<'financial' | 'followups'>('financial');
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date()
  });
  const [activeRange, setActiveRange] = useState<string>('30d');

  const handleBulkSync = async () => {
    setIsBulkSyncing(true);
    await bulkSync();
    setIsBulkSyncing(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-blue-600" />
            Overview Dashboard
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Real-time sales, order analytics, financial summaries, and operations
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Switch between Financial Analytics and Operations/Follow-up Dashboard */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setDashboardType('financial')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                dashboardType === 'financial'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              Financial
            </button>
            <button
              onClick={() => setDashboardType('followups')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                dashboardType === 'followups'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <BellDot className="w-3.5 h-3.5" />
              Operations
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkSync}
            disabled={isBulkSyncing}
            className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${isBulkSyncing ? 'animate-spin' : ''}`} />
            Bulk Sync
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={refreshAllData}
            className="h-9 px-3 text-xs font-bold rounded-xl gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Dashboard Render */}
      <motion.div
        key={dashboardType}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {dashboardType === 'financial' ? (
          <FinancialDashboard
            orders={allOrders}
            products={allProducts}
            courierData={allCourierData}
            expenses={allExpenses}
            settings={settings}
            dateRange={dateRange}
            setDateRange={setDateRange}
            activeRange={activeRange}
            setActiveRange={setActiveRange}
          />
        ) : (
          <Dashboard
            orders={allOrders}
            expenses={allExpenses}
            courierData={allCourierData}
            products={allProducts}
            dateRange={dateRange}
            setDateRange={setDateRange}
            activeRange={activeRange}
            setActiveRange={setActiveRange}
          />
        )}
      </motion.div>
    </div>
  );
}
export default DashboardPage;
