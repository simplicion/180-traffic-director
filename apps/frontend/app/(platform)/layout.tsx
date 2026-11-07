'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { getAuthToken, clearAuthTokens } from '@/lib/api';
import { TrafficDirectorTopNav } from '@/components/layout/TrafficDirectorTopNav';
import { LinkDetailNavProvider, useLinkDetailNav } from '@/context/LinkDetailNavContext';

function PlatformLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-black text-gray-900 dark:text-zinc-100 transition-colors duration-200">
      {/* 180 Traffic Director Unified Top Navigation Bar */}
      <TrafficDirectorTopNav />

      {/* Main Full-Width Content View */}
      <main className="flex-1 w-full flex flex-col min-w-0 transition-all duration-300 ease-in-out">
        {/* Page Body - Expands gracefully for link detail page */}
        <div className={`p-4 sm:p-6 md:p-8 w-full ${isLinkDetail ? 'max-w-[1680px]' : 'max-w-7xl'} mx-auto transition-all duration-300`}>
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
