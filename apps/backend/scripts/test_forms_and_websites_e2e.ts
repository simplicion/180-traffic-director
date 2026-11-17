import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

import jwt from 'jsonwebtoken';
import { prisma } from '@workspace/db';
import { getJwtSecret } from '../src/config/secrets';

const API_BASE = (process.env.TEST_API_URL || `http://127.0.0.1:${process.env.TD_PORT || process.env.PORT || 4005}`).replace(/\/+$/, '');

let passed = 0;
let failed = 0;

function check(cond: boolean, suite: string, name: string, detail?: any) {
  if (cond) {
    passed++;
    console.log(`  [PASS] (${suite}) ${name}`);
  } else {
    failed++;
    console.error(`  [FAIL] (${suite}) ${name}`, detail !== undefined ? detail : '');
  }
}

async function httpJson(method: string, route: string, opts: { token?: string; body?: any; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = {
    ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(opts.headers || {}),
  };
  const res = await fetch(`${API_BASE}${route}`, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch (_) {}
  return { status: res.status, data, headers: res.headers, raw: text };
}

async function main() {
  console.log(`\n====================================================================`);
  console.log(` 180 FORMS & WEBSITE BUILDER LIVE E2E VERIFICATION SUITE`);
  console.log(` Target Backend: ${API_BASE}`);
  console.log(`====================================================================\n`);

  const secret = getJwtSecret();

  // Ensure two distinct test users for strict userId isolation verification
  const userA =
    (await prisma.user.findFirst({ where: { email: 'e2e-owner-a@180test.local' } })) ||
    (await prisma.user.create({
      data: { email: 'e2e-owner-a@180test.local', name: 'E2E Owner A', role: 'admin' },
    }));
  const userB =
    (await prisma.user.findFirst({ where: { email: 'e2e-owner-b@180test.local' } })) ||
    (await prisma.user.create({
      data: { email: 'e2e-owner-b@180test.local', name: 'E2E Owner B', role: 'admin' },
    }));

  const tokenA = jwt.sign({ id: userA.id, userId: userA.id, sub: userA.id, email: userA.email, name: userA.name, role: userA.role }, secret, { expiresIn: '1h' });
  const tokenB = jwt.sign({ id: userB.id, userId: userB.id, sub: userB.id, email: userB.email, name: userB.name, role: userB.role }, secret, { expiresIn: '1h' });

  let createdFormId = '';
  let createdWebsiteId = '';
  let uploadedFileId = '';
  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  const testDomain = `e2e-${uniqueSuffix}.example.test`;

  try {
    // ── SUITE 1: Auth Protection ────────────────────────────────────────────
    console.log('[SUITE 1: Authentication Guard (401 without token)]');
    check((await httpJson('GET', '/api/forms')).status === 401, 'Auth', 'GET /api/forms rejects unauthenticated');
    check((await httpJson('GET', '/api/websites')).status === 401, 'Auth', 'GET /api/websites rejects unauthenticated');
    check((await httpJson('GET', '/api/v1/domains/check-availability?slug=test')).status === 401, 'Auth', 'GET /api/v1/domains/* rejects unauthenticated');
    check((await httpJson('GET', '/api/users')).status === 401, 'Auth', 'GET /api/users rejects unauthenticated');
    check((await httpJson('GET', '/api/v1/ai/status')).status === 401, 'Auth', 'GET /api/v1/ai/status rejects unauthenticated');

    // ── SUITE 2: 180 Forms Full E2E Lifecycle ───────────────────────────────
    console.log('\n[SUITE 2: 180 Forms Full E2E Lifecycle]');
    const createFormRes = await httpJson('POST', '/api/forms', {
      token: tokenA,
      body: {
        title: `E2E Lead Form ${uniqueSuffix}`,
        description: 'Automated E2E verification form',
        formType: 'SALES_ACTIVITY',
        settings: {
          disallowDuplicateSubmissions: true,
          successMessage: 'E2E Success!',
          pixelEventName: 'Lead',
          pages: [{ id: 'page_1', title: 'Step 1', order: 0 }],
        },
        fields: [
          { label: 'Full Name', type: 'TEXT', required: true, mapping: 'name', pageId: 'page_1' },
          { label: 'Work Email', type: 'EMAIL', required: true, mapping: 'email', pageId: 'page_1' },
          { label: 'Phone Number', type: 'PHONE', required: false, mapping: 'phone', pageId: 'page_1' },
        ],
      },
    });
    check(createFormRes.status === 201 && Boolean(createFormRes.data?.data?.form?.id), 'Forms', 'POST /api/forms creates form with fields', createFormRes.data);
    const form = createFormRes.data?.data?.form;
    createdFormId = form?.id || '';

    const secondFormRes = await httpJson('POST', '/api/forms', {
      token: tokenA,
      body: { title: `E2E Quota Overflow Form ${uniqueSuffix}`, formType: 'GENERAL_SURVEY' },
    });
    check(
      secondFormRes.status === 403 && secondFormRes.data?.code === 'SUBSCRIPTION_REQUIRED',
      'Quota',
      '7-day free trial blocks creating a 2nd Form (403 SUBSCRIPTION_REQUIRED)',
      { status: secondFormRes.status, data: secondFormRes.data }
    );

    const subAfterForm = await httpJson('GET', '/api/v1/traffic-director/billing/status', { token: tokenA });
    const subDataF = subAfterForm.data?.subscription;
    check(
      subAfterForm.status === 200 &&
        subDataF?.maxLinks === 1 &&
        subDataF?.maxForms === 1 &&
        subDataF?.maxWebsites === 1 &&
        subDataF?.currentFormsCount === 1 &&
        subDataF?.canCreateMoreForms === false,
      'Quota',
      'GET /api/v1/traffic-director/billing/status reports unified 1/1/1 trial limits and form usage',
      subDataF
    );

    const listFormsRes = await httpJson('GET', '/api/forms', { token: tokenA });
    check(
      listFormsRes.status === 200 && Array.isArray(listFormsRes.data?.data?.forms) && listFormsRes.data.data.forms.some((f: any) => f.id === createdFormId),
      'Forms',
      'GET /api/forms returns owner form'
    );

    const getFormRes = await httpJson('GET', `/api/forms/${createdFormId}`, { token: tokenA });
    check(
      getFormRes.status === 200 && getFormRes.data?.data?.form?.fields?.length === 3 && String(getFormRes.data?.data?.form?.apiKey || '').startsWith('fkey_'),
      'Forms',
      'GET /api/forms/:id returns fields, formCode, and apiKey'
    );
    const oldApiKey = getFormRes.data?.data?.form?.apiKey;

    const crossFormRes = await httpJson('GET', `/api/forms/${createdFormId}`, { token: tokenB });
    check(crossFormRes.status === 404, 'Forms', 'User isolation: User B cannot read User A form (404)', crossFormRes.status);

    const patchFormRes = await httpJson('PATCH', `/api/forms/${createdFormId}`, {
      token: tokenA,
      body: { title: `E2E Lead Form Updated ${uniqueSuffix}` },
    });
    check(patchFormRes.status === 200 && patchFormRes.data?.data?.form?.title?.includes('Updated'), 'Forms', 'PATCH /api/forms/:id updates form');

    const regenRes = await httpJson('POST', `/api/forms/${createdFormId}/api-key/regenerate`, { token: tokenA });
    const newApiKey = regenRes.data?.data?.apiKey;
    check(regenRes.status === 200 && newApiKey && newApiKey !== oldApiKey && newApiKey.startsWith('fkey_'), 'Forms', 'POST /api/forms/:id/api-key/regenerate rotates key');

    const pubGetRes = await httpJson('GET', `/api/public/forms/${form.slug}`);
    check(pubGetRes.status === 200 && pubGetRes.data?.data?.form?.id === createdFormId, 'Forms', 'GET /api/public/forms/:slug resolves publicly');

    const pubSubmitRes = await httpJson('POST', `/api/public/forms/${form.slug}/submit`, {
      body: {
        values: {
          name: 'Ada Lovelace',
          email: `ada-${uniqueSuffix}@example.com`,
          phone: '+1 555 234 5678',
        },
      },
    });
    check(pubSubmitRes.status === 201 && Boolean(pubSubmitRes.data?.data?.submissionId), 'Forms', 'POST /api/public/forms/:slug/submit persists submission', pubSubmitRes.data);
    const submissionId = pubSubmitRes.data?.data?.submissionId;

    const dupSubmitRes = await httpJson('POST', `/api/public/forms/${form.slug}/submit`, {
      body: {
        values: {
          name: 'Ada Duplicate',
          email: `ada-${uniqueSuffix}@example.com`,
        },
      },
    });
    check(dupSubmitRes.status === 400, 'Forms', 'Duplicate submission prevention blocks repeated email (400)', dupSubmitRes.status);

    const honeypotRes = await httpJson('POST', `/api/public/capture/${form.slug}`, {
      body: { name: 'Bot', email: 'bot@spam.test', _gotcha: 'filled-by-bot' },
    });
    check(honeypotRes.status === 201 && honeypotRes.data?.data?.submissionId === 'quarantined-bot-submission', 'Forms', 'Headless capture honeypot quarantines bots');

    const captureRes = await httpJson('POST', `/api/public/capture/${form.slug}`, {
      body: {
        name: 'Grace Hopper',
        email: `grace-${uniqueSuffix}@example.com`,
        company_size: '50-200',
      },
    });
    check(captureRes.status === 201 && Boolean(captureRes.data?.data?.submissionId), 'Forms', 'POST /api/public/capture/:slug ingests headless payload + auto-discovers field', captureRes.data);

    const badKeyRes = await httpJson('GET', `/api/public/forms/${form.slug}/api/submissions`, {
      headers: { 'X-API-Key': 'fkey_invalid' },
    });
    check(badKeyRes.status === 401, 'Forms', 'External API rejects invalid X-API-Key (401)');

    const goodKeyRes = await httpJson('GET', `/api/public/forms/${form.slug}/api/submissions`, {
      headers: { 'X-API-Key': newApiKey },
    });
    check(goodKeyRes.status === 200 && goodKeyRes.data?.submissions?.length === 2, 'Forms', 'External API returns 2 submissions with valid X-API-Key', goodKeyRes.data?.submissions?.length);

    const subsRes = await httpJson('GET', `/api/forms/${createdFormId}/submissions`, { token: tokenA });
    check(subsRes.status === 200 && subsRes.data?.data?.submissions?.length === 2, 'Forms', 'GET /api/forms/:id/submissions lists all submissions');

    const statusRes = await httpJson('PATCH', `/api/forms/submissions/${submissionId}/status`, {
      token: tokenA,
      body: { status: 'Qualified' },
    });
    check(statusRes.status === 200 && statusRes.data?.data?.status === 'Qualified', 'Forms', 'PATCH /api/forms/submissions/:id/status updates status');

    const csvRes = await httpJson('GET', `/api/forms/${createdFormId}/export/csv?token=${encodeURIComponent(tokenA)}`);
    check(csvRes.status === 200 && csvRes.raw.includes('Ada Lovelace') && csvRes.raw.includes('Qualified'), 'Forms', 'GET /api/forms/:id/export/csv?token=... streams authenticated CSV');

    const delFormRes = await httpJson('DELETE', `/api/forms/${createdFormId}`, { token: tokenA });
    check(delFormRes.status === 204, 'Forms', 'DELETE /api/forms/:id removes form cleanly');
    createdFormId = '';

    // ── SUITE 3: Website Builder Full E2E Lifecycle ─────────────────────────
    console.log('\n[SUITE 3: Website Builder Full E2E Lifecycle]');
    const siteSlug = `e2e-site-${uniqueSuffix}`;

    const slugAvailBefore = await httpJson('GET', `/api/websites/check-slug?slug=${siteSlug}`, { token: tokenA });
    check(slugAvailBefore.status === 200 && slugAvailBefore.data?.available === true, 'Websites', 'GET /api/websites/check-slug reports available');

    const createSiteRes = await httpJson('POST', '/api/websites', {
      token: tokenA,
      body: { name: `E2E Site ${uniqueSuffix}`, slug: siteSlug },
    });
    check(createSiteRes.status === 201 && Boolean(createSiteRes.data?.website?.id) && createSiteRes.data?.website?.config?.version === 2, 'Websites', 'POST /api/websites creates v2 site + DomainRegistry entry', createSiteRes.data);
    const website = createSiteRes.data?.website;
    createdWebsiteId = website?.id || '';

    const secondSiteRes = await httpJson('POST', '/api/websites', {
      token: tokenA,
      body: { name: `E2E Quota Overflow Site ${uniqueSuffix}`, slug: `${siteSlug}-overflow` },
    });
    check(
      secondSiteRes.status === 403 && secondSiteRes.data?.code === 'SUBSCRIPTION_REQUIRED',
      'Quota',
      '7-day free trial blocks creating a 2nd Website (403 SUBSCRIPTION_REQUIRED)',
      { status: secondSiteRes.status, data: secondSiteRes.data }
    );

    const subAfterSite = await httpJson('GET', '/api/v1/traffic-director/billing/status', { token: tokenA });
    const subDataW = subAfterSite.data?.subscription;
    check(
      subAfterSite.status === 200 &&
        subDataW?.currentWebsitesCount === 1 &&
        subDataW?.canCreateMoreWebsites === false,
      'Quota',
      'GET /api/v1/traffic-director/billing/status reports website usage & blocks extra websites',
      subDataW
    );

    const slugAvailAfter = await httpJson('GET', `/api/websites/check-slug?slug=${siteSlug}`, { token: tokenA });
    check(slugAvailAfter.status === 200 && slugAvailAfter.data?.available === false, 'Websites', 'GET /api/websites/check-slug reports taken after create');

    const listSitesRes = await httpJson('GET', '/api/websites', { token: tokenA });
    check(listSitesRes.status === 200 && listSitesRes.data?.websites?.some((w: any) => w.id === createdWebsiteId), 'Websites', 'GET /api/websites lists owner website');

    const crossSiteRes = await httpJson('GET', `/api/websites/${createdWebsiteId}`, { token: tokenB });
    check(crossSiteRes.status === 404, 'Websites', 'User isolation: User B cannot access User A website (404)');

    const publishRes = await httpJson('PATCH', `/api/websites/${createdWebsiteId}`, {
      token: tokenA,
      body: {
        isPublished: true,
        publishedConfig: { ...website.config, brand: { ...website.config.brand, primaryColor: '#10b981' } },
      },
    });
    check(publishRes.status === 200 && publishRes.data?.website?.isPublished === true, 'Websites', 'PATCH /api/websites/:id publishes website config');

    const createPixelRes = await httpJson('POST', `/api/websites/${createdWebsiteId}/pixels`, {
      token: tokenA,
      body: { provider: 'facebook', pixelId: '123456789012345' },
    });
    check(createPixelRes.status === 201 && createPixelRes.data?.pixel?.pixelId === '123456789012345', 'Websites', 'POST /api/websites/:id/pixels creates pixel');

    const listPixelsRes = await httpJson('GET', `/api/websites/${createdWebsiteId}/pixels`, { token: tokenA });
    check(listPixelsRes.status === 200 && listPixelsRes.data?.pixels?.length === 1, 'Websites', 'GET /api/websites/:id/pixels lists website pixels');

    const pubSiteRes = await httpJson('GET', `/api/public/websites/resolve?domain=${siteSlug}`);
    check(
      pubSiteRes.status === 200 && pubSiteRes.data?.website?.id === createdWebsiteId && pubSiteRes.data?.website?.config?.brand?.primaryColor === '#10b981' && pubSiteRes.data?.pixels?.length === 1,
      'Websites',
      'GET /api/public/websites/resolve serves publishedConfig + active pixels'
    );

    const domainResolveRes = await httpJson('GET', `/api/public/domains/resolve?domain=${siteSlug}`);
    check(
      domainResolveRes.status === 200 && domainResolveRes.data?.type === 'ADVERTISING_WEBSITE' && domainResolveRes.data?.payload?.website?.id === createdWebsiteId,
      'Websites',
      'GET /api/public/domains/resolve resolves website for /sites/[domain]'
    );

    const leadRes = await httpJson('POST', `/api/public/websites/resolve/lead?domain=${siteSlug}`, {
      body: { name: 'Alan Turing', email: `alan-${uniqueSuffix}@example.com`, message: 'Interested!' },
    });
    check(leadRes.status === 201 && Boolean(leadRes.data?.data?.submission?.id), 'Websites', 'POST /api/public/websites/resolve/lead records WebsiteFormSubmission');

    const statsRes = await httpJson('GET', `/api/websites/${createdWebsiteId}/stats`, { token: tokenA });
    check(statsRes.status === 200 && typeof statsRes.data?.views === 'number', 'Websites', 'GET /api/websites/:id/stats returns stats');

    // ── SUITE 4: Custom Domain Manager (/api/v1/domains) ────────────────────
    console.log('\n[SUITE 4: Centralized Custom Domain Manager (/api/v1/domains)]');
    const addDomRes = await httpJson('POST', '/api/v1/domains', {
      token: tokenA,
      body: { domain: testDomain, type: 'ADVERTISING_WEBSITE', targetId: createdWebsiteId },
    });
    check(addDomRes.status === 201 && addDomRes.data?.data?.domain === testDomain, 'Domains', 'POST /api/v1/domains connects custom domain', addDomRes.data);

    const statusDomRes = await httpJson('GET', `/api/v1/domains/${encodeURIComponent(testDomain)}/status`, { token: tokenA });
    check(statusDomRes.status === 200 && statusDomRes.data?.data?.domain === testDomain, 'Domains', 'GET /api/v1/domains/:domain/status returns config');

    const verifyDomRes = await httpJson('POST', `/api/v1/domains/${encodeURIComponent(testDomain)}/verify`, { token: tokenA });
    check(verifyDomRes.status === 200 && verifyDomRes.data?.success === true, 'Domains', 'POST /api/v1/domains/:domain/verify runs DNS verification');

    const delDomRes = await httpJson('DELETE', `/api/v1/domains/${encodeURIComponent(testDomain)}`, { token: tokenA });
    check(delDomRes.status === 200 && delDomRes.data?.success === true, 'Domains', 'DELETE /api/v1/domains/:domain removes domain cleanly');

    const delSiteRes = await httpJson('DELETE', `/api/websites/${createdWebsiteId}`, { token: tokenA });
    check(delSiteRes.status === 200, 'Websites', 'DELETE /api/websites/:id removes website + DomainRegistry');
    createdWebsiteId = '';

    // ── SUITE 5: Media Uploads & Compatibility Endpoints ────────────────────
    console.log('\n[SUITE 5: Media Uploads & Compatibility Endpoints]');
    const formData = new FormData();
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    formData.append('file', new Blob([tinyPng], { type: 'image/png' }), 'e2e-pixel.png');
    const uploadRes = await fetch(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
      body: formData,
    });
    const uploadJson: any = await uploadRes.json().catch(() => ({}));
    uploadedFileId = uploadJson?.data?.id || '';
    check(uploadRes.status === 201 && Boolean(uploadJson?.url), 'Media', 'POST /api/files/upload stores file and returns URL', uploadJson);

    if (uploadedFileId) {
      const fetchUploaded = await fetch(`${API_BASE}/uploads/${uploadedFileId}`);
      check(fetchUploaded.status === 200, 'Media', 'GET /uploads/:filename serves uploaded asset');
      const delUploaded = await httpJson('DELETE', `/api/files/${uploadedFileId}`, { token: tokenA });
      check(delUploaded.status === 200, 'Media', 'DELETE /api/files/:id cleans up uploaded asset');
      uploadedFileId = '';
    }

    const usersRes = await httpJson('GET', '/api/users', { token: tokenA });
    check(usersRes.status === 200 && usersRes.data?.users?.[0]?.id === userA.id, 'Compat', 'GET /api/users returns current authenticated user');

    const aiStatusRes = await httpJson('GET', '/api/v1/ai/status', { token: tokenA });
    check(aiStatusRes.status === 200 && typeof aiStatusRes.data?.configured === 'boolean', 'Compat', 'GET /api/v1/ai/status responds cleanly without 404');
  } finally {
    if (createdFormId) await httpJson('DELETE', `/api/forms/${createdFormId}`, { token: tokenA }).catch(() => {});
    if (createdWebsiteId) await httpJson('DELETE', `/api/websites/${createdWebsiteId}`, { token: tokenA }).catch(() => {});
    if (uploadedFileId) await httpJson('DELETE', `/api/files/${uploadedFileId}`, { token: tokenA }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { in: ['e2e-owner-a@180test.local', 'e2e-owner-b@180test.local'] } } }).catch(() => {});
    await prisma.$disconnect();
  }

  console.log(`\n====================================================================`);
  console.log(` E2E SUMMARY: ${passed} PASSED | ${failed} FAILED`);
  console.log(`====================================================================\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal E2E runner error:', err);
  process.exit(1);
});
