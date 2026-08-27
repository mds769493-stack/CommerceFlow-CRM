import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Package2, 
  Wallet,
  LogOut,
  User as UserIcon,
  BellDot,
  Settings,
  Palette,
  Check,
  Upload,
  Camera,
  Trash2,
  Building2,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
  Volume2,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { WooSettingsModal } from './woocommerce/WooSettingsModal';
import { ShopifySettingsModal } from './shopify/ShopifySettingsModal';
import { WooSite, ShopifySite } from '../types';
import { fetchWooSites } from '../lib/woocommerceApi';
import { fetchShopifySites } from '../lib/shopifyApi';
import { playNewOrderChime } from '../lib/socket';

export type TabType = 'dashboard' | 'followups' | 'web-orders' | 'order-list' | 'products' | 'fraud-checker' | 'expenses';

interface SidebarProps {
  activeTab?: TabType;
  setActiveTab?: (tab: TabType) => void;
  isCollapsed?: boolean;
  setIsCollapsed?: (collapsed: boolean) => void;
  user: any;
  onLogout: () => void;
  hideCollapseToggle?: boolean;
}

// Original Dashboard SVG Icon
const DashboardIcon = ({ className }: { className?: string }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <rect x="2" y="2" width="20" height="9" rx="3" />
    <rect x="2" y="13" width="9" height="9" rx="3" />
    <rect x="13" y="13" width="9" height="9" rx="3" />
  </svg>
);

export type SidebarTheme = 'light' | 'dark' | 'teal' | 'indigo';

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  isCollapsed = false,
  setIsCollapsed,
  user,
  onLogout,
  hideCollapseToggle = false
}: SidebarProps) {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isWooSettingsOpen, setIsWooSettingsOpen] = useState(false);
  const [isShopifySettingsOpen, setIsShopifySettingsOpen] = useState(false);
  const [wooSites, setWooSites] = useState<WooSite[]>([]);
  const [shopifySites, setShopifySites] = useState<ShopifySite[]>([]);
  const [sidebarTheme, setSidebarTheme] = useState<SidebarTheme>('light');
  const [companyLogo, setCompanyLogo] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('Company Name');

  const loadStores = async () => {
    try {
      const [wooData, shopifyData] = await Promise.all([
        fetchWooSites().catch(() => []),
        fetchShopifySites().catch(() => [])
      ]);
      setWooSites(Array.isArray(wooData) ? wooData : []);
      setShopifySites(Array.isArray(shopifyData) ? shopifyData : []);
    } catch (e) {
      console.error('Failed to load sites in sidebar settings:', e);
    }
  };

  useEffect(() => {
    loadStores();
  }, []);

  const effectiveCollapsed = isCollapsed;
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load stored theme, logo and name on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('commerceflow_theme') as SidebarTheme;
    if (savedTheme) {
      setSidebarTheme(savedTheme);
    }
    const savedLogo = localStorage.getItem('commerceflow_company_logo');
    if (savedLogo) {
      setCompanyLogo(savedLogo);
    }
    const savedName = localStorage.getItem('commerceflow_company_name');
    if (savedName) {
      setCompanyName(savedName);
    }

    const handleThemeChange = () => {
      const updated = localStorage.getItem('commerceflow_theme') as SidebarTheme;
      if (updated) setSidebarTheme(updated);
    };

    window.addEventListener('commerceflow_theme_change', handleThemeChange);
    return () => window.removeEventListener('commerceflow_theme_change', handleThemeChange);
  }, []);

  const handleThemeSelect = (newTheme: SidebarTheme) => {
    setSidebarTheme(newTheme);
    localStorage.setItem('commerceflow_theme', newTheme);
    window.dispatchEvent(new Event('commerceflow_theme_change'));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('Image file size should be less than 3MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64Data = event.target?.result as string;
      if (base64Data) {
        setCompanyLogo(base64Data);
        localStorage.setItem('commerceflow_company_logo', base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setCompanyLogo('');
    localStorage.removeItem('commerceflow_company_logo');
  };

  const handleSaveName = (newName: string) => {
    setCompanyName(newName);
    localStorage.setItem('commerceflow_company_name', newName);
  };

  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { id: 'web-orders' as TabType, label: 'Web Order', path: '/web-orders', icon: Globe },
    { id: 'order-list' as TabType, label: 'Order List', path: '/order-list', icon: ShoppingBag },
    { id: 'products' as TabType, label: 'Products', path: '/products', icon: Package2 },
    { id: 'fraud-checker' as TabType, label: 'Fraud Checker', path: '/fraud-checker', icon: ShieldCheck },
    { id: 'followups' as TabType, label: 'Follow-Ups', path: '/followups', icon: BellDot },
    { id: 'expenses' as TabType, label: 'Expenses', path: '/expenses', icon: Wallet },
  ];

  const isItemActive = (item: typeof navItems[0]) => {
    const path = location.pathname.toLowerCase();
    if (item.id === 'dashboard') {
      return path === '/' || path === '/dashboard';
    }
    if (item.id === 'web-orders') {
      return path.startsWith('/web-orders') || path.startsWith('/approved-orders') || path === '/call-center';
    }
    if (item.id === 'order-list') {
      return path.startsWith('/order-list') || path.startsWith('/order-list-table') || path.startsWith('/orders') || path === '/search';
    }
    if (item.id === 'products') {
      return path.startsWith('/products') || path.startsWith('/inventory');
    }
    if (item.id === 'fraud-checker') {
      return path.startsWith('/fraud-checker');
    }
    if (item.id === 'followups') {
      return path.startsWith('/followups') || path.startsWith('/tasks') || path.startsWith('/work-inbox') || path.startsWith('/messages');
    }
    if (item.id === 'expenses') {
      return path.startsWith('/expenses') || path.startsWith('/purchase');
    }
    return activeTab === item.id;
  };

  // Dynamic Theme Styling configurations (Both TopBar and Sidebar match)
  const themeStyles = {
    light: {
      capsuleBg: "bg-white/95 border-slate-200/90 text-slate-800 shadow-xl shadow-slate-200/40 backdrop-blur-xl",
      logoBg: "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20",
      activeTab: "bg-slate-900 text-white shadow-md scale-[1.02]",
      inactiveTab: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
      divider: "bg-slate-200",
      tooltipBg: "bg-slate-900 text-white border-slate-800",
      activeDot: "bg-emerald-500"
    },
    dark: {
      capsuleBg: "bg-[#1a1a1a] border-[#2e2e2e] text-slate-100 shadow-xl shadow-black/30 backdrop-blur-xl",
      logoBg: "bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-md",
      activeTab: "bg-[#333333] text-white shadow-md border border-white/15 scale-[1.02]",
      inactiveTab: "text-slate-400 hover:text-white hover:bg-white/10",
      divider: "bg-[#2e2e2e]",
      tooltipBg: "bg-[#222222] text-white border-[#383838]",
      activeDot: "bg-emerald-400"
    },
    teal: {
      capsuleBg: "bg-[#0d2826] border-teal-900/80 text-teal-50 shadow-xl shadow-teal-950/40 backdrop-blur-xl",
      logoBg: "bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-md shadow-teal-500/30",
      activeTab: "bg-teal-600 text-white shadow-md border border-teal-400/30 scale-[1.02]",
      inactiveTab: "text-teal-200/70 hover:text-white hover:bg-white/10",
      divider: "bg-teal-900/60",
      tooltipBg: "bg-[#071918] text-white border-teal-800",
      activeDot: "bg-teal-300"
    },
    indigo: {
      capsuleBg: "bg-[#131B2E] border-slate-800 text-slate-100 shadow-xl shadow-slate-950/40 backdrop-blur-xl",
      logoBg: "bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-md",
      activeTab: "bg-indigo-600 text-white shadow-md border border-indigo-400/30 scale-[1.02]",
      inactiveTab: "text-slate-300/70 hover:text-white hover:bg-white/10",
      divider: "bg-slate-800",
      tooltipBg: "bg-[#0b101c] text-white border-slate-700",
      activeDot: "bg-indigo-400"
    }
  };

  const currentTheme = themeStyles[sidebarTheme] || themeStyles.light;

  return (
    <div 
      className={cn(
        "relative h-full transition-all duration-300 ease-in-out shrink-0",
        effectiveCollapsed ? "w-[64px]" : "w-[240px]"
      )}
    >
      {/* Hidden File Input for Logo Upload */}
      <input 
        type="file" 
        ref={fileInputRef}
        onChange={handleLogoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Floating Sidebar Capsule */}
      <aside 
        className={cn(
          "h-full w-full flex flex-col justify-between border backdrop-blur-xl select-none transition-all duration-300 ease-in-out shrink-0",
          effectiveCollapsed ? "py-3.5 px-2 rounded-xl items-center" : "p-3.5 rounded-xl items-start",
          currentTheme.capsuleBg
        )}
      >
        
        {/* Top Section: Custom Company Logo & Brand Container */}
        {effectiveCollapsed ? (
          <div className="flex flex-col items-center shrink-0 w-full gap-2">
            <div 
              onClick={() => fileInputRef.current?.click()}
              title="Click to upload Company Logo"
              className={cn(
                "w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all group relative overflow-hidden p-0.5",
                companyLogo ? "bg-white border-2 border-blue-500/40" : currentTheme.logoBg
              )}
            >
              {companyLogo ? (
                <img 
                  src={companyLogo} 
                  alt={companyName} 
                  className="w-full h-full object-cover rounded-xl"
                />
              ) : (
                <DashboardIcon className="h-5 w-5 text-white" />
              )}

              {/* Camera Overlay Badge on Hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl text-white">
                <Camera className="w-4 h-4" />
              </div>
              
              {/* Tooltip */}
              <div className={cn(
                "absolute left-14 px-3 py-1.5 text-xs font-bold rounded-xl shadow-2xl border opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap z-50 flex items-center gap-1.5",
                currentTheme.tooltipBg
              )}>
                <span>{companyName}</span>
                <span className="text-[10px] text-blue-400 font-normal">(Upload Logo)</span>
              </div>
            </div>

            {!hideCollapseToggle && setIsCollapsed && (
              <button
                type="button"
                onClick={() => setIsCollapsed(false)}
                title="Expand Sidebar"
                className={cn("p-1.5 rounded-xl transition-all cursor-pointer hover:bg-white/10", currentTheme.inactiveTab)}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between w-full pb-3 border-b border-slate-700/40 shrink-0">
            <div 
              onClick={() => fileInputRef.current?.click()}
              title="Click to change Company Logo"
              className="flex items-center gap-2.5 cursor-pointer group flex-1 min-w-0"
            >
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg shadow-md shrink-0 relative overflow-hidden p-0.5 transition-transform group-hover:scale-105",
                companyLogo ? "bg-white border border-blue-500/40" : currentTheme.logoBg
              )}>
                {companyLogo ? (
                  <img src={companyLogo} alt={companyName} className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <DashboardIcon className="h-5 w-5 text-white" />
                )}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl text-white">
                  <Camera className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-bold text-sm truncate leading-tight tracking-tight">{companyName}</span>
                <span className="text-[10px] text-blue-400/90 font-medium truncate">Click to upload logo</span>
              </div>
            </div>

            {!hideCollapseToggle && setIsCollapsed && (
              <button
                type="button"
                onClick={() => setIsCollapsed(true)}
                title="Collapse Sidebar"
                className={cn("p-1.5 rounded-xl transition-all shrink-0 ml-1 cursor-pointer hover:bg-white/10", currentTheme.inactiveTab)}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Middle Section: Nav Items */}
        <div className={cn(
          "flex-1 flex flex-col gap-1.5 my-3 overflow-y-auto no-scrollbar py-1 w-full",
          effectiveCollapsed ? "items-center" : "items-stretch"
        )}>
          {navItems.map((item) => {
            const isActive = isItemActive(item);
            
            return (
              <Link
                key={item.id}
                to={item.path}
                onClick={() => {
                  if (setActiveTab) setActiveTab(item.id);
                }}
                title={effectiveCollapsed ? item.label : undefined}
                className={cn(
                  "relative flex items-center transition-all duration-200 cursor-pointer group shrink-0 select-none",
                  effectiveCollapsed 
                    ? "w-11 h-11 rounded-2xl justify-center" 
                    : "w-full px-3.5 py-2.5 rounded-2xl justify-start gap-3 text-left",
                  isActive 
                    ? currentTheme.activeTab
                    : currentTheme.inactiveTab
                )}
              >
                <item.icon className={cn("shrink-0 transition-transform duration-200", effectiveCollapsed ? "h-5 w-5" : "h-4 w-4")} />

                {!effectiveCollapsed && (
                  <span className="font-semibold text-xs flex-1 truncate text-left">{item.label}</span>
                )}

                {!effectiveCollapsed && isActive && (
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", currentTheme.activeDot)} />
                )}

                {effectiveCollapsed && (
                  <div className={cn(
                    "absolute left-14 px-3 py-1.5 text-xs font-bold rounded-xl shadow-2xl border opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap z-50 flex items-center gap-2",
                    currentTheme.tooltipBg
                  )}>
                    <span>{item.label}</span>
                    {isActive && (
                      <span className={cn("w-1.5 h-1.5 rounded-full", currentTheme.activeDot)} />
                    )}
                  </div>
                )}
              </Link>
            );
          })}
        </div>

        {/* Bottom Section: Palette Theme Switcher, Settings & Logout */}
        <div className={cn(
          "flex flex-col gap-1.5 shrink-0 pt-1 w-full border-t border-slate-700/30",
          effectiveCollapsed ? "items-center" : "items-stretch"
        )}>
          {/* Color Palette Switcher */}
          <button
            onClick={() => {
              const themes: SidebarTheme[] = ['dark', 'light', 'teal', 'indigo'];
              const nextIndex = (themes.indexOf(sidebarTheme) + 1) % themes.length;
              setSidebarTheme(themes[nextIndex]);
            }}
            className={cn(
              "transition-all duration-200 cursor-pointer",
              effectiveCollapsed 
                ? "relative group w-11 h-11 rounded-2xl flex items-center justify-center " + currentTheme.inactiveTab
                : "w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium " + currentTheme.inactiveTab
            )}
          >
            <Palette className="h-4 w-4 shrink-0" />
            {!effectiveCollapsed && <span className="flex-1 truncate capitalize">Theme: {sidebarTheme}</span>}
            {effectiveCollapsed && (
              <div className={cn(
                "absolute left-14 px-3 py-1.5 text-xs font-bold rounded-xl shadow-2xl border opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap z-50 capitalize",
                currentTheme.tooltipBg
              )}>
                Color Theme: {sidebarTheme}
              </div>
            )}
          </button>

          {/* Settings & Logo Upload Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className={cn(
              "transition-all duration-200 cursor-pointer",
              effectiveCollapsed 
                ? "relative group w-11 h-11 rounded-2xl flex items-center justify-center " + currentTheme.inactiveTab
                : "w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium " + currentTheme.inactiveTab
            )}
          >
            <Settings className="h-4 w-4 shrink-0" />
            {!effectiveCollapsed && <span className="flex-1 truncate">Branding & Settings</span>}
            {effectiveCollapsed && (
              <div className={cn(
                "absolute left-14 px-3 py-1.5 text-xs font-bold rounded-xl shadow-2xl border opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap z-50",
                currentTheme.tooltipBg
              )}>
                Settings & Logo
              </div>
            )}
          </button>

          {/* Logout Button */}
          <button
            onClick={onLogout}
            className={cn(
              "transition-all duration-200 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 cursor-pointer",
              effectiveCollapsed 
                ? "relative group w-11 h-11 rounded-2xl flex items-center justify-center"
                : "w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!effectiveCollapsed && <span className="flex-1 truncate">Logout</span>}
            {effectiveCollapsed && (
              <div className={cn(
                "absolute left-14 px-3 py-1.5 text-xs font-bold rounded-xl shadow-2xl border opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-1 group-hover:translate-x-0 whitespace-nowrap z-50",
                currentTheme.tooltipBg
              )}>
                Logout
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* Settings & Logo Upload Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
              onClick={() => setIsSettingsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 z-50 space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Branding & Settings</h3>
                    <p className="text-xs text-slate-500">Company logo and system configuration</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors font-bold text-sm"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Company Logo Upload Section */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Company Logo
                  </label>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-300 bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-sm relative group">
                      {companyLogo ? (
                        <img src={companyLogo} alt="Logo" className="w-full h-full object-cover" />
                      ) : (
                        <DashboardIcon className="w-7 h-7 text-slate-400" />
                      )}
                    </div>

                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          {companyLogo ? 'Change Logo' : 'Upload Logo'}
                        </button>

                        {companyLogo && (
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Upload PNG, JPG or WebP (max 3MB). Appears at top of navigation bar.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Company Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Company / Store Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => handleSaveName(e.target.value)}
                    placeholder="Enter store name..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all"
                  />
                </div>

                {/* User Profile Info */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                    {user?.displayName?.[0] || user?.email?.[0] || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{user?.displayName || 'Logged User'}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>
                </div>

                {/* WooCommerce Integration Settings */}
                <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-blue-600 text-white rounded-xl shrink-0 shadow-xs">
                      <Globe className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">WooCommerce Store</p>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-800">
                          {wooSites.length} {wooSites.length === 1 ? 'Store' : 'Stores'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">REST API credentials, sync & auto-import</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsWooSettingsOpen(true)}
                    className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configure
                  </button>
                </div>

                {/* Shopify Integration Settings */}
                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-emerald-600 text-white rounded-xl shrink-0 shadow-xs">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-900">Shopify Store</p>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {shopifySites.length} {shopifySites.length === 1 ? 'Store' : 'Stores'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">Shopify Webhook & Admin API integration</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsShopifySettingsOpen(true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Configure
                  </button>
                </div>

                {/* Sound & Alert Chime */}
                <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shrink-0 shadow-xs">
                      <Volume2 className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">Order Audio Alert</p>
                      <p className="text-[11px] text-slate-500 truncate">Plays sound chime when new orders arrive</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => playNewOrderChime()}
                    className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    Test Sound
                  </button>
                </div>

                {/* Header & Sidebar Theme Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-600" />
                    TopBar & Sidebar Theme
                  </label>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {[
                      { id: 'light', label: 'Crisp White (Default)', color: 'bg-white border-slate-300 text-slate-800' },
                      { id: 'dark', label: 'Dark Charcoal', color: 'bg-[#1a1a1a] text-white' },
                      { id: 'teal', label: 'Deep Teal', color: 'bg-[#0d2826] text-white' },
                      { id: 'indigo', label: 'Royal Indigo', color: 'bg-[#131B2E] text-white' },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleThemeSelect(t.id as SidebarTheme)}
                        className={cn(
                          "flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                          sidebarTheme === t.id 
                            ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50 text-blue-900" 
                            : "border-slate-200 hover:bg-slate-50 text-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("w-3.5 h-3.5 rounded-full border border-black/10", t.color)} />
                          <span className="truncate">{t.label}</span>
                        </div>
                        {sidebarTheme === t.id && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Save & Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WooCommerce Store Settings Modal */}
      <WooSettingsModal
        isOpen={isWooSettingsOpen}
        onClose={() => setIsWooSettingsOpen(false)}
        sites={wooSites}
        onSitesUpdated={loadStores}
      />

      {/* Shopify Store Settings Modal */}
      <ShopifySettingsModal
        isOpen={isShopifySettingsOpen}
        onClose={() => setIsShopifySettingsOpen(false)}
        sites={shopifySites}
        onSitesUpdated={loadStores}
      />
    </div>
  );
}


