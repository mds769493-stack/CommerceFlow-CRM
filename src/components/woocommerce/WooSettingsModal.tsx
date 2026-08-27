import React, { useState, useEffect } from 'react';
import { 
  X, 
  Store, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ExternalLink, 
  Key, 
  Globe, 
  ShieldCheck, 
  Clock, 
  HelpCircle,
  Radio,
  Zap,
  Copy,
  Check,
  Activity,
  Sliders,
  Send,
  Eye,
  EyeOff,
  Sparkles,
  Volume2,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { WooSite, WebhookLog } from '../../types';
import { 
  testWooConnection, 
  saveWooSite, 
  deleteWooSite, 
  autoRegisterWebhook, 
  testWebhook, 
  updateWebhookSecret,
  fetchWebhookLogs,
  clearWebhookLogs
} from '../../lib/woocommerceApi';
import { playTestChime } from '../../lib/socket';
import { cn } from '@/lib/utils';

interface WooSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: WooSite[];
  onSitesUpdated: () => void;
  defaultTab?: 'rest' | 'webhook' | 'logs';
}

export function WooSettingsModal({
  isOpen,
  onClose,
  sites,
  onSitesUpdated,
  defaultTab = 'rest'
}: WooSettingsModalProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | 'new'>('new');
  const [activeTab, setActiveTab] = useState<'rest' | 'webhook' | 'logs'>('rest');
  
  // Form states
  const [name, setName] = useState('');
  const [storeUrl, setStoreUrl] = useState('');
  const [consumerKey, setConsumerKey] = useState('');
  const [consumerSecret, setConsumerSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [autoSyncInterval, setAutoSyncInterval] = useState<'off' | '5m' | '15m' | '30m' | '1h'>('15m');
  
  // Webhook states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookActionMsg, setWebhookActionMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  
  // Webhook Logs states
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  
  // UI states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; currency?: string; orderCount?: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  // Initialize or populate form when selected site changes
  const handleSelectSite = (siteId: string | 'new') => {
    setSelectedSiteId(siteId);
    setTestResult(null);
    setError(null);
    setSuccessMsg(null);
    setWebhookActionMsg(null);

    if (siteId === 'new') {
      setName('');
      setStoreUrl('');
      setConsumerKey('');
      setConsumerSecret('');
      setWebhookSecret('');
      setAutoSyncInterval('15m');
      setActiveTab('rest');
    } else {
      const existing = sites.find(s => s.id === siteId);
      if (existing) {
        setName(existing.name || '');
        setStoreUrl(existing.storeUrl || '');
        setConsumerKey(existing.consumerKey || '');
        setConsumerSecret(existing.consumerSecretMasked || '••••••••••••••••');
        setWebhookSecret(existing.webhookSecret || '');
        setAutoSyncInterval((existing.autoSyncInterval as any) || '15m');
      }
    }
  };

  // Select initial site if none selected
  useEffect(() => {
    if (isOpen) {
      if (sites.length > 0 && selectedSiteId === 'new') {
        handleSelectSite(sites[0].id);
      }
      if (defaultTab) {
        setActiveTab(defaultTab);
      }
    }
  }, [isOpen, sites.length]);

  // Load logs when logs tab is active
  const loadLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const data = await fetchWebhookLogs();
      setWebhookLogs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load webhook logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && isOpen) {
      loadLogs();
    }
  }, [activeTab, isOpen]);

  const copyToClipboard = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleTestConnection = async () => {
    if (!storeUrl.trim() || !consumerKey.trim()) {
      setError('Please provide Store URL and Consumer Key.');
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResult(null);
    setSuccessMsg(null);

    try {
      const isExisting = selectedSiteId !== 'new';
      const result = await testWooConnection({
        siteId: isExisting ? selectedSiteId : undefined,
        storeUrl: storeUrl.trim(),
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim()
      });

      setTestResult(result);
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection test failed. Please verify credentials and URL.'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !storeUrl.trim() || !consumerKey.trim()) {
      setError('Please fill in Website Name, Store URL, and Consumer Key.');
      return;
    }

    if (selectedSiteId === 'new' && !consumerSecret.trim()) {
      setError('Consumer Secret is required for new store connections.');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await saveWooSite({
        id: selectedSiteId === 'new' ? undefined : selectedSiteId,
        name: name.trim(),
        storeUrl: storeUrl.trim(),
        consumerKey: consumerKey.trim(),
        consumerSecret: consumerSecret.trim(),
        webhookSecret: webhookSecret.trim() || undefined,
        autoSyncInterval
      });

      setSuccessMsg(selectedSiteId === 'new' ? 'WooCommerce store connected successfully!' : 'Store settings updated successfully!');
      onSitesUpdated();
      
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save store connection.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (selectedSiteId === 'new') return;
    if (!window.confirm('Are you sure you want to disconnect this WooCommerce store? Imported orders will remain saved.')) {
      return;
    }

    setIsDeleting(true);
    setError(null);
    try {
      await deleteWooSite(selectedSiteId);
      onSitesUpdated();
      handleSelectSite('new');
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect store.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Webhook: Auto-Register via REST API
  const handleAutoRegisterWebhook = async () => {
    if (selectedSiteId === 'new') {
      setWebhookActionMsg({ type: 'error', message: 'Please save the store connection first.' });
      return;
    }

    setIsRegisteringWebhook(true);
    setWebhookActionMsg(null);

    try {
      const res = await autoRegisterWebhook(selectedSiteId, webhookSecret.trim() || undefined);
      setWebhookActionMsg({
        type: 'success',
        message: res.message || 'Webhook successfully registered on WooCommerce!'
      });
      onSitesUpdated();
    } catch (err: any) {
      setWebhookActionMsg({
        type: 'error',
        message: err.message || 'Failed to auto-register webhook in WooCommerce.'
      });
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  // Webhook: Test Delivery & Live Audio Alert
  const handleTestWebhook = async () => {
    if (selectedSiteId === 'new') return;

    setIsTestingWebhook(true);
    setWebhookActionMsg(null);

    try {
      playTestChime();
      const res = await testWebhook(selectedSiteId);
      setWebhookActionMsg({
        type: 'success',
        message: res.message || 'Diagnostic Webhook test dispatched! Real-time channel active.'
      });
      loadLogs();
    } catch (err: any) {
      setWebhookActionMsg({
        type: 'error',
        message: err.message || 'Webhook test failed.'
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Webhook: Generate New Secret
  const handleGenerateSecret = async () => {
    if (selectedSiteId === 'new') {
      const randomSec = 'wc_sec_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      setWebhookSecret(randomSec);
      return;
    }

    try {
      const res = await updateWebhookSecret(selectedSiteId);
      setWebhookSecret(res.webhookSecret);
      setWebhookActionMsg({
        type: 'success',
        message: 'New Webhook secret generated and saved!'
      });
      onSitesUpdated();
    } catch (err: any) {
      setWebhookActionMsg({
        type: 'error',
        message: err.message || 'Failed to generate webhook secret.'
      });
    }
  };

  // Clear all webhook logs
  const handleClearLogs = async () => {
    if (!window.confirm('Clear all webhook activity logs?')) return;
    try {
      await clearWebhookLogs();
      setWebhookLogs([]);
    } catch (e: any) {
      alert(`Failed to clear logs: ${e.message}`);
    }
  };

  if (!isOpen) return null;

  // Base webhook URL calculation
  const calculatedDeliveryUrl = `${window.location.origin}/api/webhooks/woocommerce${selectedSiteId !== 'new' ? `?siteId=${selectedSiteId}` : ''}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl text-white shadow-sm shadow-blue-500/20">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">WooCommerce Integration Hub</h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <Zap className="w-3 h-3 text-emerald-600" />
                  Real-Time Webhook
                </span>
              </div>
              <p className="text-xs text-slate-500">REST API synchronization, real-time webhooks, and automatic store connection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          
          {/* Left Column: Stores List */}
          <div className="md:col-span-4 p-4 bg-slate-50/40 overflow-y-auto flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 mb-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Configured Stores</span>
              <span className="text-xs font-semibold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full">{sites.length}</span>
            </div>

            <button
              onClick={() => handleSelectSite('new')}
              className={cn(
                "flex items-center gap-2.5 w-full p-3 rounded-2xl text-left border transition-all duration-200",
                selectedSiteId === 'new'
                  ? "bg-blue-50/90 border-blue-200 text-blue-900 shadow-sm"
                  : "bg-white border-dashed border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50"
              )}
            >
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                <Plus className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-900">Connect New Store</p>
                <p className="text-[11px] text-slate-500 truncate">Add website credentials</p>
              </div>
            </button>

            <div className="flex flex-col gap-1.5 mt-2">
              {sites.map((site) => (
                <button
                  key={site.id}
                  onClick={() => handleSelectSite(site.id)}
                  className={cn(
                    "flex items-center gap-3 w-full p-3 rounded-2xl text-left border transition-all duration-200",
                    selectedSiteId === site.id
                      ? "bg-white border-blue-300 shadow-sm ring-2 ring-blue-500/20"
                      : "bg-white/60 border-slate-200/80 hover:bg-white hover:border-slate-300"
                  )}
                >
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Globe className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{site.name}</p>
                      <span className={cn(
                        "w-2 h-2 rounded-full shrink-0",
                        site.status === 'Connected' ? "bg-emerald-500" : site.status === 'Error' ? "bg-rose-500" : "bg-slate-400"
                      )} />
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{site.storeUrl}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Help Toggle Button */}
            <div className="mt-auto pt-4">
              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className="flex items-center gap-2 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 p-2.5 rounded-xl w-full justify-center transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>How to generate API Keys?</span>
              </button>
            </div>
          </div>

          {/* Right Column: Settings Tabs & Content */}
          <div className="md:col-span-8 p-6 overflow-y-auto flex flex-col justify-between">
            {showHelp ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Key className="w-4 h-4 text-blue-600" />
                    How to generate WooCommerce REST API Keys
                  </h3>
                  <button 
                    onClick={() => setShowHelp(false)}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Back to Settings
                  </button>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3 text-xs text-slate-700 leading-relaxed">
                  <p className="font-semibold text-slate-900">Follow these simple steps in your WordPress Admin:</p>
                  <ol className="list-decimal list-inside space-y-2 text-slate-600">
                    <li>Log in to your WordPress Dashboard as an Administrator.</li>
                    <li>Go to <span className="font-semibold text-slate-900">WooCommerce &rarr; Settings &rarr; Advanced &rarr; REST API</span>.</li>
                    <li>Click <span className="font-semibold text-blue-600">"Add Key"</span> or <span className="font-semibold text-blue-600">"Create an API key"</span>.</li>
                    <li>Set <span className="font-semibold">Description</span> (e.g., <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800">CommerceFlow App</code>).</li>
                    <li>Set <span className="font-semibold">Permissions</span> to <span className="font-bold text-emerald-700">Read/Write</span>.</li>
                    <li>Click <span className="font-semibold">Generate API Key</span>.</li>
                    <li>Copy your <span className="font-mono text-slate-900">Consumer Key (ck_...)</span> and <span className="font-mono text-slate-900">Consumer Secret (cs_...)</span> and paste them into the form.</li>
                  </ol>
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-800 border border-blue-100 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>Your API Secret is encrypted on the server and is never exposed to the browser.</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                
                {/* Store Header & Tab Navigation */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {selectedSiteId === 'new' ? 'Connect New Store' : selectedSite?.name || name}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {selectedSiteId === 'new' ? 'Configure WordPress REST API & Real-time Webhook' : selectedSite?.storeUrl}
                    </p>
                  </div>

                  {selectedSiteId !== 'new' && (
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                      <button
                        type="button"
                        onClick={() => setActiveTab('rest')}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                          activeTab === 'rest'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        REST API
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('webhook')}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                          activeTab === 'webhook'
                            ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Webhook & Live
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('logs')}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all",
                          activeTab === 'logs'
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        )}
                      >
                        <Activity className="w-3.5 h-3.5" />
                        Logs
                      </button>
                    </div>
                  )}
                </div>

                {/* Notifications */}
                {error && (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}

                {successMsg && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs flex items-start gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{successMsg}</span>
                  </div>
                )}

                {webhookActionMsg && (
                  <div className={cn(
                    "p-3 rounded-2xl border text-xs flex items-start gap-2 animate-in fade-in",
                    webhookActionMsg.type === 'success' 
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
                      : "bg-rose-50 border-rose-200 text-rose-800"
                  )}>
                    {webhookActionMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span>{webhookActionMsg.message}</span>
                  </div>
                )}

                {/* TAB 1: REST API & CREDENTIALS FORM */}
                {activeTab === 'rest' && (
                  <form onSubmit={handleSave} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Website / Store Name <span className="text-rose-500">*</span></label>
                        <Input
                          type="text"
                          placeholder="e.g. Main Shop / Outlet"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-700">Store URL (WordPress Site) <span className="text-rose-500">*</span></label>
                        <Input
                          type="url"
                          placeholder="https://yourstore.com"
                          value={storeUrl}
                          onChange={(e) => setStoreUrl(e.target.value)}
                          className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Consumer Key <span className="text-rose-500">*</span></label>
                      <Input
                        type="text"
                        placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={consumerKey}
                        onChange={(e) => setConsumerKey(e.target.value)}
                        className="h-10 font-mono text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700">
                          Consumer Secret <span className="text-rose-500">*</span>
                        </label>
                        {selectedSiteId !== 'new' && (
                          <span className="text-[11px] text-slate-400">Leave masked to keep existing secret</span>
                        )}
                      </div>
                      <Input
                        type="password"
                        placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={consumerSecret}
                        onChange={(e) => setConsumerSecret(e.target.value)}
                        className="h-10 font-mono text-xs rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white"
                        required={selectedSiteId === 'new'}
                      />
                    </div>

                    {/* Auto Sync Interval */}
                    <div className="space-y-1.5 pt-1">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        Background Auto-Sync Interval
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {(['off', '5m', '15m', '30m', '1h'] as const).map((interval) => (
                          <button
                            key={interval}
                            type="button"
                            onClick={() => setAutoSyncInterval(interval)}
                            className={cn(
                              "py-2 px-1 text-xs font-semibold rounded-xl border transition-all text-center",
                              autoSyncInterval === interval
                                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                                : "bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200"
                            )}
                          >
                            {interval === 'off' ? 'Off' : `Every ${interval}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Test Connection Results Badge */}
                    {testResult && (
                      <div className={cn(
                        "p-3 rounded-2xl border text-xs flex items-start gap-2.5 animate-in fade-in",
                        testResult.success
                          ? "bg-emerald-50/80 border-emerald-200 text-emerald-800"
                          : "bg-rose-50/80 border-rose-200 text-rose-800"
                      )}>
                        {testResult.success ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="font-bold">{testResult.message}</p>
                          {testResult.success && testResult.orderCount !== undefined && (
                            <p className="text-[11px] text-emerald-700 mt-0.5">
                              Currency: <span className="font-semibold">{testResult.currency || 'BDT'}</span> • Accessible orders: <span className="font-semibold">{testResult.orderCount}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={isTesting || !storeUrl.trim() || !consumerKey.trim()}
                        className="h-10 text-xs font-semibold rounded-xl border-slate-200 hover:bg-slate-50 text-slate-700"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5 mr-2", isTesting && "animate-spin")} />
                        {isTesting ? 'Testing REST API...' : 'Test Connection'}
                      </Button>

                      <div className="flex items-center gap-2">
                        {selectedSiteId !== 'new' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-10 px-3 text-xs rounded-xl"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Disconnect
                          </Button>
                        )}
                        <Button
                          type="submit"
                          disabled={isSaving}
                          className="h-10 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 shadow-sm shadow-blue-500/20"
                        >
                          {isSaving ? 'Saving...' : selectedSiteId === 'new' ? 'Connect Store' : 'Save Changes'}
                        </Button>
                      </div>
                    </div>
                  </form>
                )}

                {/* TAB 2: WEBHOOK & REAL-TIME SETUP */}
                {activeTab === 'webhook' && selectedSiteId !== 'new' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    
                    {/* Live Webhook Status Card */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/80 via-emerald-50/50 to-blue-50/80 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 animate-pulse">
                          <Zap className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-slate-900">Real-Time Webhook Engine Active</span>
                            <span className="flex h-2 w-2 relative">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">New orders are instantly received, verified with HMAC SHA256, and pushed via WebSockets with audio alerts.</p>
                        </div>
                      </div>

                      {/* 1-Click Auto Registration Button */}
                      <Button
                        type="button"
                        onClick={handleAutoRegisterWebhook}
                        disabled={isRegisteringWebhook}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl h-10 px-4 shrink-0 shadow-md shadow-emerald-600/20"
                      >
                        <Sparkles className={cn("w-3.5 h-3.5 mr-1.5", isRegisteringWebhook && "animate-spin")} />
                        {isRegisteringWebhook ? 'Registering...' : '1-Click Auto Register in WooCommerce'}
                      </Button>
                    </div>

                    {/* Delivery URL Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <Send className="w-3.5 h-3.5 text-blue-600" />
                          Webhook Delivery URL (Payload URL)
                        </label>
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Topic: order.created</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          readOnly
                          value={calculatedDeliveryUrl}
                          className="h-10 font-mono text-xs rounded-xl border-slate-200 bg-slate-50 text-slate-800 select-all"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => copyToClipboard(calculatedDeliveryUrl, 'delivery_url')}
                          className="h-10 px-3 rounded-xl border-slate-200 hover:bg-slate-50 shrink-0 text-xs font-semibold text-slate-700"
                        >
                          {copiedKey === 'delivery_url' ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy URL
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Paste this into WooCommerce &rarr; Settings &rarr; Advanced &rarr; Webhooks &rarr; Delivery URL
                      </p>
                    </div>

                    {/* Webhook Secret Box */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          Webhook Secret (HMAC SHA256 Verification)
                        </label>
                        <button
                          type="button"
                          onClick={handleGenerateSecret}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          Regenerate Secret
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            type={showSecret ? "text" : "password"}
                            placeholder="wc_sec_xxxxxxxxxxxxxxxxxxxxxxxx"
                            value={webhookSecret}
                            onChange={(e) => setWebhookSecret(e.target.value)}
                            className="h-10 font-mono text-xs rounded-xl border-slate-200 bg-slate-50/50 pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecret(!showSecret)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => copyToClipboard(webhookSecret, 'secret')}
                          className="h-10 px-3 rounded-xl border-slate-200 hover:bg-slate-50 shrink-0 text-xs font-semibold text-slate-700"
                        >
                          {copiedKey === 'secret' ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy Secret
                            </>
                          )}
                        </Button>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        The secret used by WooCommerce to sign each payload (<code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">X-WC-Webhook-Signature</code>).
                      </p>
                    </div>

                    {/* Manual Settings Quick Reference Guide */}
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 space-y-2">
                      <p className="font-bold text-slate-900 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        Manual Setup in WordPress (if not using 1-Click Auto Register):
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 block">Name:</span>
                          <span className="font-semibold text-slate-800">CommerceFlow Webhook</span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 block">Status:</span>
                          <span className="font-semibold text-emerald-700">Active</span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 block">Topic:</span>
                          <span className="font-semibold text-blue-700">Order created</span>
                        </div>
                        <div className="p-2 bg-white rounded-xl border border-slate-200">
                          <span className="text-slate-400 block">API Version:</span>
                          <span className="font-semibold text-slate-800">WP REST API v3</span>
                        </div>
                      </div>
                    </div>

                    {/* Webhook Action Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestWebhook}
                        disabled={isTestingWebhook}
                        className="h-10 text-xs font-semibold rounded-xl border-blue-200 bg-blue-50/50 hover:bg-blue-100 text-blue-700"
                      >
                        <Volume2 className={cn("w-3.5 h-3.5 mr-2", isTestingWebhook && "animate-spin")} />
                        {isTestingWebhook ? 'Testing Socket & Alert...' : 'Test Webhook & Audio Chime'}
                      </Button>

                      <Button
                        type="button"
                        onClick={handleSave}
                        disabled={isSaving}
                        className="h-10 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 shadow-sm shadow-blue-500/20"
                      >
                        {isSaving ? 'Saving...' : 'Save Webhook Secret'}
                      </Button>
                    </div>
                  </div>
                )}

                {/* TAB 3: WEBHOOK ACTIVITY LOGS */}
                {activeTab === 'logs' && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Recent Webhook Deliveries</span>
                        <span className="text-[11px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {webhookLogs.length} events
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={loadLogs}
                          disabled={isLoadingLogs}
                          className="h-8 px-2.5 text-xs text-slate-600 hover:text-slate-900 rounded-xl"
                        >
                          <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoadingLogs && "animate-spin")} />
                          Refresh
                        </Button>
                        {webhookLogs.length > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleClearLogs}
                            className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                            Clear Logs
                          </Button>
                        )}
                      </div>
                    </div>

                    {isLoadingLogs ? (
                      <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                        <span className="text-xs">Loading webhook delivery history...</span>
                      </div>
                    ) : webhookLogs.length === 0 ? (
                      <div className="py-12 px-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center flex flex-col items-center justify-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
                          <Activity className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-700">No Webhook Deliveries Recorded Yet</p>
                        <p className="text-[11px] text-slate-500 max-w-sm">
                          When WooCommerce generates new orders or triggers webhooks, the delivery attempts, HMAC verification status, and response latency will appear here.
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleTestWebhook}
                          className="mt-2 text-xs rounded-xl border-slate-200 hover:bg-slate-100"
                        >
                          Send Diagnostic Test
                        </Button>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[340px] overflow-y-auto">
                        <table className="w-full text-left border-collapse text-[11px]">
                          <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                              <th className="py-2.5 px-3">Time</th>
                              <th className="py-2.5 px-3">Topic</th>
                              <th className="py-2.5 px-3">Order #</th>
                              <th className="py-2.5 px-3">Store</th>
                              <th className="py-2.5 px-3">Status</th>
                              <th className="py-2.5 px-3">Latency</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {webhookLogs.map((log) => (
                              <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                                <td className="py-2 px-3 text-slate-500 whitespace-nowrap">
                                  {new Date(log.timestamp).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                  })}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-800">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                    {log.topic}
                                  </span>
                                </td>
                                <td className="py-2 px-3 font-bold text-slate-900">
                                  {log.orderNumber ? `#${log.orderNumber}` : '—'}
                                </td>
                                <td className="py-2 px-3 text-slate-600 truncate max-w-[120px]">
                                  {log.siteName || '—'}
                                </td>
                                <td className="py-2 px-3">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full font-bold text-[10px]",
                                    log.status === 'success' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                    log.status === 'ignored' ? "bg-amber-50 text-amber-700 border border-amber-200" :
                                    "bg-rose-50 text-rose-700 border border-rose-200"
                                  )}>
                                    {log.status === 'success' ? `200 OK` : log.errorMessage || `${log.httpStatus}`}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-400 font-mono">
                                  {log.processingTimeMs}ms
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
