import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Save, 
  CheckCircle2, 
  AlertTriangle, 
  Key, 
  Eye, 
  EyeOff, 
  Zap, 
  Loader2,
  Shield,
  HelpCircle
} from 'lucide-react';
import { 
  fetchFraudCheckerSettings, 
  saveFraudCheckerSettings, 
  testCourierConnection 
} from '../../lib/fraudCheckerApi';
import { FraudCheckerSettings } from '../../../server/types/fraudChecker';

interface FraudSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

type CourierKey = 'steadfast' | 'pathao' | 'redx' | 'paperfly' | 'carrybee';

export function FraudSettingsModal({ isOpen, onClose, onSaved }: FraudSettingsModalProps) {
  const [activeCourier, setActiveCourier] = useState<CourierKey>('steadfast');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [testStatus, setTestStatus] = useState<Record<string, { loading: boolean; success?: boolean; message?: string }>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const [settings, setSettings] = useState<FraudCheckerSettings>({
    steadfast: { enabled: true, apiKey: '', secretKey: '', email: '', password: '' },
    pathao: { enabled: true, clientId: '', clientSecret: '', email: '', password: '' },
    redx: { enabled: true, email: '', phone: '', password: '', apiKey: '' },
    paperfly: { enabled: true, username: '', password: '', apiKey: '' },
    carrybee: { enabled: true, email: '', phone: '', password: '', apiKey: '' }
  });

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await fetchFraudCheckerSettings();
      setSettings(data);
    } catch (err: any) {
      console.error('Failed to load fraud checker settings:', err);
      setErrorToast('সেটিংস লোড করা যায়নি।');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      setTestStatus({});
      setSuccessToast(null);
      setErrorToast(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleShowPassword = (fieldKey: string) => {
    setShowPassword(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleToggleEnabled = (courier: CourierKey) => {
    setSettings(prev => ({
      ...prev,
      [courier]: {
        ...prev[courier],
        enabled: !prev[courier].enabled
      }
    }));
  };

  const handleFieldChange = (courier: CourierKey, field: string, value: string) => {
    setSettings(prev => ({
      ...prev,
      [courier]: {
        ...prev[courier],
        [field]: value
      }
    }));
  };

  const handleTestConnection = async (courier: CourierKey) => {
    setTestStatus(prev => ({
      ...prev,
      [courier]: { loading: true }
    }));

    try {
      const courierConfig = settings[courier];
      const result = await testCourierConnection(courier, courierConfig);
      setTestStatus(prev => ({
        ...prev,
        [courier]: {
          loading: false,
          success: result.success,
          message: result.message
        }
      }));
    } catch (err: any) {
      setTestStatus(prev => ({
        ...prev,
        [courier]: {
          loading: false,
          success: false,
          message: err.message || 'Connection test failed'
        }
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessToast(null);
    setErrorToast(null);

    try {
      const res = await saveFraudCheckerSettings(settings);
      setSuccessToast('কুরিয়ার ফ্রড চেকার সেটিংস সফলভাবে সংরক্ষিত হয়েছে!');
      if (res.settings) {
        setSettings(res.settings);
      }
      if (onSaved) onSaved();
      setTimeout(() => {
        setSuccessToast(null);
      }, 3500);
    } catch (err: any) {
      setErrorToast(err.message || 'সেটিংস সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setIsSaving(false);
    }
  };

  const couriersList: { id: CourierKey; label: string; badge: string; color: string }[] = [
    { id: 'steadfast', label: 'Steadfast', badge: 'API / Login', color: 'emerald' },
    { id: 'pathao', label: 'Pathao', badge: 'Merchant Auth', color: 'rose' },
    { id: 'redx', label: 'RedX', badge: 'API / Login', color: 'red' },
    { id: 'paperfly', label: 'Paperfly', badge: 'Key / Basic', color: 'blue' },
    { id: 'carrybee', label: 'Carrybee', badge: 'Merchant Auth', color: 'amber' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 rounded-lg">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Courier Fraud Checker Settings
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure API keys and credentials for Steadfast, Pathao, RedX, Paperfly, and Carrybee
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast Notices */}
        {successToast && (
          <div className="mx-6 mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successToast}</span>
          </div>
        )}
        {errorToast && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorToast}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto flex flex-col md:flex-row">
          
          {/* Left Tab List */}
          <div className="w-full md:w-56 p-3 border-r border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 space-y-1">
            <span className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Supported Couriers
            </span>
            {couriersList.map(c => {
              const isActive = activeCourier === c.id;
              const isEnabled = settings[c.id]?.enabled !== false;
              const hasCreds = settings[c.id]?.hasCredentials;

              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCourier(c.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isEnabled ? (hasCreds ? 'bg-emerald-500' : 'bg-amber-400') : 'bg-slate-400'}`} />
                    <span>{c.label}</span>
                  </div>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-normal ${isActive ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Form Body */}
          <div className="flex-1 p-6">
            {isLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                <span className="text-xs">Loading courier configurations...</span>
              </div>
            ) : (
              <div>
                {/* Active Courier Title & Toggle */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
                      {activeCourier} Settings
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Enable or provide credentials to query customer delivery stats
                    </p>
                  </div>

                  {/* Enable Switch */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {settings[activeCourier]?.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings[activeCourier]?.enabled !== false}
                      onChange={() => handleToggleEnabled(activeCourier)}
                    />
                    <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-emerald-600"></div>
                  </label>
                </div>

                {/* Form Fields according to activeCourier */}
                {activeCourier === 'steadfast' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            API Key (Recommended)
                          </label>
                          {settings.steadfast?.apiKey && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('steadfast', 'apiKey', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="Steadfast API Key"
                          value={settings.steadfast?.apiKey || ''}
                          onChange={e => handleFieldChange('steadfast', 'apiKey', e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Secret Key
                          </label>
                          {settings.steadfast?.secretKey && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('steadfast', 'secretKey', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword['sf_secret'] ? 'text' : 'password'}
                            placeholder="Steadfast Secret Key"
                            value={settings.steadfast?.secretKey || ''}
                            onChange={e => handleFieldChange('steadfast', 'secretKey', e.target.value)}
                            className="w-full text-xs px-3 py-2 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword('sf_secret')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword['sf_secret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="relative my-3">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-white dark:bg-slate-900 px-2">
                        Or Login Credentials (Fallback)
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Steadfast Email
                          </label>
                          {settings.steadfast?.email && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('steadfast', 'email', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="email"
                          placeholder="merchant@example.com"
                          value={settings.steadfast?.email || ''}
                          onChange={e => handleFieldChange('steadfast', 'email', e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Steadfast Password
                          </label>
                          {settings.steadfast?.password && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('steadfast', 'password', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword['sf_pwd'] ? 'text' : 'password'}
                            placeholder="Password"
                            value={settings.steadfast?.password || ''}
                            onChange={e => handleFieldChange('steadfast', 'password', e.target.value)}
                            className="w-full text-xs px-3 py-2 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword('sf_pwd')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword['sf_pwd'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeCourier === 'pathao' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs text-slate-600 dark:text-slate-400">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Pathao Merchant / Developer Authentication
                      </p>
                      <p className="text-[11px] leading-relaxed">
                        Enter your Pathao merchant login (Email or Phone Number) and password. If you have generated API credentials from the Pathao Developer Portal, also provide your Client ID and Client Secret.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Pathao Email or Mobile Number
                          </label>
                          {settings.pathao?.email && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('pathao', 'email', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="merchant@pathao.com or 017xxxxxxxx"
                          value={settings.pathao?.email || ''}
                          onChange={e => handleFieldChange('pathao', 'email', e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Pathao Password
                          </label>
                          {settings.pathao?.password && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('pathao', 'password', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword['pt_pwd'] ? 'text' : 'password'}
                            placeholder="Pathao Account Password"
                            value={settings.pathao?.password || ''}
                            onChange={e => handleFieldChange('pathao', 'password', e.target.value)}
                            className="w-full text-xs px-3 py-2 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword('pt_pwd')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword['pt_pwd'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Client ID (Optional for Developer API)
                          </label>
                          {settings.pathao?.clientId && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('pathao', 'clientId', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. olej04vbjN"
                          value={settings.pathao?.clientId || ''}
                          onChange={e => handleFieldChange('pathao', 'clientId', e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Client Secret (Optional)
                          </label>
                          {settings.pathao?.clientSecret && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('pathao', 'clientSecret', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword['pt_secret'] ? 'text' : 'password'}
                            placeholder="Pathao Client Secret"
                            value={settings.pathao?.clientSecret || ''}
                            onChange={e => handleFieldChange('pathao', 'clientSecret', e.target.value)}
                            className="w-full text-xs px-3 py-2 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword('pt_secret')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword['pt_secret'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeCourier === 'redx' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-200/80 dark:border-red-800/50 text-xs text-slate-600 dark:text-slate-400">
                      <p className="font-bold text-red-900 dark:text-red-300 mb-1 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                        RedX সংযোগ নির্দেশিকা (Connection Guide)
                      </p>
                      <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                        RedX ফ্রড চেকার সক্রিয় করতে ২টি পদ্ধতির যেকোনো ১টি ব্যবহার করুন:
                      </p>
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                        <li><strong>পদ্ধতি ১ (সুপারিশকৃত):</strong> RedX মার্চেন্ট অ্যাকাউন্টের <strong>ফোন নম্বর ও পাসওয়ার্ড</strong> দিন। এতে স্বয়ংক্রিয়ভাবে লাইভ সেশন তৈরি হবে।</li>
                        <li><strong>পদ্ধতি ২:</strong> অথবা RedX মার্চেন্ট প্যানেল বা API থেকে <strong>Bearer Token</strong> কপি করে নিচে পেস্ট করুন।</li>
                      </ul>
                    </div>

                    {/* Stored Status Card */}
                    <div className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${settings.redx?.hasCredentials ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          সার্ভার স্ট্যাটাস: {settings.redx?.hasCredentials ? '✓ তথ্য ডাটাবেসে সেভ আছে' : '⚠️ কোনো ক্রেডেনশিয়াল সেভ নেই'}
                        </span>
                      </div>
                      {settings.redx?.apiKeyConfigured && (
                        <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono font-medium">
                          Token Saved {settings.redx.apiKeyLastChars ? `(ends in ...${settings.redx.apiKeyLastChars})` : ''}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            RedX Phone Number (পদ্ধতি ১)
                          </label>
                          {(settings.redx?.phone || settings.redx?.email) && (
                            <button
                              type="button"
                              onClick={() => {
                                handleFieldChange('redx', 'phone', '');
                                handleFieldChange('redx', 'email', '');
                              }}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <input
                          type="text"
                          placeholder="01XXXXXXXXX"
                          value={settings.redx?.phone || settings.redx?.email || ''}
                          onChange={e => {
                            const val = e.target.value;
                            if (val.includes('@')) {
                              handleFieldChange('redx', 'email', val);
                              handleFieldChange('redx', 'phone', '');
                            } else {
                              handleFieldChange('redx', 'phone', val);
                            }
                          }}
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            RedX Password (পদ্ধতি ১)
                          </label>
                          {settings.redx?.password && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('redx', 'password', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword['rx_pwd'] ? 'text' : 'password'}
                            placeholder="RedX Password"
                            value={settings.redx?.password || ''}
                            onChange={e => handleFieldChange('redx', 'password', e.target.value)}
                            className="w-full text-xs px-3 py-2 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword('rx_pwd')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword['rx_pwd'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-white dark:bg-slate-900 px-2">
                        অথবা API Bearer Token (পদ্ধতি ২)
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          RedX API Key / Bearer Token
                        </label>
                        {settings.redx?.apiKey && (
                          <button
                            type="button"
                            onClick={() => handleFieldChange('redx', 'apiKey', '')}
                            className="text-[10px] text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                          >
                            <span>Clear Token</span>
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword['rx_token'] ? 'text' : 'password'}
                          placeholder="Paste RedX Bearer Token here..."
                          value={settings.redx?.apiKey || ''}
                          onChange={e => handleFieldChange('redx', 'apiKey', e.target.value)}
                          className="w-full text-xs px-3 py-2.5 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-[11px]"
                        />
                        <button
                          type="button"
                          onClick={() => toggleShowPassword('rx_token')}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                          {showPassword['rx_token'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <div className="mt-1.5 flex flex-col gap-1 text-[11px]">
                        {settings.redx?.apiKey?.startsWith('••••') ? (
                          <div className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                            <span>✓ একটি টোকেন বর্তমানে অ্যাপ ডাটাবেসে সেভ আছে।</span>
                            <span className="text-slate-400 font-normal">নতুন টোকেন দিয়ে বদলাতে চাইলে ইনপুট বক্সে পেস্ট করুন বা Clear Token চাপুন।</span>
                          </div>
                        ) : settings.redx?.apiKey ? (
                          <div className="text-amber-600 dark:text-amber-400 font-medium">
                            ✏️ আপনি নতুন টোকেন টাইপ/পেস্ট করেছেন। সেভ করতে নিচে <strong>"Save Configuration"</strong> বাটনে ক্লিক করুন।
                          </div>
                        ) : (
                          <div className="text-slate-400">
                            টোকেন পেস্ট করার পর নিচে "Save Configuration" অথবা "Test Connection" চাপুন।
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {activeCourier === 'paperfly' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Paperfly Username
                        </label>
                        <input
                          type="text"
                          placeholder="Paperfly User / Merchant ID"
                          value={settings.paperfly?.username || ''}
                          onChange={e => handleFieldChange('paperfly', 'username', e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Paperfly Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword['pf_pwd'] ? 'text' : 'password'}
                            placeholder="Password"
                            value={settings.paperfly?.password || ''}
                            onChange={e => handleFieldChange('paperfly', 'password', e.target.value)}
                            className="w-full text-xs px-3 py-2 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword('pf_pwd')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword['pf_pwd'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Paperfly Key (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="paperflykey"
                        value={settings.paperfly?.apiKey || ''}
                        onChange={e => handleFieldChange('paperfly', 'apiKey', e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}

                {activeCourier === 'carrybee' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg text-xs text-amber-900 dark:text-amber-200">
                      <p className="font-semibold mb-1">Carrybee মার্চেন্ট সেটিংস:</p>
                      <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90">
                        আপনার <strong>merchant.carrybee.com</strong> অ্যাকাউন্টের <strong>Phone</strong> ও <strong>Password</strong> প্রদান করুন অথবা <strong>Bearer Token</strong> পেস্ট করুন।
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          Carrybee Phone (পদ্ধতি ১)
                        </label>
                        <input
                          type="text"
                          placeholder="017XXXXXXXX"
                          value={settings.carrybee?.phone || ''}
                          onChange={e => handleFieldChange('carrybee', 'phone', e.target.value)}
                          className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Carrybee Password
                          </label>
                          {settings.carrybee?.password && (
                            <button
                              type="button"
                              onClick={() => handleFieldChange('carrybee', 'password', '')}
                              className="text-[10px] text-slate-400 hover:text-rose-500 font-medium"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type={showPassword['cb_pwd'] ? 'text' : 'password'}
                            placeholder="Carrybee Password"
                            value={settings.carrybee?.password || ''}
                            onChange={e => handleFieldChange('carrybee', 'password', e.target.value)}
                            className="w-full text-xs px-3 py-2 pr-9 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => toggleShowPassword('cb_pwd')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                          >
                            {showPassword['cb_pwd'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200 dark:border-slate-800"></div></div>
                      <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-white dark:bg-slate-900 px-2">
                        অথবা API Bearer Token (পদ্ধতি ২)
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Carrybee Bearer Token / API Key
                        </label>
                        {settings.carrybee?.apiKey && (
                          <button
                            type="button"
                            onClick={() => handleFieldChange('carrybee', 'apiKey', '')}
                            className="text-[10px] text-rose-500 hover:text-rose-600 font-semibold flex items-center gap-1"
                          >
                            <span>Clear Token</span>
                          </button>
                        )}
                      </div>
                      <input
                        type={showPassword['cb_token'] ? 'text' : 'password'}
                        placeholder="Paste Carrybee Token here..."
                        value={settings.carrybee?.apiKey || ''}
                        onChange={e => handleFieldChange('carrybee', 'apiKey', e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono text-[11px]"
                      />
                    </div>
                  </div>
                )}

                {/* Test Connection Button & Status */}
                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => handleTestConnection(activeCourier)}
                    disabled={testStatus[activeCourier]?.loading}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition disabled:opacity-50"
                  >
                    {testStatus[activeCourier]?.loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    <span>Test Connection</span>
                  </button>

                  {/* Feedback Status */}
                  {testStatus[activeCourier] && !testStatus[activeCourier].loading && (
                    <div className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                      testStatus[activeCourier].success 
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' 
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    }`}>
                      {testStatus[activeCourier].success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                      )}
                      <span className="font-medium">{testStatus[activeCourier].message}</span>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/40">
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            Credentials are securely stored and masked on the server.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 rounded-lg shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Configuration</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
