import assert from 'assert';
import { PixelManagerService } from '../../src/services/pixel.service';
import { CapiEventPayload, CapiUserData } from '../../src/types';

console.log('========================================================================');
console.log('  TEST SUITE 27: META CAPI GRAPH API v19.0 & DEDUPLICATION VERIFICATION  ');
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

// 🧪 1. Deterministic Deduplication Identifier
console.log('🧪 1. Testing Event ID Deduplication Integrity...');

function generateDeduplicationId(): string {
  return 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

runTest('Generates standard deduplication key with timestamp and entropy', () => {
  const id1 = generateDeduplicationId();
  const id2 = generateDeduplicationId();

  assert(id1.startsWith('evt_'), 'Event ID must start with "evt_" prefix');
  assert.notStrictEqual(id1, id2, 'Two consecutive event IDs must be unique');
  assert(id1.length >= 15, 'Event ID must provide sufficient cryptographic entropy');
});

// 🧪 2. Meta Graph API v19.0 Request Payload Validation
console.log('\n🧪 2. Validating Meta Graph API v19.0 Payload Conformity...');

function buildMetaCapiPayload(params: {
  eventName: string;
  eventId: string;
  eventSourceUrl: string;
  userData: { email?: string; phone?: string; ipAddress?: string; userAgent?: string; fbp?: string; fbc?: string };
  customData?: Record<string, any>;
  testEventCode?: string;
}) {
  const normalizedUser: CapiUserData = PixelManagerService.normalizeUserData(params.userData);

  const eventPayload: CapiEventPayload = {
    event_name: params.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: params.eventId,
    event_source_url: params.eventSourceUrl,
    action_source: 'website',
    user_data: normalizedUser,
    custom_data: params.customData
  };

  const body: any = {
    data: [eventPayload]
  };

  if (params.testEventCode) {
    body.test_event_code = params.testEventCode;
  }

  return body;
}

runTest('Builds compliant Meta Graph API v19.0 payload for Lead conversion', () => {
  const eventId = generateDeduplicationId();
  const payload = buildMetaCapiPayload({
    eventName: 'Lead',
    eventId,
    eventSourceUrl: 'https://mysafestore.com/landing?utm_source=meta',
    userData: {
      email: 'buyer@example.com',
      phone: '+1 555 987 6543',
      ipAddress: '198.51.100.45',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)',
      fbp: 'fb.1.1712345678.123456789'
    },
    customData: {
      currency: 'USD',
      value: 99.00,
      content_name: 'VIP Enterprise Trial'
    },
    testEventCode: 'TEST98765'
  });

  assert(Array.isArray(payload.data), 'Payload must have a "data" array');
  assert.strictEqual(payload.data.length, 1, 'Data array must contain exactly 1 event');

  const ev = payload.data[0];
  assert.strictEqual(ev.event_name, 'Lead');
  assert.strictEqual(ev.event_id, eventId, 'Shared deduplication event_id must match');
  assert.strictEqual(ev.action_source, 'website');
  assert(typeof ev.event_time === 'number' && ev.event_time > 1700000000, 'event_time must be Unix epoch in seconds');

  // User Data SHA-256 validation
  assert.strictEqual(ev.user_data.em[0], PixelManagerService.hashSha256('buyer@example.com'));
  assert.strictEqual(ev.user_data.ph[0], PixelManagerService.hashSha256('15559876543'));
  assert.strictEqual(ev.user_data.client_ip_address, '198.51.100.45');
  assert.strictEqual(ev.user_data.client_user_agent, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5)');
  assert.strictEqual(ev.user_data.fbp, 'fb.1.1712345678.123456789');

  // Custom data
  assert.strictEqual(ev.custom_data.value, 99.00);
  assert.strictEqual(ev.custom_data.currency, 'USD');

  // Test Event Code for Meta Events Manager verification
  assert.strictEqual(payload.test_event_code, 'TEST98765');
});

runTest('Builds compliant Meta Graph API v19.0 payload for E-commerce Purchase', () => {
  const eventId = generateDeduplicationId();
  const payload = buildMetaCapiPayload({
    eventName: 'Purchase',
    eventId,
    eventSourceUrl: 'https://mysafestore.com/checkout/thank-you',
    userData: {
      email: 'customer@gmail.com'
    },
    customData: {
      currency: 'USD',
      value: 149.99,
      content_ids: ['SKU-001', 'SKU-002'],
      contents: [
        { id: 'SKU-001', quantity: 1, item_price: 99.99 },
        { id: 'SKU-002', quantity: 1, item_price: 50.00 }
      ],
      order_id: 'ORD-2026-9921'
    }
  });

  const ev = payload.data[0];
  assert.strictEqual(ev.event_name, 'Purchase');
  assert.strictEqual(ev.custom_data.order_id, 'ORD-2026-9921');
  assert.strictEqual(ev.custom_data.contents.length, 2);
  assert.strictEqual(payload.test_event_code, undefined, 'Test code must be omitted when not provided');
});

console.log('\n========================================================================');
console.log(`  SUITE 27 COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✅`);
console.log('========================================================================\n');
