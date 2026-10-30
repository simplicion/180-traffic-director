'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Link as LinkIcon, 
  Layers, 
  Terminal, 
  ShieldCheck, 
  CreditCard, 
  User, 
  Sparkles,
  BarChart3,
  ArrowLeft,
  ChevronLeft, 
  ChevronRight,
  Pin,
  X, 
  LogOut,
  Sun,
  Moon,
  Zap,
  Copy,
  Check,
  Radio
} from 'lucide-react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { getAuthToken, clearAuthTokens } from '@/lib/api';
import { useSubscription } from '@/lib/useSubscription';
import { useLinkDetailNav } from '@/context/LinkDetailNavContext';

export interface TrafficDirectorSidebarProps {
  isMobileOpen: boolean;
  onMobileClose: () => void;
  onExpandChange?: (expanded: boolean) => void;
}

interface NavItem {
  id: string;
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export function TrafficDirectorSidebar({
  isMobileOpen,
  onMobileClose,
  onExpandChange,
}: TrafficDirectorSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isLinkDetail, activeTab, setActiveTab, metadata } = useLinkDetailNav();

  // Sidebar collapse & hover states (matching 180workspace and Developers platform behavior)
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isDark, setIsDark] = useState<boolean>(true);
  const [copiedSlug, setCopiedSlug] = useState(false);
  const [advertisingUrl, setAdvertisingUrl] = useState('http://localhost:3000/advertising');
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    initial: string;
  }>({
    name: '180 Advertiser',
    email: 'advertiser@180workspace.com',
    initial: 'A',
  });

  const {
    planName,
    planTier,
    isPaidPlan,
    isTrialing,
    trialDaysLeft,
    isTrialExpired,
    maxLinks,
    isUnlimited
  } = useSubscription();

  // Initialize collapse preference and theme from localStorage
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('180_theme');
      const isDarkMode = storedTheme ? storedTheme === 'dark' : document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    } catch (_) {}

    try {
      const saved = localStorage.getItem('traffic_director_sidebar_collapsed');
      if (saved !== null) {
        setIsCollapsed(saved === 'true');
      } else {
        setIsCollapsed(true);
      }
    } catch (_) {}

    const isLocal =
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1');
    setAdvertisingUrl(
      isLocal
        ? 'http://localhost:3000/advertising'
        : 'https://app.180workspace.com/advertising'
    );

    // Read user profile info
    const token = getAuthToken();
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const json = decodeURIComponent(
            atob(base64)
              .split('')
              .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
              .join('')
          );
          const payload = JSON.parse(json);

          let cachedUser: any = {};
          try {
            const raw = localStorage.getItem('user');
            if (raw) cachedUser = JSON.parse(raw);
          } catch (_) {}

          const name =
            payload.name ||
            cachedUser.name ||
            payload.email?.split('@')[0] ||
            '180 Advertiser';
          const email =
            payload.email ||
            cachedUser.email ||
            'advertiser@180workspace.com';
          const initial = (name[0] || email[0] || 'A').toUpperCase();

          setUserProfile({ name, email, initial });
        }
      } catch (_) {}
    }
  }, []);

  const isExpanded = !isCollapsed || isHovered;

  // Notify parent container of expansion change to synchronize viewport margin
  useEffect(() => {
    onExpandChange?.(isExpanded);
  }, [isExpanded, onExpandChange]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    try {
      localStorage.setItem('traffic_director_sidebar_collapsed', String(next));
    } catch (_) {}
  };

  const handleSignOut = () => {
    clearAuthTokens();
    toast.success('Logged out successfully');
    window.location.href = '/';
  };

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('180_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('180_theme', 'light');
    }
  };

  const handleCopySlug = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!metadata?.slug) return;
    const fullUrl = `${window.location.origin}/r/${metadata.slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(true);
    toast.success('Redirect URL copied to clipboard');
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  // Main Platform Navigation Items (Shown when NOT on link detail page)
  const platformNavItems: NavItem[] = [
    { id: 'links', name: 'Smart Links', href: '/traffic-director/links', icon: LinkIcon },
    { id: 'logs', name: 'Traffic Logs', href: '/traffic-director/logs', icon: Layers },
    { id: 'simulator', name: 'Edge Simulator', href: '/traffic-director/simulator', icon: Terminal },
    { id: 'threats', name: 'Threat Intelligence', href: '/traffic-director/threats', icon: ShieldCheck },
    { id: 'subscription', name: 'Subscriptions', href: '/traffic-director/subscription', icon: CreditCard },
    { id: 'profile', name: 'Profile', href: '/traffic-director/profile', icon: User },
  ];

  // Contextual Link Detail Navigation Items (Shown when ON a link detail page)
  const linkDetailNavItems = [
    {
      id: 'rules' as const,
      name: 'Routing Rules & Setup',
      subtitle: 'Priorities, evasion & fallback',
      icon: Layers,
      badge: String(metadata?.rulesCount ?? 0),
    },
    {
      id: 'pixel' as const,
      name: 'Universal Meta Pixel & CAPI',
      subtitle: 'Server-side CAPI & backup pixels',
      icon: Sparkles,
      badge: 'CAPI',
    },
    {
      id: 'analytics' as const,
      name: 'Traffic Analytics & Logs',
      subtitle: 'Live breakdown & bot logs',
      icon: BarChart3,
      badge: `${metadata?.totalClicks ?? 0} views`,
    },
  ];

  const sidebarContent = (
    <div
      className={clsx(
        "flex flex-col h-full bg-white/95 dark:bg-[#101012] backdrop-blur-xl border-r border-zinc-200/80 dark:border-white/10 select-none overflow-x-hidden transition-all duration-300 ease-in-out",
        isExpanded ? "w-[280px]" : "w-[80px]"
      )}
    >
      {/* 1. Dynamic Header - Contextually Morphs for Link Detail Page */}
      <div className="px-3 py-3 border-b border-zinc-200/80 dark:border-white/10 shrink-0 min-h-[64px] flex items-center justify-between gap-1.5 transition-all duration-300">
        {isLinkDetail ? (
          /* LINK DETAIL CONTEXT HEADER */
          isExpanded ? (
            <div className="w-full flex flex-col gap-2 transition-all duration-300 animate-in fade-in">
              <div className="flex items-center justify-between w-full">
                {/* Back to All Links Action */}
                <Link
                  href="/traffic-director/links"
                  onClick={onMobileClose}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 text-xs font-bold transition group cursor-pointer border border-zinc-200/60 dark:border-white/5"
                  title="Return to Smart Links Directory"
                >
                  <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  <span>Smart Links</span>
                </Link>

                <div className="flex items-center gap-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                    Detail View
                  </span>
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                    title={isCollapsed ? 'Pin Sidebar Expanded' : 'Collapse Sidebar'}
                    aria-label="Toggle Sidebar Collapse"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Link Identity Card */}
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/70 dark:border-white/5 space-y-1">
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={clsx(
                        "w-2 h-2 rounded-full shrink-0",
                        metadata?.isActive
                          ? "bg-emerald-500 animate-pulse shadow-xs shadow-emerald-500/50"
                          : "bg-zinc-400 dark:bg-zinc-600"
                      )}
                      title={metadata?.isActive ? 'Active Cloaking' : 'Paused'}
                    />
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                      {metadata?.name || 'Smart Link'}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50 dark:border-indigo-800/50 shrink-0">
                    {metadata?.shieldMode === 'client_shield' ? 'JS Tag' : 'Edge Link'}
                  </span>
                </div>

                {metadata?.slug && (
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 font-mono pt-0.5">
                    <span className="truncate">/r/{metadata.slug}</span>
                    <button
                      type="button"
                      onClick={handleCopySlug}
                      className="p-1 text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition cursor-pointer"
                      title="Copy Link URL"
                    >
                      {copiedSlug ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* COLLAPSED DETAIL HEADER */
            <div className="w-full flex flex-col items-center gap-2 transition-all duration-300">
              <Link
                href="/traffic-director/links"
                onClick={onMobileClose}
                className="w-10 h-10 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center hover:scale-105 transition-all shadow-xs cursor-pointer group"
                title="Back to Smart Links Directory"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )
        ) : (
          /* STANDARD PLATFORM HEADER */
          isExpanded ? (
            <>
              <Link
                href="/traffic-director/links"
                onClick={onMobileClose}
                className="flex items-center gap-2.5 p-1 rounded-xl group transition-all min-h-[44px] min-w-0"
              >
                <div className="w-8 h-8 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                  <img
                    src="/traffic-director-icon.svg"
                    alt="180 Traffic Director"
                    className="w-6 h-6 object-contain"
                  />
                </div>
                <div className="min-w-0 flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold text-sm tracking-tight text-zinc-950 dark:text-white whitespace-nowrap block">
                      <span className="text-blue-600 dark:text-blue-500">180</span> Traffic Director
                    </span>
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 shrink-0">
                      EDGE
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide flex items-center gap-1 whitespace-nowrap">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    Sovereign Edge Network
                  </span>
                </div>
              </Link>

              <button
                type="button"
                onClick={toggleCollapse}
                className="hidden lg:flex p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 cursor-pointer"
                title={isCollapsed ? 'Pin Sidebar Expanded' : 'Collapse Sidebar'}
                aria-label="Toggle Sidebar Collapse"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          ) : (
            <Link
              href="/traffic-director/links"
              onClick={onMobileClose}
              className="w-10 h-10 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center mx-auto hover:scale-105 transition-all shadow-xs overflow-hidden"
              title="180 Traffic Director"
            >
              <img
                src="/traffic-director-icon.svg"
                alt="180 Traffic Director"
                className="w-7 h-7 object-contain"
              />
            </Link>
          )
        )}

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onMobileClose}
          className="lg:hidden p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
          title="Close Navigation"
          aria-label="Close Navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Navigation Area: Morphing between Platform Nav & Link Detail Nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4 space-y-4 text-xs hidden-scrollbar transition-all duration-300">
        {isLinkDetail ? (
          /* ========================================================================= */
          /* LINK DETAIL NAVIGATION (When viewing a specific Link)                     */
          /* ========================================================================= */
          <div className="space-y-2 transition-all duration-300 animate-in fade-in-50">
            {isExpanded ? (
              <div className="flex items-center justify-between px-3 mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Link Views
                </p>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-200/50 dark:border-indigo-800/50">
                  3 Tabs
                </span>
              </div>
            ) : (
              <div className="h-px bg-zinc-200/60 dark:bg-white/5 mx-2 my-1" />
            )}

            <div className="space-y-1.5">
              {linkDetailNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      onMobileClose();
                    }}
                    className={clsx(
                      "w-full transition-all duration-200 cursor-pointer relative group rounded-xl",
                      isExpanded
                        ? clsx(
                            "text-left p-2.5 flex items-start gap-3",
                            isActive
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-indigo-400/50"
                              : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/90 dark:hover:bg-zinc-900 border border-transparent"
                          )
                        : clsx(
                            "h-11 flex items-center justify-center mx-auto",
                            isActive
                              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-indigo-500/40"
                              : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
                          )
                    )}
                    title={!isExpanded ? `${item.name} (${item.badge})` : undefined}
                  >
                    {isExpanded ? (
                      <>
                        <div
                          className={clsx(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="text-xs font-bold truncate block">
                              {item.name}
                            </span>
                            <span
                              className={clsx(
                                "px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0",
                                isActive
                                  ? "bg-indigo-500/60 text-white border border-white/20"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200/50 dark:border-white/5"
                              )}
                            >
                              {item.badge}
                            </span>
                          </div>
                          <p
                            className={clsx(
                              "text-[10px] mt-0.5 line-clamp-1",
                              isActive
                                ? "text-indigo-100"
                                : "text-zinc-400 dark:text-zinc-500"
                            )}
                          >
                            {item.subtitle}
                          </p>
                        </div>

                        {isActive && (
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-white rounded-full shadow-xs" />
                        )}
                      </>
                    ) : (
                      <div className="relative flex items-center justify-center w-full h-full">
                        <Icon className="w-4 h-4" />
                        {item.badge && item.badge !== '0' && (
                          <span
                            className={clsx(
                              "absolute -top-1 -right-1 px-1 min-w-[16px] h-4 text-[9px] font-bold rounded-full flex items-center justify-center font-mono shadow-xs",
                              isActive
                                ? "bg-white text-indigo-600 ring-2 ring-indigo-600"
                                : "bg-indigo-600 text-white"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Link Info (Only visible when sidebar is expanded in link detail mode) */}
            {isExpanded && (
              <div className="pt-3 border-t border-zinc-200/70 dark:border-white/5 space-y-2 text-xs animate-in fade-in duration-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-1">
                  Quick Details
                </span>
                <div className="p-2.5 rounded-xl bg-zinc-50/70 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-white/5 space-y-1.5 text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Mode</span>
                    <span className="font-semibold text-zinc-900 dark:text-white capitalize">
                      {metadata?.shieldMode === 'client_shield' ? 'JS Tag' : 'Smart Link'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Status</span>
                    <span className={clsx("font-semibold", metadata?.isActive ? "text-emerald-500" : "text-zinc-400")}>
                      {metadata?.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">Domain</span>
                    <span className="font-mono text-[10px] text-zinc-900 dark:text-white truncate max-w-[120px]">
                      {metadata?.customDomain || 'Default'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================================= */
          /* PLATFORM GLOBAL NAVIGATION (When viewing normal platform pages)           */
          /* ========================================================================= */
          <div className="space-y-1 transition-all duration-300 animate-in fade-in-50">
            {isExpanded ? (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
                Navigation
              </p>
            ) : (
              <div className="h-px bg-zinc-200/60 dark:bg-white/5 mx-2 my-1" />
            )}

            {platformNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onMobileClose}
                  className={clsx(
                    "flex items-center gap-3 rounded-xl font-semibold transition-all duration-200 min-h-[42px] group",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-zinc-900 border border-transparent",
                    isExpanded ? "px-3 py-2" : "justify-center p-2"
                  )}
                  title={!isExpanded ? item.name : undefined}
                >
                  <div
                    className={clsx(
                      "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-zinc-100 dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  {isExpanded && <span className="text-xs font-semibold whitespace-nowrap">{item.name}</span>}
                </Link>
              );
            })}
          </div>
        )}

        {/* AI Tools Section */}
        <div className="space-y-1 pt-2 border-t border-zinc-200/60 dark:border-white/5">
          {isExpanded ? (
            <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1">
              AI Tools
            </p>
          ) : (
            <div className="h-px bg-zinc-200/60 dark:bg-white/5 mx-2 my-2" />
          )}

          <a
            href={advertisingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onMobileClose}
            className={clsx(
              "flex items-center rounded-xl font-semibold transition-all duration-200 min-h-[42px] text-zinc-600 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/20 border border-transparent hover:border-indigo-200/50 dark:hover:border-indigo-800/40 group",
              isExpanded ? "justify-between px-3 py-2" : "justify-center p-2"
            )}
            title="Generate AI White Page with 180 Visual Website & Landing Page Builder"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              {isExpanded && <span className="text-xs font-semibold whitespace-nowrap">AI White Pages</span>}
            </div>

            {isExpanded && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                Builder ↗
              </span>
            )}
          </a>
        </div>
      </nav>

      {/* 3. Subscription / Plan Status Widget */}
      <div className="border-t border-zinc-200/80 dark:border-white/10 shrink-0">
        {isExpanded ? (
          <div className="p-2.5">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-blue-500/10 border border-indigo-500/20 dark:border-indigo-500/30 shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Zap className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-zinc-950 dark:text-white truncate block">
                      {isPaidPlan ? planName : 'Free + 7-Day Trial Plan'}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block truncate">
                      {isPaidPlan
                        ? `${isUnlimited ? 'Unlimited' : maxLinks} Links Capacity`
                        : isTrialExpired
                        ? 'Trial Ended'
                        : `${trialDaysLeft} days remaining`}
                    </span>
                  </div>
                </div>
              </div>

              <Link
                href="/traffic-director/subscription"
                onClick={onMobileClose}
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold transition shadow-xs cursor-pointer group"
              >
                <span>{isPaidPlan ? 'Manage Plan' : 'Upgrade Plan ($25+)'}</span>
                <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="py-2.5 flex justify-center">
            <Link
              href="/traffic-director/subscription"
              onClick={onMobileClose}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 hover:scale-105 transition-all cursor-pointer relative shadow-xs"
              title={`Plan: ${isPaidPlan ? planName : 'Free + 7-Day Trial Plan'} (${isTrialExpired ? 'Expired' : `${trialDaysLeft}d left`})`}
            >
              <Zap className="w-4 h-4" />
              {!isPaidPlan && (
                <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1.5 right-1.5 ring-2 ring-white dark:ring-zinc-900" />
              )}
            </Link>
          </div>
        )}
      </div>

      {/* 4. Dark & Light (White) Mode Switcher */}
      <div className="border-t border-zinc-200/80 dark:border-white/10 shrink-0">
        {isExpanded ? (
          <div className="px-2.5 py-2">
            <div className="flex items-center justify-between p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10">
              <button
                type="button"
                onClick={() => isDark && toggleTheme()}
                className={clsx(
                  "flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                  !isDark
                    ? "bg-white text-zinc-950 shadow-xs font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                )}
                title="Switch to Clean Light (White) Mode"
              >
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Light</span>
              </button>

              <button
                type="button"
                onClick={() => !isDark && toggleTheme()}
                className={clsx(
                  "flex items-center justify-center gap-1.5 flex-1 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer",
                  isDark
                    ? "bg-zinc-800 text-white shadow-xs font-bold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                )}
                title="Switch to Obsidian Dark Mode"
              >
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Dark</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="py-2 flex justify-center">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center text-zinc-600 dark:text-zinc-300 hover:scale-105 transition-all cursor-pointer shadow-xs"
              title={isDark ? "Switch to Clean Light (White) Mode" : "Switch to Obsidian Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600 dark:text-zinc-400" />}
            </button>
          </div>
        )}
      </div>

      {/* 5. Account / Profile Widget */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-white/10 bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0">
        {isExpanded ? (
          <div className="flex items-center gap-2.5 p-2 rounded-2xl bg-white dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-white/10 shadow-xs">
            <Link
              href="/traffic-director/profile"
              onClick={onMobileClose}
              className="flex items-center gap-2.5 min-w-0 flex-1 group"
              title="View Profile"
            >
              <div className="w-9 h-9 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-zinc-700/50 dark:border-white/20 group-hover:scale-105 transition-transform">
                {userProfile.initial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-950 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {userProfile.name}
                </p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
                  {userProfile.email}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              title="Sign Out"
              aria-label="Sign Out"
              className="p-1.5 rounded-xl text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0 min-h-[32px] min-w-[32px] flex items-center justify-center cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <Link
            href="/traffic-director/profile"
            onClick={onMobileClose}
            title={`Profile: ${userProfile.name}`}
            className="w-10 h-10 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs mx-auto shadow-xs border border-zinc-700/50 dark:border-white/20 hover:scale-105 transition-all cursor-pointer"
          >
            {userProfile.initial}
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar with Hover Expand (matching 180workspace and Developers platform) */}
      <aside
        onMouseEnter={() => isCollapsed && setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 shadow-sm transition-all duration-300 ease-in-out",
          isExpanded
            ? "w-[280px] shadow-2xl shadow-black/10 dark:shadow-black/60"
            : "w-[80px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 lg:hidden transition-opacity duration-300"
          onClick={onMobileClose}
        >
          <div
            className="w-72 max-w-[85vw] h-full shadow-2xl transition-transform duration-300 animate-in slide-in-from-left"
            onClick={(e) => e.stopPropagation()}
          >
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

export default TrafficDirectorSidebar;
