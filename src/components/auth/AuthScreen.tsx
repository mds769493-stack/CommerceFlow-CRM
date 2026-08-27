import React from 'react';
import { useAppContext } from '../../context/AppContext';
import { ShieldCheck, AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function AuthScreen() {
  const {
    authMode,
    setAuthMode,
    authUsername,
    setAuthUsername,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authError,
    setAuthError,
    authSubmitting,
    handleAuthSubmit
  } = useAppContext();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100/90 p-4 font-sans">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl border border-slate-200/80 shadow-2xl shadow-indigo-100/30 animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center space-y-3 mb-8">
          <div className="p-4 bg-blue-50 text-blue-600 rounded-3xl shadow-sm">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {authMode === 'login' ? 'অ্যাকাউন্টে লগইন করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
            </h2>
            <p className="text-xs text-slate-500">
              {authMode === 'login' 
                ? 'আপনার ইউজারনেম এবং পাসওয়ার্ড দিয়ে লগইন করুন' 
                : 'নতুন পাসওয়ার্ড ও ইউজারনেম দিয়ে অ্যাকাউন্ট খুলুন'}
            </p>
          </div>
        </div>

        {authError && (
          <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-100/80 text-rose-600 text-xs font-semibold flex items-center gap-2.5 animate-bounce">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <Label htmlFor="authUsername" className="text-xs font-black text-slate-700 uppercase tracking-wider">
              ইউজারনেম (Username)
            </Label>
            <Input
              id="authUsername"
              type="text"
              placeholder="md_shohag"
              value={authUsername}
              onChange={(e) => setAuthUsername(e.target.value)}
              className="h-11 rounded-xl border-slate-200 focus:ring-blue-500/20 text-xs font-bold"
              disabled={authSubmitting}
              required
              autoFocus
            />
          </div>

          {authMode === 'register' && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <Label htmlFor="authEmail" className="text-xs font-black text-slate-700 uppercase tracking-wider">
                ইমেইল ঠিকানা (Email - Optional)
              </Label>
              <Input
                id="authEmail"
                type="email"
                placeholder="shohag@gmail.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="h-11 rounded-xl border-slate-200 focus:ring-blue-500/20 text-xs"
                disabled={authSubmitting}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="authPassword" className="text-xs font-black text-slate-700 uppercase tracking-wider">
              পাসওয়ার্ড (Password)
            </Label>
            <Input
              id="authPassword"
              type="password"
              placeholder="••••••••"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="h-11 rounded-xl border-slate-200 focus:ring-blue-500/20 text-xs"
              disabled={authSubmitting}
              required
            />
          </div>

          <Button 
            type="submit" 
            size="lg" 
            className="w-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-100 rounded-xl h-11 text-xs font-black uppercase tracking-wider transition-all mt-6"
            disabled={authSubmitting}
          >
            {authSubmitting ? (
              <div className="flex items-center gap-1.5 justify-center">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>প্রসেসড হচ্ছে...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1.5">
                <LogIn className="h-3.5 w-3.5" />
                <span>{authMode === 'login' ? 'লগইন করুন' : 'সাইন আপ করুন'}</span>
              </div>
            )}
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'login' ? 'register' : 'login');
              setAuthError('');
            }}
            className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all cursor-pointer"
            disabled={authSubmitting}
          >
            {authMode === 'login' 
              ? 'নতুন অ্যাকাউন্ট প্রয়োজন? এখানে তৈরি করুন' 
              : 'ইতিমধ্যেই কি অ্যাকাউন্ট আছে? লগইন করুন'}
          </button>
        </div>
      </div>
    </div>
  );
}
export default AuthScreen;
