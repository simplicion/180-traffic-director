import assert from 'assert';
import { PixelManagerService } from '../../src/services/pixel.service';
import { ClientShieldGenerator } from '../../src/evaluator/client-shield-generator';

console.log('========================================================================');
console.log('  TEST SUITE 27: MULTI-PLATFORM (META & GOOGLE ADS) PIXEL & CAPI ENGINE ');
console.log('========================================================================\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`  ❌ [FAIL] ${name}`);
    console.error(`     Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// 🧪 1. Google Conversion ID & Platform Validation
console.log('🧪 1. Testing Google Conversion ID Validation & Normalization...');

runTest('Validates standard Google Conversion ID (AW-XXXXXXXXX)', () => {
  assert.strictEqual(PixelManagerService.validateGoogleConversionId('AW-123456789'), true);
  assert.strictEqual(PixelManagerService.validateGoogleConversionId('aw-9876543210'), true);
  assert.strictEqual(PixelManagerService.validateGoogleConversionId('123456789'), true, 'Numeric-only input should be valid');
});

runTest('Rejects malformed Google Conversion IDs', () => {
  assert.strictEqual(PixelManagerService.validateGoogleConversionId(''), false);
  assert.strictEqual(PixelManagerService.validateGoogleConversionId('G-ABC123XYZ'), false, 'GA4 IDs should not match Google Ads conversion ID');
  assert.strictEqual(PixelManagerService.validateGoogleConversionId('AW-INVALID'), false);
});

// 🧪 2. Dynamic Universal Multi-Platform Tag Compilation
console.log('\n🧪 2. Testing Multi-Platform Tag Generator Engine (Meta, Google, Both)...');

const baseConfig = {
  slug: 'omni-campaign-2026',
  apiBaseUrl: 'https://trk.180traffic.com',
  masterPixelId: '1772842000633783',
  backupPixelIds: ['998877665544332'],
  googleConversionId: 'AW-1122334455',
  googleConversionLabels: {
    PageView: 'AW-1122334455/Pv_123',
    Lead: 'AW-1122334455/Lead_456'
  },
  enableGoogleEnhancedConversions: true,
  enableGoogleConsentMode: true,
  googleDefaultConsent: 'granted' as const,
  enableCapi: true,
  enableLdu: true,
  fireOnBots: false,
  trackPageViews: true,
  events: [
    { eventName: 'Lead', triggerType: 'form_submit', selector: '#optin-form' }
  ]
};

runTest('Active Platform = "both": Emits both Meta Pixel and Google Tag (gtag.js)', () => {
  const scriptJs = ClientShieldGenerator.generateUniversalPixelTag({
    ...baseConfig,
    activePlatform: 'both'
  });

  // Meta checks
  assert(scriptJs.includes('fbevents.js'), 'Must load fbevents.js for Meta');
  assert(scriptJs.includes('1772842000633783'), 'Must initialize Master Meta Pixel');
  assert(scriptJs.includes('dataProcessingOptions'), 'Must apply LDU privacy flags when enableLdu is true');

  // Google checks
  assert(scriptJs.includes('googletagmanager.com/gtag/js'), 'Must load Google Tag (gtag.js)');
  assert(scriptJs.includes('AW-1122334455'), 'Must configure Google Conversion ID');
  assert(scriptJs.includes("gtag('consent', 'default'"), 'Must declare Consent Mode v2 before config');

  // Unified triggers check
  assert(scriptJs.includes("d.addEventListener('submit'"), 'Must register unified form submit listener');
  assert(scriptJs.includes('extractFormIdentity'), 'Must extract form identities for enhanced matching');
});

runTest('Active Platform = "meta": Emits Meta Pixel and omits Google Tag', () => {
  const scriptJs = ClientShieldGenerator.generateUniversalPixelTag({
    ...baseConfig,
    activePlatform: 'meta'
  });

  assert(scriptJs.includes('fbevents.js'), 'Must load Meta fbevents.js');
  assert(scriptJs.includes('1772842000633783'), 'Must contain Meta Pixel ID');
  assert(!scriptJs.includes('googletagmanager.com/gtag/js'), 'Must NOT load Google Tag when platform is meta only');
});

runTest('Active Platform = "google": Emits Google Tag and omits Meta Pixel', () => {
  const scriptJs = ClientShieldGenerator.generateUniversalPixelTag({
    ...baseConfig,
    activePlatform: 'google'
  });

  assert(scriptJs.includes('googletagmanager.com/gtag/js'), 'Must load Google Tag');
  assert(scriptJs.includes('AW-1122334455'), 'Must contain Google Conversion ID');
  assert(!scriptJs.includes('fbevents.js'), 'Must NOT load Meta fbevents.js when platform is google only');
});

// 🧪 3. Advanced Matching & Enhanced Conversions User Normalization
console.log('\n🧪 3. Testing Comprehensive Identity Normalization (EMQ 8.0+ Factors)...');

runTest('Normalizes full user profile for Meta CAPI and Google Enhanced Conversions', () => {
  const normalized = PixelManagerService.normalizeUserData({
    email: 'John.Doe@Business.org',
    phone: '+1 (555) 987-6543',
    firstName: 'John',
    lastName: 'Doe',
    city: 'New York',
    state: 'NY',
    postalCode: '10001',
    country: 'US',
    externalId: 'cust_88291',
    ipAddress: '198.51.100.42',
    userAgent: 'Mozilla/5.0 Chrome/128.0',
    fbp: 'fb.1.1712345678.991283',
    fbc: 'fb.1.1712345678.IwAR994821'
  });

  assert(normalized.em?.[0], 'Must hash email');
  assert(normalized.ph?.[0], 'Must hash phone to E.164');
  assert(normalized.fn?.[0], 'Must hash first name');
  assert(normalized.ln?.[0], 'Must hash last name');
  assert(normalized.ct?.[0], 'Must hash city');
  assert(normalized.st?.[0], 'Must hash state');
  assert(normalized.zp?.[0], 'Must hash postal code');
  assert(normalized.country?.[0], 'Must hash country');
  assert(normalized.external_id?.[0], 'Must hash external ID');
  assert.strictEqual(normalized.client_ip_address, '198.51.100.42');
  assert.strictEqual(normalized.fbp, 'fb.1.1712345678.991283');
  assert.strictEqual(normalized.fbc, 'fb.1.1712345678.IwAR994821');
});

// 🧪 4. Performance & Latency Benchmark
console.log('\n🧪 4. Testing Edge Latency Benchmark (<10ms)...');

runTest('Universal Tag compilation executes in sub-5ms', () => {
  const start = Date.now();
  for (let i = 0; i < 50; i++) {
    ClientShieldGenerator.generateUniversalPixelTag({
      ...baseConfig,
      activePlatform: 'both'
    });
  }
  const avgLatency = (Date.now() - start) / 50;
  assert(avgLatency < 5, `Average latency must be under 5ms (Actual: ${avgLatency}ms)`);
});

console.log('\n========================================================================');
console.log(`  SUITE 27 COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✅`);
console.log('========================================================================\n');

