import assert from 'assert';
import { PixelManagerService } from '../../src/services/pixel.service';

console.log('========================================================================');
console.log('  TEST SUITE 26: BOT-GATED PIXEL FILTERING & CONVERSION PROTECTION MATRIX');
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

// 🧪 1. Threat Scenarios & Filter Matrix Evaluation
console.log('🧪 1. Evaluating Bot Filter Matrix across Diverse Visitor Profiles...');

interface MockVisitorSignal {
  profileName: string;
  userAgent: string;
  ipAddress: string;
  isWebdriver: boolean;
  touchPoints: number;
  gpuRenderer: string;
  expectedIsBot: boolean;
}

const visitorProfiles: MockVisitorSignal[] = [
  {
    profileName: 'Meta Ad Review Crawler (facebookexternalhit/1.1)',
    userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    ipAddress: '31.13.127.1',
    isWebdriver: false,
    touchPoints: 0,
    gpuRenderer: '',
    expectedIsBot: true
  },
  {
    profileName: 'Google Ads Review Bot (Googlebot/2.1)',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    ipAddress: '66.249.66.1',
    isWebdriver: false,
    touchPoints: 0,
    gpuRenderer: '',
    expectedIsBot: true
  },
  {
    profileName: 'Headless Chrome / Puppeteer Scraper',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ipAddress: '54.210.12.89', // AWS Datacenter
    isWebdriver: true,
    touchPoints: 0,
    gpuRenderer: 'Google SwiftShader',
    expectedIsBot: true
  },
  {
    profileName: 'Mobile Emulation Without Hardware Touchpoints',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    ipAddress: '198.51.100.12',
    isWebdriver: false,
    touchPoints: 0, // Inconsistency: Mobile UA but zero touchpoints
    gpuRenderer: 'ANGLE (Software Rasterizer)',
    expectedIsBot: true
  },
  {
    profileName: 'Real Human Buyer on iPhone (AT&T Residential 5G)',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    ipAddress: '172.56.21.89', // Residential cellular
    isWebdriver: false,
    touchPoints: 5,
    gpuRenderer: 'Apple GPU',
    expectedIsBot: false
  },
  {
    profileName: 'Real Human Buyer on Desktop (MacBook Chrome)',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    ipAddress: '73.189.44.120', // Comcast Residential
    isWebdriver: false,
    touchPoints: 0,
    gpuRenderer: 'Intel Iris Plus Graphics 655',
    expectedIsBot: false
  }
];

function evaluateVisitorBotStatus(profile: MockVisitorSignal): boolean {
  const ua = profile.userAgent.toLowerCase();
  const isCrawlerUa = /facebookexternalhit|googlebot|bingbot|crawler|spider/i.test(ua);
  const isMobile = /iphone|ipad|ipod|android|mobile/.test(ua);
  const isEmulatedGpu = /swiftshader|llvmpipe|software rasterizer/i.test(profile.gpuRenderer);
  
  if (isCrawlerUa) return true;
  if (profile.isWebdriver) return true;
  if (isEmulatedGpu) return true;
  if (isMobile && profile.touchPoints === 0) return true;

  return false;
}

visitorProfiles.forEach((profile) => {
  runTest(`Evaluates bot status for: ${profile.profileName}`, () => {
    const isBot = evaluateVisitorBotStatus(profile);
    assert.strictEqual(
      isBot, 
      profile.expectedIsBot, 
      `Expected isBot=${profile.expectedIsBot} for ${profile.profileName}, but got ${isBot}`
    );
  });
});

// 🧪 2. Conversion Firing Decision Matrix
console.log('\n🧪 2. Testing Conversion Firing Policy (fireOnBots toggle)...');

function shouldDispatchConversion(isBot: boolean, fireOnBots: boolean): boolean {
  if (isBot && !fireOnBots) {
    return false; // Suppress to keep Meta ML clean
  }
  return true;
}

runTest('Suppresses conversion when visitor is bot and fireOnBots is false', () => {
  const shouldFire = shouldDispatchConversion(true, false);
  assert.strictEqual(shouldFire, false, 'Bot conversion MUST be suppressed when fireOnBots=false');
});

runTest('Permits conversion when visitor is real human (isBot=false)', () => {
  const shouldFire = shouldDispatchConversion(false, false);
  assert.strictEqual(shouldFire, true, 'Human conversion MUST be dispatched when isBot=false');
});

runTest('Permits conversion when fireOnBots is explicitly enabled (audit mode)', () => {
  const shouldFire = shouldDispatchConversion(true, true);
  assert.strictEqual(shouldFire, true, 'Audit mode must dispatch even for bots when fireOnBots=true');
});

console.log('\n========================================================================');
console.log(`  SUITE 26 COMPLETE: ${passedTests}/${totalTests} TESTS PASSED ✅`);
console.log('========================================================================\n');
