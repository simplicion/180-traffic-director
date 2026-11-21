'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Link as LinkIcon,
  CreditCard,
  User,
  Sun,
  Moon,
  FileText,
  Globe,
  Pin,
  PinOff,
  Menu,
  X,
} from 'lucide-react';
import clsx from 'clsx';
import { getAuthToken } from '@/lib/api';
import { useSubscription } from '@/lib/useSubscription';
import { WEBSITE_BUILDER_COMING_SOON } from '@/lib/feature-flags';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: (pathname: string) => boolean;
  liveDot?: boolean;
  badge?: string | null;
  badgePaid?: boolean;
}

const RAIL_WIDTH = 72;
const EXPANDED_WIDTH = 256;

const DRAWER_SPRING = {
  type: 'spring' as const,
  stiffness: 320,
  damping: 30,
  mass: 0.72,
};

const ACTIVE_PILL_SPRING = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 34,
  mass: 0.6,
};

export function TrafficDirectorSidebar() {
  const pathname = usePathname();
  const { planTier, isPaidPlan } = useSubscription();

  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    initial: string;
  }>({
    name: '180 Advertiser',
    email: '',
    initial: 'A',
  });

  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isExpanded = isPinned || isHovered;

  useEffect(() => {
    try {
      const savedPinned = localStorage.getItem('td_sidebar_pinned');
      if (savedPinned === 'true') setIsPinned(true);

      const storedTheme = localStorage.getItem('180_theme');
      const isDarkMode = storedTheme
        ? storedTheme === 'dark'
        : document.documentElement.classList.contains('dark');
      setIsDark(isDarkMode);
    } catch (_) {}

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
          const email = payload.email || cachedUser.email || '';
          const initial = (name[0] || email[0] || 'A').toUpperCase();
          setUserProfile({ name, email, initial });
        }
      } catch (_) {}
    }

    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 130);
  };

  const togglePin = () => {
    setIsPinned((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('td_sidebar_pinned', String(next));
      } catch (_) {}
      return next;
    });
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

  const primaryItems: NavItem[] = [
    {
      label: 'Smart Links',
      href: '/traffic-director/links',
      icon: LinkIcon,
      isActive: (p) => p.startsWith('/traffic-director/links'),
    },
    {
      label: '180 Forms',
      href: '/forms',
      icon: FileText,
      isActive: (p) => p.startsWith('/forms'),
    },
    {
      label: 'Website Builder',
      href: '/advertising',
      icon: Globe,
      isActive: (p) => p.startsWith('/advertising'),
      badge: WEBSITE_BUILDER_COMING_SOON ? 'SOON' : null,
    },
  ];

  const workspaceItems: NavItem[] = [
    {
      label: 'Subscription',
      href: '/traffic-director/subscription',
      icon: CreditCard,
      isActive: (p) => p.startsWith('/traffic-director/subscription'),
      badge: planTier || null,
      badgePaid: isPaidPlan,
    },
    {
      label: 'Profile',
      href: '/traffic-director/profile',
      icon: User,
      isActive: (p) => p.startsWith('/traffic-director/profile'),
    },
  ];

  const renderNavGroup = (
    title: string,
    items: NavItem[],
    expanded: boolean,
    layoutScope: string
  ) => (
    <div className="space-y-1">
      <div className="h-5 px-3 flex items-center overflow-hidden">
        <motion.span
          initial={false}
          animate={{
            opacity: expanded ? 1 : 0,
            x: expanded ? 0 : -6,
          }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 dark:text-zinc-500 whitespace-nowrap select-none"
        >
          {title}
        </motion.span>
      </div>

      {items.map((item, idx) => {
        const Icon = item.icon;
        const active = item.isActive(pathname || '');
        return (
          <Link
            key={item.href}
            href={item.href}
            title={!expanded ? item.label : undefined}
            className="block relative group focus:outline-none"
          >
            <motion.div
              whileHover={{ x: expanded ? 2 : 0 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 500, damping: 32 }}
              className={clsx(
                'relative flex items-center h-10 rounded-xl text-xs font-semibold overflow-hidden transition-colors duration-200',
                active
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100/80 dark:hover:bg-white/[0.05]'
              )}
            >
              {/* Smooth Gliding Active Pill */}
              {active && (
                <motion.div
                  layoutId={`td-active-pill-${layoutScope}`}
                  transition={ACTIVE_PILL_SPRING}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/12 via-indigo-500/8 to-transparent dark:from-blue-500/18 dark:via-indigo-500/10 dark:to-transparent border border-blue-500/20 dark:border-blue-400/20 shadow-[0_2px_12px_-4px_rgba(59,130,246,0.25)]"
                />
              )}

              {/* Active Edge Accent Bar */}
              {active && (
                <motion.div
                  layoutId={`td-active-bar-${layoutScope}`}
                  transition={ACTIVE_PILL_SPRING}
                  className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-gradient-to-b from-blue-500 to-indigo-500 shadow-[0_0_8px_rgba(59,130,246,0.65)]"
                />
              )}

              {/* Fixed-width icon slot so icons NEVER jump horizontally on expand */}
              <div className="relative z-10 w-[44px] h-10 flex items-center justify-center shrink-0">
                <div className="relative flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                  <Icon
                    className={clsx(
                      'w-[18px] h-[18px] transition-colors duration-200',
                      active
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white'
                    )}
                  />
                  {item.liveDot && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                  )}
                </div>
              </div>

              {/* Organic Label + Badge Reveal */}
              <motion.div
                initial={false}
                animate={{
                  opacity: expanded ? 1 : 0,
                  x: expanded ? 0 : -10,
                }}
                transition={{
                  duration: 0.22,
                  delay: expanded ? Math.min(idx * 0.025, 0.09) : 0,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={clsx(
                  'relative z-10 flex items-center gap-2 pr-3 flex-1 min-w-0 whitespace-nowrap',
                  !expanded && 'pointer-events-none'
                )}
              >
                <span className="truncate flex-1">{item.label}</span>
                {item.badge && (
                  <span
                    className={clsx(
                      'text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold uppercase shrink-0',
                      item.badgePaid
                        ? 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                        : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </motion.div>
            </motion.div>
          </Link>
        );
      })}
    </div>
  );

  const renderSidebarContent = (expanded: boolean, isMobileDrawer = false) => {
    const layoutScope = isMobileDrawer ? 'mobile' : 'desktop';
    return (
      <div className="relative flex flex-col h-full bg-white/92 dark:bg-[#09090b]/94 backdrop-blur-2xl border-r border-zinc-200/80 dark:border-white/[0.08] overflow-hidden transition-colors">
        {/* Subtle Alive Right-Edge Rim Glow when Hover-Expanded */}
        <motion.div
          initial={false}
          animate={{ opacity: expanded && !isPinned && !isMobileDrawer ? 1 : 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-blue-500/40 to-transparent"
        />

        {/* Brand Header */}
        <div className="h-16 flex items-center px-3.5 border-b border-zinc-200/80 dark:border-white/[0.07] shrink-0 overflow-hidden">
          <Link
            href="/traffic-director/links"
            className="flex items-center min-w-0 flex-1 group"
            title="180 Traffic Director"
          >
            {/* Fixed 44px slot aligned with nav icons */}
            <div className="w-[44px] flex items-center justify-center shrink-0">
              <motion.div
                whileHover={{ scale: 1.08, rotate: -2 }}
                transition={{ type: 'spring', stiffness: 450, damping: 24 }}
                className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200/90 dark:border-white/10 flex items-center justify-center shadow-xs overflow-hidden"
              >
                <img
                  src="/traffic-director-icon.svg"
                  alt="180 Traffic Director"
                  className="w-6 h-6 object-contain"
                />
              </motion.div>
            </div>

            <motion.div
              initial={false}
              animate={{
                opacity: expanded ? 1 : 0,
                x: expanded ? 0 : -8,
              }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="ml-1.5 min-w-0 flex flex-col whitespace-nowrap"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-sm tracking-tight text-zinc-950 dark:text-white">
                  <span className="text-blue-600 dark:text-blue-500">180</span> Traffic
                </span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 shrink-0">
                  EDGE
                </span>
              </div>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                Sovereign Edge
              </span>
            </motion.div>
          </Link>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
              aria-label="Close Menu"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <motion.button
              type="button"
              onClick={togglePin}
              initial={false}
              animate={{
                opacity: expanded ? 1 : 0,
                scale: expanded ? 1 : 0.8,
              }}
              transition={{ duration: 0.18 }}
              className={clsx(
                'p-1.5 rounded-lg transition cursor-pointer shrink-0',
                isPinned
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                  : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]',
                !expanded && 'pointer-events-none'
              )}
              title={isPinned ? 'Unpin sidebar (auto-collapse on leave)' : 'Pin sidebar open'}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </motion.button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-3.5 space-y-5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {renderNavGroup('Platform', primaryItems, expanded, layoutScope)}
          <div className="border-t border-zinc-200/70 dark:border-white/[0.07] pt-4">
            {renderNavGroup('Workspace', workspaceItems, expanded, layoutScope)}
          </div>
        </nav>

        {/* Footer: Theme Toggle + User Profile */}
        <div className="border-t border-zinc-200/80 dark:border-white/[0.07] p-3.5 space-y-2 shrink-0 overflow-hidden">
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileTap={{ scale: 0.97 }}
            className="w-full h-10 flex items-center rounded-xl bg-zinc-100/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 hover:border-blue-500/40 transition-colors cursor-pointer text-xs font-semibold overflow-hidden"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Theme"
          >
            <div className="w-[44px] h-10 flex items-center justify-center shrink-0">
              <motion.div
                key={isDark ? 'sun' : 'moon'}
                initial={{ rotate: -45, opacity: 0, scale: 0.7 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              >
                {isDark ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-zinc-700" />
                )}
              </motion.div>
            </div>
            <motion.span
              initial={false}
              animate={{
                opacity: expanded ? 1 : 0,
                x: expanded ? 0 : -8,
              }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="whitespace-nowrap pr-3"
            >
              {isDark ? 'Light Mode' : 'Dark Mode'}
            </motion.span>
          </motion.button>

          <Link
            href="/traffic-director/profile"
            className="w-full h-11 flex items-center rounded-xl bg-zinc-100/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-white/[0.08] hover:border-indigo-500/40 transition-colors group overflow-hidden"
            title={`Signed in as ${userProfile.name} (${userProfile.email})`}
          >
            <div className="w-[44px] h-11 flex items-center justify-center shrink-0">
              <div className="w-7 h-7 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 flex items-center justify-center font-bold text-xs shadow-xs border border-zinc-800 dark:border-white/20 group-hover:scale-105 transition-transform">
                {userProfile.initial}
              </div>
            </div>
            <motion.div
              initial={false}
              animate={{
                opacity: expanded ? 1 : 0,
                x: expanded ? 0 : -8,
              }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col min-w-0 pr-3 text-left whitespace-nowrap"
            >
              <span className="text-xs font-bold text-zinc-950 dark:text-white truncate">
                {userProfile.name}
              </span>
              <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                {userProfile.email}
              </span>
            </motion.div>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Compact Header Bar (< lg) */}
      <div className="lg:hidden sticky top-0 z-40 h-14 w-full bg-white/90 dark:bg-[#09090b]/90 backdrop-blur-xl border-b border-zinc-200/80 dark:border-white/10 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10 text-zinc-700 dark:text-zinc-200"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <Link href="/traffic-director/links" className="flex items-center gap-2">
            <img
              src="/traffic-director-icon.svg"
              alt="180 Traffic Director"
              className="w-6 h-6 object-contain"
            />
            <span className="font-extrabold text-sm text-zinc-950 dark:text-white">
              <span className="text-blue-600 dark:text-blue-500">180</span> Traffic Director
            </span>
          </Link>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-white/10"
          aria-label="Toggle Theme"
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-zinc-700" />
          )}
        </button>
      </div>

      {/* Mobile Slide-Over Drawer with Organic Spring */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -EXPANDED_WIDTH }}
              animate={{ x: 0 }}
              exit={{ x: -EXPANDED_WIDTH }}
              transition={DRAWER_SPRING}
              className="relative z-10 w-[256px] max-w-[82vw] h-full shadow-2xl"
            >
              {renderSidebarContent(true, true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop Spacer — reserves 72px rail (or 256px when pinned) so content never jumps on hover */}
      <motion.div
        aria-hidden="true"
        initial={false}
        animate={{ width: isPinned ? EXPANDED_WIDTH : RAIL_WIDTH }}
        transition={DRAWER_SPRING}
        className="hidden lg:block shrink-0"
      />

      {/* Desktop Hover-to-Expand Organic Side Drawer */}
      <motion.aside
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={false}
        animate={{ width: isExpanded ? EXPANDED_WIDTH : RAIL_WIDTH }}
        transition={DRAWER_SPRING}
        className={clsx(
          'hidden lg:block fixed left-0 top-0 bottom-0 z-40 will-change-[width]',
          isExpanded && !isPinned
            ? 'shadow-[16px_0_48px_-12px_rgba(0,0,0,0.16)] dark:shadow-[22px_0_64px_-12px_rgba(0,0,0,0.78)]'
            : 'shadow-none'
        )}
      >
        {renderSidebarContent(isExpanded, false)}
      </motion.aside>
    </>
  );
}

export default TrafficDirectorSidebar;
