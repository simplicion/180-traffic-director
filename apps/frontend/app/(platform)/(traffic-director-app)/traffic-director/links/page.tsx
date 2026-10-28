"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  GitFork, Link as LinkIcon, Plus, Search, Copy, Check, ExternalLink, 
  Trash2, Settings2, Power, Filter, ArrowRight, CheckSquare, Layers, Lock,
  Activity, Users, Bot, Globe, ShieldCheck, AlertTriangle, Sparkles, RefreshCw, Zap
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { LogoLoader, ConfirmModal, BulkActionBar } from '@workspace/ui';
import clsx from 'clsx';
import { useSubscription } from '@/lib/useSubscription';
import CreateLinkModal from '../../_components/CreateLinkModal';
import EditLinkModal from '../../_components/EditLinkModal';

export default function SmartLinksDirectoryPage() {
  const router = useRouter();
  const { 
    canCreateMoreLinks, 
    cloakingEnabled, 
    isSubscriptionActive, 
    isPaidPlan,
    isTrialing,
    trialDaysLeft,
    isTrialExpired,
    maxLinks, 
    isUnlimited, 
    planName,
    planTier,
    refresh: refreshSub 
  } = useSubscription();

  const [links, setLinks] = useState<any[]>([]);
  const [overviewStats, setOverviewStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; link: any; loading: boolean }>({
    isOpen: false,
    link: null,
    loading: false
  });

  // Multi-selection state
  const [selectedLinkIds, setSelectedLinkIds] = useState<string[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Fast In-Memory SWR Cache for instant navigation
  const swrCacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());

  const fetchLinksAndStats = async (isBackground = false) => {
    const cacheKey = `traffic:links:${search || 'all'}`;
    const cached = swrCacheRef.current.get(cacheKey);

    if (cached && !isBackground) {
      setLinks(cached.data || []);
      setLoading(false);
    } else if (!isBackground) {
      setLoading(true);
    }

    try {
      const [linksRes, statsRes] = await Promise.allSettled([
        api.get('/api/v1/traffic-director/links', {
          params: { search: search || undefined }
        }),
        api.get('/api/v1/traffic-director/overview')
      ]);

      if (linksRes.status === 'fulfilled') {
        const fetched = linksRes.value.data?.data?.links || [];
        setLinks(fetched);
        swrCacheRef.current.set(cacheKey, {
          data: fetched,
          timestamp: Date.now()
        });
      }

      if (statsRes.status === 'fulfilled') {
        setOverviewStats(statsRes.value.data?.data || null);
      }
    } catch (error: any) {
      if (!cached) setLinks([]);
      if (error?.status === 401 || error?.message?.includes('401')) {
        toast.error('Session expired or authentication required. Please sign in.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinksAndStats();
  }, [search]);

  // Derived link stats
  const totalLinksCount = links.length;
  const activeLinksCount = useMemo(() => links.filter(l => l.isActive).length, [links]);
  const pausedLinksCount = useMemo(() => links.filter(l => !l.isActive).length, [links]);
  const totalClicks = useMemo(() => 
    links.reduce((acc, l) => acc + (l.totalClicks || l._count?.logs || 0), 0)
  , [links]);
  const totalRules = useMemo(() => 
    links.reduce((acc, l) => acc + (l.rules?.length || 0), 0)
  , [links]);
  const topLink = useMemo(() => {
    if (links.length === 0) return null;
    return [...links].sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0))[0];
  }, [links]);

  // Filtered links according to status tab
  const filteredLinks = useMemo(() => {
    return links.filter((link) => {
      if (statusFilter === 'active') return link.isActive;
      if (statusFilter === 'paused') return !link.isActive;
      return true;
    });
  }, [links, statusFilter]);

  const handleCopy = (slug: string, id: string) => {
    const url = `${window.location.origin}/r/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Routing URL copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleActive = async (link: any) => {
    if (!link.isActive && !cloakingEnabled) {
      toast.error('Subscription required: Activate a plan or free trial to enable cloaking routing.');
      router.push('/traffic-director/subscription');
      return;
    }
    try {
      const updated = !link.isActive;
      await api.put(`/api/v1/traffic-director/links/${link.id}`, { isActive: updated });
      setLinks(prev => prev.map(l => l.id === link.id ? { ...l, isActive: updated } : l));
      toast.success(`Link is now ${updated ? 'Active' : 'Paused'}`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to update status');
    }
  };

  const confirmDeleteLink = async () => {
    if (!deleteConfirm.link) return;
    try {
      setDeleteConfirm(prev => ({ ...prev, loading: true }));
      await api.delete(`/api/v1/traffic-director/links/${deleteConfirm.link.id}`);
      setLinks(prev => prev.filter(l => l.id !== deleteConfirm.link.id));
      setSelectedLinkIds(prev => prev.filter(id => id !== deleteConfirm.link.id));
      toast.success('Smart Link deleted successfully');
      setDeleteConfirm({ isOpen: false, link: null, loading: false });
    } catch (error: any) {
      toast.error('Failed to delete link');
      setDeleteConfirm(prev => ({ ...prev, loading: false }));
    }
  };

  // Selection Handlers
  const handleToggleSelectLink = (id: string) => {
    setSelectedLinkIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedLinkIds(filteredLinks.map(l => l.id));
  };

  const handleDeselectAll = () => {
    setSelectedLinkIds([]);
  };

  const handleSelectAmount = (amount: number) => {
    const targetAmount = Math.min(amount, filteredLinks.length);
    const selectedSlice = filteredLinks.slice(0, targetAmount).map(l => l.id);
    setSelectedLinkIds(selectedSlice);
    toast.success(`Selected first ${selectedSlice.length} smart links`);
  };

  const handleBulkDeleteSelected = async () => {
    if (selectedLinkIds.length === 0) return;
    setIsBulkDeleting(true);
    try {
      await api.post('/api/v1/traffic-director/links/bulk-delete', { linkIds: selectedLinkIds });
      toast.success(`Successfully deleted ${selectedLinkIds.length} links`);
      setLinks(prev => prev.filter(l => !selectedLinkIds.includes(l.id)));
      swrCacheRef.current.clear();
      setSelectedLinkIds([]);
    } catch (error: any) {
      try {
        await Promise.all(selectedLinkIds.map(id => api.delete(`/api/v1/traffic-director/links/${id}`)));
        toast.success(`Deleted ${selectedLinkIds.length} links`);
        setLinks(prev => prev.filter(l => !selectedLinkIds.includes(l.id)));
        swrCacheRef.current.clear();
        setSelectedLinkIds([]);
      } catch (fallbackError: any) {
        toast.error(error.response?.data?.error || 'Failed to delete selected links');
      }
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Quota calculation
  const quotaLimit = isPaidPlan ? (isUnlimited ? 999999 : maxLinks) : 2;
  const capacityUsedPercent = isUnlimited 
    ? 0 
    : Math.min(100, Math.round((activeLinksCount / (quotaLimit || 1)) * 100));
  const createdUsedPercent = Math.min(100, Math.round((totalLinksCount / (quotaLimit || 1)) * 100));

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-300">
      <CreateLinkModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => {
          fetchLinksAndStats(true);
          refreshSub();
        }}
      />

      <EditLinkModal
        isOpen={Boolean(editingLink)}
        onClose={() => setEditingLink(null)}
        link={editingLink}
        onSuccess={() => fetchLinksAndStats(true)}
      />

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Delete Smart Link"
        message={`Are you sure you want to delete "${deleteConfirm.link?.name || 'this Smart Link'}" and all its associated routing rules? This action cannot be undone.`}
        confirmText="Delete Link"
        cancelText="Cancel"
        onConfirm={confirmDeleteLink}
        onCancel={() => setDeleteConfirm({ isOpen: false, link: null, loading: false })}
        loading={deleteConfirm.loading}
        variant="danger"
      />

      {/* Anomaly Alert Banner (if surge detected) */}
      {overviewStats?.anomalyDetected && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3.5 text-rose-900 dark:text-rose-200">
          <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="space-y-0.5 text-xs flex-1">
            <span className="font-bold text-sm">Ad Traffic Anomaly Alert</span>
            <p className="text-rose-700 dark:text-rose-300">
              {overviewStats.anomalyMessage || 'Unusual surge in automated crawler and cloud datacenter ASN traffic detected.'}
            </p>
          </div>
          <Link
            href="/traffic-director/threats"
            className="text-xs font-bold underline hover:opacity-80 shrink-0"
          >
            Review Threats →
          </Link>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 1: PLAN CAPACITY & ACTIVE LINKS QUOTA CONTROLLER
          ────────────────────────────────────────────────────────────────────────── */}
      {isPaidPlan ? (
        /* SUBSCRIBED USER: Pro / Starter / Enterprise Dedicated Quota Panel */
        <div className="p-6 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                    {planName}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Subscription
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Sovereign Edge Cloaking Active · Subscribed link capacity enabled
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/traffic-director/simulator"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 hover:bg-gray-100 dark:hover:bg-zinc-700/60 transition"
              >
                Routing Simulator
              </Link>
              <Link
                href="/traffic-director/subscription"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition"
              >
                Manage Subscription →
              </Link>
            </div>
          </div>

          {/* Active Links vs Space Meter */}
          <div className="p-4 rounded-xl bg-gray-50/70 dark:bg-zinc-950/60 border border-gray-200/60 dark:border-white/5 space-y-2.5">
            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Active Links Capacity:
                </span>
                <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
                  {activeLinksCount}
                </span>
                <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                  / {isUnlimited ? '∞ Unlimited' : `${maxLinks} Allocated Space`}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium text-gray-500 dark:text-gray-400">
                <span>Total Created: <strong className="text-gray-900 dark:text-white font-mono">{totalLinksCount}</strong></span>
                <span>Active: <strong className="text-emerald-500 font-mono">{activeLinksCount}</strong></span>
                <span>Paused: <strong className="text-gray-400 font-mono">{pausedLinksCount}</strong></span>
                {!isUnlimited && (
                  <span>
                    Available Space: <strong className="text-blue-500 font-mono">{Math.max(0, maxLinks - activeLinksCount)}</strong>
                  </span>
                )}
              </div>
            </div>

            {!isUnlimited && (
              <div className="w-full bg-gray-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className={clsx(
                    "h-full rounded-full transition-all duration-500",
                    capacityUsedPercent >= 90 ? "bg-rose-500" : capacityUsedPercent >= 70 ? "bg-amber-500" : "bg-emerald-500"
                  )}
                  style={{ width: `${capacityUsedPercent}%` }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        /* NON-SUBSCRIBED USER: Trial / Expired / Free Tier Detailed Allocation & Limits */
        <div className="p-6 rounded-2xl bg-gradient-to-r from-amber-500/5 via-indigo-500/5 to-purple-500/5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-amber-300/40 dark:border-amber-500/30 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {isTrialExpired ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/30">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Trial Expired
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-bold border border-amber-500/30">
                    <Sparkles className="w-3.5 h-3.5" />
                    7-Day Free Trial Active ({trialDaysLeft} Days Remaining)
                  </span>
                )}
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Free Evaluation Tier
                </span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Smart Links Space & Allocation Limits
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-300 max-w-2xl">
                {totalLinksCount >= 2
                  ? "You have reached the maximum 2 links permitted under the free trial. To create more links, expand active capacity (up to Unlimited), and maintain 24/7 Anycast cloaking, please upgrade your subscription."
                  : isTrialExpired
                  ? "Your 7-day free trial has expired. Smart link redirects are temporarily paused until you upgrade to a paid subscription plan."
                  : "Under the free evaluation plan, you can create up to 2 Smart Links with live edge routing and bot inspection. Upgrade anytime to scale to 10, 50, or Unlimited links."}
              </p>
            </div>

            <Link
              href="/traffic-director/subscription"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-md shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 shrink-0"
            >
              <span>Upgrade Plan ($25, $50, $75)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Detailed Limits & Maximum Media/Links Created Readout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50/80 dark:bg-zinc-950/70 border border-gray-200/60 dark:border-white/5">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                Max Allowed Links
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-extrabold text-gray-900 dark:text-white font-mono">2 Links</span>
                <span className="text-[11px] text-gray-400">(Free Tier Cap)</span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                Smart Links Created
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className={clsx(
                  "text-xl font-extrabold font-mono",
                  totalLinksCount >= 2 ? "text-rose-500" : "text-gray-900 dark:text-white"
                )}>
                  {totalLinksCount} / 2
                </span>
                <span className="text-[11px] text-gray-400 font-medium">
                  ({createdUsedPercent}% space used)
                </span>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block">
                Active Edge Routing
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-xl font-extrabold text-emerald-500 font-mono">
                  {activeLinksCount} Active
                </span>
                <span className="text-[11px] text-gray-400">
                  · {pausedLinksCount} Paused
                </span>
              </div>
            </div>
          </div>

          {/* Allocation Meter */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
              <span>Trial Allocation Meter</span>
              <span>{totalLinksCount} / 2 Max Created</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className={clsx(
                  "h-full rounded-full transition-all duration-500",
                  totalLinksCount >= 2 ? "bg-rose-500" : "bg-amber-500"
                )}
                style={{ width: `${Math.min(100, (totalLinksCount / 2) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 2: VALUABLE PARAMETERS & LIVE OPERATIONAL METRICS SUITE
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Traffic & Routed Clicks */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Total Traffic</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white font-mono">
              {(overviewStats?.totalRequests || totalClicks).toLocaleString()}
            </span>
            <span className="text-xs font-semibold text-indigo-500">clicks routed</span>
          </div>
          <p className="text-[11px] text-gray-400 truncate">
            Aggregated traffic across all active smart links
          </p>
        </div>

        {/* KPI 2: Active vs Paused Links */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Active vs Paused</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <Power className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500 font-mono">
              {activeLinksCount}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
              active / {pausedLinksCount} paused
            </span>
          </div>
          <p className="text-[11px] text-gray-400 truncate">
            {isUnlimited ? 'Unlimited link capacity' : `${maxLinks} Max Capacity on ${planName}`}
          </p>
        </div>

        {/* KPI 3: Bot & Scraper Shield Defense */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Human Traffic Ratio</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500 font-mono">
              {overviewStats?.totalRequests > 0 ? 100 - (overviewStats?.botRatio || 0) : 100}%
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">clean verified</span>
          </div>
          <p className="text-[11px] text-gray-400 truncate">
            {overviewStats?.totalBots || 0} crawlers & ad-bots intercepted
          </p>
        </div>

        {/* KPI 4: Rules Deployed & Top Performer */}
        <div className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-gray-500 dark:text-gray-400">
            <span className="text-xs font-bold uppercase tracking-wider">Rules & Top Link</span>
            <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <GitFork className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-purple-500 font-mono">
              {totalRules}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400 font-semibold">rules active</span>
          </div>
          <p className="text-[11px] text-gray-400 truncate" title={topLink ? `/r/${topLink.slug}` : 'No links yet'}>
            {topLink ? `Top: /r/${topLink.slug} (${(topLink.totalClicks || 0)} clicks)` : 'Conditional routing rules'}
          </p>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 3: DIRECTORY HEADER & PRIMARY ACTION CONTROLS
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Smart Links Directory</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Dynamic redirect links with multi-dimensional conditional routing rules, device filtering, and bot cloaking
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/traffic-director/simulator"
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700/60 text-gray-700 dark:text-gray-200 text-xs font-semibold border border-gray-200 dark:border-zinc-700 transition active:scale-95"
          >
            <span>Simulator</span>
          </Link>

          <Link
            href="/traffic-director/logs"
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700/60 text-gray-700 dark:text-gray-200 text-xs font-semibold border border-gray-200 dark:border-zinc-700 transition active:scale-95"
          >
            <span>Traffic Logs</span>
          </Link>

          <button
            onClick={() => {
              if (!canCreateMoreLinks) {
                toast.error(
                  isTrialExpired 
                    ? 'Your 7-day free trial has expired. Upgrade your subscription to create new links.' 
                    : `Link quota limit reached (${links.length}/${isUnlimited ? '∞' : maxLinks}). Upgrade your subscription to create more links.`
                );
                router.push('/traffic-director/subscription');
                return;
              }
              setIsCreateModalOpen(true);
            }}
            className={clsx(
              "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-sm transition cursor-pointer",
              canCreateMoreLinks
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 active:scale-95"
                : "bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border border-gray-200 dark:border-zinc-700 hover:border-amber-400"
            )}
            title={canCreateMoreLinks ? 'Create a new Smart Link' : 'Upgrade subscription to create more links'}
          >
            {canCreateMoreLinks ? <Plus className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5 text-amber-500" />}
            <span>Create Smart Link</span>
            {!canCreateMoreLinks && (
              <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded font-mono font-bold">
                Upgrade
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 4: STATUS TABS, SEARCH, AND BULK SELECT CONTROLS
          ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800">
          <button
            onClick={() => setStatusFilter('all')}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
              statusFilter === 'all'
                ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-xs"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            All Links ({links.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5",
              statusFilter === 'active'
                ? "bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active ({activeLinksCount})
          </button>
          <button
            onClick={() => setStatusFilter('paused')}
            className={clsx(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5",
              statusFilter === 'paused'
                ? "bg-white dark:bg-zinc-800 text-gray-900 dark:text-white shadow-xs"
                : "text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Paused ({pausedLinksCount})
          </button>
        </div>

        {/* Search & Bulk Select Actions */}
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by link name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/90 text-xs text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none transition shadow-sm"
            />
          </div>

          <button
            onClick={selectedLinkIds.length === filteredLinks.length && filteredLinks.length > 0 ? handleDeselectAll : handleSelectAll}
            className="px-3.5 py-2.5 bg-white/80 dark:bg-zinc-900/90 border border-gray-200 dark:border-zinc-800 rounded-xl text-xs font-semibold text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shrink-0"
          >
            <CheckSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>{selectedLinkIds.length === filteredLinks.length && filteredLinks.length > 0 ? "Deselect All" : "Select All"}</span>
          </button>

          <button
            onClick={() => fetchLinksAndStats(false)}
            className="p-2.5 bg-white/80 dark:bg-zinc-900/90 border border-gray-200 dark:border-zinc-800 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white transition cursor-pointer shadow-sm"
            title="Refresh links"
          >
            <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          SECTION 5: SMART LINKS LIST DIRECTORY
          ────────────────────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <LogoLoader className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : filteredLinks.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredLinks.map((link) => {
            const isSelected = selectedLinkIds.includes(link.id);
            return (
              <div
                key={link.id}
                className={clsx(
                  "p-6 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border transition flex flex-col md:flex-row md:items-center justify-between gap-6",
                  isSelected 
                    ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 dark:bg-blue-950/20" 
                    : "border-gray-200/80 dark:border-white/10 hover:shadow-md hover:border-blue-200 dark:hover:border-zinc-700"
                )}
              >
                <div className="flex items-start gap-3.5 flex-1">
                  {/* Select Checkbox */}
                  <button
                    type="button"
                    onClick={() => handleToggleSelectLink(link.id)}
                    className="mt-1 p-0.5 rounded cursor-pointer"
                    title={isSelected ? "Deselect link" : "Select link"}
                  >
                    <span className={clsx(
                      "w-4 h-4 rounded border flex items-center justify-center transition-all",
                      isSelected ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-blue-500"
                    )}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </span>
                  </button>

                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`w-2.5 h-2.5 rounded-full ${link.isActive && cloakingEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                      <h3 className="text-base font-bold text-gray-900 dark:text-white">{link.name}</h3>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-zinc-800 font-mono text-xs text-blue-600 dark:text-blue-400 font-medium">
                        /r/{link.slug}
                        <button
                          onClick={() => handleCopy(link.slug, link.id)}
                          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-1 transition cursor-pointer"
                          title="Copy Link URL"
                        >
                          {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      {link.tags?.map((tag: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded-md bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 text-[10px] font-semibold">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-xs text-gray-500 dark:text-gray-400">
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Fallback Target:</span>{' '}
                        <span className="font-mono text-gray-400 truncate inline-block max-w-[240px] align-bottom" title={link.fallbackUrl}>
                          {link.fallbackUrl}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Rules Configured:</span>{' '}
                        <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-bold">
                          {link.rules?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700 dark:text-gray-300">Total Clicks:</span>{' '}
                        <span className="font-bold text-gray-900 dark:text-white">
                          {(link.totalClicks || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-gray-200/80 dark:border-zinc-800">
                  <button
                    onClick={() => handleToggleActive(link)}
                    className={clsx(
                      "p-2.5 rounded-xl border transition cursor-pointer relative",
                      link.isActive && cloakingEnabled
                        ? 'border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30' 
                        : 'border-gray-200 dark:border-zinc-700 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
                    )}
                    title={
                      !cloakingEnabled 
                        ? 'Cloaking Locked: Subscription required to activate edge routing' 
                        : (link.isActive ? 'Pause Link' : 'Activate Link')
                    }
                  >
                    <Power className="w-4 h-4" />
                    {!cloakingEnabled && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-xs">
                        <Lock className="w-2 h-2" />
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setEditingLink(link)}
                    className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-500 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    title="Edit Metadata & Domain"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>

                  <Link
                    href={`/traffic-director/links/${link.id}`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 dark:bg-zinc-800/80 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-white/10 hover:bg-blue-100 dark:hover:bg-zinc-800 text-xs font-semibold transition active:scale-95"
                  >
                    Rules Canvas
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <button
                    onClick={() => setDeleteConfirm({ isOpen: true, link, loading: false })}
                    className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-700 text-gray-400 hover:text-rose-500 hover:border-rose-200 dark:hover:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                    title="Delete Link"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-20 text-center rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-zinc-800/80 border border-blue-100 dark:border-white/10 flex items-center justify-center mx-auto text-blue-600 dark:text-blue-400">
            <GitFork className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              {statusFilter !== 'all' ? `No ${statusFilter} links found` : "No Smart Links Found"}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
              {statusFilter !== 'all' 
                ? `There are no smart links currently in ${statusFilter} state.`
                : "Create your first dynamic link to start routing users based on device, geography, headers, and crawlers."}
            </p>
          </div>
          {statusFilter === 'all' && (
            <button
              onClick={() => {
                if (!canCreateMoreLinks) {
                  toast.error(
                    isTrialExpired 
                      ? 'Your 7-day free trial has expired. Upgrade your subscription to create new links.' 
                      : `Link quota limit reached (${links.length}/${isUnlimited ? '∞' : maxLinks}). Upgrade your subscription to create more links.`
                  );
                  router.push('/traffic-director/subscription');
                  return;
                }
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/20 active:scale-95 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Create Smart Link
            </button>
          )}
        </div>
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedLinkIds.length}
        totalCount={filteredLinks.length}
        itemLabel="smart links"
        presetAmounts={[5, 10, 25, 50]}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onSelectAmount={handleSelectAmount}
        onDeleteSelected={handleBulkDeleteSelected}
        isDeleting={isBulkDeleting}
        deleteModalTitle={`Delete ${selectedLinkIds.length} Selected Smart Links`}
        deleteModalMessage={`Are you sure you want to permanently delete these ${selectedLinkIds.length} Smart Links and all their routing rules? This action cannot be undone.`}
      />
    </div>
  );
}
