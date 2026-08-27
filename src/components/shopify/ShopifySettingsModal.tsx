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
  FileText,
  ShoppingBag,
  Layers,
  ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ShopifySite, WebhookLog } from '../../types';
import { 
  testShopifyConnection, 
  saveShopifySite, 
  deleteShopifySite, 
  autoRegisterShopifyWebhook, 
  testShopifyWebhook, 
  updateShopifyWebhookSecret,
  fetchShopifyWebhookLogs,
  clearShopifyWebhookLogs,
  syncShopifyOrders
} from '../../lib/shopifyApi';
import { playTestChime } from '../../lib/socket';
import { cn } from '@/lib/utils';

interface ShopifySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sites: ShopifySite[];
  onSitesUpdated: () => void;
  defaultTab?: 'api' | 'webhook' | 'logs';
}

export function ShopifySettingsModal({
  isOpen,
  onClose,
  sites,
  onSitesUpdated,
  defaultTab = 'api'
}: ShopifySettingsModalProps) {
  const [selectedSiteId, setSelectedSiteId] = useState<string | 'new'>('new');
  const [activeTab, setActiveTab] = useState<'api' | 'webhook' | 'logs'>('api');
  
  // Form states
  const [name, setName] = useState('');
  const [shopDomain, setShopDomain] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  
  // Webhook states
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);
  const [webhookActionMsg, setWebhookActionMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [diagnosticSteps, setDiagnosticSteps] = useState<Array<{ step: string; status: 'ok' | 'error'; detail: string }> | null>(null);
  
  // Webhook Logs states
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedLogPayload, setSelectedLogPayload] = useState<WebhookLog | null>(null);
  
  // Sync state
  const [isSyncingOrders, setIsSyncingOrders] = useState(false);

  // UI states
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ 
    success: boolean; 
    message: string; 
    currency?: string; 
    orderCount?: number;
    shop?: any;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  // Initialize or populate form when selected site changes
  const handleSelectSite = (siteId: string | 'new') => {
    setSelectedSiteId(siteId);
    setTestResult(null);
    setError(null);
    setSuccessMsg(null);
    setWebhookActionMsg(null);
    setDiagnosticSteps(null);

    if (siteId === 'new') {
      setName('');
      setShopDomain('');
      setAccessToken('');
      setApiKey('');
      setApiSecret('');
      setWebhookSecret('');
      setActiveTab('api');
    } else {
      const existing = sites.find(s => s.id === siteId);
      if (existing) {
        setName(existing.name || '');
        setShopDomain(existing.shopDomain || '');
        setAccessToken(existing.accessTokenMasked || '••••••••••••••••');
        setApiKey(existing.apiKey || '');
        setApiSecret(existing.apiSecretMasked || '••••••••••••••••');
        setWebhookSecret(existing.webhookSecret || '');
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
      const data = await fetchShopifyWebhookLogs();
      setWebhookLogs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('Failed to load Shopify webhook logs:', e);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && isOpen) {
      loadLogs();
    }
  }, [activeTab, isOpen]);

  // Copy helper
  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Computed public webhook URL for the selected store
  const getWebhookUrl = () => {
    const origin = window.location.origin;
    if (selectedSite) {
      return `${origin}/api/integrations/shopify/webhook/orders/create?siteId=${encodeURIComponent(selectedSite.id)}`;
    }
    return `${origin}/api/integrations/shopify/webhook/orders/create`;
  };

  // Test Connection
  const handleTestConnection = async () => {
    if (!shopDomain.trim()) {
      setError('Please provide your Shopify store domain (e.g. yourstore.myshopify.com)');
      return;
    }
    if (!accessToken.trim()) {
      setError('Please provide your Shopify Admin API Access Token');
      return;
    }

    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testShopifyConnection({
        siteId: selectedSiteId !== 'new' ? selectedSiteId : undefined,
        shopDomain: shopDomain.trim(),
        accessToken: accessToken.trim()
      });

      setTestResult({
        success: result.success,
        message: result.message,
        currency: result.shop?.currency,
        orderCount: result.shop?.orderCount,
        shop: result.shop
      });

      if (result.success) {
        playTestChime();
        if (result.shop?.name && !name) {
          setName(result.shop.name);
        }
      } else {
        setError(result.message || 'Shopify connection test failed');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Shopify API');
      setTestResult({
        success: false,
        message: err.message || 'Connection failed'
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Save Store
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Store Name is required');
      return;
    }
    if (!shopDomain.trim()) {
      setError('Shopify Domain is required (e.g. brand.myshopify.com)');
      return;
    }
    if (!accessToken.trim() && selectedSiteId === 'new') {
      setError('Shopify Admin API Access Token is required');
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        name: name.trim(),
        shopDomain: shopDomain.trim(),
        accessToken: accessToken.trim(),
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
        webhookSecret: webhookSecret.trim()
      };

      if (selectedSiteId !== 'new') {
        payload.id = selectedSiteId;
      }

      const res = await saveShopifySite(payload);
      setSuccessMsg(`Shopify store "${res.site.name}" saved successfully!`);
      onSitesUpdated();

      if (selectedSiteId === 'new' && res.site.id) {
        setSelectedSiteId(res.site.id);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save store settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Store
  const handleDelete = async () => {
    if (selectedSiteId === 'new' || !selectedSite) return;
    if (!confirm(`Are you sure you want to disconnect and delete "${selectedSite.name}"?`)) return;

    setIsDeleting(true);
    setError(null);

    try {
      await deleteShopifySite(selectedSite.id);
      onSitesUpdated();
      handleSelectSite('new');
      setSuccessMsg('Shopify store deleted successfully');
    } catch (err: any) {
      setError(err.message || 'Failed to delete store');
    } finally {
      setIsDeleting(false);
    }
  };

  // Auto-Register Webhooks in Shopify
  const handleAutoRegister = async () => {
    if (!selectedSite || selectedSiteId === 'new') {
      setWebhookActionMsg({ type: 'error', message: 'Please save the Shopify store first before registering webhooks.' });
      return;
    }

    setIsRegisteringWebhook(true);
    setWebhookActionMsg(null);

    try {
      const res = await autoRegisterShopifyWebhook(selectedSite.id, webhookSecret.trim() || undefined);
      setWebhookActionMsg({
        type: 'success',
        message: res.message || 'Shopify Real-Time Webhook registered successfully!'
      });
      playTestChime();
      onSitesUpdated();
    } catch (err: any) {
      setWebhookActionMsg({
        type: 'error',
        message: err.message || 'Failed to register webhook in Shopify'
      });
    } finally {
      setIsRegisteringWebhook(false);
    }
  };

  // Diagnostic Test Webhook
  const handleTestWebhook = async () => {
    if (!selectedSite || selectedSiteId === 'new') {
      setWebhookActionMsg({ type: 'error', message: 'Please save the store first to test webhooks.' });
      return;
    }

    setIsTestingWebhook(true);
    setWebhookActionMsg(null);
    setDiagnosticSteps(null);

    try {
      const res = await testShopifyWebhook(selectedSite.id);
      if (res.steps) {
        setDiagnosticSteps(res.steps);
      }
      setWebhookActionMsg({
        type: res.success ? 'success' : 'error',
        message: res.message || 'Diagnostic Webhook test completed.'
      });
      if (res.success) {
        playTestChime();
        onSitesUpdated();
        loadLogs();
      }
    } catch (err: any) {
      setWebhookActionMsg({
        type: 'error',
        message: err.message || 'Webhook diagnostic test failed'
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  // Generate / Regenerate Webhook Secret
  const handleRegenerateSecret = async () => {
    if (!selectedSite || selectedSiteId === 'new') return;
    if (!confirm('Generate a new Shopify Webhook Secret? Note: You must update the secret in your Shopify admin settings.')) return;

    try {
      const res = await updateShopifyWebhookSecret(selectedSite.id);
      setWebhookSecret(res.webhookSecret);
      setWebhookActionMsg({ type: 'success', message: 'New Webhook Secret generated!' });
      onSitesUpdated();
    } catch (err: any) {
      setWebhookActionMsg({ type: 'error', message: err.message || 'Failed to update secret' });
    }
  };

  // Manual Import / Sync Orders
  const handleSyncOrders = async () => {
    if (!selectedSite || selectedSiteId === 'new') return;
    setIsSyncingOrders(true);
    setSuccessMsg(null);
    setError(null);

    try {
      const res = await syncShopifyOrders(selectedSite.id, 50);
      setSuccessMsg(`Imported ${res.newCount} new and updated ${res.updatedCount} orders from Shopify!`);
      playTestChime();
      onSitesUpdated();
    } catch (err: any) {
      setError(err.message || 'Failed to import orders from Shopify');
    } finally {
      setIsSyncingOrders(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="shopify-settings-modal"
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-5xl h-[88vh] max-h-[780px] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-600/20">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">Shopify Integration Hub</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300/60">
                  Real-Time Webhooks
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Connect your Shopify stores and receive new orders instantly via <code className="text-emerald-700 font-semibold">orders/create</code> Webhooks
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onClose} 
            className="w-8 h-8 p-0 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Modal Body: Left Sidebar + Right Content Area */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Sidebar: Store List */}
          <div className="w-64 border-r border-slate-200 bg-slate-50/50 flex flex-col p-4 gap-3 shrink-0">
            <Button
              onClick={() => handleSelectSite('new')}
              className={cn(
                "w-full justify-start gap-2 h-10 text-xs font-semibold rounded-xl cursor-pointer transition-all shadow-xs",
                selectedSiteId === 'new'
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-600/20"
                  : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-100"
              )}
            >
              <Plus className="w-4 h-4" />
              <span>Connect New Store</span>
            </Button>

            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2 pt-2">
              Connected Stores ({sites.length})
            </div>

            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {sites.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 rounded-xl border border-dashed border-slate-200">
                  No Shopify stores connected yet.
                </div>
              ) : (
                sites.map(site => (
                  <button
                    key={site.id}
                    onClick={() => handleSelectSite(site.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl transition-all cursor-pointer border flex flex-col gap-1",
                      selectedSiteId === site.id
                        ? "bg-emerald-50/70 border-emerald-300 text-emerald-950 shadow-xs"
                        : "bg-white border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:border-slate-300"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs truncate max-w-[130px]">{site.name}</span>
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate flex items-center gap-1 font-mono">
                      <Globe className="w-3 h-3 text-slate-400 shrink-0" />
                      {site.shopDomain}
                    </span>
                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-100 mt-1">
                      <span className="text-emerald-700 font-medium">⚡ Webhook Active</span>
                      <span className="text-slate-400 font-mono">{site.currency || 'BDT'}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Right Main Panel */}
          <div className="flex-1 flex flex-col bg-white overflow-y-auto">
            
            {/* Store Title Bar & Tabs */}
            <div className="p-6 pb-0 border-b border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedSiteId === 'new' ? 'Connect Shopify Store' : (selectedSite?.name || 'Shopify Store')}</span>
                    {selectedSite && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Connected
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedSiteId === 'new'
                      ? 'Enter your Shopify Admin API credentials to enable real-time order sync.'
                      : `Domain: ${selectedSite?.shopDomain} • ${selectedSite?.currency || 'BDT'}`}
                  </p>
                </div>

                {selectedSite && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleSyncOrders}
                      disabled={isSyncingOrders}
                      className="h-8 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer gap-1.5"
                      title="Import Recent Orders via REST API"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isSyncingOrders && "animate-spin text-emerald-600")} />
                      <span>{isSyncingOrders ? 'Importing...' : 'Import Recent Orders'}</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`https://${selectedSite.shopDomain}/admin`, '_blank')}
                      className="h-8 text-xs font-semibold text-slate-700 border-slate-200 hover:bg-slate-50 rounded-xl cursor-pointer gap-1"
                    >
                      <span>Shopify Admin</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Navigation Tabs */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('api')}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer flex items-center gap-2",
                    activeTab === 'api'
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>1. API & Store Info</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('webhook')}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer flex items-center gap-2 relative",
                    activeTab === 'webhook'
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>2. Real-Time Webhook & Live Push</span>
                  {selectedSite?.webhookStatus === 'active' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('logs')}
                  className={cn(
                    "px-4 py-2 text-xs font-semibold rounded-t-xl border-b-2 transition-all cursor-pointer flex items-center gap-2",
                    activeTab === 'logs'
                      ? "border-emerald-600 text-emerald-700 bg-emerald-50/50"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>3. Webhook Logs</span>
                  {webhookLogs.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 text-slate-600 font-bold">
                      {webhookLogs.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="p-6 space-y-4 flex-1">
              
              {/* Alert Messages */}
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* TAB 1: API & Store Info */}
              {activeTab === 'api' && (
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Store Name */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Store Name <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="e.g. Trendy Lifestyle"
                        className="text-xs h-9"
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Friendly display name in the orders dashboard</p>
                    </div>

                    {/* Shopify Domain */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Shopify Store Domain <span className="text-rose-500">*</span>
                      </label>
                      <Input
                        value={shopDomain}
                        onChange={e => setShopDomain(e.target.value)}
                        placeholder="e.g. yourbrand.myshopify.com"
                        className="text-xs h-9 font-mono"
                        required
                      />
                      <p className="text-[10px] text-slate-400 mt-1">Your .myshopify.com domain or primary custom domain</p>
                    </div>

                    {/* Admin API Access Token */}
                    <div className="md:col-span-2">
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold text-slate-700">
                          Shopify Admin API Access Token <span className="text-rose-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setShowGuide(!showGuide)}
                          className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{showGuide ? 'Hide Token Guide' : 'How to get this Token?'}</span>
                        </button>
                      </div>
                      <div className="relative">
                        <Input
                          type={showToken ? 'text' : 'password'}
                          value={accessToken}
                          onChange={e => setAccessToken(e.target.value)}
                          placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="text-xs h-9 pr-10 font-mono"
                          required={selectedSiteId === 'new'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Step by Step Guide (Collapsible) */}
                    {showGuide && (
                      <div className="md:col-span-2 p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs space-y-2 text-emerald-950 animate-in fade-in">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                          <Sparkles className="w-4 h-4 text-emerald-700" />
                          <span>How to create a Custom App & Access Token in Shopify (2 Minutes)</span>
                        </div>
                        <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-700 pl-1">
                          <li>Go to your Shopify Admin &rarr; <span className="font-bold">Settings</span> &rarr; <span className="font-bold">Apps and sales channels</span>.</li>
                          <li>Click <span className="font-bold text-emerald-800">Develop apps</span> &rarr; <span className="font-bold">Create an app</span> (Name: "CommerceFlow").</li>
                          <li>Under <span className="font-bold">Configuration</span>, click <span className="font-bold">Configure Admin API scopes</span>.</li>
                          <li>Select scopes: <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-[10px]">read_orders</code>, <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-[10px]">write_orders</code>, <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-[10px]">read_products</code>, <code className="bg-white px-1.5 py-0.5 rounded border font-mono text-[10px]">read_customers</code>.</li>
                          <li>Click <span className="font-bold">Save</span> &rarr; <span className="font-bold">Install app</span> &rarr; Reveal and copy the <span className="font-bold text-emerald-800">Admin API access token</span> (<code className="font-mono">shpat_...</code>).</li>
                        </ol>
                      </div>
                    )}

                    {/* API Secret / Webhook Secret */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        API Secret Key / Webhook Secret (For HMAC Verification)
                      </label>
                      <div className="relative">
                        <Input
                          type={showSecret ? 'text' : 'password'}
                          value={webhookSecret || apiSecret}
                          onChange={e => {
                            setWebhookSecret(e.target.value);
                            setApiSecret(e.target.value);
                          }}
                          placeholder="shpss_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="text-xs h-9 pr-10 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecret(!showSecret)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Used to verify <code className="font-mono text-emerald-700 font-bold">X-Shopify-Hmac-SHA256</code> signatures on incoming webhooks
                      </p>
                    </div>

                  </div>

                  {/* Test Results Display */}
                  {testResult && (
                    <div className={cn(
                      "p-3 rounded-xl text-xs flex items-start gap-2.5 border",
                      testResult.success 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    )}>
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5">
                        <div className="font-bold">{testResult.message}</div>
                        {testResult.shop && (
                          <div className="text-[11px] text-slate-600 flex flex-wrap gap-3 pt-1">
                            <span>Store: <strong className="text-slate-800">{testResult.shop.name}</strong></span>
                            <span>Currency: <strong className="text-slate-800">{testResult.shop.currency}</strong></span>
                            {testResult.shop.orderCount !== undefined && (
                              <span>Total Orders on Shopify: <strong className="text-slate-800">{testResult.shop.orderCount}</strong></span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Bottom Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleTestConnection}
                        disabled={isTesting}
                        className="h-9 text-xs font-semibold rounded-xl border-slate-300 hover:bg-slate-50 cursor-pointer gap-1.5"
                      >
                        <Activity className={cn("w-3.5 h-3.5", isTesting && "animate-spin text-emerald-600")} />
                        <span>{isTesting ? 'Testing Connection...' : 'Test API Connection'}</span>
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {selectedSiteId !== 'new' && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleDelete}
                          disabled={isDeleting}
                          className="h-9 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          <span>Delete Store</span>
                        </Button>
                      )}

                      <Button
                        type="submit"
                        disabled={isSaving}
                        className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs shadow-emerald-600/20 cursor-pointer gap-1.5"
                      >
                        {isSaving ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{isSaving ? 'Saving...' : 'Save Shopify Store'}</span>
                      </Button>
                    </div>
                  </div>
                </form>
              )}

              {/* TAB 2: Real-Time Webhook & Live Push */}
              {activeTab === 'webhook' && (
                <div className="space-y-5">
                  
                  {/* Status Banner */}
                  <div className="p-4 bg-emerald-500/10 border border-emerald-200 rounded-2xl flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-600/20">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-emerald-950">Real-Time Webhook Engine Active</h4>
                          <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-0.5">
                          When a customer places an order on Shopify, it is instantly pushed to your Orders dashboard in &lt;50ms.
                        </p>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={handleAutoRegister}
                      disabled={isRegisteringWebhook || selectedSiteId === 'new'}
                      className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs cursor-pointer shrink-0 gap-1.5"
                    >
                      <Sparkles className={cn("w-3.5 h-3.5", isRegisteringWebhook && "animate-spin")} />
                      <span>{isRegisteringWebhook ? 'Registering...' : '1-Click Auto Register in Shopify'}</span>
                    </Button>
                  </div>

                  {webhookActionMsg && (
                    <div className={cn(
                      "p-3 rounded-xl text-xs flex items-center gap-2 border",
                      webhookActionMsg.type === 'success' 
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border-rose-200 text-rose-900"
                    )}>
                      {webhookActionMsg.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      )}
                      <span>{webhookActionMsg.message}</span>
                    </div>
                  )}

                  {/* Webhook Delivery URL & Secret Box */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Webhook Delivery URL */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Globe className="w-3.5 h-3.5 text-blue-600" />
                          <span>Webhook Delivery URL</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(getWebhookUrl(), 'delivery_url')}
                          className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === 'delivery_url' ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy URL</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] text-slate-700 break-all select-all">
                        {getWebhookUrl()}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Topic: <strong className="text-slate-700">orders/create</strong> (Format: JSON)
                      </p>
                    </div>

                    {/* Webhook Secret */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Webhook Secret (HMAC SHA-256)</span>
                        </label>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleRegenerateSecret}
                            className="text-[10px] text-slate-500 hover:text-slate-700 underline cursor-pointer"
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(webhookSecret || selectedSite?.webhookSecret || '', 'secret')}
                            className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                          >
                            {copiedKey === 'secret' ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Secret</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 rounded-lg p-2 font-mono text-[11px] text-slate-700 truncate select-all">
                        {webhookSecret || selectedSite?.webhookSecret || 'Auto-generated on save'}
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Header: <strong className="text-slate-700">X-Shopify-Hmac-SHA256</strong>
                      </p>
                    </div>

                  </div>

                  {/* Diagnostic Webhook Test Runner */}
                  <div className="p-4 border border-slate-200 rounded-2xl bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <Activity className="w-4 h-4 text-emerald-600" />
                          <span>Run Live Diagnostic Test</span>
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Simulates an <code className="font-mono text-emerald-700 font-semibold">orders/create</code> payload to test HMAC calculation, normalization, DB saving, and Real-Time WebSocket audio alerts.
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={handleTestWebhook}
                        disabled={isTestingWebhook || selectedSiteId === 'new'}
                        className="h-8 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xs cursor-pointer gap-1.5 shrink-0"
                      >
                        <Send className={cn("w-3.5 h-3.5", isTestingWebhook && "animate-spin text-emerald-400")} />
                        <span>{isTestingWebhook ? 'Simulating...' : 'Test Shopify Webhook'}</span>
                      </Button>
                    </div>

                    {/* Step-by-Step Diagnostic Report */}
                    {diagnosticSteps && diagnosticSteps.length > 0 && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs animate-in fade-in">
                        <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider mb-1">
                          Diagnostic Execution Checklist:
                        </div>
                        {diagnosticSteps.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-[11px]">
                            {step.status === 'ok' ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            ) : (
                              <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                            )}
                            <span className="font-semibold text-slate-800">{step.step}:</span>
                            <span className="text-slate-600 font-mono text-[10px]">{step.detail}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Manual Setup Guide Box */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                    <div className="font-bold text-slate-800 flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4 text-slate-500" />
                      <span>Manual Setup in Shopify Admin (If not using 1-Click Auto Register)</span>
                    </div>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
                      <li>In Shopify Admin, navigate to <strong className="text-slate-800">Settings &rarr; Notifications</strong>.</li>
                      <li>Scroll down to the <strong className="text-slate-800">Webhooks</strong> section and click <strong className="text-emerald-700">Create webhook</strong>.</li>
                      <li>Event: Select <strong className="text-slate-800">Order creation</strong> (Format: <strong className="text-slate-800">JSON</strong>).</li>
                      <li>URL: Paste the <strong className="text-slate-800">Webhook Delivery URL</strong> shown above.</li>
                      <li>Webhook API version: Select <strong className="text-slate-800">2024-04 (Latest)</strong>.</li>
                      <li>Click <strong className="text-slate-800">Save</strong>. You will now receive every new order in real-time!</li>
                    </ol>
                  </div>

                </div>
              )}

              {/* TAB 3: Webhook Logs */}
              {activeTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">Recent Webhook Activity Logs</h4>
                      <p className="text-[11px] text-slate-500">
                        Tracks every incoming Shopify webhook event, HMAC signature verification status, delivery ID, and processing duration.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadLogs}
                        disabled={isLoadingLogs}
                        className="h-8 text-xs font-semibold border-slate-200 rounded-xl cursor-pointer gap-1"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", isLoadingLogs && "animate-spin")} />
                        <span>Refresh</span>
                      </Button>

                      {webhookLogs.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            if (confirm('Clear all webhook logs?')) {
                              await clearShopifyWebhookLogs();
                              loadLogs();
                            }
                          }}
                          className="h-8 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1" />
                          <span>Clear Logs</span>
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Logs Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-[360px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                          <tr>
                            <th className="px-3 py-2.5">Time</th>
                            <th className="px-3 py-2.5">Topic</th>
                            <th className="px-3 py-2.5">Order / Customer</th>
                            <th className="px-3 py-2.5">Total</th>
                            <th className="px-3 py-2.5">Status</th>
                            <th className="px-3 py-2.5">Duration</th>
                            <th className="px-3 py-2.5">HMAC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                          {isLoadingLogs ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                                Loading logs...
                              </td>
                            </tr>
                          ) : webhookLogs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400 font-sans">
                                No webhook activity recorded yet. Run a diagnostic test or create a test order on Shopify.
                              </td>
                            </tr>
                          ) : (
                            webhookLogs.map(log => {
                              const isSuccess = log.status === 'success';
                              const isFailed = log.status === 'failed';
                              const formattedDate = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                              return (
                                <tr 
                                  key={log.id} 
                                  className="hover:bg-slate-50/80 transition-colors"
                                >
                                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap font-sans">
                                    {formattedDate}
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-800 font-semibold font-sans">
                                    {log.topic}
                                  </td>
                                  <td className="px-3 py-2.5 font-sans">
                                    <div className="flex flex-col">
                                      <span className="font-semibold text-slate-900">{log.orderNumber || log.shopifyOrderId || '-'}</span>
                                      <span className="text-[10px] text-slate-400">{log.customerName || 'No Name'}</span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 font-sans font-bold text-slate-800">
                                    {log.total ? `৳${Number(log.total).toLocaleString()}` : '-'}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap font-sans">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1",
                                      isSuccess && "bg-emerald-100 text-emerald-800",
                                      isFailed && "bg-rose-100 text-rose-800",
                                      !isSuccess && !isFailed && "bg-slate-100 text-slate-700"
                                    )}>
                                      {isSuccess && <Check className="w-2.5 h-2.5" />}
                                      {isFailed && <X className="w-2.5 h-2.5" />}
                                      <span>{log.status.toUpperCase()}</span>
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap font-sans">
                                    {log.processingTimeMs}ms
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap font-sans">
                                    {log.signatureVerified ? (
                                      <span className="text-emerald-700 font-bold text-[10px] flex items-center gap-0.5">
                                        <Check className="w-3 h-3 text-emerald-600" />
                                        <span>Verified</span>
                                      </span>
                                    ) : (
                                      <span className="text-rose-600 font-bold text-[10px] flex items-center gap-0.5">
                                        <X className="w-3 h-3 text-rose-600" />
                                        <span>Failed</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
