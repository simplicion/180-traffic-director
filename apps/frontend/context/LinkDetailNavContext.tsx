'use client';

import React, { createContext, useContext, useState, useMemo, useEffect, Suspense } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

export interface LinkMetadata {
  id: string;
  name: string;
  slug: string;
  rulesCount: number;
  totalClicks: number;
  isActive: boolean;
  shieldMode: 'server' | 'client_shield';
  customDomain?: string | null;
}

interface LinkDetailNavContextValue {
  isLinkDetail: boolean;
  linkId: string | null;
  activeTab: 'rules' | 'pixel' | 'analytics';
  setActiveTab: (tab: 'rules' | 'pixel' | 'analytics') => void;
  metadata: LinkMetadata | null;
  setMetadata: React.Dispatch<React.SetStateAction<LinkMetadata | null>>;
  updateMetadata: (partial: Partial<LinkMetadata>) => void;
}

const LinkDetailNavContext = createContext<LinkDetailNavContextValue>({
  isLinkDetail: false,
  linkId: null,
  activeTab: 'rules',
  setActiveTab: () => {},
  metadata: null,
  setMetadata: () => {},
  updateMetadata: () => {},
});

function LinkDetailNavInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Detect if current path is a link detail page: /traffic-director/links/[linkId]
  const linkMatch = pathname ? pathname.match(/^\/traffic-director\/links\/([^\/\?#]+)$/) : null;
  const rawLinkId = linkMatch ? linkMatch[1] : null;
  const isLinkDetail = Boolean(rawLinkId && rawLinkId !== 'default' && rawLinkId !== 'new');
  const linkId = isLinkDetail ? rawLinkId : null;

  // Sync tab with URL search param '?tab=...' for bookmarkability & instant updates
  const urlTab = (searchParams?.get('tab') as 'rules' | 'pixel' | 'analytics') || 'rules';
  const [activeTabState, setActiveTabState] = useState<'rules' | 'pixel' | 'analytics'>(urlTab);

  useEffect(() => {
    if (urlTab && (urlTab === 'rules' || urlTab === 'pixel' || urlTab === 'analytics')) {
      setActiveTabState(urlTab);
    }
  }, [urlTab]);

  const setActiveTab = (tab: 'rules' | 'pixel' | 'analytics') => {
    setActiveTabState(tab);
    if (linkId && pathname) {
      const params = new URLSearchParams(searchParams?.toString() || '');
      params.set('tab', tab);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  };

  const [metadata, setMetadata] = useState<LinkMetadata | null>(null);

  const updateMetadata = (partial: Partial<LinkMetadata>) => {
    setMetadata(prev => prev ? { ...prev, ...partial } : null);
  };

  // Clear metadata if navigating away from link detail
  useEffect(() => {
    if (!isLinkDetail) {
      setMetadata(null);
    }
  }, [isLinkDetail]);

  const value = useMemo(() => ({
    isLinkDetail,
    linkId,
    activeTab: activeTabState,
    setActiveTab,
    metadata,
    setMetadata,
    updateMetadata,
  }), [isLinkDetail, linkId, activeTabState, metadata]);

  return (
    <LinkDetailNavContext.Provider value={value}>
      {children}
    </LinkDetailNavContext.Provider>
  );
}

export function LinkDetailNavProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<>{children}</>}>
      <LinkDetailNavInner>{children}</LinkDetailNavInner>
    </Suspense>
  );
}

export function useLinkDetailNav() {
  return useContext(LinkDetailNavContext);
}
