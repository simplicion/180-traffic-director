'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Link as LinkIcon, 
  Layers, 
  CreditCard, 
  User, 
  Sun, 
  Moon, 
  Zap,
  ArrowRight
} from 'lucide-react';
import clsx from 'clsx';
import { getAuthToken } from '@/lib/api';
import { useSubscription } from '@/lib/useSubscription';

export function TrafficDirectorTopNav() {
  const pathname = usePathname();
  const { planTier, isPaidPlan } = useSubscription();
  const [isDark, setIsDark] = useState<boolean>(true);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    initial: string;
  }>({
    name: '180 Advertiser',
    email: '',
    initial: 'A',
  });

  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem('180_theme');
      const isDarkMode = storedTheme ? storedTheme === 'dark' : document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    } catch (_) {}

    // Read user profile info from JWT or localStorage
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
            '';
          const initial = (name[0] || email[0] || 'A').toUpperCase();

          setUserProfile({ name, email, initial });
        }
      } catch (_) {}
    }
  }, []);

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

  return (
    <header className="sticky top-0 z-40 w-full bg-white/90 dark:bg-[#0c0c0e]/90 backdrop-blur-xl border-b border-zinc-200/80 dark:border-white/10 transition-colors">
      <div className="w-full max-w-[1680px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Left: Platform Brand & Architecture Identity */}
        <div className="flex items-center gap-6">
          <Link
            href="/traffic-director/links"
            className="flex items-center gap-3 group transition-all cursor-pointer"
          >
            <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-white/10 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
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

          {/* Quick Nav Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1.5 pl-4 border-l border-zinc-200/80 dark:border-white/10 text-xs">
            <Link
              href="/traffic-director/links"
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl font-semibold transition-all",
                pathname.startsWith('/traffic-director/links')
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
              )}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Smart Links</span>
            </Link>

            <Link
              href="/traffic-director/logs"
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl font-semibold transition-all cursor-pointer",
                pathname === '/traffic-director/logs'
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
              )}
              title="Open Live Traffic Stream for all Links"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Layers className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Live Logs</span>
            </Link>

            <Link
              href="/traffic-director/subscription"
              className={clsx(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl font-semibold transition-all",
                pathname === '/traffic-director/subscription'
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60"
                  : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900"
              )}
              title="View Plan & Manage Subscription"
            >
              <CreditCard className="w-3.5 h-3.5 text-indigo-500" />
              <span>Subscription</span>
              {planTier && (
                <span className={clsx(
                  "text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold uppercase",
                  isPaidPlan 
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" 
                    : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                )}>
                  {planTier}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* Right: Theme Switcher & User Profile Widget */}
        <div className="flex items-center gap-2.5">
          {/* Light / Dark Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:scale-105 transition-all cursor-pointer shadow-xs"
            title={isDark ? "Switch to Clean Light (White) Mode" : "Switch to Obsidian Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* User Account / Profile Card */}
          <Link
            href="/traffic-director/profile"
            className="flex items-center gap-2 p-1.5 pr-3 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 hover:border-indigo-500/40 transition cursor-pointer shadow-xs group"
            title={`Signed in as ${userProfile.name} (${userProfile.email})`}
          >
            <div className="w-7 h-7 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shrink-0 shadow-xs border border-zinc-800 dark:border-white/20 group-hover:scale-105 transition-transform">
              {userProfile.initial}
            </div>
            <div className="hidden sm:flex flex-col min-w-0 text-left">
              <span className="text-xs font-bold text-zinc-950 dark:text-white truncate max-w-[120px]">
                {userProfile.name}
              </span>
              <span className="text-[9px] text-zinc-500 dark:text-zinc-400 font-mono truncate max-w-[120px]">
                {userProfile.email}
              </span>
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default TrafficDirectorTopNav;

