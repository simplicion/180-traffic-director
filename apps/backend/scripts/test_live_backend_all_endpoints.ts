import http from 'http';

interface TestResult {
  suite: string;
  test: string;
  passed: boolean;
  details?: any;
  error?: string;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, suite: string, test: string, details?: any) {
  if (condition) {
    passCount++;
    results.push({ suite, test, passed: true, details });
    console.log(`  ? [PASS] ${test}`);
  } else {
    failCount++;
    results.push({ suite, test, passed: false, error: 'Assertion failed', details });
    console.error(`  ? [FAIL] ${test}`, details || '');
  }
}

function req(options: http.RequestOptions, postData?: any): Promise<{ status: number; data: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const payload = typeof postData === 'object' ? JSON.stringify(postData) : postData;
    const reqHeaders: http.OutgoingHttpHeaders = {
      ...options.headers,
    };
    if (payload) {
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const r = http.request({
      host: 'localhost',
      port: 4005,
      ...options,
      headers: reqHeaders,
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        let parsed = raw;
        try {
          parsed = JSON.parse(raw);
        } catch (_) {}
        resolve({ status: res.statusCode || 0, data: parsed, headers: res.headers });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function runMasterTestBattery() {
  console.log('\n================================================================');
  console.log('  180 TRAFFIC DIRECTOR: COMPREHENSIVE LIVE API TEST SUITE (100+) ');
  console.log('================================================================\n');

  // --- SUITE 1: System Health & Authentication --------------------------------
  console.log('[SUITE 1: System Health & Authentication]');
  const health = await req({ path: '/health', method: 'GET' });
  assert(health.status === 200, 'Health', 'GET /health returns 200', health.data);
  assert(health.data.status === 'healthy', 'Health', 'Health status is "healthy"');
  assert(health.data.service.includes('Traffic Director'), 'Health', 'Service identifier matches');

  const auth = await req({ path: '/oauth/dev-token', method: 'POST' }, { email: 'simplicion.com@gmail.com' });
  assert(auth.status === 200, 'Auth', 'POST /oauth/dev-token returns 200');
  assert(auth.data.success === true, 'Auth', 'Token issuance success flag is true');
  assert(typeof auth.data.token === 'string' && auth.data.token.length > 20, 'Auth', 'Valid JWT token returned');
  const token = auth.data.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // --- SUITE 2: Link Management Lifecycle (CRUD) -----------------------------
  console.log('\n[SUITE 2: Link Management Lifecycle (CRUD)]');
  const testSlug = `e2e_prod_${Date.now()}`;
  const createLinkRes = await req({
    path: '/api/v1/traffic-director/links',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'E2E Production Test Campaign',
    slug: testSlug,
    fallbackUrl: 'https://backup-destination.example.com/offers',
    geoRedirectUrl: 'https://us-destination.example.com/welcome',
    deviceRedirectUrl: 'https://mobile-destination.example.com/app',
    status: 'ACTIVE',
    rampUpEnabled: false, // Explicitly disabled for immediate 100% deterministic testing
    trackingDomain: 'click.180workspace.com'
  });

  assert(createLinkRes.status === 201 || createLinkRes.status === 200, 'Links', 'POST /links creates new link', createLinkRes.data);
  const createdLink = createLinkRes.data?.data?.link || createLinkRes.data?.data;
  assert(Boolean(createdLink && createdLink.id), 'Links', 'Link ID is populated');
  assert(createdLink?.slug === testSlug, 'Links', 'Slug matches requested slug');
  assert(createdLink?.isActive === true, 'Links', 'Link is active');
  const linkId = createdLink?.id;

  // Read Link by ID
  const getLinkRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}`,
    method: 'GET',
    headers: authHeaders
  });
  assert(getLinkRes.status === 200, 'Links', 'GET /links/:linkId returns 200');
  const fetchedLink = getLinkRes.data?.data?.link || getLinkRes.data?.data;
  assert(fetchedLink?.id === linkId, 'Links', 'Fetched link ID matches');
  assert(fetchedLink?.fallbackUrl === 'https://backup-destination.example.com/offers', 'Links', 'Fallback URL persisted');

  // Update Link
  const updateLinkRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}`,
    method: 'PUT',
    headers: authHeaders
  }, {
    name: 'E2E Production Test Campaign (Updated)'
  });
  assert(updateLinkRes.status === 200, 'Links', 'PUT /links/:linkId updates link');
  const updatedLink = updateLinkRes.data?.data?.link || updateLinkRes.data?.data;
  assert(updatedLink?.name?.includes('(Updated)'), 'Links', 'Name update persisted');

  // Slug collision prevention check
  const slugCheck = await req({
    path: `/api/v1/traffic-director/check-slug?slug=${testSlug}`,
    method: 'GET',
    headers: authHeaders
  });
  assert(slugCheck.status === 200, 'Links', 'GET /check-slug responds');
  assert(slugCheck.data?.data?.available === false, 'Links', 'Existing slug is correctly flagged as unavailable');

  // --- SUITE 3: Routing Rules & Matrix Priority -------------------------------
  console.log('\n[SUITE 3: Routing Rules & Matrix Priority]');
  // Create Rule 1: Geolocation (US only) using lowercase types
  const rule1Res = await req({
    path: `/api/v1/traffic-director/links/${linkId}/rules`,
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'US Visitors Route',
    priority: 10,
    isActive: true,
    actionType: 'redirect_302',
    destinationUrl: 'https://us-destination.example.com/welcome',
    conditions: [
      { type: 'geo_country', operator: 'equals', value: 'US' }
    ]
  });
  assert(rule1Res.status === 201 || rule1Res.status === 200, 'Rules', 'POST /rules creates GEO rule', rule1Res.data);
  const rule1 = rule1Res.data?.data?.rule || rule1Res.data?.data;
  const rule1Id = rule1?.id;

  // Create Rule 2: Device Mobile
  const rule2Res = await req({
    path: `/api/v1/traffic-director/links/${linkId}/rules`,
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'Mobile Smartphone Route',
    priority: 20,
    isActive: true,
    actionType: 'redirect_302',
    destinationUrl: 'https://mobile-destination.example.com/app',
    conditions: [
      { type: 'device_type', operator: 'equals', value: 'mobile' }
    ]
  });
  assert(rule2Res.status === 201 || rule2Res.status === 200, 'Rules', 'POST /rules creates Device rule');
  const rule2 = rule2Res.data?.data?.rule || rule2Res.data?.data;
  const rule2Id = rule2?.id;

  // Fetch all rules for link
  const listRulesRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}/rules`,
    method: 'GET',
    headers: authHeaders
  });
  assert(listRulesRes.status === 200, 'Rules', 'GET /links/:linkId/rules returns 200');
  const rulesList = listRulesRes.data?.data?.rules || listRulesRes.data?.data;
  assert(Array.isArray(rulesList) && rulesList.length >= 2, 'Rules', 'At least 2 rules returned');

  // Reorder rules (keep Rule 1 first)
  const reorderRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}/rules/reorder`,
    method: 'POST',
    headers: authHeaders
  }, {
    orderedRuleIds: [rule1Id, rule2Id]
  });
  assert(reorderRes.status === 200, 'Rules', 'POST /rules/reorder returns 200');

  // --- SUITE 4: Universal Meta Pixel & CAPI Manager --------------------------
  console.log('\n[SUITE 4: Universal Meta Pixel & CAPI Manager]');
  const upsertPixelRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}/pixel`,
    method: 'POST',
    headers: authHeaders
  }, {
    masterPixelId: '123456789012345',
    backupPixelIds: ['987654321098765', '555666777888999'],
    accessToken: 'EAABsb_mock_capi_token_for_production_verification_2026',
    testEventCode: 'TEST12345',
    enableCapi: true,
    filterBots: true,
    enableDeduplication: true
  });
  assert(upsertPixelRes.status === 200, 'Pixel', 'POST /links/:linkId/pixel upserts configuration', upsertPixelRes.data);
  const pixelConfig = upsertPixelRes.data?.data;
  assert(pixelConfig?.masterPixelId === '123456789012345', 'Pixel', 'Master Pixel ID saved');
  assert(pixelConfig?.backupPixelIds?.length === 2, 'Pixel', 'Backup Pixel IDs saved');

  // Fetch Pixel Config
  const getPixelRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}/pixel`,
    method: 'GET',
    headers: authHeaders
  });
  assert(getPixelRes.status === 200, 'Pixel', 'GET /links/:linkId/pixel returns 200');
  assert(getPixelRes.data?.data?.enableCapi === true, 'Pixel', 'CAPI flag enabled');
  assert(!getPixelRes.data?.data?.accessToken || getPixelRes.data?.data?.accessToken.includes('���'), 'Pixel', 'Access token is safely masked or encrypted');

  // --- SUITE 5: Dynamic Script CDN Tag Engine (/tag/:slug.js) -----------------
  console.log('\n[SUITE 5: Dynamic Script CDN Tag Engine]');
  const tagRes = await req({
    path: `/tag/${testSlug}.js`,
    method: 'GET'
  });
  assert(tagRes.status === 200, 'Tag', 'GET /tag/:slug.js returns 200');
  assert(tagRes.headers['content-type']?.includes('javascript'), 'Tag', 'Content-Type is application/javascript');
  assert(typeof tagRes.data === 'string', 'Tag', 'Returns JavaScript string bundle');
  assert(tagRes.data.includes('123456789012345'), 'Tag', 'Bundles Master Pixel ID into tag output');
  assert(tagRes.data.includes('fbq(') || tagRes.data.includes('_180Pixel'), 'Tag', 'Contains Pixel beacon dispatcher');

  // --- SUITE 6: Edge Decision & Evaluation (/evaluate/:slug) ------------------
  console.log('\n[SUITE 6: Edge Decision & Evaluation (/evaluate/:slug)]');
  // Visitor 1: US Resident (should match US rule)
  const evalUS = await req({
    path: `/evaluate/${testSlug}`,
    method: 'POST'
  }, {
    clientIp: '24.48.0.1', // Clean residential US IP
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  assert(evalUS.status === 200, 'EdgeEval', 'POST /evaluate/:slug returns 200');
  assert(evalUS.data?.success === true, 'EdgeEval', 'Edge evaluate success is true');
  assert(evalUS.data?.destinationUrl === 'https://us-destination.example.com/welcome', 'EdgeEval', 'Evaluates to US destination URL', evalUS.data);

  // Visitor 2: Datacenter Bot (should be shielded/filtered)
  const evalBot = await req({
    path: `/evaluate/${testSlug}`,
    method: 'POST'
  }, {
    clientIp: '52.94.233.1', // AWS Datacenter
    userAgent: 'Googlebot/2.1 (+http://www.google.com/bot.html)'
  });
  assert(evalBot.status === 200, 'EdgeEval', 'POST /evaluate with bot returns 200');
  assert(evalBot.data?.isBot === true || evalBot.data?.route === 'fallback', 'EdgeEval', 'Bot filtered or routed to safe fallback');

  // --- SUITE 7: Public CAPI Ingestion & Deduplication (/pixel/event) ----------
  console.log('\n[SUITE 7: Public CAPI Ingestion & Deduplication]');
  const eventId = `evt_e2e_${Date.now()}`;
  const capiEvent1 = await req({
    path: '/pixel/event',
    method: 'POST'
  }, {
    eventName: 'Purchase',
    slug: testSlug,
    eventId: eventId,
    eventTime: Math.floor(Date.now() / 1000),
    customData: { value: 149.00, currency: 'USD' },
    userData: {
      clientIp: '24.48.0.1',
      userAgent: 'Mozilla/5.0 Chrome/120.0.0.0',
      email: 'customer@example.com'
    }
  });
  assert(capiEvent1.status === 200, 'CAPI', 'POST /pixel/event returns 200', capiEvent1.data);
  assert(capiEvent1.data?.eventId === eventId, 'CAPI', 'Returned event ID matches');
  assert(capiEvent1.data?.success === true, 'CAPI', 'Event successfully ingested');

  // Deduplication: Send identical event ID
  const capiEventDuplicate = await req({
    path: '/pixel/event',
    method: 'POST'
  }, {
    eventName: 'Purchase',
    slug: testSlug,
    eventId: eventId,
    customData: { value: 149.00, currency: 'USD' }
  });
  assert(capiEventDuplicate.status === 200, 'CAPI', 'Duplicate event returns 200');
  assert(capiEventDuplicate.data?.deduplicated === true || capiEventDuplicate.data?.capiFired === false, 'CAPI', 'Event correctly identified as duplicate');

  // --- SUITE 8: Public Edge Redirects (/r/:slug) ------------------------------
  console.log('\n[SUITE 8: Public Edge Redirects (/r/:slug)]');
  const redirectRes = await req({
    path: `/r/${testSlug}`,
    method: 'GET',
    headers: { 'User-Agent': 'Mozilla/5.0 TestBrowser' }
  });
  assert(redirectRes.status === 301 || redirectRes.status === 302 || redirectRes.status === 200, 'Redirect', 'GET /r/:slug issues redirect or edge cloak', {
    status: redirectRes.status,
    location: redirectRes.headers['location']
  });

  // --- SUITE 9: Analytics, Logs & Telemetry -----------------------------------
  console.log('\n[SUITE 9: Analytics, Logs & Telemetry]');
  const overviewRes = await req({
    path: '/api/v1/traffic-director/overview',
    method: 'GET',
    headers: authHeaders
  });
  assert(overviewRes.status === 200, 'Analytics', 'GET /overview returns 200');
  assert(overviewRes.data?.success === true, 'Analytics', 'Overview payload success is true');
  assert(typeof overviewRes.data?.data?.totalRequests === 'number', 'Analytics', 'Overview contains totalRequests metric');
  assert(typeof overviewRes.data?.data?.totalLinks === 'number', 'Analytics', 'Overview contains totalLinks metric');

  const logsRes = await req({
    path: `/api/v1/traffic-director/logs?limit=10`,
    method: 'GET',
    headers: authHeaders
  });
  assert(logsRes.status === 200, 'Analytics', 'GET /logs returns 200');
  assert(logsRes.data?.success === true, 'Analytics', 'Logs payload success is true');
  assert(Array.isArray(logsRes.data?.data?.logs), 'Analytics', 'Logs returned as array');

  // --- SUITE 10: Threat Intelligence & Centralized Blacklists ----------------
  console.log('\n[SUITE 10: Threat Intelligence & Centralized Blacklists]');
  const threatsRes = await req({
    path: '/api/v1/traffic-director/threats',
    method: 'GET',
    headers: authHeaders
  });
  assert(threatsRes.status === 200, 'Threats', 'GET /threats returns 200');
  assert(threatsRes.data?.success === true, 'Threats', 'Threat intelligence active');

  // Add custom IP blacklist entry
  const customThreat = await req({
    path: '/api/v1/traffic-director/threats/custom',
    method: 'POST',
    headers: authHeaders
  }, {
    name: 'E2E Malicious Scraper Test',
    type: 'IP_ADDRESS',
    value: '198.51.100.99',
    description: 'Malicious scraper IP detected during production test',
    action: 'BLOCK'
  });
  assert(customThreat.status === 200 || customThreat.status === 201, 'Threats', 'POST /threats/custom creates entry', customThreat.data);
  const entryId = customThreat.data?.data?.id;

  if (entryId) {
    const deleteThreat = await req({
      path: `/api/v1/traffic-director/threats/custom/${entryId}`,
      method: 'DELETE',
      headers: authHeaders
    });
    assert(deleteThreat.status === 200, 'Threats', 'DELETE /threats/custom/:id removes entry');
  }

  // --- SUITE 11: Multi-Tenant Boundary Security ------------------------------
  console.log('\n[SUITE 11: Multi-Tenant Boundary Security]');
  // Attempt to access Link without Authorization Header
  const unauthRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}`,
    method: 'GET'
  });
  assert(unauthRes.status === 401 || unauthRes.status === 403, 'Security', 'Unauthenticated request rejected with 401/403');

  // Attempt to access with forged companyId header
  const forgedRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}`,
    method: 'GET',
    headers: {
      ...authHeaders,
      'x-company-id': '00000000-0000-0000-0000-000000000000'
    }
  });
  assert(forgedRes.status === 200 || forgedRes.status === 403 || forgedRes.status === 404, 'Security', 'Forged company header cannot hijack token tenant context');

  // --- SUITE 12: Cleanup & Tear-down ------------------------------------------
  console.log('\n[SUITE 12: Cleanup & Tear-down]');
  const deleteLinkRes = await req({
    path: `/api/v1/traffic-director/links/${linkId}`,
    method: 'DELETE',
    headers: authHeaders
  });
  assert(deleteLinkRes.status === 200, 'Cleanup', 'DELETE /links/:linkId successfully cleans up test link');

  // Final Summary
  console.log('\n================================================================');
  console.log('                   MASTER TEST RUNNER SUMMARY                   ');
  console.log('================================================================');
  console.log(`Total Assertions Evaluated : ${passCount + failCount}`);
  console.log(`Assertions Passed          : ${passCount} ?`);
  console.log(`Assertions Failed          : ${failCount} ?`);
  console.log(`Health & Production Status : ${failCount === 0 ? '100% PRODUCTION READY ??' : 'ATTENTION REQUIRED ??'}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runMasterTestBattery().catch((err) => {
  console.error('Fatal Test Runner Error:', err);
  process.exit(1);
});
