/**
 * Generates out/_redirects for Cloudflare Pages from redirects.template.
 * The backend origin comes strictly from NEXT_PUBLIC_API_URL; nothing is hardcoded.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'out');
const templatePath = path.join(root, 'redirects.template');

if (!fs.existsSync(outDir)) {
  console.log('No static export output found; skipping _redirects generation.');
  process.exit(0);
}

const apiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
if (!apiUrl) {
  console.error('NEXT_PUBLIC_API_URL is not set; cannot generate _redirects.');
  process.exit(1);
}

const contents = fs.readFileSync(templatePath, 'utf8').split('__API_URL__').join(apiUrl);
fs.writeFileSync(path.join(outDir, '_redirects'), contents);
console.log('✓ Generated out/_redirects from redirects.template');
