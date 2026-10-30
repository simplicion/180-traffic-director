"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Play, Layers, Power, Check, Copy, Code, 
  BarChart3, Lock, Sparkles 
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { LogoLoader, ConfirmModal } from '@workspace/ui';
import { useSubscription } from '@/lib/useSubscription';
import { ensureExternalUrl } from '@/lib/url';
import CreateRuleModal from '../../../_components/CreateRuleModal';
import EditRuleModal from '../../../_components/EditRuleModal';
import EmbedTagModal from '../../../_components/EmbedTagModal';
import EditLinkModal from '../../../_components/EditLinkModal';
import LinkAnalyticsTab from './_components/LinkAnalyticsTab';
import LinkPixelTab from './_components/LinkPixelTab';
import LinkRoutingRulesTab from './_components/LinkRoutingRulesTab';

export default function SmartLinkRuleCanvasPage() {
  const params = useParams();
  const router = useRouter();
  
  // Resilient linkId extraction for static SSG exports (Cloudflare Pages rewrites)
  const getInitialLinkId = () => {
    const pId = params?.linkId as string;
    if (pId && pId !== 'default') return pId;
    if (typeof window !== 'undefined') {
      const match = window.location.pathname.match(/\/traffic-director\/links\/([^\/\?#]+)/);
      if (match && match[1] && match[1] !== 'default') return match[1];
    }
    return pId || '';
  };

  const [linkId, setLinkId] = useState<string>(getInitialLinkId);

  useEffect(() => {
    const currentId = getInitialLinkId();
    if (currentId && currentId !== linkId) {
      setLinkId(currentId);
    }
  }, [params?.linkId]);

  const { cloakingEnabled, isSubscriptionActive, isTrialExpired } = useSubscription();

  const [linkData, setLinkData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'pixel' | 'analytics'>('rules');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deleteRuleConfirm, setDeleteRuleConfirm] = useState<{ isOpen: boolean; rule: any; loading: boolean }>({
    isOpen: false,
    rule: null,
    loading: false
  });

  const [fallbackUrl, setFallbackUrl] = useState('');
  const [safePageProxyMode, setSafePageProxyMode] = useState(false);
  const [savingFallback, setSavingFallback] = useState(false);
  const [copied, setCopied] = useState(false);

  // Security & Warmup Shield Controls
  const [datacenterBlocked, setDatacenterBlocked] = useState(true);
  const [blockSpyServices, setBlockSpyServices] = useState(true);
  const [blockVpn, setBlockVpn] = useState(true);
  const [warmupUntil, setWarmupUntil] = useState<string>('');
  const [rampUpEnabled, setRampUpEnabled] = useState(true);
  const [rampUpDurationHours, setRampUpDurationHours] = useState(12);
  const [shieldMode, setShieldMode] = useState<'server' | 'client_shield'>('server');
  const [savingShield, setSavingShield] = useState(false);

  const fetchLinkDetails = async (idToFetch?: string) => {
    const targetId = idToFetch || linkId;
    if (!targetId || targetId === 'default') {
      setLoading(false);
      router.replace('/traffic-director/links');
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/api/v1/traffic-director/links/${targetId}`);
      const lk = res.data?.data?.link || res.data?.link;
      if (!lk) {
        toast.error('Traffic link not found');
        return;
      }
      setLinkData(lk);
      setFallbackUrl(lk.fallbackUrl || '');
      setSafePageProxyMode(Boolean(lk.safePageProxyMode));
      setDatacenterBlocked(lk.datacenterBlocked ?? true);
      setBlockSpyServices(!lk.tags || lk.tags.length === 0 ? true : lk.tags.includes('block_spy'));
      setBlockVpn(!lk.tags || lk.tags.length === 0 ? true : lk.tags.includes('block_vpn'));
      setWarmupUntil(lk.warmupUntil ? new Date(lk.warmupUntil).toISOString() : '');
      setRampUpEnabled(lk.rampUpEnabled !== undefined && lk.rampUpEnabled !== null ? (lk.rampUpDurationHours === 24 && !lk.rampUpEnabled ? true : lk.rampUpEnabled) : true);
      setRampUpDurationHours((lk.rampUpDurationHours && lk.rampUpDurationHours !== 24) ? lk.rampUpDurationHours : 12);
      setShieldMode(lk.shieldMode || 'server');
    } catch (error: any) {
      console.error('Failed to fetch link details:', error);
      toast.error('Failed to load link details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateShieldSettings = async () => {
    try {
      setSavingShield(true);
      const existingTags = Array.isArray(linkData?.tags) ? linkData.tags : [];
      const updatedTags = existingTags.filter((t: string) => t !== 'block_spy' && t !== 'block_vpn');
      if (blockSpyServices) updatedTags.push('block_spy');
      if (blockVpn) updatedTags.push('block_vpn');

      await api.put(`/api/v1/traffic-director/links/${linkId}`, {
        datacenterBlocked,
        tags: updatedTags,
        warmupUntil: warmupUntil ? new Date(warmupUntil).toISOString() : null,
        rampUpEnabled,
        rampUpDurationHours: Number(rampUpDurationHours),
        shieldMode,
        safePageProxyMode
      });
      toast.success('Shield & Warmup settings saved!');
      fetchLinkDetails();
    } catch (error) {
      toast.error('Failed to update shield settings');
    } finally {
      setSavingShield(false);
    }
  };

  useEffect(() => {
    if (linkId && linkId !== 'default') {
      fetchLinkDetails(linkId);
    }
  }, [linkId]);

  const handleUpdateFallback = async () => {
    if (savingFallback) return;
    try {
      setSavingFallback(true);
      const cleanFallback = ensureExternalUrl(fallbackUrl);
      await api.put(`/api/v1/traffic-director/links/${linkId}`, { 
        fallbackUrl: cleanFallback,
        safePageProxyMode
      });
      setFallbackUrl(cleanFallback);
      toast.success('Safe page settings saved!');
      fetchLinkDetails();
    } catch (error) {
      toast.error('Failed to update fallback settings');
    } finally {
      setSavingFallback(false);
    }
  };

  const handleToggleRuleActive = async (rule: any) => {
    try {
      const updated = !rule.isActive;
      await api.put(`/api/v1/traffic-director/rules/${rule.id}`, { isActive: updated });
      setLinkData((prev: any) => ({
        ...prev,
        rules: prev.rules.map((r: any) => r.id === rule.id ? { ...r, isActive: updated } : r)
      }));
      toast.success(`Rule is now ${updated ? 'Active' : 'Disabled'}`);
    } catch (error) {
      toast.error('Failed to toggle rule');
    }
  };

  const confirmDeleteRule = async () => {
    if (!deleteRuleConfirm.rule) return;
    try {
      setDeleteRuleConfirm(prev => ({ ...prev, loading: true }));
      await api.delete(`/api/v1/traffic-director/rules/${deleteRuleConfirm.rule.id}`);
      setLinkData((prev: any) => ({
        ...prev,
        rules: prev.rules.filter((r: any) => r.id !== deleteRuleConfirm.rule.id)
      }));
      toast.success('Rule removed');
      setDeleteRuleConfirm({ isOpen: false, rule: null, loading: false });
    } catch (error) {
      toast.error('Failed to delete rule');
      setDeleteRuleConfirm(prev => ({ ...prev, loading: false }));
    }
  };

  const handleMoveRule = async (index: number, direction: 'up' | 'down') => {
    if (!linkData?.rules) return;
    const newRules = [...linkData.rules];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newRules.length) return;

    const temp = newRules[index];
    newRules[index] = newRules[targetIdx];
    newRules[targetIdx] = temp;

    setLinkData((prev: any) => ({ ...prev, rules: newRules }));

    try {
      await api.post(`/api/v1/traffic-director/links/${linkId}/rules/reorder`, {
        orderedRuleIds: newRules.map(r => r.id)
      });
      toast.success('Priority order updated');
    } catch (error) {
      toast.error('Failed to save priority order');
      fetchLinkDetails();
    }
  };

  const handleCopyUrl = () => {
    const url = `${window.location.origin}/r/${linkData?.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Routing URL copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !linkData) {
    return (
      <div className="flex h-96 items-center justify-center">
        <LogoLoader className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <CreateRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        linkId={linkId}
        onSuccess={() => fetchLinkDetails()}
      />

      <EditRuleModal
        isOpen={Boolean(editingRule)}
        onClose={() => setEditingRule(null)}
        linkId={linkId}
        rule={editingRule}
        onSuccess={() => fetchLinkDetails()}
      />

      <EmbedTagModal
        isOpen={isEmbedModalOpen}
        onClose={() => setIsEmbedModalOpen(false)}
        slug={linkData.slug}
        linkName={linkData.name}
        linkId={linkId}
        customDomain={linkData.customDomain}
        shieldMode={shieldMode}
        onDomainUpdated={() => fetchLinkDetails()}
      />

      <EditLinkModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        link={linkData}
        onSuccess={() => fetchLinkDetails()}
      />

      <ConfirmModal
        isOpen={deleteRuleConfirm.isOpen}
        title="Delete Routing Rule"
        message={`Are you sure you want to delete "${deleteRuleConfirm.rule?.name || 'this rule'}"? Traffic will no longer be evaluated against its conditions.`}
        confirmText="Delete Rule"
        cancelText="Cancel"
        onConfirm={confirmDeleteRule}
        onCancel={() => setDeleteRuleConfirm({ isOpen: false, rule: null, loading: false })}
        loading={deleteRuleConfirm.loading}
        variant="danger"
      />

      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/traffic-director/links"
            className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">{linkData.name}</h1>
              <span className={`w-2.5 h-2.5 rounded-full ${linkData.isActive && cloakingEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {!cloakingEnabled && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  Cloaking Paused
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400 font-mono">/r/{linkData.slug}</span>
              <button onClick={handleCopyUrl} className="text-gray-400 hover:text-indigo-600 transition text-xs flex items-center gap-1">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={async () => {
              if (!linkData.isActive && !cloakingEnabled) {
                toast.error(
                  isTrialExpired 
                    ? 'Your 7-day free trial has expired. Upgrade your subscription to activate cloaking.' 
                    : 'Active subscription required: Activate a plan in Billing to enable cloaking routing.'
                );
                router.push('/traffic-director/subscription');
                return;
              }
              try {
                const nextActive = !linkData.isActive;
                await api.put(`/api/v1/traffic-director/links/${linkId}`, { isActive: nextActive });
                setLinkData((prev: any) => ({ ...prev, isActive: nextActive }));
                toast.success(`Link is now ${nextActive ? 'Active' : 'Paused'}`);
              } catch (err: any) {
                toast.error(err.response?.data?.error || 'Failed to update link status');
              }
            }}
            className={`p-2 rounded-xl border transition cursor-pointer relative ${
              linkData.isActive && cloakingEnabled
                ? 'border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30'
                : 'border-gray-200 dark:border-zinc-700 text-gray-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
            title={
              !cloakingEnabled
                ? 'Cloaking Locked: Subscription required to activate edge routing'
                : (linkData.isActive ? 'Pause Link' : 'Activate Link')
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
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold transition"
          >
            Edit Details
          </button>
          <button
            onClick={() => setIsEmbedModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer"
          >
            <Code className="w-3.5 h-3.5" />
            <span>{shieldMode === 'client_shield' ? 'Get Embed Snippets' : 'Smart Link Setup'}</span>
          </button>
          <Link
            href={`/traffic-director/simulator?linkId=${linkId}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50 text-xs font-semibold hover:bg-purple-100 transition"
          >
            <Play className="w-3.5 h-3.5" />
            Simulate
          </Link>
          <button
            onClick={() => {
              if (!cloakingEnabled) {
                toast.error(
                  isTrialExpired 
                    ? 'Your 7-day free trial has expired. Upgrade your subscription to add routing rules.' 
                    : 'Active subscription required to add routing rules.'
                );
                router.push('/traffic-director/subscription');
                return;
              }
              setIsRuleModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer"
          >
            {cloakingEnabled ? <Plus className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>Add Rule</span>
          </button>
        </div>
      </div>

      {/* 2-Column Layout with Right-Hand Side Menu */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Content Area (Left on desktop) */}
        <div className="lg:col-span-8 xl:col-span-9 min-w-0 order-2 lg:order-1">
          {activeTab === 'rules' && (
            <LinkRoutingRulesTab
              linkId={linkId}
              linkData={linkData}
              shieldMode={shieldMode}
              setShieldMode={setShieldMode}
              datacenterBlocked={datacenterBlocked}
              setDatacenterBlocked={setDatacenterBlocked}
              blockSpyServices={blockSpyServices}
              setBlockSpyServices={setBlockSpyServices}
              blockVpn={blockVpn}
              setBlockVpn={setBlockVpn}
              warmupUntil={warmupUntil}
              setWarmupUntil={setWarmupUntil}
              rampUpEnabled={rampUpEnabled}
              setRampUpEnabled={setRampUpEnabled}
              rampUpDurationHours={rampUpDurationHours}
              setRampUpDurationHours={setRampUpDurationHours}
              savingShield={savingShield}
              handleUpdateShieldSettings={handleUpdateShieldSettings}
              fallbackUrl={fallbackUrl}
              setFallbackUrl={setFallbackUrl}
              safePageProxyMode={safePageProxyMode}
              setSafePageProxyMode={setSafePageProxyMode}
              savingFallback={savingFallback}
              handleUpdateFallback={handleUpdateFallback}
              handleMoveRule={handleMoveRule}
              handleToggleRuleActive={handleToggleRuleActive}
              setEditingRule={setEditingRule}
              setDeleteRuleConfirm={setDeleteRuleConfirm}
              setIsRuleModalOpen={setIsRuleModalOpen}
              setIsEmbedModalOpen={setIsEmbedModalOpen}
            />
          )}

          {activeTab === 'pixel' && (
            <LinkPixelTab linkId={linkId} linkData={linkData} onUpdated={fetchLinkDetails} />
          )}

          {activeTab === 'analytics' && (
            <LinkAnalyticsTab linkId={linkId} linkData={linkData} />
          )}
        </div>

        {/* Right-Hand Side Menu (Sticky Navigation Rail) */}
        <aside className="lg:col-span-4 xl:col-span-3 order-1 lg:order-2 lg:sticky lg:top-6 space-y-4">
          <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200/90 dark:border-white/10 shadow-xs space-y-2">
            <div className="px-3 py-2 border-b border-gray-200/80 dark:border-white/10 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400">
                Link Navigation
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-800/50 font-semibold">
                3 Views
              </span>
            </div>

            <nav className="space-y-1.5 pt-1">
              {/* Item 1: Routing Rules & Setup */}
              <button
                type="button"
                onClick={() => setActiveTab('rules')}
                className={`w-full text-left p-3 rounded-xl transition flex items-start gap-3 cursor-pointer group relative ${
                  activeTab === 'rules'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  activeTab === 'rules'
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 group-hover:text-indigo-500'
                }`}>
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold truncate">Routing Rules & Setup</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                      activeTab === 'rules'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300'
                    }`}>
                      {linkData.rules?.length || 0}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${
                    activeTab === 'rules' ? 'text-indigo-100' : 'text-gray-400 dark:text-zinc-500'
                  }`}>
                    Priorities, evasion & fallback
                  </p>
                </div>
                {activeTab === 'rules' && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-full" />
                )}
              </button>

              {/* Item 2: Universal Meta Pixel & CAPI */}
              <button
                type="button"
                onClick={() => setActiveTab('pixel')}
                className={`w-full text-left p-3 rounded-xl transition flex items-start gap-3 cursor-pointer group relative ${
                  activeTab === 'pixel'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  activeTab === 'pixel'
                    ? 'bg-white/20 text-white'
                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 group-hover:text-purple-500'
                }`}>
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold truncate">Universal Meta Pixel</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                      activeTab === 'pixel'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                    }`}>
                      CAPI
                    </span>
                  </div>
                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${
                    activeTab === 'pixel' ? 'text-indigo-100' : 'text-gray-400 dark:text-zinc-500'
                  }`}>
                    Server-side CAPI & backup pixels
                  </p>
                </div>
                {activeTab === 'pixel' && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-full" />
                )}
              </button>

              {/* Item 3: Traffic Analytics & Cloaking Breakdown */}
              <button
                type="button"
                onClick={() => setActiveTab('analytics')}
                className={`w-full text-left p-3 rounded-xl transition flex items-start gap-3 cursor-pointer group relative ${
                  activeTab === 'analytics'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800/60'
                }`}
              >
                <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                  activeTab === 'analytics'
                    ? 'bg-white/20 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-500'
                }`}>
                  <BarChart3 className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-xs font-bold truncate">Traffic Analytics</span>
                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                      activeTab === 'analytics'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    }`}>
                      {linkData.totalClicks || 0}
                    </span>
                  </div>
                  <p className={`text-[11px] mt-0.5 line-clamp-1 ${
                    activeTab === 'analytics' ? 'text-indigo-100' : 'text-gray-400 dark:text-zinc-500'
                  }`}>
                    Live breakdown & bot logs
                  </p>
                </div>
                {activeTab === 'analytics' && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-full" />
                )}
              </button>
            </nav>
          </div>

          {/* Quick Link Summary Card on the Right Side */}
          <div className="p-4 rounded-2xl bg-white/60 dark:bg-zinc-900/60 backdrop-blur-md border border-gray-200/80 dark:border-white/10 shadow-xs space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Quick Link Info
            </span>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Architecture</span>
                <span className="font-semibold text-gray-900 dark:text-white capitalize">
                  {shieldMode === 'server' ? 'Smart Link' : 'JS Tag'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Status</span>
                <span className={`font-semibold ${linkData.isActive ? 'text-emerald-500' : 'text-gray-400'}`}>
                  {linkData.isActive ? 'Active' : 'Paused'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 dark:text-zinc-400">Custom Domain</span>
                <span className="font-mono text-[11px] text-gray-900 dark:text-white truncate max-w-[140px]">
                  {linkData.customDomain || 'Default'}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
