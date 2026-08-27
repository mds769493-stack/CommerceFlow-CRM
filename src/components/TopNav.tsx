import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  ShoppingBag, 
  Package2, 
  Wallet, 
  Search, 
  Bell, 
  Settings, 
  Menu,
  User as UserIcon,
  LogOut,
  Sparkles,
  ChevronDown,
  Plus,
  Command,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import { TabType } from './Sidebar';

interface TopNavProps {
  activeTab?: TabType;
  setActiveTab?: (tab: TabType) => void;
  isSidebarCollapsed?: boolean;
  setIsSidebarCollapsed?: (collapsed: boolean) => void;
  setIsMobileSidebarOpen: (open: boolean) => void;
  user: any;
  onLogout: () => void;
}

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

export type AppTheme = 'light' | 'dark' | 'teal' | 'indigo';

export function TopNav({
  activeTab,
  setActiveTab,
  setIsMobileSidebarOpen,
  user,
  onLogout
}: TopNavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [theme, setTheme] = useState<AppTheme>('light');

  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { id: 'web-orders' as TabType, label: 'Web Order', path: '/web-orders', icon: Globe },
    { id: 'order-list' as TabType, label: 'Order List', path: '/order-list', icon: ShoppingBag },
    { id: 'products' as TabType, label: 'Products', path: '/products', icon: Package2 },
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
    return activeTab === item.id;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchValue.trim()) {
      navigate(`/order-list?q=${encodeURIComponent(searchValue.trim())}`);
    }
  };

  const [companyName, setCompanyName] = useState<string>('Company Name');

  React.useEffect(() => {
    const savedName = localStorage.getItem('commerceflow_company_name');
    if (savedName) setCompanyName(savedName);

    const savedTheme = localStorage.getItem('commerceflow_theme') as AppTheme;
    if (savedTheme) setTheme(savedTheme);

    const handleThemeChange = () => {
      const updated = localStorage.getItem('commerceflow_theme') as AppTheme;
      if (updated) setTheme(updated);
    };

    window.addEventListener('commerceflow_theme_change', handleThemeChange);
    return () => window.removeEventListener('commerceflow_theme_change', handleThemeChange);
  }, []);

  const topNavThemes = {
    light: {
      headerBg: "bg-white/95 border-b border-slate-200/80 backdrop-blur-xl text-slate-800 shadow-sm",
      menuBtn: "hover:bg-slate-100 text-slate-700 hover:text-slate-900",
      navBg: "bg-slate-100/90 border-slate-200/80",
      activeTab: "bg-slate-900 text-white shadow-sm border border-slate-800",
      inactiveTab: "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60",
      activeIcon: "text-blue-400",
      inactiveIcon: "text-slate-500",
      badgeDot: "bg-blue-400",
      searchBg: "bg-slate-100/90 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500",
      searchCmd: "bg-white border-slate-200 text-slate-500",
      iconBtn: "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
      divider: "bg-slate-200",
      userCapsule: "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200/80",
      userName: "text-slate-800",
      userAvatar: "bg-slate-900 text-white",
      popoverBg: "bg-white text-slate-900 border-slate-200/90 shadow-2xl",
      popoverCard: "bg-slate-50 border-slate-100 text-slate-800",
      popoverText: "text-slate-800",
      popoverSub: "text-slate-500",
      popoverBtn: "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
    },
    dark: {
      headerBg: "bg-[#1a1a1a]/95 border-b border-[#2e2e2e] backdrop-blur-xl text-white shadow-sm",
      menuBtn: "hover:bg-white/10 text-slate-300 hover:text-white",
      navBg: "bg-[#242424] border-[#333333]",
      activeTab: "bg-[#383838] text-white shadow-sm border border-white/15",
      inactiveTab: "text-slate-400 hover:text-white hover:bg-white/5",
      activeIcon: "text-emerald-400",
      inactiveIcon: "text-slate-400",
      badgeDot: "bg-emerald-400",
      searchBg: "bg-[#2A2A2A] hover:bg-[#303030] focus:bg-[#333333] border-[#3A3A3A] text-slate-200 placeholder-slate-400 focus:border-emerald-500/50",
      searchCmd: "bg-[#1A1A1A] border-[#383838] text-slate-400",
      iconBtn: "text-slate-300 hover:text-white hover:bg-white/10",
      divider: "bg-[#333333]",
      userCapsule: "bg-[#242424] border-[#383838] text-white hover:bg-white/10",
      userName: "text-white",
      userAvatar: "bg-emerald-600 text-white",
      popoverBg: "bg-[#222222] text-white border-[#383838] shadow-2xl",
      popoverCard: "bg-[#2A2A2A] border-[#383838] text-slate-200",
      popoverText: "text-white",
      popoverSub: "text-slate-400",
      popoverBtn: "text-slate-300 hover:text-white hover:bg-white/10"
    },
    teal: {
      headerBg: "bg-[#0d2826]/95 border-b border-teal-900/80 backdrop-blur-xl text-teal-50 shadow-sm",
      menuBtn: "hover:bg-white/10 text-teal-200 hover:text-white",
      navBg: "bg-[#123835] border-teal-800/60",
      activeTab: "bg-teal-600 text-white shadow-sm border border-teal-400/30",
      inactiveTab: "text-teal-200/70 hover:text-white hover:bg-white/10",
      activeIcon: "text-teal-300",
      inactiveIcon: "text-teal-300/70",
      badgeDot: "bg-teal-300",
      searchBg: "bg-[#123835] border-teal-800/60 text-teal-100 placeholder-teal-300/50 focus:border-teal-400/50",
      searchCmd: "bg-[#081a19] border-teal-900 text-teal-300/70",
      iconBtn: "text-teal-200 hover:text-white hover:bg-white/10",
      divider: "bg-teal-900/80",
      userCapsule: "bg-[#123835] border-teal-800/60 text-white hover:bg-white/10",
      userName: "text-white",
      userAvatar: "bg-teal-500 text-white",
      popoverBg: "bg-[#071918] text-white border-teal-800 shadow-2xl",
      popoverCard: "bg-[#123835] border-teal-800/60 text-teal-100",
      popoverText: "text-white",
      popoverSub: "text-teal-300/70",
      popoverBtn: "text-teal-200 hover:text-white hover:bg-white/10"
    },
    indigo: {
      headerBg: "bg-[#131B2E]/95 border-b border-slate-800 backdrop-blur-xl text-slate-100 shadow-sm",
      menuBtn: "hover:bg-white/10 text-slate-300 hover:text-white",
      navBg: "bg-[#1B2640] border-slate-700/60",
      activeTab: "bg-indigo-600 text-white shadow-sm border border-indigo-400/30",
      inactiveTab: "text-slate-300/70 hover:text-white hover:bg-white/10",
      activeIcon: "text-indigo-400",
      inactiveIcon: "text-slate-400",
      badgeDot: "bg-indigo-400",
      searchBg: "bg-[#1B2640] border-slate-700/60 text-slate-100 placeholder-slate-400 focus:border-indigo-400/50",
      searchCmd: "bg-[#0b101c] border-slate-800 text-slate-400",
      iconBtn: "text-slate-300 hover:text-white hover:bg-white/10",
      divider: "bg-slate-800",
      userCapsule: "bg-[#1B2640] border-slate-700/60 text-white hover:bg-white/10",
      userName: "text-white",
      userAvatar: "bg-indigo-600 text-white",
      popoverBg: "bg-[#0b101c] text-white border-slate-700 shadow-2xl",
      popoverCard: "bg-[#1B2640] border-slate-700/60 text-slate-200",
      popoverText: "text-white",
      popoverSub: "text-slate-400",
      popoverBtn: "text-slate-300 hover:text-white hover:bg-white/10"
    }
  };

  const currentTheme = topNavThemes[theme] || topNavThemes.light;

  return (
    <header className="sticky top-0 z-30 w-full shrink-0">
      <div className={cn(
        "w-full h-[60px] flex items-center justify-between px-4 sm:px-6 gap-2 transition-all",
        currentTheme.headerBg
      )}>
        
        {/* Left Section: Mobile Menu Trigger */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className={cn("lg:hidden p-2 rounded-xl transition-colors shrink-0 cursor-pointer", currentTheme.menuBtn)}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        {/* Center Section: Navigation Tabs */}
        <div className="flex-1 flex items-center justify-center px-1 sm:px-3 min-w-0">
          <nav className={cn(
            "flex items-center p-1 rounded-xl border space-x-1 shadow-inner overflow-x-auto no-scrollbar max-w-full",
            currentTheme.navBg
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
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 whitespace-nowrap relative cursor-pointer",
                    isActive 
                      ? currentTheme.activeTab 
                      : currentTheme.inactiveTab
                  )}
                >
                  <item.icon className={cn("h-3.5 w-3.5 shrink-0 transition-colors", isActive ? currentTheme.activeIcon : currentTheme.inactiveIcon)} />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.div 
                      layoutId="activeTabBadge" 
                      className={cn("absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full", currentTheme.badgeDot)}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Section: Search, Notifications & User Profile */}
        <div className="flex items-center gap-2 shrink-0">
          
          {/* Quick Search Input Form */}
          <form 
            onSubmit={handleSearchSubmit}
            className={cn(
              "relative hidden md:flex items-center transition-all duration-300",
              isSearchFocused ? "w-56" : "w-36 lg:w-44"
            )}
          >
            <Search className="absolute left-3 h-3.5 w-3.5 opacity-60 pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={cn(
                "w-full pl-8 pr-12 py-1.5 border rounded-xl text-xs font-medium transition-all outline-none",
                currentTheme.searchBg
              )}
            />
            <div className={cn("absolute right-2 px-1.5 py-0.5 border rounded text-[9px] font-bold pointer-events-none flex items-center gap-0.5", currentTheme.searchCmd)}>
              <Command className="w-2.5 h-2.5" />K
            </div>
          </form>

          {/* Notifications Button */}
          <div className="relative">
            <button 
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className={cn("relative p-2 rounded-xl transition-colors border cursor-pointer", currentTheme.iconBtn)}
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white font-extrabold text-[9px] rounded-full flex items-center justify-center ring-2 ring-black/20">
                13
              </span>
            </button>

            {/* Notifications Popover */}
            <AnimatePresence>
              {isNotificationsOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className={cn("absolute right-0 mt-2 w-72 rounded-2xl border z-50 p-3 space-y-3 shadow-2xl", currentTheme.popoverBg)}
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-black/10">
                      <span className={cn("text-xs font-bold", currentTheme.popoverText)}>Notifications</span>
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">Live System</span>
                    </div>
                    <div className="space-y-2">
                      <div className={cn("p-2.5 rounded-xl border text-xs space-y-1", currentTheme.popoverCard)}>
                        <p className={cn("font-bold", currentTheme.popoverText)}>Automatic Sync Ready</p>
                        <p className={cn("text-[11px]", currentTheme.popoverSub)}>Courier status and Firestore are synced smoothly.</p>
                      </div>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <div className={cn("h-5 w-px mx-0.5 hidden sm:block", currentTheme.divider)} />

          {/* User Profile Capsule */}
          <div className="relative">
            <button 
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className={cn("flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl border transition-all cursor-pointer shadow-sm", currentTheme.userCapsule)}
            >
              <div className={cn("w-6 h-6 rounded-lg overflow-hidden flex items-center justify-center font-extrabold text-[11px] shrink-0 shadow-sm border border-black/10", currentTheme.userAvatar)}>
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  user?.displayName?.[0] || user?.email?.[0] || 'A'
                )}
              </div>
              <span className={cn("hidden sm:inline-block text-xs font-bold max-w-[100px] truncate", currentTheme.userName)}>
                {user?.displayName || 'Adinoor'}
              </span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60 shrink-0" />
            </button>

            {/* Profile Dropdown */}
            <AnimatePresence>
              {isUserMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsUserMenuOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className={cn("absolute right-0 mt-2 w-60 border rounded-2xl z-50 p-2 space-y-1 shadow-2xl", currentTheme.popoverBg)}
                  >
                    <div className={cn("px-3 py-2.5 rounded-xl border mb-1", currentTheme.popoverCard)}>
                      <p className={cn("text-xs font-extrabold truncate", currentTheme.popoverText)}>{user?.displayName || 'User'}</p>
                      <p className={cn("text-[11px] truncate font-medium", currentTheme.popoverSub)}>{user?.email}</p>
                    </div>

                    <Link 
                      to="/dashboard"
                      onClick={() => {
                        if (setActiveTab) setActiveTab('dashboard');
                        setIsUserMenuOpen(false);
                      }}
                      className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold rounded-xl transition-colors cursor-pointer", currentTheme.popoverBtn)}
                    >
                      <DashboardIcon className="h-4 w-4 opacity-70" />
                      Dashboard
                    </Link>

                    <div className={cn("h-px my-1", currentTheme.divider)} />

                    <button 
                      onClick={onLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer group"
                    >
                      <LogOut className="h-4 w-4 text-rose-500 transition-transform group-hover:-translate-x-0.5" />
                      Sign Out
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

        </div>

      </div>
    </header>
  );
}

