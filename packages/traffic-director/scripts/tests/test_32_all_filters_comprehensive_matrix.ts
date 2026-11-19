import assert from 'assert';
import { DecisionEngine } from '../../src/evaluator/decision-engine';
import { ExtractedSignals, RuleCondition } from '../../src/types';

console.log('========================================================================');
console.log(' TEST SUITE 32: COMPREHENSIVE 25-CRITERIA & 10-OPERATOR FILTER MATRIX   ');
console.log('========================================================================\n');

let totalAssertions = 0;
let passedAssertions = 0;

function check(desc: string, actual: boolean, expected: boolean = true) {
  totalAssertions++;
  if (actual === expected) {
    passedAssertions++;
  } else {
    console.error(`❌ FAILED: ${desc} (Expected: ${expected}, Got: ${actual})`);
    assert.strictEqual(actual, expected, desc);
  }
}

// Rich test signal representing a genuine high-value visitor
const sampleSignals: ExtractedSignals = {
  ipAddress: '198.51.100.24',
  country: 'US',
  region: 'California',
  city: 'San Francisco',
  postalCode: '94107',
  timezone: 'America/Los_Angeles',
  deviceType: 'mobile',
  os: 'iOS',
  browser: 'Safari',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  referrer: 'https://www.instagram.com/p/viral-reel',
  isBot: false,
  language: 'en-US',
  networkType: '4g',
  asn: 'AS7922',
  asnOrg: 'Comcast Cable Communications',
  isp: 'Comcast Cable',
  isVpn: false,
  isTor: false,
  isSpyService: false,
  hasTimezoneDelta: false,
  touchPoints: 5,
  gpuRenderer: 'Apple GPU',
  batteryLevel: 0.82,
  isEmulated: false,
  headers: {
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124"',
    'sec-ch-ua-mobile': '?1',
    'x-affiliate-id': 'aff-98214',
    'accept-language': 'en-US,en;q=0.9'
  },
  queryParams: {
    utm_source: 'instagram',
    utm_campaign: 'spring_sale_2026',
    click_id: 'clk_xyz_8829'
  },
  timestamp: new Date()
};

const evalCond = (cond: RuleCondition, signals: ExtractedSignals = sampleSignals): boolean => {
  return DecisionEngine.evaluateCondition(cond, signals);
};

// ============================================================================
// PART 1: ALL 25 SIGNAL CRITERIA TESTING
// ============================================================================
console.log('🧪 1. Testing All 25 Signal Criteria Against Real Signals...');

// 1. geo_country
check('geo_country equals US', evalCond({ type: 'geo_country', operator: 'equals', value: 'US' }), true);
check('geo_country not_equals CA', evalCond({ type: 'geo_country', operator: 'not_equals', value: 'CA' }), true);
check('geo_country in US,GB,DE', evalCond({ type: 'geo_country', operator: 'in', value: 'US,GB,DE' }), true);
check('geo_country not_in FR,IT', evalCond({ type: 'geo_country', operator: 'not_in', value: 'FR,IT' }), true);

// 2. geo_region
check('geo_region equals California', evalCond({ type: 'geo_region', operator: 'equals', value: 'California' }), true);
check('geo_region contains Calif', evalCond({ type: 'geo_region', operator: 'contains', value: 'Calif' }), true);
check('geo_region not_equals Texas', evalCond({ type: 'geo_region', operator: 'not_equals', value: 'Texas' }), true);

// 3. geo_city
check('geo_city equals San Francisco', evalCond({ type: 'geo_city', operator: 'equals', value: 'San Francisco' }), true);
check('geo_city starts_with San', evalCond({ type: 'geo_city', operator: 'starts_with', value: 'San' }), true);
check('geo_city regex ^San [A-Z]', evalCond({ type: 'geo_city', operator: 'regex', value: '^San [A-Z]' }), true);

// 4. geo_postal_code
check('geo_postal_code equals 94107', evalCond({ type: 'geo_postal_code', operator: 'equals', value: '94107' }), true);
check('geo_postal_code in 94107,94108', evalCond({ type: 'geo_postal_code', operator: 'in', value: ['94107', '94108'] }), true);
check('geo_postal_code not_equals 90210', evalCond({ type: 'geo_postal_code', operator: 'not_equals', value: '90210' }), true);

// 5. geo_timezone
check('geo_timezone equals America/Los_Angeles', evalCond({ type: 'geo_timezone', operator: 'equals', value: 'America/Los_Angeles' }), true);
check('geo_timezone contains Los_Angeles', evalCond({ type: 'geo_timezone', operator: 'contains', value: 'Los_Angeles' }), true);

// 6. device_type
check('device_type equals mobile', evalCond({ type: 'device_type', operator: 'equals', value: 'mobile' }), true);
check('device_type not_equals desktop', evalCond({ type: 'device_type', operator: 'not_equals', value: 'desktop' }), true);

// 7. os
check('os equals iOS', evalCond({ type: 'os', operator: 'equals', value: 'iOS' }), true);
check('os in iOS,Android', evalCond({ type: 'os', operator: 'in', value: 'iOS,Android' }), true);

// 8. browser
check('browser equals Safari', evalCond({ type: 'browser', operator: 'equals', value: 'Safari' }), true);
check('browser contains saf', evalCond({ type: 'browser', operator: 'contains', value: 'saf' }), true);

// 9. bot_status
check('bot_status equals human', evalCond({ type: 'bot_status', operator: 'equals', value: 'human' }), true);
check('bot_status not_equals bot', evalCond({ type: 'bot_status', operator: 'not_equals', value: 'bot' }), true);
const botSignal = { ...sampleSignals, isBot: true };
check('bot_status bot matches bot signal', evalCond({ type: 'bot_status', operator: 'equals', value: 'bot' }, botSignal), true);

// 10. network_type
check('network_type equals 4g', evalCond({ type: 'network_type', operator: 'equals', value: '4g' }), true);
check('network_type in 4g,5g,wifi', evalCond({ type: 'network_type', operator: 'in', value: ['4g', '5g', 'wifi'] }), true);

// 11. asn_provider
check('asn_provider contains Comcast', evalCond({ type: 'asn_provider', operator: 'contains', value: 'Comcast' }), true);
check('asn_provider not_contains AWS', evalCond({ type: 'asn_provider', operator: 'not_contains', value: 'AWS' }), true);

// 12. isp_provider
check('isp_provider equals Comcast Cable', evalCond({ type: 'isp_provider', operator: 'equals', value: 'Comcast Cable' }), true);

// 13. spy_service
check('spy_service matches false/clean', evalCond({ type: 'spy_service', operator: 'equals', value: 'false' }), true);
const spySignal = { ...sampleSignals, isSpyService: true };
check('spy_service matches true for ad spy detection', evalCond({ type: 'spy_service', operator: 'equals', value: 'true' }, spySignal), true);

// 14. vpn_status
check('vpn_status matches false for clean visitor', evalCond({ type: 'vpn_status', operator: 'equals', value: 'false' }), true);
const vpnSignal = { ...sampleSignals, isVpn: true };
check('vpn_status matches true when VPN detected', evalCond({ type: 'vpn_status', operator: 'equals', value: 'true' }, vpnSignal), true);

// 15. timezone_delta
check('timezone_delta matches false when system & geo clocks align', evalCond({ type: 'timezone_delta', operator: 'equals', value: 'false' }), true);
const deltaSignal = { ...sampleSignals, hasTimezoneDelta: true };
check('timezone_delta matches true when proxy clock desync detected', evalCond({ type: 'timezone_delta', operator: 'equals', value: 'true' }, deltaSignal), true);

// 16. threat_list
check('threat_list returns false for clean residential visitor', evalCond({ type: 'threat_list', operator: 'equals', value: 'true' }), false);

// 17. touch_support
check('touch_support is true for real mobile with touchPoints > 0', evalCond({ type: 'touch_support', operator: 'equals', value: 'true' }), true);
const noTouchSignal = { ...sampleSignals, touchPoints: 0, deviceType: 'desktop' };
check('touch_support is false for desktop without touch', evalCond({ type: 'touch_support', operator: 'equals', value: 'false' }, noTouchSignal), true);

// 18. gpu_renderer
check('gpu_renderer contains Apple GPU', evalCond({ type: 'gpu_renderer', operator: 'contains', value: 'Apple GPU' }), true);
check('gpu_renderer not_contains SwiftShader', evalCond({ type: 'gpu_renderer', operator: 'not_contains', value: 'SwiftShader' }), true);

// 19. battery_valid
check('battery_valid is true for 82% battery level', evalCond({ type: 'battery_valid', operator: 'equals', value: 'true' }), true);

// 20. language
check('language equals en-US', evalCond({ type: 'language', operator: 'equals', value: 'en-US' }), true);
check('language starts_with en', evalCond({ type: 'language', operator: 'starts_with', value: 'en' }), true);

// 21. referrer
check('referrer contains instagram.com', evalCond({ type: 'referrer', operator: 'contains', value: 'instagram.com' }), true);
check('referrer not_contains google.com', evalCond({ type: 'referrer', operator: 'not_contains', value: 'google.com' }), true);

// 22. sec_ch_ua
check('sec_ch_ua contains Chromium', evalCond({ type: 'sec_ch_ua', operator: 'contains', value: 'Chromium' }), true);

// 23. ip_address
check('ip_address starts_with 198.51', evalCond({ type: 'ip_address', operator: 'starts_with', value: '198.51' }), true);
check('ip_address equals 198.51.100.24', evalCond({ type: 'ip_address', operator: 'equals', value: '198.51.100.24' }), true);

// 24. header
check('header x-affiliate-id equals aff-98214', evalCond({ type: 'header', key: 'x-affiliate-id', operator: 'equals', value: 'aff-98214' }), true);
check('header x-affiliate-id starts_with aff-', evalCond({ type: 'header', key: 'x-affiliate-id', operator: 'starts_with', value: 'aff-' }), true);
check('header missing-header not_exists', evalCond({ type: 'header', key: 'missing-header', operator: 'not_exists', value: '' }), true);

// 25. query_param
check('query_param utm_source equals instagram', evalCond({ type: 'query_param', key: 'utm_source', operator: 'equals', value: 'instagram' }), true);
check('query_param utm_campaign contains spring', evalCond({ type: 'query_param', key: 'utm_campaign', operator: 'contains', value: 'spring' }), true);
check('query_param click_id exists', evalCond({ type: 'query_param', key: 'click_id', operator: 'exists', value: '' }), true);
check('query_param nonexistent not_exists', evalCond({ type: 'query_param', key: 'nonexistent', operator: 'not_exists', value: '' }), true);

console.log(`  ✅ All 25 criteria passed verification! (${passedAssertions}/${totalAssertions} assertions)\n`);

// ============================================================================
// PART 2: ALL 10 OPERATORS IN-DEPTH MATRIX
// ============================================================================
console.log('🧪 2. Testing All 10 Operators Across Positive & Negative Boundaries...');

// 1. equals
check('equals (positive match)', evalCond({ type: 'geo_city', operator: 'equals', value: 'San Francisco' }), true);
check('equals (negative mismatch)', evalCond({ type: 'geo_city', operator: 'equals', value: 'Chicago' }), false);
check('equals (case insensitive)', evalCond({ type: 'geo_city', operator: 'equals', value: 'san francisco' }), true);
check('equals (comma-separated fallback list)', evalCond({ type: 'geo_city', operator: 'equals', value: 'New York, San Francisco, Miami' }), true);

// 2. not_equals
check('not_equals (positive difference)', evalCond({ type: 'geo_city', operator: 'not_equals', value: 'Boston' }), true);
check('not_equals (negative identical)', evalCond({ type: 'geo_city', operator: 'not_equals', value: 'San Francisco' }), false);

// 3. starts_with
check('starts_with (positive prefix)', evalCond({ type: 'referrer', operator: 'starts_with', value: 'https://www.instagram' }), true);
check('starts_with (negative prefix)', evalCond({ type: 'referrer', operator: 'starts_with', value: 'https://facebook' }), false);

// 4. contains
check('contains (positive substring)', evalCond({ type: 'referrer', operator: 'contains', value: 'viral-reel' }), true);
check('contains (negative substring)', evalCond({ type: 'referrer', operator: 'contains', value: 'tiktok-feed' }), false);

// 5. not_contains
check('not_contains (positive omission)', evalCond({ type: 'asn_provider', operator: 'not_contains', value: 'DigitalOcean' }), true);
check('not_contains (negative presence)', evalCond({ type: 'asn_provider', operator: 'not_contains', value: 'Comcast' }), false);

// 6. in
check('in (positive comma string)', evalCond({ type: 'device_type', operator: 'in', value: 'mobile, tablet' }), true);
check('in (positive string array)', evalCond({ type: 'device_type', operator: 'in', value: ['mobile', 'tablet'] }), true);
check('in (negative absence)', evalCond({ type: 'device_type', operator: 'in', value: ['desktop', 'smarttv'] }), false);

// 7. not_in
check('not_in (positive absence)', evalCond({ type: 'geo_country', operator: 'not_in', value: ['RU', 'CN', 'KP'] }), true);
check('not_in (negative inclusion)', evalCond({ type: 'geo_country', operator: 'not_in', value: ['US', 'GB'] }), false);

// 8. regex
check('regex (positive pattern)', evalCond({ type: 'query_param', key: 'click_id', operator: 'regex', value: '^clk_[a-z]+_[0-9]+$' }), true);
check('regex (negative pattern)', evalCond({ type: 'query_param', key: 'click_id', operator: 'regex', value: '^[0-9]+$' }), false);

// 9. exists
check('exists (positive key present)', evalCond({ type: 'header', key: 'x-affiliate-id', operator: 'exists', value: '' }), true);
check('exists (negative key absent)', evalCond({ type: 'header', key: 'x-non-existent-header', operator: 'exists', value: '' }), false);

// 10. not_exists
check('not_exists (positive key absent)', evalCond({ type: 'header', key: 'x-fake-token', operator: 'not_exists', value: '' }), true);
check('not_exists (negative key present)', evalCond({ type: 'header', key: 'x-affiliate-id', operator: 'not_exists', value: '' }), false);

console.log(`  ✅ All 10 operators passed boundary verification!\n`);

// ============================================================================
// PART 3: COMPOUND AND/OR MULTI-CONDITION RULE MATRIX
// ============================================================================
console.log('🧪 3. Testing Compound Multi-Condition Rule Priorities & Fail-Safes...');

const testLink = {
  id: 'link-matrix-test',
  fallbackUrl: 'https://brand-safe-landing.com',
  isActive: true,
  rules: [
    {
      id: 'rule-test-compound',
      name: 'US iOS Mobile High Value',
      priority: 1,
      actionType: 'redirect_302',
      destinationUrl: 'https://brand-offer.com/vip',
      isActive: true,
      weight: 100,
      conditions: [
        { type: 'geo_country', operator: 'equals', value: 'US' },
        { type: 'device_type', operator: 'equals', value: 'mobile' },
        { type: 'os', operator: 'equals', value: 'iOS' },
        { type: 'bot_status', operator: 'equals', value: 'human' }
      ]
    }
  ]
};

// Evaluate rule with all 4 matching conditions
const compoundResult = DecisionEngine.evaluate(testLink as any, sampleSignals);
check('Compound rule with 4 matching conditions matches target URL', compoundResult.destinationUrl === 'https://brand-offer.com/vip', true);
check('Compound rule matched isFallback is false', compoundResult.isFallback === false, true);

// One condition failing (e.g. Bot detected)
const botSignals = { ...sampleSignals, isBot: true };
const botCompoundResult = DecisionEngine.evaluate(testLink as any, botSignals);
check('Compound rule with bot visitor falls back to safe landing page', botCompoundResult.destinationUrl === 'https://brand-safe-landing.com', true);
check('Compound rule for bot isFallback is true', botCompoundResult.isFallback === true, true);

// One condition failing (e.g. Country mismatch)
const ukSignals = { ...sampleSignals, country: 'GB' };
const ukCompoundResult = DecisionEngine.evaluate(testLink as any, ukSignals);
check('Compound rule with country mismatch falls back to safe landing page', ukCompoundResult.destinationUrl === 'https://brand-safe-landing.com', true);
check('Compound rule for country mismatch isFallback is true', ukCompoundResult.isFallback === true, true);

console.log('========================================================================');
console.log(`  SUITE 32 COMPLETE: ${passedAssertions}/${totalAssertions} ASSERTIONS PASSED (100% SUCCESS) ✅`);
console.log('========================================================================');
