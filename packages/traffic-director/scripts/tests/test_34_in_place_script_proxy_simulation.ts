import { ClientShieldGenerator } from '../../src/evaluator/client-shield-generator';
import { DecisionEngine } from '../../src/evaluator/decision-engine';

/**
 * Test Suite 34: In-Place Reverse Proxy Delivery via Script Injection Tag & Live Evaluator Simulation
 */
async function runSuite34() {
  console.log('--- Running Test Suite 34: In-Place Reverse Proxy Script Tag Simulation ---');

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

  // 1. Generate Dynamic Client Script Tag
  const script = ClientShieldGenerator.generateSelfHostedPixelJs({
    slug: 'bookselling',
    apiBaseUrl: 'https://api.180trafficdirector.pro',
    obfuscate: false
  });

  assert('Dynamic tag script generated successfully', typeof script === 'string' && script.length > 500);
  assert('Script calls /api/v1/traffic-director/evaluate/bookselling', script.includes('/api/v1/traffic-director/evaluate/'));
  assert('Script checks data.actionType for proxy_target_offer and rewrite', script.includes('proxy_target_offer') && script.includes('rewrite'));
  assert('Script creates in-place full-screen viewport iframe when proxy is selected', script.includes('document.createElement(\'iframe\')') && script.includes('position:fixed;top:0;left:0;width:100vw;height:100vh'));
  assert('Script applies security sandbox attributes on in-place frame', script.includes('allow-scripts') && script.includes('allow-forms'));
  assert('Script contains mountFrame helper with DOMContentLoaded fallback', script.includes('mountFrame') && script.includes('document.body.style.overflow = \'hidden\''));
  assert('Script retains window.location.replace for 302 redirect rules', script.includes('window.location.replace(data.destinationUrl)'));

  // 2. Decision Engine Simulation for In-Place Proxy vs Redirect
  const mockLink = {
    id: 'test-link-1',
    fallbackUrl: 'https://clean-safe-page.com',
    isActive: true,
    safePageProxyMode: true,
    rules: [
      {
        id: 'rule-proxy',
        priority: 1,
        name: 'Mobile In-Place Reverse Proxy',
        destinationUrl: 'https://extra-works.vercel.app/',
        actionType: 'proxy_target_offer',
        weight: 100,
        isActive: true,
        conditions: [
          {
            type: 'device_type',
            operator: 'equals',
            value: 'mobile'
          }
        ]
      }
    ]
  };

  // 2a. Mobile Human Visitor -> Target Offer with proxy_target_offer actionType
  const mobileSignals: any = {
    deviceType: 'mobile',
    isBot: false,
    isDatacenter: false,
    isVpn: false,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
  };

  const mobileResult = DecisionEngine.evaluate(mockLink, mobileSignals);
  assert('Mobile human evaluates to route: target', mobileResult.isFallback === false && mobileResult.destinationUrl === 'https://extra-works.vercel.app/');
  assert('Mobile human returns actionType: proxy_target_offer for in-place cloaking', mobileResult.actionType === 'proxy_target_offer');

  // 2b. Desktop / PC Visitor -> Falls back to safe page
  const desktopSignals: any = {
    deviceType: 'desktop',
    isBot: false,
    isDatacenter: false,
    isVpn: false,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  };

  const desktopResult = DecisionEngine.evaluate(mockLink, desktopSignals);
  assert('Desktop visitor evaluates to route: fallback', desktopResult.isFallback === true && desktopResult.destinationUrl === 'https://clean-safe-page.com');
  assert('Desktop visitor receives proxy_safe_page actionType', desktopResult.actionType === 'proxy_safe_page');

  // 2c. Meta Reviewer Bot -> Falls back to safe page
  const metaBotSignals: any = {
    deviceType: 'mobile',
    isBot: true,
    botName: 'FacebookExternalHit',
    isDatacenter: true,
    userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
  };

  const botResult = DecisionEngine.evaluate(mockLink, metaBotSignals);
  assert('Meta crawler evaluates to route: fallback', botResult.isFallback === true && botResult.destinationUrl === 'https://clean-safe-page.com');

  console.log(`\nSuite 34 Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runSuite34().catch(err => {
  console.error(err);
  process.exit(1);
});
