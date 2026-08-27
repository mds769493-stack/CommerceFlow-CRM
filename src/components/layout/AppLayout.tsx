import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAppContext } from '../../context/AppContext';
import { Sidebar } from '../Sidebar';
import { TopNav, AppTheme } from '../TopNav';
import { AddEntryDialog } from '../AddEntryDialog';
import { 
  ShoppingBag, 
  Package2, 
  Wallet, 
  AlertTriangle,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'motion/react';

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

export function AppLayout() {
  const {
    user,
    handleLogout,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileSidebarOpen,
    setIsMobileSidebarOpen,
    allDataError,
    isAddFollowUpOpen,
    setIsAddFollowUpOpen,
    addFollowUp,
    followUps
  } = useAppContext();

  const location = useLocation();
  const [theme, setTheme] = useState<AppTheme>('light');

  useEffect(() => {
    const savedTheme = localStorage.getItem('commerceflow_theme') as AppTheme;
    if (savedTheme) setTheme(savedTheme);

    const handleThemeChange = () => {
      const updated = localStorage.getItem('commerceflow_theme') as AppTheme;
      if (updated) setTheme(updated);
    };

    window.addEventListener('commerceflow_theme_change', handleThemeChange);
    return () => window.removeEventListener('commerceflow_theme_change', handleThemeChange);
  }, []);

  const mobileNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: DashboardIcon },
    { label: 'Web Order', path: '/web-orders', icon: Globe },
    { label: 'Order List', path: '/order-list', icon: ShoppingBag },
    { label: 'Fraud', path: '/fraud-checker', icon: ShieldCheck },
    { label: 'Products', path: '/products', icon: Package2 },
    { label: 'Expenses', path: '/expenses', icon: Wallet },
  ];

  const isMobileItemActive = (path: string) => {
    const current = location.pathname.toLowerCase();
    if (path === '/dashboard') return current === '/' || current === '/dashboard';
    if (path === '/web-orders') return current.startsWith('/web-orders') || current.startsWith('/approved-orders') || current === '/call-center';
    if (path === '/order-list') return current.startsWith('/order-list') || current.startsWith('/orders') || current === '/search';
    if (path === '/fraud-checker') return current.startsWith('/fraud-checker');
    if (path === '/products') return current.startsWith('/products') || current.startsWith('/inventory');
    if (path === '/expenses') return current.startsWith('/expenses') || current.startsWith('/purchase');
    return current.startsWith(path);
  };

  const bgThemes = {
    light: "bg-slate-50 text-slate-900",
    dark: "bg-[#121212] text-slate-100",
    teal: "bg-[#081a19] text-teal-50",
    indigo: "bg-[#0b101c] text-slate-100"
  };

  return (
    <div className={cn("min-h-screen flex flex-col font-sans transition-colors duration-300", bgThemes[theme] || bgThemes.light)}>
      
      {/* Top Header Navigation */}
      <TopNav
        setIsMobileSidebarOpen={setIsMobileSidebarOpen}
        user={user}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Desktop Sidebar */}
        <div className="hidden lg:block p-3 pr-0 shrink-0">
          <Sidebar
            isCollapsed={isSidebarCollapsed}
            setIsCollapsed={setIsSidebarCollapsed}
            user={user}
            onLogout={handleLogout}
          />
        </div>

        {/* Mobile Slide-Out Sidebar Drawer */}
        <AnimatePresence>
          {isMobileSidebarOpen && (
            <div className="fixed inset-0 z-50 lg:hidden flex">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs"
                onClick={() => setIsMobileSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 280 }}
                className="relative z-10 w-[270px] h-full p-3 flex flex-col"
              >
                <Sidebar
                  isCollapsed={false}
                  user={user}
                  onLogout={handleLogout}
                  hideCollapseToggle={true}
                />
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Dynamic Route View Page */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-5 pb-20 lg:pb-6 w-full min-w-0">
          {allDataError && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Background sync notification: {allDataError}</span>
            </div>
          )}

          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 border-t border-slate-200/80 backdrop-blur-xl shadow-lg px-2 py-1.5 flex items-center justify-around">
        {mobileNavItems.map((item) => {
          const isActive = isMobileItemActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl text-[10px] font-bold transition-all",
                isActive
                  ? "text-blue-600 font-extrabold"
                  : "text-slate-500 hover:text-slate-900"
              )}
            >
              <item.icon className={cn("w-4 h-4", isActive ? "text-blue-600" : "text-slate-400")} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Global Add Entry Dialog */}
      <AddEntryDialog
        isOpen={isAddFollowUpOpen}
        onOpenChange={setIsAddFollowUpOpen}
        onAdd={addFollowUp}
        followUps={followUps}
        hideTrigger={true}
      />
    </div>
  );
}
export default AppLayout;
