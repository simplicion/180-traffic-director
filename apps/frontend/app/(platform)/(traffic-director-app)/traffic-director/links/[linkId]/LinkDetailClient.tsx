"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Plus, Play, Layers, Power, Check, Copy, Code, 
  BarChart3, Lock, Sparkles, ShieldCheck 
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { LogoLoader, ConfirmModal } from '@workspace/ui';
import { useSubscription } from '@/lib/useSubscription';
import { ensureExternalUrl } from '@/lib/url';
import { useLinkDetailNav } from '@/context/LinkDetailNavContext';
import CreateRuleModal from '../../../_components/CreateRuleModal';
import EditRuleModal from '../../../_components/EditRuleModal';
import EmbedTagModal from '../../../_components/EmbedTagModal';
import EditLinkModal from '../../../_components/EditLinkModal';
import LinkThreatDrawer from './_components/LinkThreatDrawer';
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
  const { activeTab, setActiveTab, setMetadata, updateMetadata } = useLinkDetailNav();

  const [linkData, setLinkData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [isEmbedModalOpen, setIsEmbedModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isThreatDrawerOpen, setIsThreatDrawerOpen] = useState(false);
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

      // Synchronize metadata with Platform Sidebar
      setMetadata({
        id: lk.id,
        name: lk.name,
        slug: lk.slug,
        rulesCount: lk.rules?.length || 0,
        totalClicks: lk.totalClicks || 0,
        isActive: lk.isActive,
        shieldMode: lk.shieldMode || 'server',
        customDomain: lk.customDomain,
      });
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
      updateMetadata({ shieldMode });
      fetchLinkDetails();
    } catch (error) {
      toast.error('Failed to update shield settings');
    } finally {
      setSavingShield(false);
    }
  };

  const handleUpdateFallback = async () => {
    try {
      setSavingFallback(true);
      const formattedFallback = ensureExternalUrl(fallbackUrl);
      await api.put(`/api/v1/traffic-director/links/${linkId}`, {
        fallbackUrl: formattedFallback,
        safePageProxyMode: safePageProxyMode
      });
      setFallbackUrl(formattedFallback);
      setLinkData((prev: any) => ({ ...prev, fallbackUrl: formattedFallback, safePageProxyMode }));
      toast.success('Compliant Safe Page updated!');
    } catch (error) {
      toast.error('Failed to update safe page');
    } finally {
      setSavingFallback(false);
    }
  };

  useEffect(() => {
    if (linkId && linkId !== 'default') {
      fetchLinkDetails();
    }
  }, [linkId]);

  const handleToggleRuleActive = async (rule: any) => {
    try {
      const nextActive = !rule.isActive;
      await api.put(`/api/v1/traffic-director/links/${linkId}/rules/${rule.id}`, {
        isActive: nextActive
      });
      setLinkData((prev: any) => ({
        ...prev,
        rules: prev.rules.map((r: any) => r.id === rule.id ? { ...r, isActive: nextActive } : r)
      }));
      toast.success(`Rule "${rule.name}" is now ${nextActive ? 'Active' : 'Paused'}`);
    } catch (error) {
      toast.error('Failed to update rule status');
    }
  };

  const confirmDeleteRule = async () => {
    if (!deleteRuleConfirm.rule) return;
    try {
      setDeleteRuleConfirm(prev => ({ ...prev, loading: true }));
      await api.delete(`/api/v1/traffic-director/links/${linkId}/rules/${deleteRuleConfirm.rule.id}`);
      setLinkData((prev: any) => {
        const remainingRules = prev.rules.filter((r: any) => r.id !== deleteRuleConfirm.rule.id);
        updateMetadata({ rulesCount: remainingRules.length });
        return {
          ...prev,
          rules: remainingRules
        };
      });
      toast.success('Rule deleted successfully');
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

  const navItems = [
    {
      id: 'rules' as const,
      name: 'Rules',
      icon: Layers,
      badge: String(linkData?.rules?.length || 0),
    },
    {
      id: 'pixel' as const,
      name: 'Pixel Manager',
      icon: Sparkles,
      badge: 'CAPI',
    },
    {
      id: 'analytics' as const,
      name: 'Analytics',
      icon: BarChart3,
      badge: `${linkData?.totalClicks || 0} views`,
    }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300 w-full">
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

      <LinkThreatDrawer
        isOpen={isThreatDrawerOpen}
        onClose={() => setIsThreatDrawerOpen(false)}
        linkId={linkId}
        linkData={linkData}
        onUpdated={() => fetchLinkDetails()}
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

      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/traffic-director/links"
            className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-indigo-600 transition"
            title="Back to Smart Links"
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
              <button onClick={handleCopyUrl} className="text-gray-400 hover:text-indigo-600 transition text-xs flex items-center gap-1 cursor-pointer">
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
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
                updateMetadata({ isActive: nextActive });
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
            onClick={() => setIsThreatDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition cursor-pointer"
            title="Configure Per-Link Threat Shields & Custom Blacklists"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            <span>Threat Shield ({linkData?.threatFeeds && typeof linkData.threatFeeds === 'object' ? Object.values(linkData.threatFeeds).filter(Boolean).length : 6} Feeds)</span>
          </button>

          <button
            onClick={() => setIsEditModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold transition cursor-pointer"
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

      {/* Canvas Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-b border-gray-200 dark:border-zinc-800 pb-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shrink-0 cursor-pointer ${
              activeTab === item.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                : 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
            }`}
          >
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.name}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              activeTab === item.id ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
            }`}>
              {item.badge}
            </span>
          </button>
        ))}
      </div>

      {/* Main Full-Space Workspace Canvas (100% width, No right sidebar) */}
      <div className="w-full min-w-0 transition-all duration-300">
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
    </div>
  );
}
