import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  Settings, 
  History, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Trash2, 
  Eye, 
  RefreshCw, 
  Phone, 
  Sparkles,
  Info,
  TrendingUp,
  TrendingDown,
  Layers,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { 
  checkFraud, 
  fetchFraudCheckHistory, 
  deleteFraudCheckHistoryItem 
} from '../../lib/fraudCheckerApi';
import { 
  OverallFraudReport, 
  FraudCheckHistoryItem, 
  RiskLevel 
} from '../../../server/types/fraudChecker';
import { RiskBadge } from './RiskBadge';
import { CourierResultCard } from './CourierResultCard';
import { FraudSettingsModal } from './FraudSettingsModal';
import { FraudHistoryModal } from './FraudHistoryModal';

export function FraudCheckerPage() {
  const [activeSubTab, setActiveSubTab] = useState<'check' | 'history'>('check');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentReport, setCurrentReport] = useState<OverallFraudReport | null>(null);

  // Settings Modal
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // History State
  const [historyList, setHistoryList] = useState<FraudCheckHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<FraudCheckHistoryItem | null>(null);
  const [historyFilterRisk, setHistoryFilterRisk] = useState<string>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');


  const loadHistory = async () => {
    setIsHistoryLoading(true);
    try {
      const data = await fetchFraudCheckHistory();
      setHistoryList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load history:', err);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleSearchSubmit = async (e?: React.FormEvent, phoneOverride?: string) => {
    if (e) e.preventDefault();
    const queryPhone = (phoneOverride || phoneNumber).trim();

    if (!queryPhone) {
      setError('গ্রাহকের মোবাইল নম্বর প্রবেশ করুন (যেমন: 017XXXXXXXX)');
      return;
    }

    setError(null);
    setIsLoading(true);
    setCurrentReport(null);

    try {
      const report = await checkFraud(queryPhone);
      setCurrentReport(report);
      loadHistory(); // refresh history in background
    } catch (err: any) {
      setError(err.message || 'ফ্রড চেক সম্পন্ন করা যায়নি। দয়া করে আবার চেষ্টা করুন।');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = async () => {
    if (!window.confirm('আপনি কি সমস্ত সার্চ হিস্ট্রি মুছে ফেলতে চান?')) return;
    try {
      await deleteFraudCheckHistoryItem('all');
      setHistoryList([]);
    } catch (err: any) {
      alert(err.message || 'হিস্ট্রি মুছা যায়নি');
    }
  };

  const handleDeleteHistorySingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteFraudCheckHistoryItem(id);
      setHistoryList(prev => prev.filter(item => item.id !== id && (item as any).internalId !== id));
    } catch (err: any) {
      alert(err.message || 'রেকর্ড মুছা যায়নি');
    }
  };

  // Filter history
  const filteredHistory = historyList.filter(item => {
    const matchesPhone = item.phone.toLowerCase().includes(historySearchQuery.toLowerCase());
    const matchesRisk = historyFilterRisk === 'all' || item.riskLevel === historyFilterRisk;
    return matchesPhone && matchesRisk;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-br from-emerald-600 to-teal-700 text-white rounded-xl shadow-md shadow-emerald-600/20 flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              Courier Fraud Checker
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live customer delivery history & return risk analysis across 5 courier networks
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Sub Tab Switch */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveSubTab('check')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'check'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Check Fraud</span>
            </button>
            <button
              onClick={() => {
                setActiveSubTab('history');
                loadHistory();
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeSubTab === 'history'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History</span>
              {historyList.length > 0 && (
                <span className="ml-0.5 px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-bold">
                  {historyList.length}
                </span>
              )}
            </button>
          </div>

          {/* Courier Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition"
          >
            <Settings className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeSubTab === 'check' ? (
        <div className="space-y-6">
          
          {/* Search Box Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                  Customer Mobile Number
                </label>
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      id="customer-mobile-input"
                      type="text"
                      placeholder="017XXXXXXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      disabled={isLoading}
                      className="w-full text-sm sm:text-base font-mono pl-10 pr-10 py-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition text-slate-900 dark:text-white"
                    />
                    {phoneNumber && (
                      <button
                        type="button"
                        onClick={() => setPhoneNumber('')}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    id="check-fraud-button"
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 transition disabled:opacity-60 cursor-pointer"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Checking courier records...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>🔍 Check Fraud</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Format Help */}
              <div className="flex items-center justify-end gap-1 pt-1 text-xs text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1 text-[11px]">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>Supports 017..., 88017..., +88017... formats</span>
                </div>
              </div>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-xl text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span className="font-medium">{error}</span>
              </div>
            )}
          </div>

          {/* Loading Skeleton */}
          {isLoading && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
              <div className="inline-flex p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-full text-emerald-600 dark:text-emerald-400 animate-spin">
                <Loader2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Querying 5 Bangladesh Courier Networks...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Contacting Steadfast, Pathao, RedX, Paperfly, and Carrybee APIs concurrently for customer parcel delivery histories.
              </p>
            </div>
          )}

          {/* Overall Results Display */}
          {currentReport && !isLoading && (
            <div className="space-y-6">
              
              {/* Main Overall Card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm overflow-hidden relative">
                
                {/* Background Accent glow based on risk */}
                <div 
                  className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-3xl opacity-15 pointer-events-none ${
                    currentReport.overall.riskLevel === 'LOW' 
                      ? 'bg-emerald-500' 
                      : currentReport.overall.riskLevel === 'MEDIUM' 
                      ? 'bg-amber-500' 
                      : currentReport.overall.riskLevel === 'HIGH' 
                      ? 'bg-rose-500' 
                      : 'bg-slate-400'
                  }`} 
                />

                {/* Card Top Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-mono text-lg font-black">
                      {currentReport.phone}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">
                          Customer Delivery Profile
                        </h2>
                        {currentReport.operator && (
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            • {currentReport.operator}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">
                        Evaluated {new Date(currentReport.timestamp).toLocaleTimeString()} across 5 courier services
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {currentReport.ourRecord && (
                      <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {currentReport.ourRecord.isNewCustomer ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold">🏪 Our Store: New Customer</span>
                        ) : (
                          <span>
                            🏪 Our Store: <strong>{currentReport.ourRecord.totalOrders} Orders</strong> ({currentReport.ourRecord.deliveredOrders} Del, {currentReport.ourRecord.cancelledOrders} Can{currentReport.ourRecord.webCancelCount > 0 ? `, ${currentReport.ourRecord.webCancelCount} Web Cancel` : ''})
                          </span>
                        )}
                      </div>
                    )}
                    <RiskBadge level={currentReport.overall.riskLevel} size="lg" />
                  </div>
                </div>

                {/* 4 Core Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 my-6">
                  
                  <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                      <Layers className="w-4 h-4 text-slate-400" />
                      <span>Total Parcels</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">
                      {currentReport.overall.total}
                    </p>
                    <span className="text-[11px] text-slate-400 font-normal">All couriers combined</span>
                  </div>

                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 p-4 rounded-xl border border-emerald-200/70 dark:border-emerald-900/40">
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Delivered (Success)</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      {currentReport.overall.delivered}
                    </p>
                    <span className="text-[11px] text-emerald-600/80 font-normal">
                      {currentReport.overall.total > 0 ? `${currentReport.overall.successRate}% Success` : 'No records'}
                    </span>
                  </div>

                  <div className="bg-rose-50/60 dark:bg-rose-950/20 p-4 rounded-xl border border-rose-200/70 dark:border-rose-900/40">
                    <div className="flex items-center gap-1.5 text-xs text-rose-700 dark:text-rose-400 font-semibold">
                      <XCircle className="w-4 h-4" />
                      <span>Cancelled / Return</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 mt-1">
                      {currentReport.overall.cancelled}
                    </p>
                    <span className="text-[11px] text-rose-600/80 font-normal">
                      {currentReport.overall.total > 0 ? `${currentReport.overall.cancelRate}% Return Rate` : 'No returns'}
                    </span>
                  </div>

                  <div className="bg-indigo-50/60 dark:bg-indigo-950/20 p-4 rounded-xl border border-indigo-200/70 dark:border-indigo-900/40">
                    <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-400 font-semibold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Delivery Rate</span>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                      {currentReport.overall.successRate}%
                    </p>
                    <span className="text-[11px] text-indigo-600/80 font-normal">
                      Risk: {currentReport.overall.riskLevel}
                    </span>
                  </div>

                </div>

                {/* Genuine Probability vs Fraud Probability Visualization */}
                <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <TrendingUp className="w-4 h-4" />
                      <span>Genuine Customer Probability: {currentReport.overall.genuineProbability}%</span>
                    </div>
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                      <TrendingDown className="w-4 h-4" />
                      <span>Return / Fraud Probability: {currentReport.overall.fraudProbability}%</span>
                    </div>
                  </div>

                  {/* Dual Bar */}
                  <div className="h-3.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden flex shadow-inner">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-700" 
                      style={{ width: `${currentReport.overall.total > 0 ? currentReport.overall.genuineProbability : 0}%` }}
                    />
                    <div 
                      className="bg-rose-500 h-full transition-all duration-700" 
                      style={{ width: `${currentReport.overall.total > 0 ? currentReport.overall.fraudProbability : 0}%` }}
                    />
                  </div>

                  {/* Contextual Recommendation */}
                  <div className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-2 pt-1">
                    <Sparkles className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <span>
                      {currentReport.overall.riskLevel === 'LOW' ? (
                        <strong>Safe Delivery: </strong>
                      ) : currentReport.overall.riskLevel === 'MEDIUM' ? (
                        <strong>Proceed with Caution: </strong>
                      ) : currentReport.overall.riskLevel === 'HIGH' ? (
                        <strong>High Risk Customer: </strong>
                      ) : (
                        <strong>New Customer: </strong>
                      )}
                      {currentReport.overall.riskLevel === 'LOW'
                        ? 'High success rate history. Order can be processed immediately.'
                        : currentReport.overall.riskLevel === 'MEDIUM'
                        ? 'Moderate cancellation history. We recommend confirming via phone call before dispatch.'
                        : currentReport.overall.riskLevel === 'HIGH'
                        ? 'High parcel return rate history. Take advance delivery charge or confirm strictly.'
                        : 'No prior courier history found for this phone number.'}
                    </span>
                  </div>
                </div>

              </div>

              {/* 5 Courier Breakdown Cards */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Courier Network Breakdown
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Detailed delivery and return statistics from individual couriers
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                  <CourierResultCard name="Steadfast" result={currentReport.couriers.steadfast} />
                  <CourierResultCard name="Pathao" result={currentReport.couriers.pathao} />
                  <CourierResultCard name="RedX" result={currentReport.couriers.redx} />
                  <CourierResultCard name="Paperfly" result={currentReport.couriers.paperfly} />
                  <CourierResultCard name="Carrybee" result={currentReport.couriers.carrybee} />
                </div>
              </div>

            </div>
          )}

        </div>
      ) : (
        /* History Sub-tab */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          
          {/* History Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              {/* Search in History */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search phone number..."
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {/* Risk Filter */}
              <select
                value={historyFilterRisk}
                onChange={(e) => setHistoryFilterRisk(e.target.value)}
                className="text-xs px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none"
              >
                <option value="all">All Risk Levels</option>
                <option value="LOW">Low Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="HIGH">High Risk</option>
                <option value="UNKNOWN">Unknown</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={loadHistory}
                disabled={isHistoryLoading}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-200 dark:border-slate-700"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
              {historyList.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg text-xs font-semibold flex items-center gap-1 border border-rose-200 dark:border-rose-900"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              )}
            </div>
          </div>

          {/* History Table */}
          {isHistoryLoading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600 mb-2" />
              <span className="text-xs">Loading search history...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <History className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium">No fraud check history found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3 px-3">Phone Number</th>
                    <th className="py-3 px-3">Risk Level</th>
                    <th className="py-3 px-3 text-center">Total</th>
                    <th className="py-3 px-3 text-center">Delivered</th>
                    <th className="py-3 px-3 text-center">Cancelled</th>
                    <th className="py-3 px-3 text-center">Success Rate</th>
                    <th className="py-3 px-3">Date & Time</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                  {filteredHistory.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedHistoryItem(item)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition"
                    >
                      <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                        {item.phone}
                        {item.operator && (
                          <span className="ml-1 text-[10px] text-slate-400 font-normal">
                            ({item.operator})
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <RiskBadge level={item.riskLevel} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-center font-bold">{item.total}</td>
                      <td className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                        {item.delivered}
                      </td>
                      <td className="py-3 px-3 text-center text-rose-600 dark:text-rose-400 font-bold">
                        {item.cancelled}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        <span className={item.successRate >= 80 ? 'text-emerald-600' : item.successRate >= 50 ? 'text-amber-600' : 'text-rose-600'}>
                          {item.successRate}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-400 text-[11px]">
                        {new Date(item.timestamp).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setSelectedHistoryItem(item)}
                            title="View Report Snapshot"
                            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setPhoneNumber(item.phone);
                              setActiveSubTab('check');
                              handleSearchSubmit(undefined, item.phone);
                            }}
                            title="Re-check Live"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteHistorySingle(item.id || (item as any).internalId, e)}
                            title="Delete Item"
                            className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Courier Settings Modal */}
      <FraudSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {
          // If we had a current report, re-check to reflect updated credentials
          if (phoneNumber) {
            handleSearchSubmit();
          }
        }}
      />

      {/* Search History Details Inspector Modal */}
      <FraudHistoryModal
        item={selectedHistoryItem}
        isOpen={!!selectedHistoryItem}
        onClose={() => setSelectedHistoryItem(null)}
        onRecheck={(phone) => {
          setPhoneNumber(phone);
          setActiveSubTab('check');
          handleSearchSubmit(undefined, phone);
        }}
      />

    </div>
  );
}
