"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Sparkles, Shield, ShieldCheck, Zap, Activity, CheckCircle2, AlertCircle, 
  Copy, Check, ExternalLink, RefreshCw, Plus, Search, Filter, Terminal, 
  Code2, ArrowRight, Layers, Key, Eye, EyeOff, Play, Globe, CheckCheck,
  ChevronRight, Laptop, ShoppingBag, HelpCircle
} from 'lucide-react';
import api, { getApiBase } from '@/lib/api';
import toast from 'react-hot-toast';
import { LogoLoader } from '@workspace/ui';
import clsx from 'clsx';
import { useSubscription } from '@/lib/useSubscription';

interface PixelEventDef {
  id?: string;
  eventName: string;
  triggerType: string;
  selector?: string;
  urlPattern?: string;
  eventValueKey?: string;
  currency?: string;
  isEnabled?: boolean;
}

interface LinkWithPixel {
  id: string;
  name: string;
  slug: string;
  fallbackUrl: string;
  customDomain?: string | null;
  isActive: boolean;
  pixelConfig?: {
    id: string;
    masterPixelId: string;
    backupPixelIds: string[];
    hasCapiToken?: boolean;
    capiTokenEnc?: string | null;
    testEventCode?: string | null;
    enableCapi: boolean;
    fireOnBots: boolean;
    trackPageViews: boolean;
    trackOutbound: boolean;
    events: PixelEventDef[];
    updatedAt: string;
  } | null;
}

export default function UniversalPixelManagerPage() {
  const { isSubscriptionActive, planName } = useSubscription();
  const [links, setLinks] = useState<LinkWithPixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'configured' | 'unconfigured'>('all');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Quick edit modal state
  const [selectedLink, setSelectedLink] = useState<LinkWithPixel | null>(null);
  const [masterPixelId, setMasterPixelId] = useState('');
  const [backupPixelIds, setBackupPixelIds] = useState<string[]>([]);
  const [newBackupId, setNewBackupId] = useState('');
  const [capiToken, setCapiToken] = useState('');
  const [hasCapiToken, setHasCapiToken] = useState(false);
  const [testEventCode, setTestEventCode] = useState('');
  const [enableCapi, setEnableCapi] = useState(true);
  const [fireOnBots, setFireOnBots] = useState(false);
  const [trackPageViews, setTrackPageViews] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [showToken, setShowToken] = useState(false);

  // Universal Tag Generator state
  const [mounted, setMounted] = useState(false);
  const [tagPlatform, setTagPlatform] = useState<'html' | 'shopify' | 'wordpress' | 'webflow'>('html');
  const [activeTagSlug, setActiveTagSlug] = useState<string>('');
  const [verifyUrl, setVerifyUrl] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<any>(null);

  // Live conversion logs state
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [simulatingEvent, setSimulatingEvent] = useState(false);

  const fetchLinks = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/traffic-director/links', {
        params: { limit: 100 }
      });
      const items = res.data?.data?.links || [];
      setLinks(items);
      if (items.length > 0 && !activeTagSlug) {
        setActiveTagSlug(items[0].slug);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to load tracking links');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPixelLogs = async () => {
    try {
      setLoadingLogs(true);
      // Fetch recent traffic logs that contain pixel or conversions telemetry
      const res = await api.get('/api/v1/traffic-director/logs', {
        params: { limit: 20 }
      });
      setLogs(res.data?.data?.logs || []);
    } catch (err) {
      // Non-blocking
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchLinks();
    fetchAllPixelLogs();
  }, []);

  // Filter links
  const filteredLinks = links.filter(link => {
    const matchesSearch = link.name.toLowerCase().includes(search.toLowerCase()) || 
                          link.slug.toLowerCase().includes(search.toLowerCase()) ||
                          link.pixelConfig?.masterPixelId?.includes(search);
    if (!matchesSearch) return false;
    if (filterMode === 'configured') return Boolean(link.pixelConfig?.masterPixelId);
    if (filterMode === 'unconfigured') return !link.pixelConfig?.masterPixelId;
    return true;
  });

  // Calculate high-level KPIs
  const totalConfigured = links.filter(l => l.pixelConfig?.masterPixelId).length;
  const totalCapiActive = links.filter(l => l.pixelConfig?.enableCapi && (l.pixelConfig?.hasCapiToken || l.pixelConfig?.capiTokenEnc)).length;
  const totalBackupPixels = links.reduce((acc, l) => acc + (l.pixelConfig?.backupPixelIds?.length || 0), 0);
  const totalBotGated = links.filter(l => l.pixelConfig?.fireOnBots === false).length;

  const openConfigModal = (link: LinkWithPixel) => {
    setSelectedLink(link);
    const cfg = link.pixelConfig;
    if (cfg) {
      setMasterPixelId(cfg.masterPixelId || '');
      setBackupPixelIds(cfg.backupPixelIds || []);
      setHasCapiToken(Boolean(cfg.hasCapiToken || cfg.capiTokenEnc));
      setTestEventCode(cfg.testEventCode || '');
      setEnableCapi(cfg.enableCapi !== false);
      setFireOnBots(Boolean(cfg.fireOnBots));
      setTrackPageViews(cfg.trackPageViews !== false);
    } else {
      setMasterPixelId('');
      setBackupPixelIds([]);
      setHasCapiToken(false);
      setTestEventCode('');
      setEnableCapi(true);
      setFireOnBots(false);
      setTrackPageViews(true);
    }
    setCapiToken('');
    setNewBackupId('');
  };

  const handleAddBackupPixel = () => {
    const clean = newBackupId.trim();
    if (!clean) return;
    if (!/^\d{12,18}$/.test(clean)) {
      toast.error('Pixel ID must be a 12-18 digit numeric ID');
      return;
    }
    if (clean === masterPixelId || backupPixelIds.includes(clean)) {
      toast.error('Pixel ID already present');
      return;
    }
    setBackupPixelIds([...backupPixelIds, clean]);
    setNewBackupId('');
  };

  const handleSaveModal = async () => {
    if (!selectedLink) return;
    if (!masterPixelId.trim()) {
      toast.error('Master Pixel ID is required');
      return;
    }

    try {
      setSavingConfig(true);
      await api.post(`/api/v1/traffic-director/links/${selectedLink.id}/pixel`, {
        masterPixelId: masterPixelId.trim(),
        backupPixelIds,
        capiToken: capiToken.trim() || undefined,
        testEventCode: testEventCode.trim() || null,
        enableCapi,
        fireOnBots,
        trackPageViews,
      });

      toast.success('Universal Pixel configuration saved successfully!');
      setSelectedLink(null);
      fetchLinks();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to save pixel configuration');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSendTestConversion = async (slug: string) => {
    try {
      setSimulatingEvent(true);
      const res = await api.post('/api/v1/traffic-director/pixel/event', {
        slug: slug || activeTagSlug || links[0]?.slug,
        eventName: 'Lead',
        eventId: 'test_capi_' + Date.now(),
        eventSourceUrl: window.location.href,
        customData: {
          content_name: 'Universal Pixel Test Lead',
          currency: 'USD',
          value: 99.00
        },
        userData: {
          email: 'simplicion.lead@example.com',
          phone: '+15559876543'
        },
        isBot: false
      });

      if (res.data?.success) {
        toast.success('Test conversion dispatched via CAPI & Browser deduplication!');
        fetchAllPixelLogs();
      } else {
        toast.error(res.data?.error || 'Test event failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send test conversion');
    } finally {
      setSimulatingEvent(false);
    }
  };

  const handleVerifyTag = async () => {
    if (!verifyUrl.trim()) {
      toast.error('Please enter a target webpage URL');
      return;
    }
    try {
      setVerifying(true);
      setVerifyResult(null);
      const res = await api.post('/api/v1/traffic-director/verify-tag', {
        url: verifyUrl.trim(),
        slug: activeTagSlug
      });
      setVerifyResult(res.data);
      if (res.data?.verified) {
        toast.success('Universal Tag detected successfully!');
      } else {
        toast.error('Tag not detected on this page. Check installation.');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to verify tag installation');
      setVerifyResult({ verified: false, error: err.message });
    } finally {
      setVerifying(false);
    }
  };

  const copyCode = (text: string, identifier: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSlug(identifier);
    toast.success('Snippet copied to clipboard');
    setTimeout(() => setCopiedSlug(null), 2000);
  };

  const apiBase = getApiBase();
  const tagUrl = `${apiBase}/api/v1/traffic-director/tag/${activeTagSlug || 'my-link'}.js`;

  const getPlatformSnippet = () => {
    switch (tagPlatform) {
      case 'shopify':
        return `<!-- 180 Traffic Director: Universal Meta Pixel & CAPI for Shopify theme.liquid -->
<script src="${tagUrl}" async></script>
<script>
  window.addEventListener('load', function() {
    if (window._180td && window.Shopify && window.Shopify.checkout) {
      _180td.track('Purchase', {
        value: Shopify.checkout.total_price / 100,
        currency: Shopify.checkout.currency,
        content_name: 'Shopify Checkout'
      });
    }
  });
</script>`;
      case 'wordpress':
        return `<!-- Add to functions.php or Theme Header (header.php) -->
<?php
add_action('wp_head', function() {
    echo '<script src="${tagUrl}" async></script>';
});
?>`;
      case 'webflow':
        return `<!-- 180 Traffic Director: Webflow Custom Code (Inside <head> tag) -->
<script src="${tagUrl}" async></script>`;
      case 'html':
      default:
        return `<!-- 180 Traffic Director: Universal Meta Pixel & CAPI Edge Tag -->
<script src="${tagUrl}" async></script>`;
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* 1. Header with Breadcrumb & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200/80 dark:border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1.5">
            <Sparkles className="w-4 h-4" />
            <span>Telemetry & Ad Intelligence</span>
            <span className="text-zinc-400 dark:text-zinc-600">•</span>
            <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/40 text-[10px]">
              GRAPH API v19.0+ READY
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
            Universal Meta Pixel & CAPI Manager
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
            Install 1 small edge script once. Manage primary and failover Meta Pixels, server-side Conversions API (CAPI) deduplication, and automated bot event gating centrally.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleSendTestConversion(activeTagSlug || links[0]?.slug)}
            disabled={simulatingEvent || links.length === 0}
            className="px-4 py-2 text-xs font-medium rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
          >
            <Play className={clsx("w-3.5 h-3.5", simulatingEvent && "animate-spin")} />
            <span>Dispatch Test CAPI Event</span>
          </button>
          <button
            onClick={() => { fetchLinks(); fetchAllPixelLogs(); }}
            className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-900/60 text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all shadow-xs"
            title="Refresh"
          >
            <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Configured Smart Links</span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white">{totalConfigured}</span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">/ {links.length} total links</span>
          </div>
          <div className="mt-2 text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <CheckCircle2 className="w-3 h-3" />
            <span>Zero-touch tagless management</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">CAPI Active Tokens</span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <Key className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white">{totalCapiActive}</span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">AES-256-GCM Vault</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-500" />
            <span>Direct Graph API v19.0 ingestion</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Backup Failover Pixels</span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white">{totalBackupPixels}</span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Warm Audiences</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <span>Redundant ad account protection</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-xs relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Bot-Gated Drops</span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-zinc-950 dark:text-white">{totalBotGated}</span>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Clean Learning</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <span>Blocks crawlers from poisoning pixels</span>
          </div>
        </div>
      </div>

      {/* 3. Universal Tag Installation Studio */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">
                Universal CDN Edge Tag Generator
              </h2>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
              Paste this tag into your landing page or CMS. All pixel IDs and CAPI conversions update dynamically without touching code again.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Link Context:</span>
            <select
              value={activeTagSlug}
              onChange={(e) => setActiveTagSlug(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              {links.map(l => (
                <option key={l.id} value={l.slug}>
                  {l.name} (/{l.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Platform tabs */}
        <div className="flex items-center gap-2 border-b border-zinc-200/80 dark:border-white/10 pb-3">
          {[
            { id: 'html', label: 'Custom HTML / React', icon: Code2 },
            { id: 'shopify', label: 'Shopify Store', icon: ShoppingBag },
            { id: 'wordpress', label: 'WordPress / WooCommerce', icon: Laptop },
            { id: 'webflow', label: 'Webflow', icon: Globe },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setTagPlatform(p.id as any)}
              className={clsx(
                "px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5",
                tagPlatform === p.id 
                  ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950" 
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800"
              )}
            >
              <p.icon className="w-3.5 h-3.5" />
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Snippet box */}
        <div className="relative group">
          <pre suppressHydrationWarning className="p-4 rounded-xl bg-zinc-950 text-zinc-200 font-mono text-xs overflow-x-auto border border-zinc-800 selection:bg-blue-600/30">
            {getPlatformSnippet()}
          </pre>
          <button
            onClick={() => copyCode(getPlatformSnippet(), 'platform_tag')}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-zinc-800/90 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
          >
            {copiedSlug === 'platform_tag' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSlug === 'platform_tag' ? 'Copied' : 'Copy Snippet'}</span>
          </button>
        </div>

        {/* Live Tag Installation Verifier */}
        <div className="pt-2 border-t border-zinc-200/80 dark:border-white/10 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="url"
              placeholder="https://yourlandingpage.com to verify tag installation"
              value={verifyUrl}
              onChange={(e) => setVerifyUrl(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            onClick={handleVerifyTag}
            disabled={verifying || !verifyUrl.trim()}
            className="w-full sm:w-auto px-4 py-2 text-xs font-medium rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            {verifying ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />}
            <span>Verify Live Tag</span>
          </button>
        </div>

        {verifyResult && (
          <div className={clsx(
            "p-3 rounded-xl text-xs flex items-center gap-2 font-medium border",
            verifyResult.verified 
              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40"
          )}>
            {verifyResult.verified ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{verifyResult.message || (verifyResult.verified ? 'Universal Edge Tag detected and active on target page!' : 'Tag not found on target page.')}</span>
          </div>
        )}
      </div>

      {/* 4. Smart Links Pixel Directory */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">
              Smart Link Pixel Directory
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Manage Meta Pixel IDs and CAPI access tokens for each smart link route.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search links, slugs, pixel IDs..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white/80 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20 w-48 sm:w-64"
              />
            </div>

            <div className="flex items-center rounded-xl border border-zinc-200/80 dark:border-white/10 p-0.5 bg-white/80 dark:bg-zinc-950 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={clsx("px-2.5 py-1 rounded-lg font-medium transition-all", filterMode === 'all' && "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white")}
              >
                All
              </button>
              <button
                onClick={() => setFilterMode('configured')}
                className={clsx("px-2.5 py-1 rounded-lg font-medium transition-all", filterMode === 'configured' && "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white")}
              >
                Configured
              </button>
              <button
                onClick={() => setFilterMode('unconfigured')}
                className={clsx("px-2.5 py-1 rounded-lg font-medium transition-all", filterMode === 'unconfigured' && "bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white")}
              >
                Unset
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10">
            <LogoLoader size="md" />
            <span className="text-xs text-zinc-500 mt-3">Loading pixel directory...</span>
          </div>
        ) : filteredLinks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10">
            <Sparkles className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No smart links found</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Create a smart link first to associate Meta Pixels and server-side Conversions API tokens.
            </p>
            <Link
              href="/traffic-director/links"
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-all"
            >
              <span>Go to Smart Links</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-500 dark:text-zinc-400 font-semibold">
                    <th className="py-3 px-4">Smart Link</th>
                    <th className="py-3 px-4">Master Meta Pixel</th>
                    <th className="py-3 px-4">Backup Pixels</th>
                    <th className="py-3 px-4">CAPI Status</th>
                    <th className="py-3 px-4">Bot Gating</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:border-white/5">
                  {filteredLinks.map((link) => {
                    const cfg = link.pixelConfig;
                    const hasMaster = Boolean(cfg?.masterPixelId);
                    const hasCapi = Boolean(cfg?.enableCapi && (cfg?.hasCapiToken || cfg?.capiTokenEnc));

                    return (
                      <tr key={link.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-zinc-950 dark:text-white">{link.name}</span>
                            <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400">/{link.slug}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {hasMaster ? (
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-zinc-900 dark:text-zinc-100 font-semibold">{cfg?.masterPixelId}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 font-bold">
                                ACTIVE
                              </span>
                            </div>
                          ) : (
                            <span className="text-zinc-400 italic">Not configured</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {cfg?.backupPixelIds && cfg.backupPixelIds.length > 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 font-semibold text-[11px]">
                              {cfg.backupPixelIds.length} Failover{cfg.backupPixelIds.length > 1 ? 's' : ''}
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">None</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {hasCapi ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>CAPI Ready</span>
                            </div>
                          ) : hasMaster ? (
                            <span className="text-amber-600 dark:text-amber-400 font-medium text-[11px]">
                              Client Only
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {cfg?.fireOnBots === false ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Shield className="w-3 h-3" />
                              <span>Gated</span>
                            </span>
                          ) : (
                            <span className="text-zinc-400 text-[11px]">Unrestricted</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openConfigModal(link)}
                              className="px-3 py-1.5 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium text-xs transition-all shadow-2xs"
                            >
                              Configure
                            </button>
                            <Link
                              href={`/traffic-director/links/${link.id}?tab=pixel`}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
                              title="Deep Configuration & Custom Triggers"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 5. Live Conversion & CAPI Stream */}
      <div className="p-6 rounded-2xl bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/80 dark:border-white/10 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500 animate-pulse" />
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">
              Live Conversion & Telemetry Stream
            </h2>
          </div>
          <button
            onClick={fetchAllPixelLogs}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium"
          >
            <RefreshCw className={clsx("w-3 h-3", loadingLogs && "animate-spin")} />
            <span>Refresh Stream</span>
          </button>
        </div>

        {loadingLogs ? (
          <div className="py-8 text-center text-xs text-zinc-500">Updating conversion activity...</div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No live conversions recorded yet. Click "Dispatch Test CAPI Event" to verify the pipeline.
          </div>
        ) : (
          <div className="space-y-2">
            {logs.slice(0, 5).map((log, i) => (
              <div 
                key={log.id || i}
                className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-white/5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {log.action || 'PageView'}
                  </span>
                  <span className="text-zinc-400 font-mono text-[11px]">
                    {log.link?.slug ? `/${log.link.slug}` : log.slug ? `/${log.slug}` : 'route'}
                  </span>
                  {log.isBot && (
                    <span className="px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 text-[10px] font-bold">
                      BOT
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 text-zinc-400 text-[11px]">
                  <span>{log.country || 'Global'}</span>
                  <span>{log.deviceType || 'Browser'}</span>
                  <span className="font-mono text-zinc-500">
                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : 'Just now'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Quick Edit Modal */}
      {selectedLink && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-white/10 max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Quick Pixel Setup
                </span>
                <h3 className="text-lg font-bold text-zinc-950 dark:text-white mt-0.5">
                  {selectedLink.name} (/{selectedLink.slug})
                </h3>
              </div>
              <button
                onClick={() => setSelectedLink(null)}
                className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white p-1 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Master Meta Pixel ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 1827492819284729"
                  value={masterPixelId}
                  onChange={(e) => setMasterPixelId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Your primary advertising account's Pixel ID from Meta Events Manager.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Backup / Failover Pixel IDs
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter backup pixel ID"
                    value={newBackupId}
                    onChange={(e) => setNewBackupId(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddBackupPixel}
                    className="px-3 py-2 rounded-xl bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-medium"
                  >
                    Add
                  </button>
                </div>
                {backupPixelIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {backupPixelIds.map((id) => (
                      <span key={id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/50 font-mono text-[11px]">
                        <span>{id}</span>
                        <button
                          type="button"
                          onClick={() => setBackupPixelIds(backupPixelIds.filter(x => x !== id))}
                          className="hover:text-red-500"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-zinc-900 dark:text-zinc-100">
                    Meta Conversions API (CAPI) Access Token
                  </label>
                  {hasCapiToken && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Encrypted in Vault
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showToken ? "text" : "password"}
                    placeholder={hasCapiToken ? "••••••••••••••••••••••••••••••••" : "EAAG..."}
                    value={capiToken}
                    onChange={(e) => setCapiToken(e.target.value)}
                    className="w-full px-3 py-2 pr-10 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">
                  System User Token from Business Settings → System Users. Encrypted using AES-256-GCM.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
                  Test Event Code (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. TEST12345"
                  value={testEventCode}
                  onChange={(e) => setTestEventCode(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
                />
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/60 dark:border-white/5 space-y-2.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableCapi}
                    onChange={(e) => setEnableCapi(e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    Enable Server-Side CAPI Deduplication
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!fireOnBots}
                    onChange={(e) => setFireOnBots(!e.target.checked)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">
                      Block Bots & Crawlers from Firing Pixel
                    </span>
                    <span className="block text-[10px] text-zinc-500">
                      Prevents Meta algorithm poisoning from ad verification spiders & scrapers
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedLink(null)}
                className="px-4 py-2 text-xs font-medium rounded-xl border border-zinc-200/80 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModal}
                disabled={savingConfig}
                className="px-5 py-2 text-xs font-medium rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-sm disabled:opacity-50"
              >
                {savingConfig && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Pixel Configuration</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
