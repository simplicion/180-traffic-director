import JavaScriptObfuscator from 'javascript-obfuscator';

/**
 * Client-Side Shield Probe & Dynamic Ad Tag Generator
 * 
 * Delivers lightweight (< 2.5KB) zero-dependency browser telemetry probes
 * that unmask emulated headless cloud scrapers before DOM rendering.
 */

export interface ShieldConfig {
  slug: string;
  linkName?: string;
  targetUrl: string;
  fallbackUrl: string;
  datacenterBlocked?: boolean;
  timeoutMs?: number;
}

export interface EmbedTagConfig {
  slug: string;
  targetUrl: string;
  fallbackUrl: string;
  creativeUrl?: string;
  fallbackCreativeUrl?: string;
  width?: number;
  height?: number;
}

export class ClientShieldGenerator {
  /**
   * Generates a stealth client-side hardware probe page
   */
  static generateShieldHtml(config: ShieldConfig): string {
    const { targetUrl, fallbackUrl, timeoutMs = 800 } = config;
    const safeTarget = JSON.stringify(targetUrl);
    const safeFallback = JSON.stringify(fallbackUrl);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
  <title>Verifying Connection...</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      width: 100vw;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #94a3b8;
      overflow: hidden;
    }
    .shield-container {
      text-align: center;
      padding: 24px;
    }
    .spinner {
      width: 38px;
      height: 38px;
      border: 3px solid rgba(147, 51, 234, 0.15);
      border-top-color: #a855f7;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto 16px auto;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .label {
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.02em;
    }
  </style>
</head>
<body>
  <div class="shield-container">
    <div class="spinner"></div>
    <div class="label">Securing verification...</div>
  </div>
  <script>
    (function() {
      var target = ${safeTarget};
      var fallback = ${safeFallback};
      var resolved = false;

      function redirect(url) {
        if (resolved) return;
        resolved = true;
        try {
          window.location.replace(url);
        } catch(e) {
          window.location.href = url;
        }
      }

      // Hard fallback timer
      setTimeout(function() {
        redirect(fallback);
      }, ${timeoutMs});

      try {
        var ua = (navigator.userAgent || '').toLowerCase();
        var isMobileUa = /iphone|ipad|ipod|android|mobile/.test(ua);
        var touchPoints = navigator.maxTouchPoints || 0;
        var hasTouch = ('ontouchstart' in window) || (touchPoints > 0);
        var isWebdriver = navigator.webdriver === true;

        // 1. Webdriver / Automation detection
        if (isWebdriver) {
          return redirect(fallback);
        }

        // 2. Mobile touch consistency check
        if (isMobileUa && !hasTouch && touchPoints === 0) {
          return redirect(fallback);
        }

        // 3. WebGL GPU Hardware check (Catches SwiftShader / CPU software rasterizers)
        var canvas = document.createElement('canvas');
        var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        var gpu = '';
        if (gl) {
          var dbg = gl.getExtension('WEBGL_debug_renderer_info');
          if (dbg) {
            gpu = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
            if (gpu.indexOf('swiftshader') !== -1 || 
                gpu.indexOf('llvmpipe') !== -1 || 
                gpu.indexOf('software rasterizer') !== -1 ||
                gpu.indexOf('virtualbox') !== -1 ||
                gpu.indexOf('vmware') !== -1) {
              return redirect(fallback);
            }
          }
        }

        // 4. Battery API check (Headless clouds often return static 100% charging)
        if (navigator.getBattery) {
          navigator.getBattery().then(function(battery) {
            if (isMobileUa && battery.charging === true && battery.level === 1.0 && screen.width > 1200) {
              return redirect(fallback);
            }
            redirect(target);
          }).catch(function() {
            redirect(target);
          });
        } else {
          redirect(target);
        }
      } catch(err) {
        redirect(fallback);
      }
    })();
  </script>
</body>
</html>`;
  }

  /**
   * Generates a stealth, zero-footprint JavaScript snippet for embedding in the <head>
   * of an advertiser's self-hosted safe page on their own domain.
   */
  static generateSelfHostedPixelJs(config: { slug: string; apiBaseUrl: string; targetUrl?: string; fallbackUrl?: string }): string {
    const { slug, apiBaseUrl } = config;
    const safeBaseUrl = JSON.stringify(apiBaseUrl.replace(/\/+$/, ''));
    const safeSlug = JSON.stringify(slug);

    const rawScript = `(function() {
  'use strict';
  try {
    var bUrl = ${safeBaseUrl};
    var s = ${safeSlug};
    var ua = (navigator.userAgent || '').toLowerCase();
    var isMobile = /iphone|ipad|ipod|android|mobile/.test(ua);
    var tp = navigator.maxTouchPoints || 0;
    var hasTouch = ('ontouchstart' in window) || (tp > 0);
    var isWd = navigator.webdriver === true || !!window.__nightmare || !!window._phantom || !!window.callPhantom;

    // If running inside a reverse-proxy sandbox or frame, don't double-evaluate
    if (window.self !== window.top) {
      return;
    }

    // Fast-path client heuristic check: Bot / Automation detected -> stay on safe page quietly
    if (isWd || (isMobile && !hasTouch && tp === 0)) {
      return;
    }

    // WebGL software renderer verification
    var gpu = '';
    try {
      var cv = document.createElement('canvas');
      var gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          gpu = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
          if (gpu.indexOf('swiftshader') !== -1 || gpu.indexOf('llvmpipe') !== -1 || gpu.indexOf('software rasterizer') !== -1) {
            return; // Bot / Cloud sandbox detected -> silent exit
          }
        }
      }
    } catch(e) {}

    // Edge evaluation ping
    var clientTz = '';
    try {
      if (typeof Intl !== 'undefined' && Intl.DateTimeFormat) {
        clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      }
    } catch(e) {}

    var payload = {
      touchPoints: tp,
      gpuRenderer: gpu,
      screenWidth: window.screen ? window.screen.width : 0,
      screenHeight: window.screen ? window.screen.height : 0,
      referrer: document.referrer || '',
      url: window.location.href,
      clientTimezone: clientTz,
      timezoneOffset: new Date().getTimezoneOffset()
    };

    fetch(bUrl + '/api/v1/traffic-director/evaluate/' + s, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data && data.success && data.destinationUrl) {
        var curUrl = window.location.href;
        var destUrl = data.destinationUrl;
        if (curUrl === destUrl || curUrl.indexOf(destUrl) === 0 || (destUrl.indexOf(window.location.pathname) !== -1 && window.location.pathname !== '/')) {
          return;
        }
        try {
          window.location.replace(data.destinationUrl);
        } catch(err) {
          window.location.href = data.destinationUrl;
        }
      }
    })
    .catch(function() {
      // On network failure or adblocker interception, gracefully remain on safe page
    });
  } catch(fatal) {}
})();`;

    // Aggressively obfuscate the script to bypass static scanners (Meta/Google bots)
    const obfuscated = JavaScriptObfuscator.obfuscate(rawScript, {
      compact: true,
      controlFlowFlattening: true,
      controlFlowFlatteningThreshold: 0.75,
      deadCodeInjection: true,
      deadCodeInjectionThreshold: 0.4,
      debugProtection: false, // Don't crash legit users' devtools
      disableConsoleOutput: true,
      identifierNamesGenerator: 'hexadecimal',
      log: false,
      numbersToExpressions: true,
      renameGlobals: false,
      selfDefending: false,
      simplify: true,
      splitStrings: true,
      splitStringsChunkLength: 5,
      stringArray: true,
      stringArrayCallsTransform: true,
      stringArrayCallsTransformThreshold: 0.75,
      stringArrayEncoding: ['base64', 'rc4'],
      stringArrayIndexShift: true,
      stringArrayRotate: true,
      stringArrayShuffle: true,
      stringArrayWrappersCount: 2,
      stringArrayWrappersChainedCalls: true,
      stringArrayWrappersParametersMaxCount: 4,
      stringArrayWrappersType: 'function',
      unicodeEscapeSequence: false
    });

    return obfuscated.getObfuscatedCode();
  }

  /**
   * Generates a drop-in WordPress PHP hook snippet for server-side evaluation
   */
  static generateWordPressPhpSnippet(config: { slug: string; apiBaseUrl: string }): string {
    const { slug, apiBaseUrl } = config;
    return `<?php
/**
 * 180workspace Traffic Director - Server-Side Safe Page Hook
 * Paste inside your active theme's functions.php or header.php
 */
add_action('template_redirect', function() {
    if (is_admin() || wp_doing_ajax() || wp_doing_cron()) {
        return;
    }

    $slug = '${slug}';
    $api_endpoint = '${apiBaseUrl.replace(/\/+$/, '')}/api/v1/traffic-director/evaluate/' . $slug;

    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] 
        ?? $_SERVER['HTTP_X_FORWARDED_FOR'] 
        ?? $_SERVER['REMOTE_ADDR'] 
        ?? '';
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $ref = $_SERVER['HTTP_REFERER'] ?? '';

    $response = wp_remote_post($api_endpoint, [
        'timeout'     => 1.2,
        'redirection' => 0,
        'httpversion' => '1.1',
        'blocking'    => true,
        'headers'     => ['Content-Type' => 'application/json'],
        'body'        => json_encode([
            'clientIp'    => $ip,
            'userAgent'   => $ua,
            'referrer'    => $ref,
            'queryParams' => $_GET
        ])
    ]);

    if (!is_wp_error($response)) {
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        if (!empty($data['route']) && $data['route'] === 'target' && !empty($data['destinationUrl'])) {
            wp_redirect($data['destinationUrl'], 302);
            exit;
        }
    }
});
?>`;
  }

  /**
   * Generates a drop-in standalone index.php gateway for Apache, Nginx, cPanel, or LiteSpeed servers
   */
  static generateStandalonePhpFile(config: { slug: string; apiBaseUrl: string }): string {
    const { slug, apiBaseUrl } = config;
    return `<?php
/**
 * ============================================================================
 * 180workspace Traffic Director - Standalone Edge Routing Gateway
 * ============================================================================
 * 
 * 📍 DEPLOYMENT INSTRUCTIONS:
 * 1. Upload this file as index.php to your web server (Apache, Nginx, cPanel, LiteSpeed).
 * 2. Place your compliant Safe Page HTML as safe.html or white_page.html in the same directory.
 *    (Alternatively, if your Safe Page is a remote URL, the gateway will transparently reverse-proxy it).
 * 
 * 🛡️ HOW IT WORKS:
 * - When an Ad Review bot (Meta Crawler, Google AdsBot, TikTok Bot) or Datacenter/Spy IP arrives:
 *   HTTP 200 OK is returned with the compliant Safe Page without changing the URL.
 * - When a real human visitor arrives:
 *   They are routed to your Offer/Target Page (via 302 Redirect or transparent Reverse-Proxy).
 * 
 * 🔒 ZERO FOOTPRINT:
 * 100% Server-side evaluation. View-source displays pure clean HTML. No JavaScript trackers.
 */

// Configuration
$config = [
    'slug'         => '${slug}',
    'api_endpoint' => '${apiBaseUrl.replace(/\/+$/, '')}/api/v1/traffic-director/evaluate/${slug}',
    'timeout_sec'  => 1.5,
    'local_safe'   => __DIR__ . '/safe.html',     // Local safe page fallback if present
    'white_page'   => __DIR__ . '/white_page.html' // Alternate local safe page
];

// 1. Resolve Real Visitor IP (Handles Cloudflare, Reverse Proxies & Load Balancers)
function get_client_ip() {
    $headers = [
        'HTTP_CF_CONNECTING_IP',
        'HTTP_TRUE_CLIENT_IP',
        'HTTP_X_REAL_IP',
        'HTTP_X_FORWARDED_FOR',
        'REMOTE_ADDR'
    ];
    foreach ($headers as $h) {
        if (!empty($_SERVER[$h])) {
            $ip_list = explode(',', $_SERVER[$h]);
            $ip = trim($ip_list[0]);
            if (filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
}

// 2. Fallback Safe Page Handler
function serve_safe_page($config, $fallback_url = '') {
    if (file_exists($config['local_safe'])) {
        include $config['local_safe'];
        exit;
    }
    if (file_exists($config['white_page'])) {
        include $config['white_page'];
        exit;
    }
    if (!empty($fallback_url)) {
        if (function_exists('curl_init')) {
            $ch = curl_init($fallback_url);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0');
            $html = curl_exec($ch);
            $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($http_code === 200 && $html) {
                http_response_code(200);
                echo $html;
                exit;
            }
        }
        header("Location: " . $fallback_url, true, 302);
        exit;
    }
    http_response_code(200);
    echo '<!DOCTYPE html><html><head><title>Welcome</title></head><body><h1>Welcome to our site</h1></body></html>';
    exit;
}

// 3. Assemble Evaluation Payload
$current_url = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http') 
    . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . ($_SERVER['REQUEST_URI'] ?? '');

$payload = [
    'ip'          => get_client_ip(),
    'userAgent'   => $_SERVER['HTTP_USER_AGENT'] ?? '',
    'referrer'    => $_SERVER['HTTP_REFERER'] ?? '',
    'url'         => $current_url,
    'language'    => $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '',
    'headers'     => [
        'sec-ch-ua'          => $_SERVER['HTTP_SEC_CH_UA'] ?? '',
        'sec-ch-ua-mobile'   => $_SERVER['HTTP_SEC_CH_UA_MOBILE'] ?? '',
        'sec-ch-ua-platform' => $_SERVER['HTTP_SEC_CH_UA_PLATFORM'] ?? '',
        'sec-fetch-site'     => $_SERVER['HTTP_SEC_FETCH_SITE'] ?? '',
        'sec-fetch-mode'     => $_SERVER['HTTP_SEC_FETCH_MODE'] ?? '',
        'sec-fetch-dest'     => $_SERVER['HTTP_SEC_FETCH_DEST'] ?? '',
    ],
    'queryParams' => $_GET
];

// 4. Query 180workspace Traffic Director Decision Engine
if (!function_exists('curl_init')) {
    serve_safe_page($config);
}

$ch = curl_init($config['api_endpoint']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_TIMEOUT, $config['timeout_sec']);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
curl_setopt($ch, CURLOPT_USERAGENT, '180workspace-PHP-Gateway/2.0');

$response = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($http_code === 200 && $response) {
    $data = json_decode($response, true);
    if (!empty($data['success']) && !empty($data['route']) && $data['route'] === 'target' && !empty($data['destinationUrl'])) {
        $dest = $data['destinationUrl'];
        $action = $data['actionType'] ?? 'redirect_302';

        // Transparent Reverse-Proxy Mode (Loads offer without changing browser URL)
        if ($action === 'proxy_target_offer') {
            $ch = curl_init($dest);
            curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
            curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
            curl_setopt($ch, CURLOPT_USERAGENT, $_SERVER['HTTP_USER_AGENT'] ?? 'Mozilla/5.0');
            $body = curl_exec($ch);
            curl_close($ch);
            http_response_code(200);
            echo $body;
            exit;
        }

        // Standard 302 Redirect
        if ($current_url !== $dest && strpos($current_url, $dest) !== 0) {
            header("Location: " . $dest, true, 302);
            exit;
        }
    }
    // Evaluated as bot, moderator, or fallback -> Serve clean safe page
    serve_safe_page($config, $data['destinationUrl'] ?? '');
}

// Fail-open default: serve safe page
serve_safe_page($config);
?>`;
  }

  /**
   * Generates a drop-in Vercel / Next.js / Edge JavaScript middleware snippet
   */
  static generateEdgeMiddlewareSnippet(config: { slug: string; apiBaseUrl: string }): string {
    const { slug, apiBaseUrl } = config;
    return `/**
 * 180workspace Traffic Director - Server-Side Edge Middleware
 * Place in middleware.js (or middleware.ts) at the root of your Vercel / Next.js / Node app
 */
export const config = {
  matcher: ['/((?!assets|_next|favicon.ico|.*\\\\..*).*)'],
};

export default async function middleware(request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '';
  const ua = request.headers.get('user-agent') || '';
  const ref = request.headers.get('referer') || '';
  const url = request.url;

  try {
    const res = await fetch('${apiBaseUrl.replace(/\/+$/, '')}/api/v1/traffic-director/evaluate/${slug}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, userAgent: ua, referrer: ref, url }),
      signal: AbortSignal.timeout(1200)
    });

    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.route === 'target' && data?.destinationUrl) {
        if (url !== data.destinationUrl) {
          return Response.redirect(data.destinationUrl, 302);
        }
      }
    }
  } catch (err) {
    // Fail silently: serve the normal safe page on timeout or error
  }
}`;
  }

  /**
   * Generates a pre-click embeddable dynamic ad script
   */
  static generateEmbedTagJs(config: EmbedTagConfig): string {
    const { 
      targetUrl, 
      fallbackUrl, 
      creativeUrl = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&auto=format&fit=crop&q=80', 
      fallbackCreativeUrl = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
      width = 300, 
      height = 250 
    } = config;

    return `(function() {
  var targetUrl = ${JSON.stringify(targetUrl)};
  var fallbackUrl = ${JSON.stringify(fallbackUrl)};
  var creativeUrl = ${JSON.stringify(creativeUrl)};
  var fallbackCreativeUrl = ${JSON.stringify(fallbackCreativeUrl)};
  var width = ${width};
  var height = ${height};

  var ua = (navigator.userAgent || '').toLowerCase();
  var isMobileUa = /iphone|ipad|ipod|android|mobile/.test(ua);
  var touchPoints = navigator.maxTouchPoints || 0;
  var hasTouch = ('ontouchstart' in window) || (touchPoints > 0);
  var isWebdriver = navigator.webdriver === true;

  var isHuman = !isWebdriver;
  if (isMobileUa && !hasTouch) isHuman = false;

  var dest = isHuman ? targetUrl : fallbackUrl;
  var creative = isHuman ? creativeUrl : fallbackCreativeUrl;

  var container = document.currentScript ? document.currentScript.parentNode : document.body;
  var wrapper = document.createElement('div');
  wrapper.style.width = width + 'px';
  wrapper.style.height = height + 'px';
  wrapper.style.overflow = 'hidden';
  wrapper.style.display = 'inline-block';
  wrapper.style.position = 'relative';

  var link = document.createElement('a');
  link.href = dest;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'block';
  link.style.width = '100%';
  link.style.height = '100%';

  var img = document.createElement('img');
  img.src = creative;
  img.style.width = '100%';
  img.style.height = '100%';
  img.style.objectFit = 'cover';
  img.alt = 'Advertisement';

  link.appendChild(img);
  wrapper.appendChild(link);
  container.appendChild(wrapper);
})();`;
  }

  /**
   * Generates a high-performance, bot-shielded Universal Meta Pixel & CAPI tag bundle.
   * Features:
   * 1. Multi-pixel broadcast (Master + Backup Pixels).
   * 2. Shared `event_id` generation for browser & server deduplication.
   * 3. Automated form submission & SPA navigation tracking.
   * 4. Bot-gated conversion suppression (preserves Meta machine learning).
   */
  /**
   * Generates a stealth, dual-engine Universal Pixel Tag supporting:
   * 1. Meta Pixel & Conversions API (CAPI v19.0+) with Advanced Matching & Deduplication
   * 2. Google Ads (gtag.js) with Enhanced Conversions & Consent Mode v2
   * 3. Hardware-level bot suppression shielding machine learning models
   */
  /**
   * Generates a stealth, dual-engine Universal Pixel Tag supporting:
   * 1. Meta Pixel & Conversions API (CAPI v19.0+) with Advanced Matching & Deduplication
   * 2. Google Ads (gtag.js) with Enhanced Conversions & Consent Mode v2
   * 3. Hardware-level bot suppression shielding machine learning models
   */
  static generateUniversalPixelTag(config: {
    slug: string;
    apiBaseUrl: string;
    activePlatform?: 'meta' | 'google' | 'both';
    masterPixelId?: string | null;
    backupPixelIds?: string[];
    enableCapi?: boolean;
    enableLdu?: boolean;
    googleConversionId?: string | null;
    googleConversionLabels?: Record<string, string> | null;
    enableGoogleEnhancedConversions?: boolean;
    enableGoogleConsentMode?: boolean;
    googleDefaultConsent?: 'granted' | 'denied';
    fireOnBots?: boolean;
    trackPageViews?: boolean;
    trackOutbound?: boolean;
    events?: Array<{
      eventName: string;
      triggerType: string;
      selector?: string;
      urlPattern?: string;
      eventValueKey?: string;
      currency?: string;
    }>;
  }): string {
    const {
      slug,
      apiBaseUrl,
      activePlatform = 'both',
      masterPixelId,
      backupPixelIds = [],
      enableCapi = true,
      enableLdu = false,
      googleConversionId,
      googleConversionLabels = {},
      enableGoogleEnhancedConversions = true,
      enableGoogleConsentMode = true,
      googleDefaultConsent = 'granted',
      fireOnBots = false,
      trackPageViews = true,
      trackOutbound = true,
      events = []
    } = config;

    const allPixelIds = masterPixelId 
      ? [masterPixelId, ...backupPixelIds.filter(id => id && id !== masterPixelId)]
      : backupPixelIds.filter(Boolean);

    const hasMeta = (activePlatform === 'meta' || activePlatform === 'both') && allPixelIds.length > 0;
    const hasGoogle = (activePlatform === 'google' || activePlatform === 'both') && Boolean(googleConversionId);

    const safeBaseUrl = JSON.stringify(apiBaseUrl.replace(/\/+$/, ''));
    const safeSlug = JSON.stringify(slug);
    const safePixelIds = JSON.stringify(allPixelIds);
    const safeGId = JSON.stringify(googleConversionId || '');
    const safeGLabels = JSON.stringify(googleConversionLabels || {});
    const safeGConsent = JSON.stringify(googleDefaultConsent || 'granted');
    const safeEvents = JSON.stringify(events);

    // Dynamic Meta Code Block (Only included if Meta is active)
    const metaInitBlock = hasMeta ? `
    // --- Meta Pixel (fbevents.js) & Attribution Cookies ---
    function getCookie(name) {
      var parts = (d.cookie || '').split('; ');
      for (var i = 0; i < parts.length; i++) {
        var c = parts[i].split('=');
        if (c[0] === name) return decodeURIComponent(c.slice(1).join('='));
      }
      return '';
    }
    function setCookie(name, val, days) {
      try {
        var exp = new Date(Date.now() + (days || 90) * 864e5).toUTCString();
        var host = w.location.hostname.replace(/^www\./, '');
        d.cookie = name + '=' + encodeURIComponent(val) + '; expires=' + exp + '; path=/; domain=.' + host + '; SameSite=Lax';
      } catch(e) {}
    }

    var _fbc = getCookie('_fbc');
    try {
      var searchStr = w.location.search.substring(1);
      if (searchStr) {
        var pairs = searchStr.split('&');
        for (var p = 0; p < pairs.length; p++) {
          var kv = pairs[p].split('=');
          if (kv[0] === 'fbclid') {
            _fbc = 'fb.1.' + Date.now() + '.' + decodeURIComponent(kv[1] || '');
            setCookie('_fbc', _fbc, 90);
            break;
          }
        }
      }
    } catch(e) {}

    var _fbp = getCookie('_fbp');
    if (!_fbp) {
      _fbp = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1e10);
      setCookie('_fbp', _fbp, 730);
    }

    if (!w.fbq) {
      var n = w.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!w._fbq) w._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = '2.0';
      n.queue = [];
      var t = d.createElement(s);
      t.async = true;
      t.src = 'https://connect.facebook.net/en_US/fbevents.js';
      var f = d.getElementsByTagName(s)[0];
      if (f && f.parentNode) f.parentNode.insertBefore(t, f);
    }

    ${enableLdu ? "try { w.fbq('dataProcessingOptions', ['LDU'], 0, 0); } catch(e) {}" : ''}

    for (var i = 0; i < _pixels.length; i++) {
      w.fbq('init', _pixels[i]);
    }
` : '';

    // Dynamic Google Tag Code Block (Only included if Google is active)
    const googleInitBlock = hasGoogle ? `
    // --- Google Tag (gtag.js) & Consent Mode v2 ---
    w.dataLayer = w.dataLayer || [];
    if (!w.gtag) {
      w.gtag = function() { w.dataLayer.push(arguments); };
    }

    ${enableGoogleConsentMode ? `
    w.gtag('consent', 'default', {
      'ad_storage': ${safeGConsent},
      'analytics_storage': ${safeGConsent},
      'ad_user_data': ${safeGConsent},
      'ad_personalization': ${safeGConsent}
    });` : ''}

    var gt = d.createElement(s);
    gt.async = true;
    gt.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(_gId);
    var gf = d.getElementsByTagName(s)[0];
    if (gf && gf.parentNode) gf.parentNode.insertBefore(gt, gf);

    w.gtag('js', new Date());
    w.gtag('config', _gId, { send_page_view: _trackPv });
` : '';

        // Dynamic Meta Dispatch Block
    const metaDispatchBlock = hasMeta ? `
      try {
        w.fbq('track', eventName, customData, { eventID: eventId });
      } catch(err) {}
` : '';

    // Dynamic S2S Telemetry Beacon (Meta CAPI & Google Ads Logging)
    const telemetryBeaconBlock = (hasMeta || hasGoogle) ? `
      try {
        var beaconPayload = {
          slug: _slug,
          eventName: eventName,
          eventId: eventId,
          eventSourceUrl: w.location.href,
          customData: customData,
          userData: {
            email: extractedUser.email,
            phone: extractedUser.phone,
            firstName: extractedUser.firstName,
            lastName: extractedUser.lastName,
            city: extractedUser.city,
            postalCode: extractedUser.postalCode,
            country: extractedUser.country,
            fbp: _fbp,
            fbc: _fbc,
            gclid: _gcl_aw,
            wbraid: _gcl_wb,
            gbraid: _gcl_gb
          },
          isBot: isBot
        };

        if (nav.sendBeacon) {
          nav.sendBeacon(_bUrl + '/api/v1/traffic-director/pixel/event', JSON.stringify(beaconPayload));
        } else {
          fetch(_bUrl + '/api/v1/traffic-director/pixel/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(beaconPayload),
            keepalive: true
          }).catch(function() {});
        }
      } catch(bErr) {}
    ` : '';

    // Dynamic Google Dispatch Block
    const googleDispatchBlock = hasGoogle ? `
      if (w.gtag) {
        try {
          ${enableGoogleEnhancedConversions ? `
          if (extractedUser.email || extractedUser.phone || extractedUser.postalCode) {
            w.gtag('set', 'user_data', {
              email: extractedUser.email || undefined,
              phone_number: extractedUser.phone || undefined,
              address: {
                first_name: extractedUser.firstName || undefined,
                last_name: extractedUser.lastName || undefined,
                city: extractedUser.city || undefined,
                postal_code: extractedUser.postalCode || undefined,
                country: extractedUser.country || undefined
              }
            });
          }` : ''}

          var sendToLabel = _gLabels[eventName] || _gLabels['default'] || '';
          var gPayload = {
            value: customData.value || 0,
            currency: customData.currency || 'USD',
            transaction_id: eventId
          };
          if (sendToLabel) {
            gPayload.send_to = sendToLabel;
          }

          w.gtag('event', 'conversion', gPayload);
        } catch(gErr) {}
      }
` : '';

    return `/** 180workspace Universal Advertising Pixel & Conversion Engine **/
(function(w, d, s) {
  'use strict';
  try {
    var _bUrl = ${safeBaseUrl};
    var _slug = ${safeSlug};
    var _pixels = ${safePixelIds};
    var _gId = ${safeGId};
    var _gLabels = ${safeGLabels};
    var _rules = ${safeEvents};
    var _fireOnBots = ${fireOnBots ? 'true' : 'false'};
    var _trackPv = ${trackPageViews ? 'true' : 'false'};

    // 1. Hardware Telemetry & Bot Detection Shield
    var nav = navigator || {};
    var ua = (nav.userAgent || '').toLowerCase();
    var isMobile = /iphone|ipad|ipod|android|mobile/.test(ua);
    var tp = nav.maxTouchPoints || 0;
    var hasTouch = ('ontouchstart' in w) || (tp > 0);
    var isWd = (navigator.webdriver === true) || nav.webdriver === true || !!w.__nightmare || !!w._phantom || !!w.callPhantom;
    
    var isEmulatedGpu = false;
    try {
      var cv = d.createElement('canvas');
      var gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      if (gl) {
        var dbg = gl.getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          var gpu = (gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
          if (gpu.indexOf('swiftshader') !== -1 || gpu.indexOf('llvmpipe') !== -1 || gpu.indexOf('software rasterizer') !== -1) {
            isEmulatedGpu = true;
          }
        }
      }
    } catch(e) {}

    var isBot = isWd || isEmulatedGpu || (isMobile && !hasTouch && tp === 0);
    if (isBot && !_fireOnBots) {
      return; // Bot detected -> suppress conversion engines to protect ML
    }

    // --- First-Party Attribution & Cookie Persistence ---
    function getCookie(name) {
      var parts = (d.cookie || '').split('; ');
      for (var i = 0; i < parts.length; i++) {
        var c = parts[i].split('=');
        if (c[0] === name) return decodeURIComponent(c.slice(1).join('='));
      }
      return '';
    }
    function setCookie(name, val, days) {
      try {
        var exp = new Date(Date.now() + (days || 90) * 864e5).toUTCString();
        var host = w.location.hostname.replace(/^www\./, '');
        d.cookie = name + '=' + encodeURIComponent(val) + '; expires=' + exp + '; path=/; domain=.' + host + '; SameSite=Lax';
      } catch(e) {}
    }

    var _fbc = getCookie('_fbc');
    var _fbp = getCookie('_fbp');
    var _gcl_aw = getCookie('_gcl_aw');
    var _gcl_wb = getCookie('_gcl_wb');
    var _gcl_gb = getCookie('_gcl_gb');

    try {
      var searchStr = w.location.search.substring(1);
      if (searchStr) {
        var pairs = searchStr.split('&');
        for (var p = 0; p < pairs.length; p++) {
          var kv = pairs[p].split('=');
          var k = kv[0];
          var v = decodeURIComponent(kv[1] || '');
          if (k === 'fbclid') {
            _fbc = 'fb.1.' + Date.now() + '.' + v;
            setCookie('_fbc', _fbc, 90);
          } else if (k === 'gclid') {
            _gcl_aw = 'GCL.' + Math.floor(Date.now() / 1000) + '.' + v;
            setCookie('_gcl_aw', _gcl_aw, 90);
          } else if (k === 'wbraid') {
            _gcl_wb = 'GCL.' + Math.floor(Date.now() / 1000) + '.' + v;
            setCookie('_gcl_wb', _gcl_wb, 90);
          } else if (k === 'gbraid') {
            _gcl_gb = 'GCL.' + Math.floor(Date.now() / 1000) + '.' + v;
            setCookie('_gcl_gb', _gcl_gb, 90);
          }
        }
      }
    } catch(e) {}

    if (!_fbp && ${hasMeta ? 'true' : 'false'}) {
      _fbp = 'fb.1.' + Date.now() + '.' + Math.floor(Math.random() * 1e10);
      setCookie('_fbp', _fbp, 730);
    }

    ${metaInitBlock}

    ${googleInitBlock}

    // Deterministic Event ID Generator (Shared Deduplication)
    function genEventId() {
      return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
    }

    // Unified Multi-Platform Event Dispatcher
    function dispatchEvent(eventName, customData, extractedUser) {
      if (isBot && !_fireOnBots) return;

      var eventId = genEventId();
      customData = customData || {};
      extractedUser = extractedUser || {};

      ${metaDispatchBlock}

      ${googleDispatchBlock}

      ${telemetryBeaconBlock}
    }

    // Track Initial PageView
    if (_trackPv) {
      ${hasMeta || Boolean(googleConversionLabels?.PageView) ? "dispatchEvent('PageView');" : ''}
    }

    // Identity Extraction Helper (DOM Forms)
    function extractFormIdentity(form) {
      var user = { email: '', phone: '', firstName: '', lastName: '', postalCode: '', city: '', country: '' };
      try {
        var inputs = form.querySelectorAll('input, select, textarea');
        for (var i = 0; i < inputs.length; i++) {
          var inp = inputs[i];
          var name = (inp.name || inp.id || '').toLowerCase();
          var type = (inp.type || '').toLowerCase();
          var auto = (inp.getAttribute('autocomplete') || '').toLowerCase();
          var val = (inp.value || '').trim();
          if (!val) continue;

          // Email
          if (!user.email && (type === 'email' || name.indexOf('email') !== -1 || name.indexOf('mail') !== -1 || auto.indexOf('email') !== -1)) {
            if (val.indexOf('@') !== -1) user.email = val;
          }
          // Phone
          if (!user.phone && (type === 'tel' || name.indexOf('phone') !== -1 || name.indexOf('tel') !== -1 || name.indexOf('mobile') !== -1 || auto.indexOf('tel') !== -1)) {
            user.phone = val;
          }
          // First Name
          if (!user.firstName && (name.indexOf('fname') !== -1 || name.indexOf('first_name') !== -1 || name.indexOf('firstname') !== -1 || auto.indexOf('given-name') !== -1)) {
            user.firstName = val;
          }
          // Last Name
          if (!user.lastName && (name.indexOf('lname') !== -1 || name.indexOf('last_name') !== -1 || name.indexOf('lastname') !== -1 || auto.indexOf('family-name') !== -1)) {
            user.lastName = val;
          }
          // Full Name Fallback
          if (!user.firstName && !user.lastName && (name === 'name' || name === 'fullname' || name === 'full_name' || auto === 'name')) {
            var parts = val.split(' ');
            user.firstName = parts[0] || '';
            user.lastName = parts.slice(1).join(' ') || '';
          }
          // Zip / Postal
          if (!user.postalCode && (name.indexOf('zip') !== -1 || name.indexOf('postal') !== -1 || auto.indexOf('postal-code') !== -1)) {
            user.postalCode = val;
          }
          // City
          if (!user.city && (name.indexOf('city') !== -1 || auto.indexOf('address-level2') !== -1)) {
            user.city = val;
          }
          // Country
          if (!user.country && (name.indexOf('country') !== -1 || auto.indexOf('country') !== -1)) {
            user.country = val;
          }
        }
      } catch(ex) {}
      return user;
    }

    // Automated Form Submission Tracking (Lead, Purchase, etc.)
    d.addEventListener('submit', function(e) {
      var form = e.target;
      if (!form || form.nodeName !== 'FORM') return;

      var identity = extractFormIdentity(form);
      var matchedEvent = 'Lead';

      for (var r = 0; r < _rules.length; r++) {
        var rule = _rules[r];
        if (rule.triggerType === 'form_submit') {
          if (!rule.selector || form.matches(rule.selector) || form.closest(rule.selector)) {
            matchedEvent = rule.eventName || 'Lead';
            break;
          }
        }
      }

      dispatchEvent(matchedEvent, { content_name: form.id || form.action || 'Lead Form' }, identity);
    }, true);

    // Click Triggers
    d.addEventListener('click', function(e) {
      var target = e.target;
      if (!target) return;

      for (var r = 0; r < _rules.length; r++) {
        var rule = _rules[r];
        if (rule.triggerType === 'click' && rule.selector) {
          if (target.matches(rule.selector) || target.closest(rule.selector)) {
            dispatchEvent(rule.eventName || 'Click', { content_name: rule.selector });
          }
        }
      }
    }, true);

    // SPA Route Change Listener
    if (_trackPv && w.history && w.history.pushState) {
      var origPush = w.history.pushState;
      w.history.pushState = function() {
        origPush.apply(this, arguments);
        ${hasMeta ? "dispatchEvent('PageView');" : ''}
      };
      w.addEventListener('popstate', function() {
        ${hasMeta ? "dispatchEvent('PageView');" : ''}
      });
    }

  } catch(fatal) {}
})(window, document, 'script');`;
  }
}
