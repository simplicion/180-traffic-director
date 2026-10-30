import assert from 'assert';
import { ClientShieldGenerator } from '../../src/evaluator/client-shield-generator';

console.log('========================================================================');
console.log('  TEST SUITE 25: UNIVERSAL STEALTH PIXEL SCRIPT TAG GENERATION BENCHMARK ');
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

// 🧪 1. Tag Generation & Multi-Pixel Broadcast
console.log('🧪 1. Testing Dynamic Tag Compilation & Multi-Pixel Injection...');

const mockConfig = {
  slug: 'promo-summer-2026',
  apiBaseUrl: 'https://edge.180trafficdirector.pro',
  masterPixelId: '112233445566778',
  backupPixelIds: ['998877665544332', '554433221100998'],
  fireOnBots: false,
  trackPageViews: true,
  trackOutbound: true,
  events: [
    {
      eventName: 'Lead',
      triggerType: 'form_submit',
      selector: '#lead-capture-form'
    },
    {
      eventName: 'AddToCart',
      triggerType: 'click',
      selector: '.add-to-cart-btn'
    }
  ],
  enableCapi: true
};

runTest('Generates valid stealth JavaScript tag with multi-pixel initialization', () => {
  const startTime = Date.now();
  const scriptJs = ClientShieldGenerator.generateUniversalPixelTag(mockConfig);
  const latencyMs = Date.now() - startTime;

  assert(typeof scriptJs === 'string' && scriptJs.length > 500, 'Compiled script must be non-empty JS');
  assert(latencyMs < 10, `Compilation latency must be sub-10ms (Actual: ${latencyMs}ms)`);

  // Verify Master and Backup pixel initialization
  assert(scriptJs.includes('112233445566778'), 'Must include Master Pixel ID');
  assert(scriptJs.includes('998877665544332'), 'Must include Backup Pixel 1');
  assert(scriptJs.includes('554433221100998'), 'Must include Backup Pixel 2');
  assert(scriptJs.includes("w.fbq('init', _pixels[i])"), 'Must loop over and initialize all configured pixels');
});

runTest('Embeds automated event listeners & triggers', () => {
  const scriptJs = ClientShieldGenerator.generateUniversalPixelTag(mockConfig);

  // Form submission listener
  assert(scriptJs.includes("d.addEventListener('submit'"), 'Must include automated form submission listener');
  assert(scriptJs.includes('#lead-capture-form'), 'Must include custom form selector');

  // Click trigger listener
  assert(scriptJs.includes("d.addEventListener('click'"), 'Must include automated click trigger listener');
  assert(scriptJs.includes('.add-to-cart-btn'), 'Must include custom click selector');

  // SPA Route Change interception
  assert(scriptJs.includes('w.history.pushState'), 'Must intercept SPA pushState for zero-refresh route tracking');
  assert(scriptJs.includes("w.addEventListener('popstate'"), 'Must intercept browser popstate navigation');
});

runTest('Integrates bot shield hardware telemetry probes', () => {
  const scriptJs = ClientShieldGenerator.generateUniversalPixelTag(mockConfig);

  // Touchpoint heuristic
  assert(scriptJs.includes('maxTouchPoints'), 'Must inspect client touchpoints for mobile emulation detection');

  // Webdriver heuristic
  assert(scriptJs.includes('navigator.webdriver'), 'Must check for automation driver');

  // Software renderer probe
  assert(scriptJs.includes('swiftshader'), 'Must check against cloud datacenter SwiftShader GPU emulators');

  // Bot-suppression logic
  assert(scriptJs.includes('if (isBot && !_fireOnBots)'), 'Must suppress conversion firing on bot detected');
});

runTest('Generates unique deterministic eventID for deduplication', () => {
  const scriptJs = ClientShieldGenerator.generateUniversalPixelTag(mockConfig);

  assert(scriptJs.includes('genEventId'), 'Must define event ID generator');
  assert(scriptJs.includes("w.fbq('track', eventName, customData, { eventID: eventId })"), 'Must pass eventID to browser fbq');
  assert(scriptJs.includes("fetch(_bUrl + '/api/v1/traffic-director/pixel/event'"), 'Must forward eventId to server CAPI');
});

console.log('\n========================================================================');
console.log(`  SUITE 25 COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✅`);
console.log('========================================================================\n');
