"use client";

import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Shield, ShieldCheck, CheckCircle2, AlertCircle, Copy, Check,
  Plus, Trash2, Eye, EyeOff, Terminal, Zap, ArrowRight, Play, RefreshCw,
  Globe, Code2, Layers, Key, CheckCheck, HelpCircle, Activity
} from 'lucide-react';
import api, { getApiBase } from '@/lib/api';
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
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Form State
  const [masterPixelId, setMasterPixelId] = useState('');
  const [backupPixelIds, setBackupPixelIds] = useState<string[]>([]);
  const [newBackupId, setNewBackupId] = useState('');
  const [capiToken, setCapiToken] = useState('');
  const [hasCapiToken, setHasCapiToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState('');
  const [enableCapi, setEnableCapi] = useState(true);
  const [fireOnBots, setFireOnBots] = useState(false);
  const [trackPageViews, setTrackPageViews] = useState(true);
  const [events, setEvents] = useState<any[]>([]);

  // Logs & Diagnostics
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [simulating, setSimulating] = useState(false);

  // New Event Modal / Input State
  const [newEventName, setNewEventName] = useState('Lead');
  const [newTriggerType, setNewTriggerType] = useState('form_submit');
  const [newSelector, setNewSelector] = useState('');
  const [isAddingEvent, setIsAddingEvent] = useState(false);

  const fetchPixelConfig = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/traffic-director/links/${linkId}/pixel`);
      const cfg = res.data?.data;
      if (cfg) {
        setMasterPixelId(cfg.masterPixelId || '');
        setBackupPixelIds(cfg.backupPixelIds || []);
        setHasCapiToken(Boolean(cfg.hasCapiToken));
        setTestEventCode(cfg.testEventCode || '');
        setEnableCapi(cfg.enableCapi !== false);
        setFireOnBots(Boolean(cfg.fireOnBots));
        setTrackPageViews(cfg.trackPageViews !== false);
        setEvents(cfg.events || []);
      }
    } catch (err) {
      // Configuration may not exist yet
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoadingLogs(true);
      const res = await api.get(`/api/v1/traffic-director/links/${linkId}/pixel/logs?limit=25`);
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
    if (!newEventName) {
      toast.error('Event name is required');
      return;
    }
    const newEvt = {
      id: 'temp_' + Date.now(),
      eventName: newEventName,
      triggerType: newTriggerType,
      selector: newSelector.trim() || undefined,
      isEnabled: true
    };
    setEvents([...events, newEvt]);
    setNewSelector('');
    setIsAddingEvent(false);
    toast.success(`Added ${newEventName} trigger`);
  };

  const handleRemoveEvent = (idx: number) => {
    setEvents(events.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!masterPixelId.trim()) {
      toast.error('Master Meta Pixel ID is required');
      return;
    }

    try {
      setSaving(true);
      await api.post(`/api/v1/traffic-director/links/${linkId}/pixel`, {
        masterPixelId: masterPixelId.trim(),
        backupPixelIds,
        capiToken: capiToken.trim() || undefined,
        testEventCode: testEventCode.trim() || null,
        enableCapi,
        fireOnBots,
        trackPageViews,
        events
      });
      toast.success('Universal Pixel configuration saved successfully!');
      if (capiToken) {
        setHasCapiToken(true);
        setCapiToken('');
      }
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSendTestEvent = async () => {
    if (!masterPixelId) {
      toast.error('Save a Master Pixel ID first');
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
          phone: '+15551234567'
        },
        isBot: false
      });

      if (res.data?.success) {
        toast.success('Test conversion dispatched! Check Meta Events Manager.');
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

  const [domainMode, setDomainMode] = useState<'dedicated' | 'custom' | 'platform'>(
    linkData?.customDomain ? 'custom' : 'dedicated'
  );

  const dedicatedCdnUrl = process.env.NEXT_PUBLIC_TRAFFIC_DIRECTOR_CDN_URL || 'trk.180traffic.com';
  const apiBase = typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BACKEND_URL || window.location.origin)
    : '';

  const getSelectedHost = () => {
    if (domainMode === 'custom' && linkData?.customDomain) {
      return `https://${linkData.customDomain.replace(/\/+$/, '')}`;
    }
    if (domainMode === 'dedicated') {
      return `https://${dedicatedCdnUrl.replace(/\/+$/, '')}`;
    }
    return apiBase.replace(/\/+$/, '');
  };

  const snippetTag = `<script src="${getSelectedHost()}/tag/${linkData?.slug || 'slug'}.js" async></script>`;

  const copySnippet = () => {
    navigator.clipboard.writeText(snippetTag);
    setCopied(true);
    toast.success('Snippet tag copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
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
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ─── Hero Banner ─── */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Universal Meta Pixel & CAPI
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Bot Shield Protected
            </span>
          </div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">
            Universal Meta Pixel & Conversions API (CAPI) Manager
          </h3>
          <p className="text-xs text-gray-600 dark:text-gray-300 max-w-2xl leading-relaxed">
            Install the 1-line tag on your landing pages once. Remotely deploy and swap Meta Pixel IDs, configure custom conversion triggers, and deduplicate with server-side CAPI with zero code changes.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={copySnippet}
            className="px-3.5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:border-indigo-400 transition flex items-center gap-2 cursor-pointer shadow-xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Tag' : 'Copy Script Tag'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md transition flex items-center gap-1.5 cursor-pointer"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {/* ─── 1-Line Remote Tag Embed Card with Domain Switcher ─── */}
      <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-3.5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-white/5 pb-3">
          <div>
            <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-indigo-500" />
              1-Line Universal Tracking Script Snippet
            </h4>
            <p className="text-[11px] text-gray-500">Paste this script tag into the &lt;head&gt; of your landing page, Shopify theme, or WordPress header</p>
          </div>

          {/* Domain Mode Selector */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => setDomainMode('dedicated')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                domainMode === 'dedicated'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Dedicated CDN (trk.180traffic.com)
            </button>
            {linkData?.customDomain && (
              <button
                type="button"
                onClick={() => setDomainMode('custom')}
                className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                  domainMode === 'custom'
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                Custom CNAME ({linkData.customDomain})
              </button>
            )}
            <button
              type="button"
              onClick={() => setDomainMode('platform')}
              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-semibold transition cursor-pointer ${
                domainMode === 'platform'
                  ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Direct Platform URL
            </button>
          </div>
        </div>

        <div className="relative">
          <pre className="p-3.5 rounded-xl bg-gray-950 text-indigo-300 font-mono text-[11.5px] overflow-x-auto border border-white/5 select-all">
            <code>{snippetTag}</code>
          </pre>
          <button
            onClick={copySnippet}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-semibold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Column 1 & 2: Pixel Configuration Form ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Multi-Pixel Setup */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-indigo-500" />
                  Meta Pixel ID Configuration
                </h4>
                <p className="text-[11px] text-gray-500">Add primary agency and backup audit pixels</p>
              </div>
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
                  placeholder="e.g. 123456789012345"
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
                  Meta Conversions API (Server-Side CAPI)
                </h4>
                <p className="text-[11px] text-gray-500">Encrypted token vault for server-side deduplication</p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                AES-256-GCM Vault
              </span>
            </div>

            <div className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    CAPI Access Token
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
                    <p className="text-[11px] text-gray-500">Dispatch events server-to-server for ad blocker recovery</p>
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
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Bot Shield Conversion Gating</span>
                    <p className="text-[11px] text-gray-500">Suppress pixel/CAPI firing for review bots, emulators, and datacenter IPs</p>
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
                    <span className="font-semibold text-gray-800 dark:text-gray-200">Auto-track PageViews</span>
                    <p className="text-[11px] text-gray-500">Automatically fire PageView on page load and SPA route changes</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={trackPageViews}
                    onChange={(e) => setTrackPageViews(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Card 3: Custom Conversion Trigger Rules */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-3">
              <div>
                <h4 className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Conversion Event Trigger Rules
                </h4>
                <p className="text-[11px] text-gray-500">Automatically capture Leads, Purchases, and custom clicks</p>
              </div>
              <button
                onClick={() => setIsAddingEvent(true)}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Event
              </button>
            </div>

            {isAddingEvent && (
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-zinc-700 space-y-3 animate-in fade-in">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Event Name
                    </label>
                    <select
                      value={newEventName}
                      onChange={(e) => setNewEventName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Lead">Lead (Form Submit)</option>
                      <option value="AddToCart">AddToCart (Button Click)</option>
                      <option value="Purchase">Purchase (Checkout/Thank You)</option>
                      <option value="CompleteRegistration">CompleteRegistration</option>
                      <option value="Contact">Contact</option>
                      <option value="Custom">Custom Event</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                      Trigger Type
                    </label>
                    <select
                      value={newTriggerType}
                      onChange={(e) => setNewTriggerType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="form_submit">Form Submit</option>
                      <option value="click">Element / Button Click</option>
                      <option value="url_match">URL Match</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    CSS Selector (Optional, e.g. #lead-form, .cta-btn)
                  </label>
                  <input
                    type="text"
                    value={newSelector}
                    onChange={(e) => setNewSelector(e.target.value)}
                    placeholder="Leave blank to match all forms or enter selector"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-zinc-700 text-xs font-mono text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={() => setIsAddingEvent(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddEvent}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs"
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
                          Trigger: {evt.triggerType} {evt.selector ? `(${evt.selector})` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveEvent(idx)}
                      className="text-gray-400 hover:text-rose-500 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─── Column 3: Live Test & Event Diagnostics ─── */}
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
              Dispatches a simulated Lead conversion through the backend CAPI pipeline with SHA-256 hashed test credentials. Open <strong>Meta Events Manager &gt; Test Events</strong> to watch it appear in real-time.
            </p>
          </div>

          {/* Card: Real-time Conversion Log Inspector */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-500" />
                <h4 className="text-xs font-bold text-gray-900 dark:text-white">Recent CAPI Logs</h4>
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

            <div className="space-y-2 max-h-[420px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400">
                  No conversion logs recorded yet. Events will appear here as visitors interact with your pages.
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200/80 dark:border-zinc-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span className="text-gray-900 dark:text-white flex items-center gap-1.5">
                        {log.eventName}
                        {log.isBotFiltered && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            Bot Suppressed
                          </span>
                        )}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        log.capiFired ? 'bg-emerald-500/10 text-emerald-500' : 'bg-gray-500/10 text-gray-400'
                      }`}>
                        {log.capiFired ? 'CAPI Sent' : log.capiStatus || 'Local'}
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
