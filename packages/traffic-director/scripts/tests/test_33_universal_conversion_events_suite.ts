import { ClientShieldGenerator } from '../../src/evaluator/client-shield-generator';

/**
 * Test Suite 33: Universal Conversion Events, URL Match Triggers & Heuristics
 */
async function runSuite33() {
  console.log('--- Running Test Suite 33: Universal Conversion Events, URL Triggers & Heuristics ---');

  let passed = 0;
  let failed = 0;

  function assert(desc: string, cond: boolean) {
    if (cond) {
      console.log(`  ✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  // Test 1: Generate Universal Pixel Tag with URL Match Trigger for Purchase
  const script = ClientShieldGenerator.generateUniversalPixelTag({
    slug: 'oldaagedonation',
    apiBaseUrl: 'https://api.180trafficdirector.pro',
    activePlatform: 'both',
    masterPixelId: '4841750582774042',
    backupPixelIds: [],
    enableCapi: true,
    googleConversionId: 'AW-123456789',
    googleConversionLabels: {
      Purchase: 'AW-123456789/PURCHASE_LABEL',
      Donate: 'AW-123456789/DONATE_LABEL'
    },
    enableGoogleEnhancedConversions: true,
    events: [
      {
        eventName: 'Purchase',
        triggerType: 'url_match',
        urlPattern: 'thankyou.html',
        eventValueKey: 'amount',
        currency: 'INR'
      },
      {
        eventName: 'Donate',
        triggerType: 'url_match',
        urlPattern: 'thankyou*',
        eventValueKey: 'amount',
        currency: 'INR'
      },
      {
        eventName: 'Lead',
        triggerType: 'form_submit',
        selector: '#donation-form'
      },
      {
        eventName: 'InitiateCheckout',
        triggerType: 'click',
        selector: '.donate-btn'
      }
    ]
  });

  assert('Universal script generated successfully', typeof script === 'string' && script.length > 500);
  assert('Contains Meta Pixel fbevents.js initialization', script.includes('fbevents.js') && script.includes('4841750582774042'));
  assert('Contains Google Tag gtag.js initialization', script.includes('googletagmanager.com/gtag/js?id=') && script.includes('AW-123456789'));
  assert('Contains evaluateUrlTriggers function', script.includes('evaluateUrlTriggers'));
  assert('Contains query parameter extraction logic', script.includes('qParams') && script.includes('txnid'));
  assert('Contains dynamic amount/value parsing', script.includes('rule.eventValueKey') && script.includes('queryParams[\'amount\']') || script.includes('qParams[\'amount\']'));
  assert('Contains Enhanced Conversions user extraction for name, phone, email', script.includes('firstName') && script.includes('phone') && script.includes('email'));
  assert('Maps Meta Purchase/Donate to Google Ads standard conversion events', script.includes('gStandardEvents') && script.includes('\'Purchase\': \'purchase\''));
  assert('Includes global programmatic bridge hook _td_track and _td_convert', script.includes('w._td_track') && script.includes('w._td_convert'));
  assert('Hooks into SPA router history.pushState and popstate for dynamic URL match', script.includes('origPush') && script.includes('evaluateUrlTriggers()'));

  console.log(`\nSuite 33 Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runSuite33().catch(err => {
  console.error(err);
  process.exit(1);
});
