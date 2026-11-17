'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { LogoLoader } from '@workspace/ui';
import { getApiBase } from '@/lib/api';
import {
  ResponsiveStyles,
  SITE_ROOT_CLASS,
  SITE_CONTAINER_NAME,
  BREAKPOINT_MAX,
} from '@/app/(platform)/(advertising-app)/advertising/[id]/edit/responsive-styles';
import { migrateLegacySection } from '@/app/(platform)/(advertising-app)/advertising/[id]/edit/ElementFactory';
import { ScriptInjector } from './_components/ScriptInjector';
import { FacebookPixel } from './_components/FacebookPixel';
import { SiteElement } from './_components/SiteElement';
import { SiteMobileNav, type SiteNavLink } from './_components/SiteMobileNav';

export default function PublicSiteClient() {
  const params = useParams();
  const [website, setWebsite] = useState<any>(null);
  const [pixels, setPixels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resolvedSlug, setResolvedSlug] = useState('/');
  const [resolvedDomain, setResolvedDomain] = useState('');

  useEffect(() => {
    let domain = typeof params?.domain === 'string' ? decodeURIComponent(params.domain) : '';
    let slugParts: string[] = Array.isArray(params?.slug)
      ? params.slug
      : typeof params?.slug === 'string'
      ? [params.slug]
      : [];

    if ((!domain || domain === 'default') && typeof window !== 'undefined') {
      const m = window.location.pathname.match(/^\/sites\/([^\/]+)(?:\/(.*))?$/);
      if (m && m[1] && m[1] !== 'default') {
        domain = decodeURIComponent(m[1]);
        slugParts = m[2] ? m[2].split('/').filter(Boolean) : [];
      }
    }

    const currentSlug = slugParts.length > 0 ? `/${slugParts.join('/')}` : '/';
    setResolvedDomain(domain);
    setResolvedSlug(currentSlug);

    if (!domain || domain === 'default') {
      setError('Website domain not specified.');
      setLoading(false);
      return;
    }

    const fetchSite = async () => {
      try {
        const apiBase = getApiBase();
        const query = new URLSearchParams({ domain });
        if (slugParts.length > 0) query.set('slug', slugParts.join('/'));
        const res = await fetch(`${apiBase}/api/public/domains/resolve?${query.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Page not found or inactive.');
        const data = await res.json();
        if (data?.type === 'ADVERTISING_WEBSITE' && data?.payload) {
          setWebsite(data.payload.website || data.payload);
          setPixels(data.payload.pixels || data.pixels || []);
        } else if (data?.website) {
          setWebsite(data.website);
          setPixels(data.pixels || []);
        } else {
          setError('Page not found or inactive.');
        }
      } catch (err: any) {
        setError(err?.message || 'Page not found or inactive.');
      } finally {
        setLoading(false);
      }
    };

    fetchSite();
  }, [params?.domain, params?.slug]);

  useEffect(() => {
    if (website?.name) {
      document.title = website?.config?.seo?.metaTitle || website.name;
    }
  }, [website]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LogoLoader size={40} className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const config = website?.config || {};
  let currentPage: any;
  if (config.version !== 2 && !Array.isArray(config.pages)) {
    if (resolvedSlug === '/') {
      currentPage = { isPublished: true, isEnabled: true, sections: config.sections || [] };
    }
  } else {
    currentPage = config.pages?.find((p: any) => p.slug === resolvedSlug) || config.pages?.[0];
  }

  if (currentPage && Array.isArray(currentPage.sections)) {
    currentPage = {
      ...currentPage,
      sections: currentPage.sections.filter(Boolean).map((s: any) => migrateLegacySection(s, '$')),
    };
  }

  const isPagePublished = currentPage
    ? currentPage.isPublished !== false && currentPage.isEnabled !== false
    : false;

  if (error || !website || !currentPage || !isPagePublished) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
          <ShieldCheck className="w-10 h-10 text-gray-300" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Website Unavailable</h1>
        <p className="text-gray-500 max-w-md">
          {error || 'The page you are looking for does not exist or has been moved.'}
        </p>
      </div>
    );
  }

  const colors = config.colors || { primary: '#4f46e5', secondary: '#ffffff', accent: '#10b981' };
  const primaryColor = colors.primary;
  const brand = config.brand || {
    primaryColor: colors.primary || '#4f46e5',
    secondaryColor: colors.secondary || '#ffffff',
    textColor: '#111827',
    headingFont: 'Inter',
    bodyFont: 'Inter',
    bgType: 'color',
    bgValue: '#ffffff',
  };

  const getHeaderFooterStyles = (b: any) => {
    const theme = b.headerFooterTheme || 'light';
    const customTextColor = b.headerFooterTextColor;
    let styles: any;
    if (theme === 'dark') {
      styles = { backgroundColor: '#111827', color: customTextColor || '#ffffff' };
    } else if (theme === 'brand') {
      styles = { backgroundColor: b.primaryColor || '#4f46e5', color: customTextColor || '#ffffff' };
    } else {
      styles = { backgroundColor: 'rgba(255, 255, 255, 0.8)', color: customTextColor || 'inherit' };
    }
    if (b.fontFamily) styles.fontFamily = `"${b.fontFamily}", sans-serif`;
    return styles;
  };
  const hfStyles = getHeaderFooterStyles(brand);

  const pageSections: any[] = Array.isArray(currentPage?.sections)
    ? currentPage.sections.filter((s: any) => s && typeof s === 'object')
    : [];
  const hasDynamicSections = pageSections.length > 0;
  const bodyFont = config.typography?.body || brand?.fontFamily || 'Inter';
  const hasBgImage =
    (currentPage?.bgType === 'image' && !!currentPage?.bgValue) ||
    (brand?.bgType === 'image' && !!brand?.bgValue);
  const navPages = (config.pages || []).filter(
    (p: any) =>
      p.isPublished !== false &&
      p.isEnabled !== false &&
      (!p.navVisibility || p.navVisibility === 'both' || p.navVisibility === 'header')
  );
  const basePath = resolvedDomain ? `/sites/${encodeURIComponent(resolvedDomain)}` : '';
  const navLinks: SiteNavLink[] = navPages.map((p: any) => ({
    id: String(p.id ?? p.slug),
    name: String(p.name ?? ''),
    href: p.slug === '/' ? basePath || '/' : `${basePath}${p.slug}`,
    active: resolvedSlug === p.slug,
  }));

  return (
    <div
      className={`${SITE_ROOT_CLASS} ${hasBgImage ? 'site-bg-fixed' : ''} min-h-screen w-full max-w-full overflow-x-clip font-sans text-gray-900 selection:bg-indigo-100`}
      style={
        {
          fontFamily: `"${bodyFont}", sans-serif`,
          color: brand?.textColor || '#111827',
          backgroundColor:
            currentPage?.bgType === 'image'
              ? 'transparent'
              : currentPage?.bgValue || brand?.bgValue || '#ffffff',
          backgroundImage:
            currentPage?.bgType === 'image' && currentPage?.bgValue
              ? `url(${currentPage.bgValue})`
              : brand?.bgType === 'image' && brand?.bgValue
              ? `url(${brand.bgValue})`
              : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          '--primary': primaryColor,
          '--heading-font': config.typography?.heading || 'Inter',
        } as any
      }
    >
      <div className="w-full max-w-full min-h-screen flex flex-col bg-transparent relative overflow-x-clip">
        <style
          dangerouslySetInnerHTML={{
            __html:
              `.site-nav-toggle{display:none}` +
              `@container ${SITE_CONTAINER_NAME} (max-width: ${BREAKPOINT_MAX.mobile}px){.site-nav-desktop{display:none}.site-nav-toggle{display:inline-flex}}` +
              `.site-bg-fixed{background-attachment:fixed}` +
              `@media (max-width: ${BREAKPOINT_MAX.tablet}px), (hover: none), (pointer: coarse){.site-bg-fixed{background-attachment:scroll}}`,
          }}
        />
        <ResponsiveStyles nodes={pageSections} brand={brand} includeRoot={true} />
        {pixels && pixels.length > 0 && <FacebookPixel pixels={pixels} />}
        {brand.headScript && <ScriptInjector html={brand.headScript} position="head" />}

        {config.header?.enabled !== false && currentPage?.showHeader !== false && (
          <header
            className={`flex flex-row items-center justify-between gap-4 group border-b border-black/5 ${
              config.header?.style?.isSticky !== false ? 'sticky top-0 z-40' : 'relative'
            } transition-all`}
            style={{
              backgroundColor: config.header?.style?.backgroundColor || hfStyles.backgroundColor,
              color: config.header?.style?.color || hfStyles.color,
              backdropFilter: 'blur(12px)',
              paddingTop:
                config.header?.style?.paddingTop ||
                (config.header?.style?.paddingY !== undefined
                  ? `${config.header.style.paddingY}rem`
                  : '1.5rem'),
              paddingBottom:
                config.header?.style?.paddingBottom ||
                (config.header?.style?.paddingY !== undefined
                  ? `${config.header.style.paddingY}rem`
                  : '1.5rem'),
              paddingLeft:
                config.header?.style?.paddingLeft ||
                (config.header?.style?.paddingX !== undefined
                  ? `${config.header.style.paddingX}rem`
                  : '1.5rem'),
              paddingRight:
                config.header?.style?.paddingRight ||
                (config.header?.style?.paddingX !== undefined
                  ? `${config.header.style.paddingX}rem`
                  : '1.5rem'),
            }}
          >
            <a href={basePath || '/'} className="flex items-center gap-3 min-w-0">
              {config.header?.logo && (
                <img
                  src={config.header.logo}
                  alt={config.header?.title || website.name}
                  style={{
                    height: config.header?.style?.logoHeight
                      ? `${config.header.style.logoHeight}px`
                      : '40px',
                  }}
                  className="w-auto object-contain"
                />
              )}
              <span
                className="text-xl font-black tracking-tight text-current truncate"
                style={{ color: 'inherit' }}
              >
                {brand?.companyName || config.header?.title || website?.name || 'Website Name'}
              </span>
            </a>

            {navLinks.length > 0 && (
              <nav
                aria-label="Main"
                className="site-nav-desktop flex flex-wrap justify-end items-center gap-6 text-sm font-bold opacity-80"
              >
                {navLinks.map((l) => (
                  <a
                    key={l.id}
                    href={l.href}
                    aria-current={l.active ? 'page' : undefined}
                    className={`hover:opacity-100 transition-opacity py-1 ${
                      l.active ? 'border-b-2 border-current' : ''
                    }`}
                    style={{ color: 'inherit' }}
                  >
                    {l.name}
                  </a>
                ))}
              </nav>
            )}
            <SiteMobileNav
              links={navLinks}
              backgroundColor={config.header?.style?.backgroundColor || hfStyles.backgroundColor}
              color={config.header?.style?.color || hfStyles.color}
            />
          </header>
        )}

        {hasDynamicSections ? (
          <main className="flex-1 w-full max-w-full min-h-[50vh] flex flex-col overflow-x-clip">
            {pageSections
              .filter((s: any) => s.type !== 'floating')
              .map((sec: any, i: number) => (
                <SiteElement key={sec.id ?? i} node={sec} brand={brand} />
              ))}
          </main>
        ) : (
          <div className="min-h-[50vh] flex items-center justify-center">
            <p className="text-gray-500">This page has no content yet.</p>
          </div>
        )}

        {config.footer?.enabled !== false && currentPage?.showFooter !== false && (
          <footer
            className="border-t border-black/10 transition-all"
            style={{
              backgroundColor: config.footer?.style?.backgroundColor || hfStyles.backgroundColor,
              color: config.footer?.style?.color || hfStyles.color,
              backdropFilter: 'blur(12px)',
              paddingTop:
                config.footer?.style?.paddingTop ||
                (config.footer?.style?.paddingY !== undefined
                  ? `${config.footer.style.paddingY}rem`
                  : '3rem'),
              paddingBottom:
                config.footer?.style?.paddingBottom ||
                (config.footer?.style?.paddingY !== undefined
                  ? `${config.footer.style.paddingY}rem`
                  : '3rem'),
              paddingLeft:
                config.footer?.style?.paddingLeft ||
                (config.footer?.style?.paddingX !== undefined
                  ? `${config.footer.style.paddingX}rem`
                  : '1.5rem'),
              paddingRight:
                config.footer?.style?.paddingRight ||
                (config.footer?.style?.paddingX !== undefined
                  ? `${config.footer.style.paddingX}rem`
                  : '1.5rem'),
            }}
          >
            <div className="text-center pt-4 flex flex-col items-center justify-center w-full">
              <div className="text-sm opacity-60 font-medium text-current text-center">
                {config.footer?.copyright ||
                  `© ${new Date().getFullYear()} ${
                    brand?.companyName || config.header?.title || website.name
                  }. All Rights Reserved.`}
              </div>
            </div>
          </footer>
        )}

        {pageSections
          .filter((s: any) => s.type === 'floating')
          .map((sec: any, i: number) => (
            <SiteElement key={sec.id ?? i} node={sec} brand={brand} />
          ))}

        {brand.bodyScript && <ScriptInjector html={brand.bodyScript} position="body" />}
      </div>
    </div>
  );
}
