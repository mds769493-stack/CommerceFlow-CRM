import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ArrowLeft, AlertCircle, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 animate-in fade-in zoom-in-95 duration-300">
      <div className="relative mb-6">
        <div className="w-24 h-24 rounded-3xl bg-slate-100 border border-slate-200 flex items-center justify-center shadow-lg shadow-slate-200/50">
          <Compass className="w-12 h-12 text-slate-400 animate-spin-slow" />
        </div>
        <div className="absolute -top-2 -right-2 p-2 bg-rose-500 text-white rounded-xl shadow-md">
          <AlertCircle className="w-5 h-5" />
        </div>
      </div>

      <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-[11px] font-bold text-slate-600 uppercase tracking-widest mb-3">
        404 • Page Not Found
      </span>

      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-2">
        We couldn't find this page
      </h1>

      <p className="text-sm text-slate-500 max-w-md mx-auto mb-8 font-medium">
        The requested URL path does not exist or may have been moved. You can navigate back or return to the main dashboard.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="h-11 px-5 rounded-2xl border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold gap-2 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          Go Back
        </Button>

        <Link to="/dashboard">
          <Button
            className="h-11 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold gap-2 shadow-lg shadow-slate-900/10 cursor-pointer"
          >
            <LayoutDashboard className="w-4 h-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
export default NotFoundPage;
