'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  RefreshCw, 
  Filter, 
  Bot, 
  ShieldCheck, 
  ExternalLink, 
  Search, 
  Globe, 
  Smartphone, 
  Monitor,
  X, 
  Clock,
  Layers,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
  Play,
  Pause,
  ChevronDown,
  ChevronUp,
  Zap
} from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { Drawer } from '@/components/ui/Drawer';
import { LogoLoader } from '@workspace/ui';
import clsx from 'clsx';

export interface LiveLogsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialSlug?: string;
}

export function LiveLogsDrawer({ isOpen, onClose, initialSlug }: LiveLogsDrawerProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(true);
  const [actionFilter, setActionFilter] = useState<'all' | 'target_offer' | 'safe_page' | 'bot'>('all');
  const [searchQuery, setSearchQuery] = useState(initialSlug || '');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [copiedIp, setCopiedIp] = useState<string | null>(null);

  const fetchLogs = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const params: any = {
        limit: 50,
      };
      if (actionFilter !== 'all') {
        params.action = actionFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await api.get('/api/v1/traffic-director/logs', { params });
      const fetched = res.data?.data?.logs || [];
      setLogs(fetched);
    } catch (err) {
      if (!isBackground) {
        toast.error('Failed to stream live edge logs');
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Re-fetch when filter or drawer open changes
  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, actionFilter, searchQuery]);

  // Real-time polling stream every 3.5 seconds when drawer is open and streaming is active
  useEffect(() => {
    if (!isOpen || !isStreaming) return;
    const interval = setInterval(() => {
      fetchLogs(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [isOpen, isStreaming, actionFilter, searchQuery]);

  const handleCopyIp = (ip: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(ip);
    setCopiedIp(ip);
    toast.success('IP address copied');
    setTimeout(() => setCopiedIp(null), 1500);
  };

  const formatRelativeTime = (timestamp: string) => {
    try {
      const diffSec = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
      if (diffSec < 5) return 'Just now';
      if (diffSec < 60) return `${diffSec}s ago`;
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      return new Date(timestamp).toLocaleTimeString();
    } catch {
      return timestamp;
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="max-w-3xl"
      title={
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            {isStreaming && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            )}
            <span className={clsx("relative inline-flex rounded-full h-3 w-3", isStreaming ? "bg-emerald-500" : "bg-amber-500")}></span>
          </div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-zinc-950 dark:text-white">Live Traffic Stream</h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 font-semibold">
              {isStreaming ? 'STREAMING' : 'PAUSED'}
            </span>
          </div>
        </div>
      }
      description="Real-time sub-10ms visitor routing evaluations across all Smart Links"
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsStreaming(!isStreaming)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 transition cursor-pointer"
            >
              {isStreaming ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-amber-500" />
                  <span>Pause Stream</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Resume Live Stream</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => fetchLogs(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              title="Manual Refresh"
            >
              <RefreshCw className={clsx("w-3.5 h-3.5", loading && "animate-spin text-blue-500")} />
            </button>
          </div>

          <Link
            href="/traffic-director/logs"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 transition group cursor-pointer"
          >
            <span>Full Analytics Page</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Search & Action Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-2 border-b border-zinc-200/70 dark:border-white/5">
          {/* Action Filter Pills */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-white/5 overflow-x-auto text-xs">
            <button
              type="button"
              onClick={() => setActionFilter('all')}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap",
                actionFilter === 'all'
                  ? "bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              )}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('target_offer')}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap",
                actionFilter === 'target_offer'
                  ? "bg-emerald-500 text-white shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"
              )}
            >
              Allowed (Offer)
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('bot')}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap",
                actionFilter === 'bot'
                  ? "bg-purple-600 text-white shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-purple-600 dark:hover:text-purple-400"
              )}
            >
              Cloaked Bots
            </button>
            <button
              type="button"
              onClick={() => setActionFilter('safe_page')}
              className={clsx(
                "px-2.5 py-1 rounded-lg font-medium transition cursor-pointer whitespace-nowrap",
                actionFilter === 'safe_page'
                  ? "bg-amber-500 text-white shadow-xs font-semibold"
                  : "text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400"
              )}
            >
              Fallback
            </button>
          </div>

          {/* Quick Search Input */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search slug, IP, country..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Live Logs Stream Body */}
        {loading && logs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <LogoLoader size="md" />
            <span className="text-xs text-zinc-500">Connecting to edge live log stream...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center space-y-2 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
            <Layers className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-white">No live traffic recorded yet</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Send test traffic to any of your Smart Link URLs (e.g. <code className="bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">/r/[slug]</code>) to see live edge routing decisions in real-time.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {logs.map((log) => {
              const isTarget = log.action === 'target_offer' || (log.destinationUrl && log.destinationUrl !== log.link?.fallbackUrl && !log.isBot);
              const isBot = log.isBot || log.action === 'bot' || log.threatFeedMatched;
              const isSafe = !isTarget && !isBot;
              const isExpanded = expandedLogId === log.id;

              return (
                <div
                  key={log.id}
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                  className={clsx(
                    "p-3.5 rounded-xl border transition-all cursor-pointer group text-xs",
                    isExpanded
                      ? "bg-zinc-50/90 dark:bg-zinc-900/90 border-blue-500/40 shadow-sm"
                      : "bg-white dark:bg-zinc-900/50 border-zinc-200/80 dark:border-white/5 hover:border-zinc-300 dark:hover:border-white/20"
                  )}
                >
                  {/* Top Row: Slug, Action Tag, Latency & Timestamp */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-200/50 dark:border-blue-900/50">
                        /r/{log.link?.slug || 'unknown'}
                      </span>

                      {/* Action Decision Badge */}
                      {isBot ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50 dark:border-purple-800/50">
                          <ShieldAlert className="w-3 h-3 text-purple-500" />
                          CLOAKED BOT
                        </span>
                      ) : isTarget ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/50">
                          <Check className="w-3 h-3 text-emerald-500" />
                          TARGET OFFER
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-bold text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/50 dark:border-amber-800/50">
                          <Globe className="w-3 h-3 text-amber-500" />
                          SAFE FALLBACK
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {log.latencyMs !== undefined && (
                        <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                          <Zap className="w-3 h-3" />
                          {log.latencyMs}ms
                        </span>
                      )}
                      <span>{formatRelativeTime(log.timestamp)}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </div>

                  {/* Second Row: Geo, Device & IP */}
                  <div className="mt-2 flex items-center justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* IP address with copy */}
                      <button
                        type="button"
                        onClick={(e) => handleCopyIp(log.ipAddress, e)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-zinc-700 dark:text-zinc-300 hover:text-blue-500 transition cursor-pointer"
                        title="Click to copy IP"
                      >
                        <span>{log.ipAddress || '127.0.0.1'}</span>
                        {copiedIp === log.ipAddress ? (
                          <Check className="w-3 h-3 text-emerald-500" />
                        ) : (
                          <Copy className="w-3 h-3 opacity-60 hover:opacity-100" />
                        )}
                      </button>

                      {/* Geo location */}
                      <span className="flex items-center gap-1 font-medium">
                        <Globe className="w-3 h-3 text-zinc-400" />
                        <span>{log.country || 'Global'}{log.city ? `, ${log.city}` : ''}</span>
                      </span>

                      {/* Device */}
                      <span className="flex items-center gap-1 text-zinc-500">
                        {log.device === 'mobile' ? (
                          <Smartphone className="w-3 h-3" />
                        ) : (
                          <Monitor className="w-3 h-3" />
                        )}
                        <span>{log.os || log.device || 'Desktop'} · {log.browser || 'Browser'}</span>
                      </span>
                    </div>

                    {log.reason && (
                      <span className="text-[11px] text-zinc-500 truncate max-w-[220px]" title={log.reason}>
                        {log.reason}
                      </span>
                    )}
                  </div>

                  {/* Expandable Inspector */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-zinc-200/60 dark:border-white/5 space-y-2 text-[11px] animate-in fade-in duration-200">
                      <div>
                        <span className="text-zinc-400 font-medium">Destination Route: </span>
                        <a
                          href={log.destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-blue-600 dark:text-blue-400 hover:underline break-all inline-flex items-center gap-1"
                        >
                          {log.destinationUrl}
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </div>

                      {log.userAgent && (
                        <div>
                          <span className="text-zinc-400 font-medium">User Agent: </span>
                          <span className="font-mono text-zinc-600 dark:text-zinc-300 break-all">
                            {log.userAgent}
                          </span>
                        </div>
                      )}

                      {log.threatFeedMatched && (
                        <div>
                          <span className="text-rose-500 font-medium">Threat Feed Triggered: </span>
                          <span className="font-mono text-rose-600 dark:text-rose-400">
                            {log.threatFeedMatched}
                          </span>
                        </div>
                      )}

                      {log.referer && (
                        <div>
                          <span className="text-zinc-400 font-medium">Referer: </span>
                          <span className="font-mono text-zinc-600 dark:text-zinc-300">
                            {log.referer}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default LiveLogsDrawer;

