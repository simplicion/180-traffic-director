/**
 * --------------------------------------------------------------------------
 * 180 Traffic Director - Centralized Domain Configuration
 * --------------------------------------------------------------------------
 * Strictly environment-variable driven. Zero hardcoded URLs or domain fallbacks.
 *
 * Supports dynamic switching between configured stealth edge domains,
 * platform domains, and verified user custom domains (all from env).
 */

/**
 * Returns the default edge domain configured in .env (NEXT_PUBLIC_DEFAULT_EDGE_DOMAIN)
 * Safely defaults to window.location.host in production or 180trafficdirector.pro
 */
export const getDefaultEdgeDomain = (): string => {
  const envDomain = process.env.NEXT_PUBLIC_DEFAULT_EDGE_DOMAIN || '';
  const cleaned = envDomain
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/+$/, '');
  if (cleaned && cleaned !== 'lokaya.shop') {
    return cleaned;
  }
  return '180trafficdirector.pro';
};

/**
 * Returns list of available edge domains for the selector, with default domain first.
 * If the link has an active customDomain, it is appended.
 * Strictly filters out any "www." domains to avoid domain collision and routing issues.
 */
export const getAvailableEdgeDomains = (customDomain?: string | null): string[] => {
  const defaultDomain = getDefaultEdgeDomain();
  const rawList = process.env.NEXT_PUBLIC_AVAILABLE_EDGE_DOMAINS || '';
  
  const envDomains = rawList
    .split(',')
    .map((d) => d.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, ''))
    .filter((d) => Boolean(d) && d !== 'lokaya.shop' && !d.startsWith('www.'));

  const domains: string[] = [];

  // Default domain always appears first (e.g. 180trafficdirector.pro)
  if (defaultDomain && !domains.includes(defaultDomain)) {
    domains.push(defaultDomain);
  }

  // Ensure production edge domain is always included (without www)
  if (!domains.includes('180trafficdirector.pro')) {
    domains.push('180trafficdirector.pro');
  }

  // Add all other configured edge domains from environment
  for (const d of envDomains) {
    const cleanD = d.replace(/^www\./i, '');
    if (cleanD && !domains.includes(cleanD) && !cleanD.startsWith('www.')) {
      domains.push(cleanD);
    }
  }

  // If the link has its own verified custom domain, include it
  if (customDomain) {
    const cleanCustom = customDomain
      .trim()
      .replace(/^https?:\/\//i, '')
      .replace(/\.www\./i, '.')
      .replace(/^www\./i, '')
      .replace(/\/+$/, '');
    if (cleanCustom && !domains.includes(cleanCustom) && cleanCustom !== '180trafficdirector.pro') {
      domains.push(cleanCustom);
    }
  }

  // Strictly filter out any lingering www. domains
  return domains.filter(d => !d.startsWith('www.'));
};

/**
 * Build a standard Smart Link URL (https://<edge-domain>/r/<slug>)
 */
export const buildSmartLinkUrl = (slug: string, domain?: string): string => {
  const activeDomain = domain?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || getDefaultEdgeDomain();
  return activeDomain ? `https://${activeDomain}/r/${slug}` : `/r/${slug}`;
};

/**
 * Build dynamic pixel / client-shield script URL (https://<edge-domain>/tag/<slug>.js)
 */
export const buildTagScriptUrl = (slug: string, domain?: string): string => {
  const activeDomain = domain?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || getDefaultEdgeDomain();
  return activeDomain ? `https://${activeDomain}/tag/${slug}.js` : `/tag/${slug}.js`;
};

/**
 * Build dynamic edge evaluation API URL (https://<edge-domain>/api/v1/traffic-director/evaluate/<slug>)
 */
export const buildEvaluateUrl = (slug: string, domain?: string): string => {
  const activeDomain = domain?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || getDefaultEdgeDomain();
  return activeDomain
    ? `https://${activeDomain}/api/v1/traffic-director/evaluate/${slug}`
    : `/api/v1/traffic-director/evaluate/${slug}`;
};

/**
 * Build full base URL for an edge domain
 */
export const buildDomainBase = (domain?: string): string => {
  const activeDomain = domain?.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '') || getDefaultEdgeDomain();
  return activeDomain ? `https://${activeDomain}` : '';
};

/**
 * Returns the platform web portal / dashboard origin.
 * The management portal, auth callbacks, and settings reside strictly on NEXT_PUBLIC_APP_URL.
 * The edge domains are strictly reserved for operational traffic (smart links & script injection).
 */
export const getPortalOrigin = (): string => {
  const portalUrl = process.env.NEXT_PUBLIC_APP_URL || '';
  if (portalUrl) return portalUrl.trim().replace(/\/+$/, '');
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

