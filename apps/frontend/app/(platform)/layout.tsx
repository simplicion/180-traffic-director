'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Link as LinkIcon, 
  Layers, 
  Terminal, 
  User, 
  Sun, 
  Moon, 
  ShieldCheck, 
  ChevronRight, 
  CreditCard,
  Menu
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAuthToken, clearAuthTokens } from '@/lib/api';
import { TrialBanner } from '@/components/shared/TrialBanner';
import { TrafficDirectorSidebar } from '@/components/layout/TrafficDirectorSidebar';
import { LinkDetailNavProvider, useLinkDetailNav } from '@/context/LinkDetailNavContext';

function PlatformLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isDark, setIsDark] = useState<boolean>(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const { isLinkDetail } = useLinkDetailNav();

  useEffect(() => {
    // Read theme
    const storedTheme = localStorage.getItem('180_theme');
    const isDarkMode = storedTheme ? storedTheme === 'dark' : document.documentElement.classList.contains('dark');
    setIsDark(isDarkMode);

    const token = getAuthToken();
    if (!token) {
      router.replace('/');
      return;
    }

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
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          clearAuthTokens();
          toast.error('Your session has expired. Please sign in again.');
          router.replace('/');
          return;
        }
      }
    } catch (_) {}
  }, [router]);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-black text-gray-900 dark:text-zinc-100 transition-colors duration-200">
      {/* 180 Workspace & Developers Platform Standard Sidebar with Hover Expand/Collapse */}
      <TrafficDirectorSidebar
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
        onExpandChange={setIsSidebarExpanded}
      />

      {/* Main Content Area */}
      <main
        className={`flex-1 ${
          isSidebarExpanded
            ? 'lg:ml-[280px] lg:w-[calc(100%-280px)]'
            : 'lg:ml-[80px] lg:w-[calc(100%-80px)]'
        } flex flex-col min-w-0 min-h-screen overflow-y-auto transition-all duration-300 ease-in-out`}
      >
        {/* Mobile-only Hamburger Menu Toggle */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="lg:hidden fixed top-3.5 left-3.5 z-40 p-2.5 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-white/10 shadow-md text-zinc-700 dark:text-zinc-300 backdrop-blur-md cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          title="Open Navigation Menu"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Body - Expands gracefully for link detail page */}
        <div className={`p-6 md:p-8 w-full ${isLinkDetail ? 'max-w-[1680px]' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
          {children}
        </div>
      </main>
    </div>
  );
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LinkDetailNavProvider>
      <PlatformLayoutInner>{children}</PlatformLayoutInner>
    </LinkDetailNavProvider>
  );
}
