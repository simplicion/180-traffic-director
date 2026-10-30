import assert from 'assert';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { prisma } from '@workspace/db';
import { PixelManagerService } from '@workspace/traffic-director';
import { PublicRoutingController } from '../src/controllers/public-routing.controller';
import trafficDirectorRoutes from '../src/routes/traffic-director.routes';
import publicRoutingRoutes from '../src/routes/public-routing.routes';

console.log('========================================================================');
console.log('  TEST SUITE: LIVE MULTI-PLATFORM (META & GOOGLE) BACKEND BATTERY       ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => Promise<void> | void) {
  totalTests++;
  return Promise.resolve(fn())
    .then(() => {
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    })
    .catch((err: any) => {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
      process.exitCode = 1;
    });
}

async function startTestApp(port: number): Promise<http.Server> {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Public Routes
  app.get('/tag/:slug', PublicRoutingController.handleDynamicTag);
  app.post('/pixel/event', PublicRoutingController.handlePixelEvent);
  app.use('/r', publicRoutingRoutes);

  // Fake auth middleware for test harness
  app.use('/api/v1/traffic-director', (req: any, _res, next) => {
    req.userId = '00000000-0000-0000-0000-000000000001';
    req.user = { id: '00000000-0000-0000-0000-000000000001', email: 'test.admin@180traffic.com' };
    next();
  }, trafficDirectorRoutes);

  return new Promise((resolve) => {
    const server = app.listen(port, () => resolve(server));
  });
}

function req(port: number, path: string, method: string = 'GET', body?: any): Promise<{ status: number; data: any; headers: any }> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const request = http.request({
      host: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsed = raw;
        try { parsed = JSON.parse(raw); } catch (e) {}
        resolve({ status: res.statusCode || 200, data: parsed, headers: res.headers });
      });
    });
    request.on('error', reject);
    if (payload) request.write(payload);
    request.end();
  });
}

async function runBattery() {
  const TEST_PORT = 4199;
  const server = await startTestApp(TEST_PORT);
  console.log(`📡 In-process Test Server running on port ${TEST_PORT}...\n`);

  // Ensure test user and subscription exist in DB
  const testUserId = '00000000-0000-0000-0000-000000000001';
  await prisma.user.upsert({
    where: { id: testUserId },
    create: {
      id: testUserId,
      email: 'test.admin@180traffic.com',
      name: 'Test Administrator'
    },
    update: {}
  });

  // Clean up any stale test links
  await prisma.trafficPixelLog.deleteMany({ where: { userId: testUserId } });
  await prisma.trafficPixelEvent.deleteMany({ where: { config: { userId: testUserId } } });
  await prisma.trafficPixelConfig.deleteMany({ where: { userId: testUserId } });
  await prisma.trafficRule.deleteMany({ where: { userId: testUserId } });
  await prisma.trafficLink.deleteMany({ where: { userId: testUserId } });

  await prisma.trafficDirectorSubscription.upsert({
    where: { userId: testUserId },
    create: {
      userId: testUserId,
      planTier: 'ENTERPRISE',
      maxLinks: 100,
      status: 'ACTIVE',
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000)
    },
    update: {
      status: 'ACTIVE',
      planTier: 'ENTERPRISE',
      maxLinks: 100,
      currentPeriodEnd: new Date(Date.now() + 30 * 86400 * 1000)
    }
  });

  const testSlug = `test-omni-${Date.now()}`;
  let createdLinkId = '';

  try {
    // 1. Create Smart Link
    await runTest('1. POST /links: Creates a new smart link for multi-platform test', async () => {
      const res = await req(TEST_PORT, '/api/v1/traffic-director/links', 'POST', {
        name: 'Omni Conversion Campaign',
        slug: testSlug,
        fallbackUrl: 'https://mysafepage.com',
        isActive: true
      });
      assert(res.status === 200 || res.status === 201, `Expected 200 or 201, got ${res.status}`);
      assert(res.data?.success, 'Response must indicate success');
      createdLinkId = res.data.data?.link?.id || res.data.data?.id;
      assert(createdLinkId, 'Created link must have an ID');
    });

    // 2. Configure Multi-Platform Pixels (Meta + Google Ads)
    await runTest('2. POST /links/:linkId/pixel: Upserts dual-platform configuration', async () => {
      const res = await req(TEST_PORT, `/api/v1/traffic-director/links/${createdLinkId}/pixel`, 'POST', {
        activePlatform: 'both',
        masterPixelId: '1772842000633783',
        backupPixelIds: ['987654321012345'],
        capiToken: 'EAAGNO4a7r2wBAODwQzK1k4Y3j9s8d7f6g5h4j3k2l1m9n8b7v6c5x4z3a2s1d0',
        testEventCode: 'TEST12345',
        enableCapi: true,
        enableLdu: true,
        googleConversionId: 'AW-987654321',
        googleConversionLabels: {
          PageView: 'AW-987654321/Pv_Label',
          Lead: 'AW-987654321/Lead_Label'
        },
        enableGoogleEnhancedConversions: true,
        enableGoogleConsentMode: true,
        googleDefaultConsent: 'granted',
        fireOnBots: false,
        trackPageViews: true,
        events: [
          { eventName: 'Lead', triggerType: 'form_submit', selector: '#lead-form' }
        ]
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data?.success, true);
      const cfg = res.data?.data;
      assert.strictEqual(cfg.activePlatform, 'both');
      assert.strictEqual(cfg.masterPixelId, '1772842000633783');
      assert.strictEqual(cfg.googleConversionId, 'AW-987654321');
      assert.strictEqual(cfg.hasCapiToken, true, 'Vaulted token must be present');
    });

    // 3. Fetch Pixel Configuration (Multi-tenant check)
    await runTest('3. GET /links/:linkId/pixel: Verifies multi-platform persisted settings', async () => {
      const res = await req(TEST_PORT, `/api/v1/traffic-director/links/${createdLinkId}/pixel`, 'GET');
      assert.strictEqual(res.status, 200);
      const cfg = res.data?.data;
      assert.strictEqual(cfg.activePlatform, 'both');
      assert.strictEqual(cfg.enableGoogleEnhancedConversions, true);
      assert.strictEqual(cfg.enableGoogleConsentMode, true);
      assert.strictEqual(cfg.googleConversionLabels?.Lead, 'AW-987654321/Lead_Label');
    });

    // 4. Test Dynamic CDN JavaScript Tag Generation (/tag/:slug.js)
    await runTest('4. GET /tag/:slug.js: Returns dual-engine JS tag for landing pages', async () => {
      const res = await req(TEST_PORT, `/tag/${testSlug}.js`, 'GET');
      assert.strictEqual(res.status, 200);
      assert(String(res.headers['content-type']).includes('application/javascript'), 'Content-type must be JS');
      const jsCode = String(res.data);

      // Meta verification
      assert(jsCode.includes('1772842000633783'), 'Must contain Master Meta Pixel ID');
      assert(jsCode.includes('fbevents.js'), 'Must contain Meta Pixel loader');

      // Google Ads verification
      assert(jsCode.includes('AW-987654321'), 'Must contain Google Conversion ID');
      assert(jsCode.includes('googletagmanager.com/gtag/js'), 'Must contain Google Tag loader');
      assert(jsCode.includes("gtag('consent', 'default'"), 'Must declare Consent Mode v2');

      // Enhanced Conversions & Deduplication
      assert(jsCode.includes('user_data'), 'Must include Enhanced Conversions mapping');
      assert(jsCode.includes('genEventId'), 'Must include deduplication eventId generator');
    });

    // 5. Simulate Ingestion of Conversion Event (/pixel/event)
    await runTest('5. POST /pixel/event: Ingests Lead conversion with user identity', async () => {
      const res = await req(TEST_PORT, '/pixel/event', 'POST', {
        slug: testSlug,
        eventName: 'Lead',
        eventId: 'evt_sim_' + Date.now(),
        eventSourceUrl: 'https://mysafepage.com/offer',
        customData: {
          value: 129.99,
          currency: 'USD'
        },
        userData: {
          email: 'lead.customer@example.com',
          phone: '+14155550199',
          firstName: 'Sarah',
          lastName: 'Connor',
          postalCode: '94105',
          country: 'US'
        },
        isBot: false
      });

      assert.strictEqual(res.status, 200);
      assert(res.data?.eventId, 'Response must return eventId');
      assert.strictEqual(res.data?.browserFired, true);
      assert(res.data?.error !== undefined || res.data?.capiFired !== undefined, 'CAPI dispatch attempted');
    });

    // 6. Inspect Conversion Telemetry Logs
    await runTest('6. GET /links/:linkId/pixel/logs: Retrieves recorded conversion logs', async () => {
      // Give async DB write 150ms
      await new Promise(r => setTimeout(r, 150));
      const res = await req(TEST_PORT, `/api/v1/traffic-director/links/${createdLinkId}/pixel/logs?limit=10`, 'GET');
      assert.strictEqual(res.status, 200);
      const logs = res.data?.data;
      assert(Array.isArray(logs) && logs.length > 0, 'Must record at least one conversion log');
      assert.strictEqual(logs[0].eventName, 'Lead');
    });

  } finally {
    // Cleanup test link and close server
    if (createdLinkId) {
      await prisma.trafficPixelLog.deleteMany({ where: { linkId: createdLinkId } }).catch(() => {});
      await prisma.trafficPixelEvent.deleteMany({ where: { config: { linkId: createdLinkId } } }).catch(() => {});
      await prisma.trafficPixelConfig.deleteMany({ where: { linkId: createdLinkId } }).catch(() => {});
      await prisma.trafficLink.delete({ where: { id: createdLinkId } }).catch(() => {});
    }
    server.close();
    console.log('\n========================================================================');
    console.log(`  SUITE 28 COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✅`);
    console.log('========================================================================\n');
  }
}

runBattery().catch(console.error);
