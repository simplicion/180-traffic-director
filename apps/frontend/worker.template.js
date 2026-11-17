/**
 * Cloudflare Pages Advanced Mode Worker (_worker.js)
 *
 * Cloudflare Pages `_redirects` only supports same-origin 200 rewrites and
 * ignores external 200 proxy rules. This worker transparently proxies public
 * edge routing & API endpoints (/r/*, /tag/*, /evaluate/*, /pixel/*, /shield/*,
 * /stream-proxy, /asset-proxy, /api/v1/traffic-director/*, /oauth/*, /health)
 * to the dedicated Traffic Director Express backend while preserving the
 * visitor's real IP/geo/ASN telemetry and HTTP 301/302/307 redirect responses.
 *
 * Generated automatically from worker.template.js during static export build.
 */

const API_ORIGIN = '__API_URL__';

const PROXY_PREFIXES = [
  '/r/',
  '/tag/',
  '/evaluate/',
  '/pixel/',
  '/shield/',
  '/stream-proxy/',
  '/asset-proxy/',
  '/api/v1/traffic-director/',
  '/api/v1/advertising/',
  '/api/v1/domains/',
  '/api/v1/ai/',
  '/api/v1/workspace-tools/',
  '/api/forms/',
  '/api/websites/',
  '/api/public/',
  '/api/files/',
  '/uploads/',
  '/oauth/',
];

const PROXY_EXACT_PATHS = new Set([
  '/r',
  '/stream-proxy',
  '/asset-proxy',
  '/api/forms',
  '/api/websites',
  '/api/users',
  '/api/v1/domains',
  '/health',
]);

function shouldProxy(pathname) {
  if (PROXY_EXACT_PATHS.has(pathname)) return true;
  return PROXY_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. Reverse proxy public edge routing & backend APIs to Express backend
    if (shouldProxy(pathname)) {
      const targetUrl = new URL(pathname + url.search, API_ORIGIN);
      const headers = new Headers(request.headers);

      // Let fetch compute upstream Host/SNI while preserving original host/proto
      headers.delete('host');
      headers.set('x-forwarded-host', url.host);
      headers.set('x-forwarded-proto', url.protocol.replace(':', ''));

      // Forward real visitor telemetry so upstream Cloudflare edge hops do not mask it
      const visitorIp =
        request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-real-ip') ||
        '';
      if (visitorIp) {
        headers.set('x-td-visitor-ip', visitorIp);
        headers.set('x-real-ip', visitorIp);
        const existingXff = request.headers.get('x-forwarded-for');
        headers.set(
          'x-forwarded-for',
          existingXff ? `${existingXff}, ${visitorIp}` : visitorIp
        );
      }

      const cf = request.cf || {};
      if (cf.country) headers.set('x-td-visitor-country', String(cf.country));
      if (cf.city) headers.set('x-td-visitor-city', String(cf.city));
      if (cf.postalCode) headers.set('x-td-visitor-postal', String(cf.postalCode));
      if (cf.region) headers.set('x-td-visitor-region', String(cf.region));
      if (cf.timezone) headers.set('x-td-visitor-timezone', String(cf.timezone));
      if (cf.asn) headers.set('x-td-visitor-asn', String(cf.asn));
      if (cf.asOrganization) {
        headers.set('x-td-visitor-as-org', String(cf.asOrganization));
      }

      const method = request.method.toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';

      const upstreamRes = await fetch(targetUrl.toString(), {
        method: request.method,
        headers,
        body: hasBody ? request.body : undefined,
        redirect: 'manual',
      });

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: upstreamRes.headers,
      });
    }

    // 2. SPA rewrites for dynamic routes (Smart Links, 180 Forms, Website Builder, Public Forms & Sites)
    const rewriteAsset = (targetPath) => {
      const rewriteUrl = new URL(url.toString());
      rewriteUrl.pathname = targetPath;
      return env.ASSETS.fetch(new Request(rewriteUrl.toString(), request));
    };

    if (
      pathname.startsWith('/traffic-director/links/') &&
      pathname !== '/traffic-director/links/' &&
      !pathname.startsWith('/traffic-director/links/default')
    ) {
      return rewriteAsset(
        pathname.endsWith('.txt')
          ? '/traffic-director/links/default.txt'
          : '/traffic-director/links/default'
      );
    }

    if (
      pathname.startsWith('/forms/') &&
      pathname !== '/forms/' &&
      !pathname.startsWith('/forms/default')
    ) {
      return rewriteAsset(
        pathname.endsWith('.txt') ? '/forms/default.txt' : '/forms/default'
      );
    }

    if (/^\/advertising\/[^\/]+\/edit(\.txt)?\/?$/.test(pathname) && !pathname.startsWith('/advertising/default/edit')) {
      return rewriteAsset(
        pathname.endsWith('.txt')
          ? '/advertising/default/edit.txt'
          : '/advertising/default/edit'
      );
    }

    if (
      pathname.startsWith('/advertising/') &&
      pathname !== '/advertising/' &&
      !pathname.startsWith('/advertising/default')
    ) {
      return rewriteAsset(
        pathname.endsWith('.txt') ? '/advertising/default.txt' : '/advertising/default'
      );
    }

    if (
      pathname.startsWith('/f/') &&
      pathname !== '/f/' &&
      !pathname.startsWith('/f/default')
    ) {
      return rewriteAsset(
        pathname.endsWith('.txt') ? '/f/default.txt' : '/f/default'
      );
    }

    if (
      pathname.startsWith('/sites/') &&
      pathname !== '/sites/' &&
      !pathname.startsWith('/sites/default')
    ) {
      return rewriteAsset(
        pathname.endsWith('.txt') ? '/sites/default.txt' : '/sites/default'
      );
    }

    // 3. Fallback to Cloudflare Pages static assets
    return env.ASSETS.fetch(request);
  },
};
