/**
 * Generates Cloudflare Pages routing artifacts in out/ after static export:
 *   - out/_redirects    (same-origin SPA rewrites)
 *   - out/_worker.js    (edge reverse proxy for /r/*, /tag/*, /evaluate/*, /pixel/*, /api/*, etc.)
 *   - out/_routes.json  (limits worker invocations strictly to dynamic/edge routes)
 *
 * The backend origin comes strictly from NEXT_PUBLIC_API_URL; nothing is hardcoded.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');
const templatePath = path.join(root, 'redirects.template');
const workerTemplatePath = path.join(root, 'worker.template.js');

if (!fs.existsSync(outDir)) {
  console.log('No static export output found; skipping Cloudflare Pages routing generation.');
  process.exit(0);
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
if (!apiUrl) {
  console.error('NEXT_PUBLIC_API_URL is not set; cannot generate Cloudflare Pages routing files.');
  process.exit(1);
}

// 1. Write out/_redirects (same-origin SPA rewrites)
const redirectsContents = fs.readFileSync(templatePath, 'utf8').split('__API_URL__').join(apiUrl);
fs.writeFileSync(path.join(outDir, '_redirects'), redirectsContents);
console.log('✓ Generated out/_redirects from redirects.template');

// 2. Write out/_worker.js (external backend reverse-proxy + SPA dynamic route handler)
const workerContents = fs.readFileSync(workerTemplatePath, 'utf8').split('__API_URL__').join(apiUrl);
fs.writeFileSync(path.join(outDir, '_worker.js'), workerContents);
console.log('✓ Generated out/_worker.js from worker.template.js');

// 3. Write out/_routes.json (bypass worker for all static assets)
const routesConfig = {
  version: 1,
  include: [
    '/r/*',
    '/tag/*',
    '/evaluate/*',
    '/pixel/*',
    '/shield/*',
    '/stream-proxy',
    '/stream-proxy/*',
    '/asset-proxy',
    '/asset-proxy/*',
    '/api/v1/traffic-director/*',
    '/oauth/*',
    '/health',
    '/traffic-director/links/*',
  ],
  exclude: [
    '/traffic-director/links',
    '/traffic-director/links/',
    '/traffic-director/links/default',
    '/traffic-director/links/default.html',
    '/traffic-director/links/default.txt',
  ],
};
fs.writeFileSync(path.join(outDir, '_routes.json'), JSON.stringify(routesConfig, null, 2) + '\n');
console.log('✓ Generated out/_routes.json');
