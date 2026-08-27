import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { AppLayout } from '../components/layout/AppLayout';
import { AuthScreen } from '../components/auth/AuthScreen';
import { DashboardPage } from '../pages/DashboardPage';
import { WebOrdersPageWrapper } from '../pages/WebOrdersPageWrapper';
import { WebOrderDetailPage } from '../pages/WebOrderDetailPage';
import { ProductsPage } from '../pages/ProductsPage';
import { FraudCheckerPageWrapper } from '../pages/FraudCheckerPageWrapper';
import { FollowUpsPage } from '../pages/FollowUpsPage';
import { ExpensesPage } from '../pages/ExpensesPage';
import { OrderListPage } from '../pages/OrderListPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { LayoutDashboard } from 'lucide-react';

function ProtectedLayout() {
  const { user, isAuthLoading } = useAppContext();

  if (isAuthLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <div className="relative">
          <div className="h-12 w-12 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <LayoutDashboard className="h-4 w-4 text-blue-600" />
          </div>
        </div>
        <div className="animate-pulse text-slate-400 font-bold text-xs uppercase tracking-widest">
          Loading application...
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <AppLayout />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<ProtectedLayout />}>
        {/* Default Index Route */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        
        {/* Core Pages */}
        <Route path="/dashboard" element={<DashboardPage />} />
        
        {/* Orders & Search Fallback Redirects */}
        <Route path="/orders" element={<Navigate to="/order-list" replace />} />
        <Route path="/search" element={<Navigate to="/order-list" replace />} />
        
        {/* Web Orders & Nested Sub-routes */}
        <Route path="/web-orders" element={<WebOrdersPageWrapper />} />
        <Route path="/web-orders/list" element={<WebOrdersPageWrapper />} />
        <Route path="/web-orders/new" element={<WebOrdersPageWrapper />} />
        <Route path="/web-orders/auto-pick" element={<WebOrdersPageWrapper />} />
        <Route path="/web-orders/auto-call" element={<WebOrdersPageWrapper />} />
        <Route path="/web-orders/block-list" element={<WebOrdersPageWrapper />} />
        <Route path="/web-order-list" element={<WebOrdersPageWrapper />} />
        <Route path="/web-order" element={<Navigate to="/web-orders" replace />} />
        <Route path="/web-order/:orderId" element={<WebOrderDetailPage />} />
        <Route path="/web-orders/:status" element={<WebOrdersPageWrapper />} />
        <Route path="/approved-orders" element={<WebOrdersPageWrapper />} />
        <Route path="/call-center" element={<WebOrdersPageWrapper />} />

        {/* Order List */}
        <Route path="/order-list" element={<OrderListPage />} />
        <Route path="/order-list-table" element={<Navigate to="/order-list" replace />} />
        <Route path="/order-list/:status" element={<OrderListPage />} />

        {/* Products & Inventory */}
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/inventory" element={<Navigate to="/products" replace />} />

        {/* Fraud Checker */}
        <Route path="/fraud-checker" element={<FraudCheckerPageWrapper />} />

        {/* Follow-ups & Inbox */}
        <Route path="/followups" element={<FollowUpsPage />} />
        <Route path="/tasks" element={<Navigate to="/followups" replace />} />
        <Route path="/work-inbox" element={<Navigate to="/followups" replace />} />
        <Route path="/messages" element={<Navigate to="/followups" replace />} />

        {/* Expenses & Purchase */}
        <Route path="/expenses" element={<ExpensesPage />} />
        <Route path="/purchase" element={<Navigate to="/expenses" replace />} />

        {/* 404 Fallback for any unknown route */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
export default AppRoutes;
