"use client";

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, Shield, ShieldCheck, CheckCircle2, AlertCircle, Check,
  Plus, Trash2, Eye, EyeOff, Terminal, Zap, ArrowRight, Play, RefreshCw,
  Globe, Code2, Layers, Key, CheckCheck, HelpCircle, Activity, Sliders,
  Share2, Database, ShieldAlert
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { LogoLoader } from '@workspace/ui';

interface LinkPixelTabProps {
  linkId: string;
  linkData: any;
  onUpdated?: () => void;
}

export default function LinkPixelTab({ linkId, linkData, onUpdated }: LinkPixelTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Auto-Save Lifecycle & Indicator State
  type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const isInitialLoad = useRef(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  // Active UI Navigation Tab ('meta' | 'google' | 'rules')
  const [activeTab, setActiveTab] = useState<'meta' | 'google' | 'rules'>('meta');

  // Platform Execution Mode ('meta' | 'google' | 'both')
  const [activePlatform, setActivePlatform] = useState<'meta' | 'google' | 'both'>('both');

  // ─── Meta Ads Form State ──────────────────────────────────────────────────
  const [masterPixelId, setMasterPixelId] = useState('');
  const [backupPixelIds, setBackupPixelIds] = useState<string[]>([]);
  const [newBackupId, setNewBackupId] = useState('');
  const [capiToken, setCapiToken] = useState('');
  const [hasCapiToken, setHasCapiToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState('');
  const [enableCapi, setEnableCapi] = useState(true);
  const [enableLdu, setEnableLdu] = useState(false);

  // ─── Google Ads Form State ────────────────────────────────────────────────
  const [googleConversionId, setGoogleConversionId] = useState('');
  const [pageViewLabel, setPageViewLabel] = useState('');
  const [leadLabel, setLeadLabel] = useState('');
  const [purchaseLabel, setPurchaseLabel] = useState('');
  const [enableGoogleEnhancedConversions, setEnableGoogleEnhancedConversions] = useState(true);
  const [enableGoogleConsentMode, setEnableGoogleConsentMode] = useState(true);
  const [googleDefaultConsent, setGoogleDefaultConsent] = useState<'granted' | 'denied'>('granted');

  // ─── Shared Controls & Events ─────────────────────────────────────────────
  const [fireOnBots, setFireOnBots] = useState(false);
  const [trackPageViews, setTrackPageViews] = useState(true);
  const [trackOutbound, setTrackOutbound] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  // Logs & Diagnostics
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // New Event Modal / Input State
  const [newEventName, setNewEventName] = useState('Purchase');
  const [newTriggerType, setNewTriggerType] = useState('url_match');
  const [newSelector, setNewSelector] = useState('');
  const [newUrlPattern, setNewUrlPattern] = useState('thankyou.html');
  const [newEventValueKey, setNewEventValueKey] = useState('amount');
  const [newCurrency, setNewCurrency] = useState('INR');
  const [newCustomEventName, setNewCustomEventName] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  const fetchPixelConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/traffic-director/links/${linkId}/pixel`);
      const cfg = res.data?.data;
      if (cfg) {
        setActivePlatform('both');
        // Meta
        setMasterPixelId(cfg.masterPixelId || '');
        setBackupPixelIds(cfg.backupPixelIds || []);
        setHasCapiToken(Boolean(cfg.hasCapiToken));
        setTestEventCode(cfg.testEventCode || '');
        setEnableCapi(cfg.enableCapi !== false);
        setEnableLdu(Boolean(cfg.enableLdu));
        // Google Ads
        setGoogleConversionId(cfg.googleConversionId || '');
        const gLabels = cfg.googleConversionLabels || {};
        setPageViewLabel(gLabels.PageView || '');
        setLeadLabel(gLabels.Lead || '');
        setPurchaseLabel(gLabels.Purchase || '');
        setEnableGoogleEnhancedConversions(cfg.enableGoogleEnhancedConversions !== false);
        setEnableGoogleConsentMode(cfg.enableGoogleConsentMode !== false);
        setGoogleDefaultConsent(cfg.googleDefaultConsent === 'denied' ? 'denied' : 'granted');
        // Shared
        setFireOnBots(Boolean(cfg.fireOnBots));
        setTrackPageViews(cfg.trackPageViews !== false);
        setTrackOutbound(cfg.trackOutbound !== false);
        setEvents(cfg.events || []);
      }
    } catch (err) {
      // Configuration may not exist yet
    } finally {
      setLoading(false);
      setTimeout(() => {
        isInitialLoad.current = false;
        setSaveStatus('saved');
      }, 400);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.get(`/api/v1/traffic-director/links/${linkId}/pixel/logs?limit=30`);
      setLogs(res.data?.data || []);
    } catch (err) {
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (linkId) {
      fetchPixelConfig();
      fetchLogs();
    }
  }, [linkId]);

  const handleAddBackupPixel = () => {
    const clean = newBackupId.trim();
    if (!clean) return;
    if (!/^\d{12,18}$/.test(clean)) {
      toast.error('Pixel ID must be a 12-18 digit numeric ID');
      return;
    }
    if (clean === masterPixelId || backupPixelIds.includes(clean)) {
      toast.error('Pixel ID already added');
      return;
    }
    setBackupPixelIds([...backupPixelIds, clean]);
    setNewBackupId('');
  };

  const handleRemoveBackupPixel = (idToRemove: string) => {
    setBackupPixelIds(backupPixelIds.filter(id => id !== idToRemove));
  };

  const handleAddEvent = () => {
    const finalEventName = newEventName === 'Custom' ? newCustomEventName.trim() : newEventName;
    if (!finalEventName) {
      toast.error('Event name is required');
      return;
    }
    const newEvt: any = {
      id: 'temp_' + Date.now(),
      eventName: finalEventName,
      triggerType: newTriggerType,
      isEnabled: true
    };
    if (newTriggerType === 'url_match') {
      if (!newUrlPattern.trim()) {
        toast.error('URL path pattern is required (e.g. thankyou.html)');
        return;
      }
      newEvt.urlPattern = newUrlPattern.trim();
      if (newEventValueKey.trim()) newEvt.eventValueKey = newEventValueKey.trim();
      if (newCurrency.trim()) newEvt.currency = newCurrency.trim();
    } else {
      if (newSelector.trim()) newEvt.selector = newSelector.trim();
    }
    setEvents([...events, newEvt]);
    setNewSelector('');
    setNewUrlPattern('thankyou.html');
    setNewEventValueKey('amount');
    setNewCustomEventName('');
    setIsAddingEvent(false);
    toast.success(`Added ${finalEventName} trigger`);
  };

  const handleRemoveEvent = (idx: number) => {
    setEvents(events.filter((_, i) => i !== idx));
  };

  const saveConfiguration = async (isManual = false) => {
    const hasMeta = Boolean(masterPixelId.trim());
    const hasGoogle = Boolean(googleConversionId.trim());

    if (isManual) {
      if (!hasMeta && !hasGoogle) {
        toast.error('Please configure at least one Meta Pixel ID or Google Conversion ID');
        return false;
      }
    } else {
      // Auto-save guard: only save if configured properly to avoid dirty state on partial typing
      if (!hasMeta && !hasGoogle) return false;
    }

    try {
      setSaving(true);
      setSaveStatus('saving');
      isSavingRef.current = true;

      const googleConversionLabels: Record<string, string> = {};
      if (pageViewLabel.trim()) googleConversionLabels.PageView = pageViewLabel.trim();
      if (leadLabel.trim()) googleConversionLabels.Lead = leadLabel.trim();
      if (purchaseLabel.trim()) googleConversionLabels.Purchase = purchaseLabel.trim();

      await api.post(`/api/v1/traffic-director/links/${linkId}/pixel`, {
        activePlatform,
        // Meta
        masterPixelId: masterPixelId.trim() || undefined,
        backupPixelIds,
        capiToken: capiToken.trim() || undefined,
        testEventCode: testEventCode.trim() || null,
        enableCapi,
        enableLdu,
        // Google Ads
        googleConversionId: googleConversionId.trim() || undefined,
        googleConversionLabels,
        enableGoogleEnhancedConversions,
        enableGoogleConsentMode,
        googleDefaultConsent,
        // Shared
        fireOnBots,
        trackPageViews,
        trackOutbound,
        events
      });

      setSaveStatus('saved');
      if (capiToken) {
        setHasCapiToken(true);
        setCapiToken('');
      }
      if (isManual) {
        toast.success('Universal Advertising Pixel configuration saved!');
      }
      if (onUpdated) onUpdated();
      return true;
    } catch (err: any) {
      setSaveStatus('error');
      if (isManual) {
        toast.error(err.response?.data?.error || 'Failed to save configuration');
      }
      return false;
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  // 800ms Debounced Auto-Save
  useEffect(() => {
    if (isInitialLoad.current) return;

    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveConfiguration(false);
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [
    activePlatform,
    masterPixelId,
    backupPixelIds,
    capiToken,
    testEventCode,
    enableCapi,
    enableLdu,
    googleConversionId,
    pageViewLabel,
    leadLabel,
    purchaseLabel,
    enableGoogleEnhancedConversions,
    enableGoogleConsentMode,
    googleDefaultConsent,
    fireOnBots,
    trackPageViews,
    trackOutbound,
    events
  ]);

  const handleSendTestEvent = async () => {
    if (!masterPixelId && !googleConversionId) {
      toast.error('Configure and save a Meta Pixel ID or Google Conversion ID first');
      return;
    }

    try {
      setSimulating(true);
      const res = await api.post('/api/v1/traffic-director/pixel/event', {
        slug: linkData.slug,
        eventName: 'Lead',
        eventId: 'test_evt_' + Date.now(),
        eventSourceUrl: window.location.href,
        customData: {
          content_name: 'Test Verification Event',
          currency: 'USD',
          value: 49.99
        },
        userData: {
          email: 'test.verification@example.com',
          phone: '+15551234567',
          firstName: 'Alex',
          lastName: 'Morgan',
          city: 'Austin',
          state: 'TX',
          postalCode: '78701',
          country: 'US'
        },
        isBot: false
      });

      if (res.data?.success) {
        toast.success('Test conversion dispatched! Check Meta Events Manager / Google Ads Diagnostics.');
        fetchLogs();
      } else {
        toast.error(res.data?.error || 'Test event failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to dispatch test event');
    } finally {
      setSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center space-y-3">
        <LogoLoader />
        <span className="text-xs text-gray-500 dark:text-gray-400">Loading Universal Pixel Manager...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Platform Selector & Tab Switcher Bar ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 shadow-xs">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('meta')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'meta'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Meta Ads (Pixel & CAPI)
          </button>

          <button
            onClick={() => setActiveTab('google')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'google'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            Google Ads (gtag & Enhanced)
          </button>

          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'rules'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            <Zap className="w-4 h-4" />
            Triggers & Bot Shield
          </button>
        </div>

        {/* Auto-Save Status Indicator & Manual Save Button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 text-xs">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-amber-500 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCheck className="w-3.5 h-3.5" />
                  Saved
                </span>
              )}
              {saveStatus === 'unsaved' && (
                <span className="flex items-center gap-1 text-amber-500 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  Unsaved
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1 text-rose-500 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Save error
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => saveConfiguration(true)}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Changes
            </button>
          </div>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Column 1 & 2: Dynamic Form Panels ─── */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* ══════════ TAB 1: META ADS CONFIGURATION ══════════ */}
          {activeTab === 'meta' && (
            <div className="space-y-6">
              {/* Card 1: Multi-Pixel Setup */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Code2 className="w-4 h-4 text-indigo-500" />
                      Meta Pixel ID Configuration
                    </h4>
                    <p className="text-[11px] text-gray-500">Configure master ad set pixel and backup audit pixels</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    fbevents.js v2.0
                  </span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Master Meta Pixel ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={masterPixelId}
                      onChange={(e) => setMasterPixelId(e.target.value)}
                      placeholder="e.g. 1772842000633783 (Numeric 12-18 digits)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Backup Pixels */}
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Secondary & Agency Backup Pixels
                    </label>
                    <div className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={newBackupId}
                        onChange={(e) => setNewBackupId(e.target.value)}
                        placeholder="Enter backup pixel ID"
                        className="flex-1 px-3.5 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleAddBackupPixel}
                        className="px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-semibold text-gray-800 dark:text-gray-200 transition shrink-0 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>

                    {backupPixelIds.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {backupPixelIds.map((id) => (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-[11px] font-mono text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-zinc-700"
                          >
                            {id}
                            <button
                              onClick={() => handleRemoveBackupPixel(id)}
                              className="hover:text-rose-500 transition"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 2: Meta Conversions API (CAPI) */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-purple-500" />
                      Meta Conversions API (Server-Side CAPI v19.0+)
                    </h4>
                    <p className="text-[11px] text-gray-500">AES-256 encrypted token vault for deduplicated server-to-server tracking</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    AES-256-GCM Vault
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        CAPI System User Access Token
                      </label>
                      {hasCapiToken && (
                        <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" />
                          Active Vaulted Token
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <input
                        type={showToken ? 'text' : 'password'}
                        value={capiToken}
                        onChange={(e) => setCapiToken(e.target.value)}
                        placeholder={hasCapiToken ? '●●●●●●●●●●●●●●●●●●●● (Paste new token to update)' : 'EAAB... (Paste Meta CAPI System User Token)'}
                        className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowToken(!showToken)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                      >
                        {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Meta Test Event Code (Optional)
                    </label>
                    <input
                      type="text"
                      value={testEventCode}
                      onChange={(e) => setTestEventCode(e.target.value)}
                      placeholder="e.g. TEST12345 (From Meta Events Manager -> Test Events)"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* Toggles */}
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-2.5">
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">Enable Server-Side CAPI</span>
                        <p className="text-[11px] text-gray-500">Dispatch events server-to-server for ad blocker and iOS 14.5 recovery</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableCapi}
                        onChange={(e) => setEnableCapi(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">Limited Data Use (LDU / CCPA)</span>
                        <p className="text-[11px] text-gray-500">Enable Meta California Consumer Privacy Act (CPRA/CCPA) compliance flag</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableLdu}
                        onChange={(e) => setEnableLdu(e.target.checked)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB 2: GOOGLE ADS CONFIGURATION ══════════ */}
          {activeTab === 'google' && (
            <div className="space-y-6">
              {/* Card 1: Google Tag & Enhanced Conversions */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-emerald-500" />
                      Google Tag (gtag.js) & Conversion Tracking
                    </h4>
                    <p className="text-[11px] text-gray-500">Set up Google Ads conversion tracking and Smart Bidding signals</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Google Ads API v18
                  </span>
                </div>

                <div className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Google Conversion ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={googleConversionId}
                      onChange={(e) => setGoogleConversionId(e.target.value)}
                      placeholder="e.g. AW-123456789 or 123456789"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-mono text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-[10.5px] text-gray-500 mt-1">Found in Google Ads under Tools & Settings &gt; Conversions &gt; Tag Setup</p>
                  </div>

                  {/* Conversion Action Labels Mapping */}
                  <div className="pt-2 border-t border-gray-100 dark:border-white/5 space-y-3">
                    <label className="block text-xs font-semibold text-gray-800 dark:text-gray-200">
                      Conversion Action Labels (send_to Mapping)
                    </label>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                          Lead Conversion Label:
                        </span>
                        <input
                          type="text"
                          value={leadLabel}
                          onChange={(e) => setLeadLabel(e.target.value)}
                          placeholder="AW-XXXXX/AbC_123"
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400 block mb-1">
                          Purchase Conversion Label:
                        </span>
                        <input
                          type="text"
                          value={purchaseLabel}
                          onChange={(e) => setPurchaseLabel(e.target.value)}
                          placeholder="AW-XXXXX/XyZ_456"
                          className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-mono text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Enhanced Conversions Toggle */}
                  <div className="pt-3 border-t border-gray-100 dark:border-white/5 space-y-3">
                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">Enable Google Enhanced Conversions</span>
                        <p className="text-[11px] text-gray-500">Automatically hash and pass first-party lead data (email, phone, address) to recover Safari conversions</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableGoogleEnhancedConversions}
                        onChange={(e) => setEnableGoogleEnhancedConversions(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between text-xs cursor-pointer">
                      <div>
                        <span className="font-semibold text-gray-800 dark:text-gray-200">Enforce Google Consent Mode v2</span>
                        <p className="text-[11px] text-gray-500">Sets ad_storage, ad_user_data, and ad_personalization signals before tag evaluation</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={enableGoogleConsentMode}
                        onChange={(e) => setEnableGoogleConsentMode(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                      />
                    </label>

                    {enableGoogleConsentMode && (
                      <div className="flex items-center justify-between pl-4 text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Default Baseline Consent State:</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setGoogleDefaultConsent('granted')}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition ${
                              googleDefaultConsent === 'granted'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Granted (Global)
                          </button>
                          <button
                            type="button"
                            onClick={() => setGoogleDefaultConsent('denied')}
                            className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition ${
                              googleDefaultConsent === 'denied'
                                ? 'bg-amber-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
                            }`}
                          >
                            Denied (Strict EEA)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════ TAB 3: CONVERSION TRIGGERS & BOT SHIELD ══════════ */}
          {activeTab === 'rules' && (
            <div className="space-y-6">
              {/* Bot Shielding & Machine Learning Protection */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-3.5 shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      Advertising Algorithm & Bot Protection
                    </h4>
                    <p className="text-[11px] text-gray-500">Prevent Google & Meta machine learning models from getting poisoned by bot traffic</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">Bot Shield Conversion Gating</span>
                      <p className="text-[11px] text-gray-500">Checks WebGL hardware rasterizer, touch points, and webdriver flags to suppress conversion firing on crawlers</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={!fireOnBots}
                      onChange={(e) => setFireOnBots(!e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">Automatic PageView Firing</span>
                      <p className="text-[11px] text-gray-500">Automatically fires PageView on initial landing and client-side SPA history pushes</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={trackPageViews}
                      onChange={(e) => setTrackPageViews(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>

                  <label className="flex items-center justify-between text-xs cursor-pointer">
                    <div>
                      <span className="font-semibold text-gray-800 dark:text-gray-200">Track Outbound Link Clicks</span>
                      <p className="text-[11px] text-gray-500">Listens for external button clicks and routes them through configured ad triggers</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={trackOutbound}
                      onChange={(e) => setTrackOutbound(e.target.checked)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Conversion Trigger Rules Table */}
              <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-xs">
                <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Universal Conversion Event Triggers
                    </h4>
                    <p className="text-[11px] text-gray-500">Automatically captures and fires conversions across both Meta and Google Ads</p>
                  </div>
                  <button
                    onClick={() => setIsAddingEvent(true)}
                    className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Event Trigger
                  </button>
                </div>

                {isAddingEvent && (
                  <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-zinc-700 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Event Name (Meta & Google Standard)
                        </label>
                        <select
                          value={newEventName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setNewEventName(val);
                            if (val === 'Purchase' || val === 'Donate') {
                              setNewTriggerType('url_match');
                              setNewUrlPattern('thankyou.html');
                            }
                          }}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <optgroup label="E-Commerce & Transactions">
                            <option value="Purchase">Purchase (Order Confirmation)</option>
                            <option value="Donate">Donate (Charity / NGO Contribution)</option>
                            <option value="InitiateCheckout">InitiateCheckout (Checkout Started)</option>
                            <option value="AddPaymentInfo">AddPaymentInfo (Payment Entered)</option>
                            <option value="AddToCart">AddToCart (Cart Added)</option>
                            <option value="AddToWishlist">AddToWishlist (Wishlist Added)</option>
                            <option value="ViewContent">ViewContent (Product / Offer Viewed)</option>
                          </optgroup>
                          <optgroup label="Lead Gen & User Actions">
                            <option value="Lead">Lead (Form Submit / Inquiry)</option>
                            <option value="CompleteRegistration">CompleteRegistration (Sign Up / KYC)</option>
                            <option value="SubmitApplication">SubmitApplication (Application Filed)</option>
                            <option value="Contact">Contact (Phone / WhatsApp / Email)</option>
                            <option value="Schedule">Schedule (Appointment / Demo Booked)</option>
                            <option value="StartTrial">StartTrial (Free Trial Started)</option>
                            <option value="Subscribe">Subscribe (Paid Subscription)</option>
                          </optgroup>
                          <optgroup label="Search & Discovery">
                            <option value="Search">Search (Site Search)</option>
                            <option value="CustomizeProduct">CustomizeProduct (Configured Option)</option>
                            <option value="FindLocation">FindLocation (Store / Center Found)</option>
                          </optgroup>
                          <optgroup label="Custom Events">
                            <option value="Custom">Custom Event Name...</option>
                          </optgroup>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Trigger Mechanism
                        </label>
                        <select
                          value={newTriggerType}
                          onChange={(e) => setNewTriggerType(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="url_match">URL Match / Page Visit (e.g. thankyou.html)</option>
                          <option value="form_submit">Form Submit (Captures Inputs + User Data)</option>
                          <option value="click">Element / Button Click (CSS Selector)</option>
                        </select>
                      </div>
                    </div>

                    {newEventName === 'Custom' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Custom Event Name (e.g. DonationStep2, DownloadPDF)
                        </label>
                        <input
                          type="text"
                          value={newCustomEventName}
                          onChange={(e) => setNewCustomEventName(e.target.value)}
                          placeholder="Enter alphanumeric event name"
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    {newTriggerType === 'url_match' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            URL Pattern / Path <span className="text-rose-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={newUrlPattern}
                            onChange={(e) => setNewUrlPattern(e.target.value)}
                            placeholder="e.g. thankyou.html, /success, *order*"
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Value Query Key (Optional)
                          </label>
                          <input
                            type="text"
                            value={newEventValueKey}
                            onChange={(e) => setNewEventValueKey(e.target.value)}
                            placeholder="e.g. amount, value, price"
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                            Currency
                          </label>
                          <input
                            type="text"
                            value={newCurrency}
                            onChange={(e) => setNewCurrency(e.target.value.toUpperCase())}
                            placeholder="e.g. INR, USD, EUR"
                            className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    )}

                    {newTriggerType === 'form_submit' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Form CSS Selector (Optional, leave blank to match all forms)
                        </label>
                        <input
                          type="text"
                          value={newSelector}
                          onChange={(e) => setNewSelector(e.target.value)}
                          placeholder="e.g. #donation-form, form.lead-capture"
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    {newTriggerType === 'click' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                          Button / Element CSS Selector <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={newSelector}
                          onChange={(e) => setNewSelector(e.target.value)}
                          placeholder="e.g. #donate-now-btn, .checkout-btn, button[type='submit']"
                          className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setIsAddingEvent(false)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddEvent}
                        className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
                      >
                        Save Rule
                      </button>
                    </div>
                  </div>
                )}

                {events.length === 0 ? (
                  <div className="py-6 text-center text-xs text-gray-400">
                    No custom event rules configured. PageViews and auto-detected form leads will fire by default.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((evt, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/80 dark:border-zinc-800 text-xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          <div>
                            <span className="font-bold text-gray-900 dark:text-white">{evt.eventName}</span>
                            <span className="ml-2 text-[10.5px] text-gray-400 font-mono">
                              Trigger: {evt.triggerType}
                              {evt.triggerType === 'url_match' && evt.urlPattern
                                ? ` (Pattern: ${evt.urlPattern}${evt.eventValueKey ? `, Key: ?${evt.eventValueKey}=...` : ''}${evt.currency ? ` [${evt.currency}]` : ''})`
                                : evt.selector ? ` (${evt.selector})` : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveEvent(idx)}
                          className="text-gray-400 hover:text-rose-500 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ─── Column 3: Live Verification & Conversion Telemetry Logs ─── */}
        <div className="space-y-6">
          {/* Card: Live Test Event Verification */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Play className="w-4 h-4 text-emerald-500" />
                Live Event Verification
              </h4>
              <button
                onClick={handleSendTestEvent}
                disabled={simulating}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {simulating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3 h-3" />}
                {simulating ? 'Sending...' : 'Test Event'}
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-relaxed">
              Dispatches a simulated Lead conversion through the backend pipeline with SHA-256 hashed customer parameters. Open <strong>Meta Events Manager &gt; Test Events</strong> or Google Tag Assistant to verify delivery.
            </p>
          </div>

          {/* Card: Real-time Conversion Log Inspector */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Recent Conversion Logs</h4>
              </div>
              <button
                onClick={fetchLogs}
                disabled={loadingLogs}
                className="text-[11px] text-indigo-500 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            <div className="space-y-2 max-h-[440px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No conversion logs recorded yet. Events will appear here as visitors interact with your pages.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-zinc-800 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-gray-900 dark:text-white flex items-center gap-1.5">
                        {log.eventName}
                        {log.platform && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-500 border border-indigo-500/20 font-bold uppercase">
                            {log.platform}
                          </span>
                        )}
                        {log.isBotFiltered && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Bot Suppressed
                          </span>
                        )}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        log.capiFired ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        {log.capiFired ? 'CAPI Sent' : log.capiStatus || 'Local Hit'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10.5px] text-gray-400 font-mono">
                      <span className="truncate max-w-[150px]">ID: {log.eventId}</span>
                      <span>{log.capiLatencyMs ? `${log.capiLatencyMs}ms` : ''}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
