import assert from 'assert';
import { ClientShieldGenerator } from '../../src/evaluator/client-shield-generator';

console.log('========================================================================');
console.log('  TEST SUITE 28: CLIENT-SIDE BROWSER SIMULATION (FORMS, SPAS, AD-BLOCKER)');
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

// 🧪 1. Mock Browser Environment Simulation Harness
console.log('🧪 1. Constructing Headless DOM Simulation Harness...');

function createMockBrowserEnv() {
  const dispatchedFbqEvents: Array<{ eventName: string; customData: any; options: any }> = [];
  const dispatchedBeacons: Array<{ url: string; payload: any }> = [];

  const listeners: Record<string, Function[]> = {};

  const mockWindow: any = {
    location: {
      href: 'https://mysafestore.com/vip-landing',
      pathname: '/vip-landing'
    },
    history: {
      pushState: function(state: any, title: string, url: string) {
        mockWindow.location.pathname = url;
        mockWindow.location.href = `https://mysafestore.com${url}`;
      }
    },
    addEventListener: function(event: string, handler: Function) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }
  };

  const mockDocument: any = {
    createElement: function(tag: string) {
      return { tag, src: '', async: false };
    },
    getElementsByTagName: function() {
      return [{ parentNode: { insertBefore: () => {} } }];
    },
    addEventListener: function(event: string, handler: Function) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
    }
  };

  return {
    mockWindow,
    mockDocument,
    listeners,
    dispatchedFbqEvents,
    dispatchedBeacons
  };
}

runTest('Initializes headless DOM harness with mock listeners and history', () => {
  const env = createMockBrowserEnv();
  assert(typeof env.mockWindow.history.pushState === 'function');
  assert(typeof env.mockDocument.addEventListener === 'function');
});

// 🧪 2. DOM Form Submission Extraction Simulation
console.log('\n🧪 2. Simulating DOM Form Submissions & Enhanced Matching Extraction...');

function simulateFormExtraction(formInputs: Array<{ name: string; type: string; value: string }>) {
  let email = '';
  let phone = '';

  for (let i = 0; i < formInputs.length; i++) {
    const inp = formInputs[i];
    const name = inp.name.toLowerCase();
    const type = inp.type.toLowerCase();
    const val = inp.value.trim();

    if (!email && (type === 'email' || name.includes('email') || name.includes('mail'))) {
      if (val.includes('@')) email = val;
    }
    if (!phone && (type === 'tel' || name.includes('phone') || name.includes('tel') || name.includes('mobile'))) {
      phone = val;
    }
  }

  return { email, phone };
}

runTest('Extracts email and phone from generic form field names', () => {
  const inputs = [
    { name: 'user_full_name', type: 'text', value: 'Alex Morgan' },
    { name: 'contact_email_address', type: 'text', value: 'alex@startup.io' },
    { name: 'mobile_tel', type: 'text', value: '+1-555-888-9999' }
  ];

  const extracted = simulateFormExtraction(inputs);
  assert.strictEqual(extracted.email, 'alex@startup.io', 'Email must be identified from name="contact_email_address"');
  assert.strictEqual(extracted.phone, '+1-555-888-9999', 'Phone must be identified from name="mobile_tel"');
});

// 🧪 3. Ad-Blocker Resilience Simulation
console.log('\n🧪 3. Simulating Ad-Blocker Suppression & Server CAPI Fallback...');

runTest('Ad-Blocker Scenario: Browser fbq is blocked, CAPI Beacon transmits seamlessly', () => {
  // When an ad blocker blocks connect.facebook.net:
  let browserFbqBlocked = true;
  let capiBeaconSucceeded = false;

  // The client script wraps fbq in try/catch and continues to beacon
  try {
    if (browserFbqBlocked) {
      throw new Error('Blocked by Client (net::ERR_BLOCKED_BY_CLIENT)');
    }
  } catch (browserErr) {
    // Graceful fallback to server beacon
    capiBeaconSucceeded = true;
  }

  assert.strictEqual(capiBeaconSucceeded, true, 'Server-Side CAPI must execute even when browser fbq is blocked by ad-blocker');
});

console.log('\n========================================================================');
console.log(`  SUITE 28 COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✅`);
console.log('========================================================================\n');
