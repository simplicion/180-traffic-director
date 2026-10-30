import { DecisionEngine } from '../../src/evaluator/decision-engine';
import { ThreatIntelligenceService } from '../../src/services/threat-intelligence.service';
import { 
  ExtractedSignals, 
  DEFAULT_LINK_THREAT_FEEDS, 
  CustomThreatEntry 
} from '../../src/types';

function createMockSignals(overrides: Partial<ExtractedSignals> = {}): ExtractedSignals {
  return {
    ipAddress: '104.28.19.45',
    country: 'US',
    city: 'Los Angeles',
    deviceType: 'mobile',
    os: 'iOS',
    browser: 'Mobile Safari',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
    referrer: 'https://instagram.com',
    isBot: false,
    language: 'en-US',
    networkType: 'cellular',
    headers: {},
    queryParams: {},
    timestamp: new Date(),
    ...overrides
  };
}

function createMockLink(overrides: any = {}): any {
  return {
    id: 'link_test_per_link_threats',
    userId: 'user_180_enterprise',
    name: 'Enterprise Cloaked Offer',
    slug: 'per-link-threat-demo',
    fallbackUrl: 'https://clean-safe-page.org/wellness',
    isActive: true,
    shieldMode: 'server',
    datacenterBlocked: true,
    rampUpEnabled: false,
    threatFeeds: { ...DEFAULT_LINK_THREAT_FEEDS },
    customThreatList: [],
    rules: [
      {
        id: 'rule_money_page',
        name: 'Target Money Offer',
        priority: 1,
        isActive: true,
        destinationUrl: 'https://secret-money-page.com/offer',
        actionType: 'redirect_302',
        conditions: [],
        weight: 100
      }
    ],
    ...overrides
  };
}

async function runTestBattery() {
  console.log('========================================================================');
  console.log('   SUITE 31: PER-LINK THREAT INTELLIGENCE & SHIELD EVALUATION BATTERY   ');
  console.log('========================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testId: string, testName: string, details?: string) {
    total++;
    if (condition) {
      passed++;
      console.log(`  \x1b[32m✔ PASS\x1b[0m [${testId}] ${testName}`);
    } else {
      console.log(`  \x1b[31m✖ FAIL\x1b[0m [${testId}] ${testName}`);
      if (details) console.log(`         \x1b[33m${details}\x1b[0m`);
    }
  }

  // -------------------------------------------------------------------------
  // TEST 31.1: Default Threat Feeds Configuration on Link Creation
  // -------------------------------------------------------------------------
  const defaultFeeds = DEFAULT_LINK_THREAT_FEEDS;
  const allSixEnabled = 
    defaultFeeds.meta_reviewers === true &&
    defaultFeeds.google_compliance === true &&
    defaultFeeds.tiktok_qa === true &&
    defaultFeeds.spy_scrapers === true &&
    defaultFeeds.tor_network === true &&
    defaultFeeds.cloud_datacenters === true;

  assert(allSixEnabled, '31.1', 'Default Threat Feeds Configuration (All 6 Feeds Armed ON by Default)');

  // -------------------------------------------------------------------------
  // TEST 31.2: Per-Link Isolation (Cross-Link Security Independence)
  // -------------------------------------------------------------------------
  const linkGooglePermissive = createMockLink({
    id: 'link_google_permissive',
    threatFeeds: {
      ...DEFAULT_LINK_THREAT_FEEDS,
      google_compliance: false // Explicitly disabled for Google Search campaign
    }
  });

  const linkFullyArmed = createMockLink({
    id: 'link_fully_armed',
    threatFeeds: {
      ...DEFAULT_LINK_THREAT_FEEDS,
      google_compliance: true // Protected
    }
  });

  const googlebotSignals = createMockSignals({
    ipAddress: '66.249.66.1',
    userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    isBot: true,
    botName: 'Googlebot',
    asnOrg: 'AS15169 Google LLC'
  });

  const evalGooglePermissive = DecisionEngine.evaluate(linkGooglePermissive, googlebotSignals);
  const evalFullyArmed = DecisionEngine.evaluate(linkFullyArmed, googlebotSignals);

  const isIsolated = 
    evalGooglePermissive.isFallback === false &&
    evalGooglePermissive.destinationUrl === 'https://secret-money-page.com/offer' &&
    evalFullyArmed.isFallback === true &&
    evalFullyArmed.destinationUrl === 'https://clean-safe-page.org/wellness';

  assert(
    isIsolated, 
    '31.2', 
    'Per-Link Feed Isolation (Permissive on Link A does NOT compromise Link B)',
    `Link A fallback: ${evalGooglePermissive.isFallback}, Link B fallback: ${evalFullyArmed.isFallback}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.3: Meta Reviewer Cloaking on Protected Link
  // -------------------------------------------------------------------------
  const metaCrawlerSignals = createMockSignals({
    ipAddress: '157.240.18.35', // Meta Dublin QA Subnet
    userAgent: 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
    asnOrg: 'AS32934 Meta Platforms, Inc.'
  });

  const evalMetaReviewer = DecisionEngine.evaluate(linkFullyArmed, metaCrawlerSignals);
  assert(
    evalMetaReviewer.isFallback === true &&
    evalMetaReviewer.matchedRuleName?.includes('Threat Defense') &&
    evalMetaReviewer.matchedRuleName?.includes('Meta'),
    '31.3',
    'Meta Reviewer Cloaking (Routes crawler to clean safe page)',
    `Matched rule: ${evalMetaReviewer.matchedRuleName}, Url: ${evalMetaReviewer.destinationUrl}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.4: TikTok Ads QA Review Team Interception
  // -------------------------------------------------------------------------
  const tiktokSignals = createMockSignals({
    ipAddress: '130.44.20.10',
    userAgent: 'Mozilla/5.0 (Linux; Android 10) Bytespider',
    asnOrg: 'AS138699 ByteDance'
  });

  const evalTikTok = DecisionEngine.evaluate(linkFullyArmed, tiktokSignals);
  assert(
    evalTikTok.isFallback === true &&
    evalTikTok.matchedRuleName?.includes('TikTok'),
    '31.4',
    'TikTok QA Review Team Detection & Stealth Routing',
    `Matched rule: ${evalTikTok.matchedRuleName}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.5: Tor Exit Node Detection
  // -------------------------------------------------------------------------
  const torSignals = createMockSignals({
    ipAddress: '185.220.101.5',
    isTor: true
  });

  const evalTorBlocked = DecisionEngine.evaluate(linkFullyArmed, torSignals);

  const linkTorPermissive = createMockLink({
    threatFeeds: {
      ...DEFAULT_LINK_THREAT_FEEDS,
      tor_network: false
    }
  });
  const evalTorAllowed = DecisionEngine.evaluate(linkTorPermissive, torSignals);

  assert(
    evalTorBlocked.isFallback === true && evalTorAllowed.isFallback === false,
    '31.5',
    'Tor Exit Node Interception & Per-Link Toggle',
    `Tor blocked fallback: ${evalTorBlocked.isFallback}, Tor allowed fallback: ${evalTorAllowed.isFallback}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.6: Spy Service Interception (AdPlexity / PacketHub)
  // -------------------------------------------------------------------------
  const spySignals = createMockSignals({
    ipAddress: '198.51.100.22',
    isSpyService: true,
    spyServiceName: 'AdPlexity Mobile Scraper',
    asnOrg: 'AS209242 PacketHub S.A.'
  });

  const evalSpy = DecisionEngine.evaluate(linkFullyArmed, spySignals);
  assert(
    evalSpy.isFallback === true &&
    evalSpy.matchedRuleName?.includes('Threat Defense'),
    '31.6',
    'Spy Service Interception (Blocks AdPlexity/PacketHub from stealing creatives)',
    `Matched: ${evalSpy.matchedRuleName}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.7: Per-Link Custom IP Blacklist
  // -------------------------------------------------------------------------
  const customIp = '198.51.100.99';
  const customBlacklistEntry: CustomThreatEntry = {
    id: 'threat_custom_1',
    type: 'ip',
    value: customIp,
    action: 'block',
    note: 'Known competitor scraper in Moscow',
    createdAt: new Date().toISOString()
  };

  const linkWithCustomBlacklist = createMockLink({
    id: 'link_custom_blacklist',
    customThreatList: [customBlacklistEntry]
  });

  const targetIpSignals = createMockSignals({
    ipAddress: customIp,
    networkType: 'residential'
  });

  const evalCustomBlacklistHit = DecisionEngine.evaluate(linkWithCustomBlacklist, targetIpSignals);
  const evalCleanLinkHit = DecisionEngine.evaluate(linkFullyArmed, targetIpSignals);

  assert(
    evalCustomBlacklistHit.isFallback === true &&
    evalCustomBlacklistHit.matchedRuleName?.includes('Custom Blacklist') &&
    evalCleanLinkHit.isFallback === false,
    '31.7',
    'Per-Link Custom IP Blacklist (Blocks exclusively on assigned link)',
    `Custom link: ${evalCustomBlacklistHit.matchedRuleName}, Clean link destination: ${evalCleanLinkHit.destinationUrl}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.8: Per-Link Custom CIDR Subnet Evaluation
  // -------------------------------------------------------------------------
  const customCidrEntry: CustomThreatEntry = {
    id: 'threat_custom_cidr',
    type: 'cidr',
    value: '192.0.2.0/24',
    action: 'block',
    note: 'Rogue datacenter subnet',
    createdAt: new Date().toISOString()
  };

  const linkWithCidr = createMockLink({
    customThreatList: [customCidrEntry]
  });

  const insideCidrSignals = createMockSignals({ ipAddress: '192.0.2.45' });
  const outsideCidrSignals = createMockSignals({ ipAddress: '192.0.3.45' });

  const evalInsideCidr = DecisionEngine.evaluate(linkWithCidr, insideCidrSignals);
  const evalOutsideCidr = DecisionEngine.evaluate(linkWithCidr, outsideCidrSignals);

  assert(
    evalInsideCidr.isFallback === true && evalOutsideCidr.isFallback === false,
    '31.8',
    'Per-Link Custom CIDR Subnet Evaluation (Matches entire IP range bitwise)',
    `Inside: ${evalInsideCidr.isFallback}, Outside: ${evalOutsideCidr.isFallback}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.9: Per-Link Whitelist Precedence (Bypasses Threat Feeds)
  // -------------------------------------------------------------------------
  const whitelistedMetaIp = '157.240.1.55';
  const whitelistEntry: CustomThreatEntry = {
    id: 'threat_whitelist_qa_partner',
    type: 'ip',
    value: whitelistedMetaIp,
    action: 'allow',
    note: 'Whitelisted QA testing partner inside Meta IP block',
    createdAt: new Date().toISOString()
  };

  const linkWithWhitelist = createMockLink({
    threatFeeds: { ...DEFAULT_LINK_THREAT_FEEDS }, // All 6 feeds active
    customThreatList: [whitelistEntry]
  });

  const whitelistedVisitorSignals = createMockSignals({
    ipAddress: whitelistedMetaIp,
    userAgent: 'facebookexternalhit/1.1',
    asnOrg: 'AS32934 Meta Platforms, Inc.'
  });

  const evalWhitelisted = DecisionEngine.evaluate(linkWithWhitelist, whitelistedVisitorSignals);
  assert(
    evalWhitelisted.isFallback === false &&
    evalWhitelisted.destinationUrl === 'https://secret-money-page.com/offer',
    '31.9',
    'Per-Link Whitelist Precedence (Whitelisted IP bypasses active Meta threat feed)',
    `Destination: ${evalWhitelisted.destinationUrl}, isFallback: ${evalWhitelisted.isFallback}`
  );

  // -------------------------------------------------------------------------
  // TEST 31.10: Sub-Millisecond Edge Evaluation Latency Benchmark (< 0.5ms)
  // -------------------------------------------------------------------------
  const iterations = 2000;
  const benchmarkLink = createMockLink({
    threatFeeds: { ...DEFAULT_LINK_THREAT_FEEDS },
    customThreatList: [customBlacklistEntry, customCidrEntry, whitelistEntry]
  });
  const benchmarkSignals = createMockSignals();

  // Warmup
  for (let i = 0; i < 100; i++) {
    DecisionEngine.evaluate(benchmarkLink, benchmarkSignals);
  }

  const startBenchmark = performance.now();
  for (let i = 0; i < iterations; i++) {
    DecisionEngine.evaluate(benchmarkLink, benchmarkSignals);
  }
  const totalDuration = performance.now() - startBenchmark;
  const avgLatencyMs = totalDuration / iterations;

  assert(
    avgLatencyMs < 0.5,
    '31.10',
    `Sub-Millisecond Edge Latency Benchmark (${avgLatencyMs.toFixed(4)}ms per evaluation < 0.5ms threshold)`,
    `Executed ${iterations} evaluations in ${totalDuration.toFixed(2)}ms`
  );

  // -------------------------------------------------------------------------
  // FINAL SCORE SUMMARY
  // -------------------------------------------------------------------------
  console.log('\n------------------------------------------------------------------------');
  console.log(`SUITE 31 RESULT: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}% Pass Rate)`);
  console.log('------------------------------------------------------------------------\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTestBattery().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});

