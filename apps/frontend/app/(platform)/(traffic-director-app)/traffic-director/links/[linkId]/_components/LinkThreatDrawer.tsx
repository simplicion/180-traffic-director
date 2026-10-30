"use client";

import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  ShieldAlert, 
  X, 
  Zap, 
  Check, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Globe, 
  Radio, 
  Terminal,
  Lock,
  Unlock,
  Sparkles,
  Server,
  Layers,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';

interface CustomThreatEntry {
  id: string;
  type: 'ip' | 'cidr' | 'asn' | 'user_agent';
  value: string;
  action: 'block' | 'allow';
  note?: string;
  createdAt: string;
}

interface ThreatFeedsState {
  meta_reviewers: boolean;
  google_compliance: boolean;
  tiktok_qa: boolean;
  spy_scrapers: boolean;
  tor_network: boolean;
  cloud_datacenters: boolean;
  [key: string]: boolean;
}

const DEFAULT_FEEDS: ThreatFeedsState = {
  meta_reviewers: true,
  google_compliance: true,
  tiktok_qa: true,
  spy_scrapers: true,
  tor_network: true,
  cloud_datacenters: true,
};

const SYSTEM_FEED_METADATA = [
  {
    key: 'meta_reviewers' as const,
    name: 'Meta Ad Reviewers & Dublin QA',
    category: 'COMPLIANCE',
    description: 'Internal Meta review teams, Dublin QA subnets, and automated ad compliance verification crawlers.',
    signatureCount: '42+ Signatures',
    badgeColor: 'border-blue-500/30 text-blue-500 bg-blue-500/10'
  },
  {
    key: 'google_compliance' as const,
    name: 'Google AdsBot & Policy Scanners',
    category: 'COMPLIANCE',
    description: 'Google LLC ad destination reviewers, automated landing page policy evaluators, and AdsBot crawlers.',
    signatureCount: '38+ Signatures',
    badgeColor: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10'
  },
  {
    key: 'tiktok_qa' as const,
    name: 'TikTok Ads QA Review Team',
    category: 'COMPLIANCE',
    description: 'ByteDance moderation and compliance teams operating out of Singapore, Dublin, and US testing clusters.',
    signatureCount: '16+ Signatures',
    badgeColor: 'border-purple-500/30 text-purple-500 bg-purple-500/10'
  },
  {
    key: 'spy_scrapers' as const,
    name: 'Spy Services (AdPlexity, SpyOver, Anstrex)',
    category: 'SPY TOOLS',
    description: 'Hosting networks and automated scrapers dedicated to stealing competitor creatives and cloaked offers.',
    signatureCount: '65+ Signatures',
    badgeColor: 'border-amber-500/30 text-amber-500 bg-amber-500/10'
  },
  {
    key: 'tor_network' as const,
    name: 'Tor Anonymity Exit Nodes',
    category: 'ANONYMIZERS',
    description: 'Real-time synchronization with the official Tor Project bulk exit node directory (O(1) memory lookup).',
    signatureCount: '1,224+ Live Nodes',
    badgeColor: 'border-pink-500/30 text-pink-500 bg-pink-500/10'
  },
  {
    key: 'cloud_datacenters' as const,
    name: 'Major Cloud Datacenters',
    category: 'DATACENTER',
    description: 'AWS, GCP, Azure, DigitalOcean, Hetzner, OVH, and Oracle server farm IP blocks.',
    signatureCount: '240+ Datacenter ASNs',
    badgeColor: 'border-cyan-500/30 text-cyan-500 bg-cyan-500/10'
  }
];

interface LinkThreatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  linkId: string;
  linkData: any;
  onUpdated?: () => void;
}

export default function LinkThreatDrawer({
  isOpen,
  onClose,
  linkId,
  linkData,
  onUpdated
}: LinkThreatDrawerProps) {
  const [threatFeeds, setThreatFeeds] = useState<ThreatFeedsState>(DEFAULT_FEEDS);
  const [customThreatList, setCustomThreatList] = useState<CustomThreatEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // New custom rule inputs
  const [newRuleType, setNewRuleType] = useState<'ip' | 'cidr' | 'asn' | 'user_agent'>('ip');
  const [newRuleAction, setNewRuleAction] = useState<'block' | 'allow'>('block');
  const [newRuleValue, setNewRuleValue] = useState('');
  const [newRuleNote, setNewRuleNote] = useState('');

  // Synchronize state when drawer opens or linkData changes
  useEffect(() => {
    if (linkData) {
      if (linkData.threatFeeds && typeof linkData.threatFeeds === 'object') {
        setThreatFeeds({
          ...DEFAULT_FEEDS,
          ...linkData.threatFeeds
        });
      } else {
        setThreatFeeds(DEFAULT_FEEDS);
      }

      if (Array.isArray(linkData.customThreatList)) {
        setCustomThreatList(linkData.customThreatList);
      } else {
        setCustomThreatList([]);
      }
    }
  }, [linkData, isOpen]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);


  const activeFeedsCount = Object.values(threatFeeds).filter(Boolean).length;

  const handleToggleFeed = (key: string) => {
    setThreatFeeds(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const applyPreset = (preset: 'maximum' | 'meta' | 'google' | 'tiktok') => {
    switch (preset) {
      case 'maximum':
        setThreatFeeds({
          meta_reviewers: true,
          google_compliance: true,
          tiktok_qa: true,
          spy_scrapers: true,
          tor_network: true,
          cloud_datacenters: true
        });
        toast.success('Applied Maximum Armor Preset (All 6 Feeds ON)');
        break;
      case 'meta':
        setThreatFeeds({
          meta_reviewers: true,
          google_compliance: false,
          tiktok_qa: false,
          spy_scrapers: true,
          tor_network: true,
          cloud_datacenters: true
        });
        toast.success('Applied Meta Stealth Preset');
        break;
      case 'google':
        setThreatFeeds({
          meta_reviewers: false,
          google_compliance: false,
          tiktok_qa: false,
          spy_scrapers: true,
          tor_network: true,
          cloud_datacenters: true
        });
        toast.success('Applied Google Search Safe Preset');
        break;
      case 'tiktok':
        setThreatFeeds({
          meta_reviewers: false,
          google_compliance: false,
          tiktok_qa: true,
          spy_scrapers: true,
          tor_network: true,
          cloud_datacenters: true
        });
        toast.success('Applied TikTok Native Preset');
        break;
    }
  };

  const handleAddCustomRule = () => {
    if (!newRuleValue.trim()) {
      toast.error('Rule value is required');
      return;
    }

    const newEntry: CustomThreatEntry = {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      type: newRuleType,
      value: newRuleValue.trim(),
      action: newRuleAction,
      note: newRuleNote.trim() || undefined,
      createdAt: new Date().toISOString()
    };

    setCustomThreatList(prev => [newEntry, ...prev]);
    setNewRuleValue('');
    setNewRuleNote('');
    toast.success(`Added custom ${newRuleAction === 'block' ? 'blacklist' : 'whitelist'} rule`);
  };

  const handleDeleteCustomRule = (id: string) => {
    setCustomThreatList(prev => prev.filter(r => r.id !== id));
    toast.success('Rule removed from link configuration');
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/api/v1/traffic-director/links/${linkId}`, {
        threatFeeds,
        customThreatList
      });
      toast.success('Link Threat Shield matrix saved successfully');
      if (onUpdated) onUpdated();
      onClose();
    } catch (err: any) {
      console.error('Failed to update threat intelligence:', err);
      toast.error(err.response?.data?.error || 'Failed to save threat settings');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] overflow-hidden flex justify-end">
          {/* Backdrop with smooth fade */}
          <motion.div 
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            onClick={onClose}
          />

          {/* Slide-Out Drawer with ultra-smooth cubic-bezier transition */}
          <motion.div 
            className="relative w-screen max-w-lg bg-white dark:bg-zinc-950 border-l border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full z-10"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          >
          
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-zinc-800/80 flex items-center justify-between shrink-0 bg-gray-50/70 dark:bg-zinc-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  Threat Shield & Cloaking
                </h2>
                <p className="text-xs text-gray-500 dark:text-zinc-400 font-mono">
                  /r/{linkData?.slug || 'link'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-zinc-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Status & Health Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/20 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeFeedsCount >= 5 ? 'bg-emerald-500 animate-pulse' : activeFeedsCount > 0 ? 'bg-amber-500' : 'bg-zinc-500'}`} />
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                    {activeFeedsCount === 6 ? 'Maximum Armor Armed' : `${activeFeedsCount} / 6 Feeds Active`}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-400 mt-1">
                  Traffic matching active feeds is automatically routed to your safe fallback URL with zero edge latency (&lt;0.5ms).
                </p>
              </div>
            </div>

            {/* 1-Click Defense Presets */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  1-Click Defense Presets
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('maximum')}
                  className="p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 text-left hover:border-indigo-500 transition cursor-pointer group"
                >
                  <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-indigo-500 flex items-center justify-between">
                    <span>Maximum Armor</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">All 6 Feeds Active (Default)</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('meta')}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-left hover:border-blue-500 transition cursor-pointer group"
                >
                  <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-blue-500 flex items-center justify-between">
                    <span>Meta Stealth</span>
                    <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Cloak Meta review clusters</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('google')}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-left hover:border-emerald-500 transition cursor-pointer group"
                >
                  <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-emerald-500 flex items-center justify-between">
                    <span>Google Search Safe</span>
                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Allow AdsBot inspection</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('tiktok')}
                  className="p-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 text-left hover:border-purple-500 transition cursor-pointer group"
                >
                  <div className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-purple-500 flex items-center justify-between">
                    <span>TikTok Native</span>
                    <Radio className="w-3.5 h-3.5 text-purple-500" />
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-zinc-400 mt-0.5">Filter ByteDance QA bots</div>
                </button>
              </div>
            </div>

            {/* Pre-Configured System Threat Feeds */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Pre-Configured System Feeds
                </span>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold font-mono">
                  {activeFeedsCount} / 6 Armed
                </span>
              </div>

              <div className="space-y-2.5">
                {SYSTEM_FEED_METADATA.map((feed) => {
                  const isEnabled = threatFeeds[feed.key] !== false;
                  return (
                    <div
                      key={feed.key}
                      onClick={() => handleToggleFeed(feed.key)}
                      className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                        isEnabled
                          ? 'bg-white dark:bg-zinc-900/90 border-indigo-200 dark:border-indigo-900/40 shadow-xs'
                          : 'bg-gray-50 dark:bg-zinc-900/30 border-gray-200 dark:border-zinc-800/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-gray-900 dark:text-white">
                              {feed.name}
                            </span>
                            <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full border ${feed.badgeColor}`}>
                              {feed.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">
                            {feed.description}
                          </p>
                          <div className="text-[10px] font-mono font-medium text-gray-400 dark:text-zinc-500 mt-2">
                            {feed.signatureCount}
                          </div>
                        </div>

                        {/* Modern Switch */}
                        <div 
                          className={`w-11 h-6 rounded-full transition-colors relative shrink-0 mt-0.5 ${
                            isEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-zinc-700'
                          }`}
                        >
                          <div 
                            className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 shadow-xs ${
                              isEnabled ? 'left-6' : 'left-1'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Blacklist & Whitelist Management */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-indigo-500" />
                  Custom Link Blacklists & Whitelists
                </span>
                <span className="text-[11px] font-mono text-gray-400">
                  {customThreatList.length} Rules
                </span>
              </div>

              {/* Add Custom Entry Mini-Form */}
              <div className="p-3.5 rounded-2xl bg-gray-50/70 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1 block">
                      Target Type
                    </label>
                    <select
                      value={newRuleType}
                      onChange={(e) => setNewRuleType(e.target.value as any)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                    >
                      <option value="ip">IP Address</option>
                      <option value="cidr">CIDR Subnet</option>
                      <option value="asn">ASN Number</option>
                      <option value="user_agent">User-Agent Substring</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase text-gray-500 dark:text-zinc-400 mb-1 block">
                      Action Mode
                    </label>
                    <select
                      value={newRuleAction}
                      onChange={(e) => setNewRuleAction(e.target.value as any)}
                      className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-semibold"
                    >
                      <option value="block">Block (Blacklist Drop)</option>
                      <option value="allow">Allow (Whitelist Bypass)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newRuleValue}
                    onChange={(e) => setNewRuleValue(e.target.value)}
                    placeholder={
                      newRuleType === 'ip' ? 'e.g. 198.51.100.45' :
                      newRuleType === 'cidr' ? 'e.g. 198.51.100.0/24' :
                      newRuleType === 'asn' ? 'e.g. AS209242' : 'e.g. AdPlexity'
                    }
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white font-mono"
                  />

                  <input
                    type="text"
                    value={newRuleNote}
                    onChange={(e) => setNewRuleNote(e.target.value)}
                    placeholder="Optional note / label..."
                    className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddCustomRule}
                  className="w-full py-2 px-3 rounded-lg bg-gray-900 dark:bg-zinc-800 hover:bg-gray-800 dark:hover:bg-zinc-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rule to Link</span>
                </button>
              </div>

              {/* Active Custom Rules List */}
              {customThreatList.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-gray-200 dark:border-zinc-800 text-center">
                  <p className="text-xs text-gray-400">No custom link rules yet. Add an IP or subnet above to customize this link's firewall.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {customThreatList.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.action === 'allow'
                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                          {item.action === 'allow' ? 'Allow' : 'Block'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-zinc-800 text-[10px] font-mono text-gray-500">
                          {item.type}
                        </span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white truncate">
                          {item.value}
                        </span>
                        {item.note && (
                          <span className="text-[11px] text-gray-400 italic">
                            ({item.note})
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteCustomRule(item.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition cursor-pointer"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* Footer Action Bar */}
          <div className="p-4 border-t border-gray-200 dark:border-zinc-800/80 bg-gray-50/70 dark:bg-zinc-900/50 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={() => applyPreset('maximum')}
              className="text-xs text-gray-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
            >
              Reset to Maximum
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-800 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 active:scale-95 transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Shield Matrix</span>
                  </>
                )}
              </button>
            </div>
          </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
