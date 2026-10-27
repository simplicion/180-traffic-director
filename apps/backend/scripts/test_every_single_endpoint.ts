import http from 'http';

interface TestResult {
  endpoint: string;
  method: string;
  status: number;
  passed: boolean;
  notes?: string;
  error?: any;
}

const results: TestResult[] = [];
let passCount = 0;
let failCount = 0;

function logResult(r: TestResult) {
  results.push(r);
  if (r.passed) {
    passCount++;
    console.log(`  ✓ [PASS] [${r.method}] ${r.endpoint} (${r.status}) ${r.notes || ''}`);
  } else {
    failCount++;
    console.error(`  ✗ [FAIL] [${r.method}] ${r.endpoint} (${r.status}) - ${r.error || 'Unexpected response'}`);
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

async function runFullEndpointVerification() {
  console.log('\n================================================================');
  console.log('   180 TRAFFIC DIRECTOR: EXHAUSTIVE 100% ENDPOINT VERIFICATION   ');
  console.log('================================================================\n');

  // 1. Health
  const health = await req({ path: '/health', method: 'GET' });
  logResult({
    endpoint: '/health',
    method: 'GET',
    status: health.status,
    passed: health.status === 200 && health.data?.status === 'healthy',
    notes: `Service: ${health.data?.service}`
  });

  // 2. OAuth Dev Token
  const auth = await req({ path: '/oauth/dev-token', method: 'POST' }, { email: 'simplicion.com@gmail.com' });
  const token = auth.data?.token;
  logResult({
    endpoint: '/oauth/dev-token',
    method: 'POST',
    status: auth.status,
    passed: auth.status === 200 && typeof token === 'string' && token.length > 20,
    notes: `Token issued for: ${auth.data?.user?.email}`
  });

  const authHeaders = { Authorization: `Bearer ${token}` };

  // 3. Overview stats
  const overview = await req({ path: '/api/v1/traffic-director/overview', method: 'GET', headers: authHeaders });
  logResult({
    endpoint: '/api/v1/traffic-director/overview',
    method: 'GET',
    status: overview.status,
    passed: overview.status === 200 && overview.data?.success === true,
    notes: `Total Links: ${overview.data?.data?.totalLinks}, Requests: ${overview.data?.data?.totalRequests}`
  });

  // 4. Logs
  const logs = await req({ path: '/api/v1/traffic-director/logs?limit=5', method: 'GET', headers: authHeaders });
  logResult({
    endpoint: '/api/v1/traffic-director/logs',
    method: 'GET',
    status: logs.status,
    passed: logs.status === 200 && Array.isArray(logs.data?.data?.logs),
    notes: `Logs count: ${logs.data?.data?.logs?.length ?? 0}`
  });

  // 5. Check slug
  const testSlug = `exhaustive_${Date.now()}`;
  const checkSlug = await req({ path: `/api/v1/traffic-director/check-slug?slug=${testSlug}`, method: 'GET', headers: authHeaders });
  logResult({
    endpoint: '/api/v1/traffic-director/check-slug',
    method: 'GET',
    status: checkSlug.status,
    passed: checkSlug.status === 200 && checkSlug.data?.data?.available === true,
    notes: `Slug "${testSlug}" available: ${checkSlug.data?.data?.available}`
  });

  // 6. Threats intelligence
  const threats = await req({ path: '/api/v1/traffic-director/threats', method: 'GET', headers: authHeaders });
  logResult({
    endpoint: '/api/v1/traffic-director/threats',
    method: 'GET',
    status: threats.status,
    passed: threats.status === 200 && threats.data?.success === true,
    notes: `Feeds available: ${threats.data?.data?.feeds?.length ?? 0}`
  });

  // 7. Threats toggle feed
  const toggleFeed = await req({ path: '/api/v1/traffic-director/threats/toggle-feed', method: 'POST', headers: authHeaders }, {
    feedKey: 'tor_exit_nodes',
    enabled: true
  });
  logResult({
    endpoint: '/api/v1/traffic-director/threats/toggle-feed',
    method: 'POST',
    status: toggleFeed.status,
    passed: toggleFeed.status === 200 && toggleFeed.data?.success === true,
    notes: `Toggled feed: ${JSON.stringify(toggleFeed.data?.data || {})}`
  });

  // 8. Threats sync tor
  const syncTor = await req({ path: '/api/v1/traffic-director/threats/sync-tor', method: 'POST', headers: authHeaders });
  logResult({
    endpoint: '/api/v1/traffic-director/threats/sync-tor',
    method: 'POST',
    status: syncTor.status,
    passed: syncTor.status === 200 && syncTor.data?.success === true,
    notes: `Tor nodes synced: ${syncTor.data?.data?.totalNodes || 0}`
  });

  // 9. Threats custom entry create
  const customThreat = await req({ path: '/api/v1/traffic-director/threats/custom', method: 'POST', headers: authHeaders }, {
    name: 'Exhaustive Test Threat IP',
    type: 'IP_ADDRESS',
    value: '198.51.100.222',
    description: 'Blocked during exhaustive automated verification',
    action: 'BLOCK'
  });
  const threatEntryId = customThreat.data?.data?.id;
  logResult({
    endpoint: '/api/v1/traffic-director/threats/custom',
    method: 'POST',
    status: customThreat.status,
    passed: (customThreat.status === 200 || customThreat.status === 201) && Boolean(threatEntryId),
    notes: `Created threat ID: ${threatEntryId}`
  });

  // 10. Threats custom entry delete
  if (threatEntryId) {
    const delThreat = await req({ path: `/api/v1/traffic-director/threats/custom/${threatEntryId}`, method: 'DELETE', headers: authHeaders });
    logResult({
      endpoint: `/api/v1/traffic-director/threats/custom/:entryId`,
      method: 'DELETE',
      status: delThreat.status,
      passed: delThreat.status === 200,
      notes: `Deleted threat ID: ${threatEntryId}`
    });
  }

  // 11. Links - CREATE
  const createLink = await req({ path: '/api/v1/traffic-director/links', method: 'POST', headers: authHeaders }, {
    name: 'Exhaustive Test Smart Link',
    slug: testSlug,
    fallbackUrl: 'https://backup-safe.example.com',
    status: 'ACTIVE',
    rampUpEnabled: false,
    datacenterBlocked: true
  });
  const createdLink = createLink.data?.data?.link || createLink.data?.data;
  const linkId = createdLink?.id;
  logResult({
    endpoint: '/api/v1/traffic-director/links',
    method: 'POST',
    status: createLink.status,
    passed: (createLink.status === 200 || createLink.status === 201) && Boolean(linkId),
    notes: `Created linkId: ${linkId}`
  });

  // 12. Links - LIST
  const listLinks = await req({ path: '/api/v1/traffic-director/links?page=1&limit=10', method: 'GET', headers: authHeaders });
  logResult({
    endpoint: '/api/v1/traffic-director/links',
    method: 'GET',
    status: listLinks.status,
    passed: listLinks.status === 200 && Array.isArray(listLinks.data?.data?.links || listLinks.data?.data),
    notes: `Total links fetched: ${(listLinks.data?.data?.links || listLinks.data?.data)?.length}`
  });

  // 13. Links - GET BY ID
  const getLink = await req({ path: `/api/v1/traffic-director/links/${linkId}`, method: 'GET', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId`,
    method: 'GET',
    status: getLink.status,
    passed: getLink.status === 200 && (getLink.data?.data?.link || getLink.data?.data)?.id === linkId,
    notes: `Fetched link slug: ${(getLink.data?.data?.link || getLink.data?.data)?.slug}`
  });

  // 14. Links - PUT (Update)
  const putLink = await req({ path: `/api/v1/traffic-director/links/${linkId}`, method: 'PUT', headers: authHeaders }, {
    name: 'Exhaustive Test Smart Link (Updated via PUT)'
  });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId`,
    method: 'PUT',
    status: putLink.status,
    passed: putLink.status === 200,
    notes: `Updated name via PUT`
  });

  // 15. Links - PATCH (Partial Update)
  const patchLink = await req({ path: `/api/v1/traffic-director/links/${linkId}`, method: 'PATCH', headers: authHeaders }, {
    description: 'Updated via PATCH test'
  });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId`,
    method: 'PATCH',
    status: patchLink.status,
    passed: patchLink.status === 200,
    notes: `Updated description via PATCH`
  });

  // 16. Links - ANALYTICS
  const linkAnalytics = await req({ path: `/api/v1/traffic-director/links/${linkId}/analytics`, method: 'GET', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/analytics`,
    method: 'GET',
    status: linkAnalytics.status,
    passed: linkAnalytics.status === 200 && linkAnalytics.data?.success === true,
    notes: `Analytics success: ${linkAnalytics.data?.success}`
  });

  // 17. Rules - CREATE
  const createRule = await req({ path: `/api/v1/traffic-director/links/${linkId}/rules`, method: 'POST', headers: authHeaders }, {
    name: 'Canada Target Route',
    priority: 10,
    isActive: true,
    actionType: 'redirect_302',
    destinationUrl: 'https://ca-offer.example.com/promo',
    conditions: [{ type: 'geo_country', operator: 'equals', value: 'CA' }]
  });
  const ruleObj = createRule.data?.data?.rule || createRule.data?.data;
  const ruleId = ruleObj?.id;
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/rules`,
    method: 'POST',
    status: createRule.status,
    passed: (createRule.status === 200 || createRule.status === 201) && Boolean(ruleId),
    notes: `Created ruleId: ${ruleId}`
  });

  // 18. Rules - LIST
  const listRules = await req({ path: `/api/v1/traffic-director/links/${linkId}/rules`, method: 'GET', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/rules`,
    method: 'GET',
    status: listRules.status,
    passed: listRules.status === 200 && Array.isArray(listRules.data?.data?.rules || listRules.data?.data),
    notes: `Rules count: ${(listRules.data?.data?.rules || listRules.data?.data)?.length}`
  });

  // 19. Rules - PUT
  const putRule = await req({ path: `/api/v1/traffic-director/rules/${ruleId}`, method: 'PUT', headers: authHeaders }, {
    name: 'Canada Target Route (Updated via PUT)',
    destinationUrl: 'https://ca-offer.example.com/promo-v2'
  });
  logResult({
    endpoint: `/api/v1/traffic-director/rules/:ruleId`,
    method: 'PUT',
    status: putRule.status,
    passed: putRule.status === 200,
    notes: `Updated rule via PUT`
  });

  // 20. Rules - PATCH
  const patchRule = await req({ path: `/api/v1/traffic-director/rules/${ruleId}`, method: 'PATCH', headers: authHeaders }, {
    name: 'Canada Target Route (Updated via PATCH)'
  });
  logResult({
    endpoint: `/api/v1/traffic-director/rules/:ruleId`,
    method: 'PATCH',
    status: patchRule.status,
    passed: patchRule.status === 200,
    notes: `Updated rule via PATCH`
  });

  // 21. Rules - REORDER
  const reorderRules = await req({ path: `/api/v1/traffic-director/links/${linkId}/rules/reorder`, method: 'POST', headers: authHeaders }, {
    orderedRuleIds: [ruleId]
  });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/rules/reorder`,
    method: 'POST',
    status: reorderRules.status,
    passed: reorderRules.status === 200,
    notes: `Reordered rules successfully`
  });

  // 22. Pixel - UPSERT
  const upsertPixel = await req({ path: `/api/v1/traffic-director/links/${linkId}/pixel`, method: 'POST', headers: authHeaders }, {
    masterPixelId: '112233445566778',
    backupPixelIds: ['998877665544332'],
    enableCapi: true
  });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/pixel`,
    method: 'POST',
    status: upsertPixel.status,
    passed: upsertPixel.status === 200 && upsertPixel.data?.data?.masterPixelId === '112233445566778',
    notes: `Upserted master pixel: ${upsertPixel.data?.data?.masterPixelId}`
  });

  // 23. Pixel - GET
  const getPixel = await req({ path: `/api/v1/traffic-director/links/${linkId}/pixel`, method: 'GET', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/pixel`,
    method: 'GET',
    status: getPixel.status,
    passed: getPixel.status === 200 && getPixel.data?.data?.masterPixelId === '112233445566778',
    notes: `Fetched pixel config`
  });

  // 24. Pixel - LOGS
  const pixelLogs = await req({ path: `/api/v1/traffic-director/links/${linkId}/pixel/logs?limit=5`, method: 'GET', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/pixel/logs`,
    method: 'GET',
    status: pixelLogs.status,
    passed: pixelLogs.status === 200 && Array.isArray(pixelLogs.data?.data),
    notes: `Pixel logs count: ${pixelLogs.data?.data?.length ?? 0}`
  });

  // 25. Pixel - DELETE
  const deletePixel = await req({ path: `/api/v1/traffic-director/links/${linkId}/pixel`, method: 'DELETE', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId/pixel`,
    method: 'DELETE',
    status: deletePixel.status,
    passed: deletePixel.status === 200 && deletePixel.data?.success === true,
    notes: `Deleted pixel configuration`
  });

  // Re-save pixel for edge testing
  await req({ path: `/api/v1/traffic-director/links/${linkId}/pixel`, method: 'POST', headers: authHeaders }, {
    masterPixelId: '112233445566778',
    enableCapi: true
  });

  // 26. Simulator - POST /simulate
  const sim = await req({ path: '/api/v1/traffic-director/simulate', method: 'POST', headers: authHeaders }, {
    linkId,
    simulatedCountry: 'CA',
    simulatedNetworkType: 'residential',
    simulatedUserAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  });
  logResult({
    endpoint: '/api/v1/traffic-director/simulate',
    method: 'POST',
    status: sim.status,
    passed: sim.status === 200 && sim.data?.success === true,
    notes: `Simulation matched rule: ${sim.data?.data?.simulationResult?.matchedRuleName || 'none'}, destination: ${sim.data?.data?.simulationResult?.destinationUrl || sim.data?.data?.destinationUrl}`
  });

  // 27. Verify Tag - POST /verify-tag
  const verifyTag = await req({ path: '/api/v1/traffic-director/verify-tag', method: 'POST', headers: authHeaders }, {
    slug: testSlug,
    url: 'https://example.com'
  });
  logResult({
    endpoint: '/api/v1/traffic-director/verify-tag',
    method: 'POST',
    status: verifyTag.status,
    passed: verifyTag.status === 200 && verifyTag.data?.success === true,
    notes: `Tag verifier response: ${verifyTag.data?.summary}`
  });

  // 28. Billing Status - GET /billing/status
  const billingStatus = await req({ path: '/api/v1/traffic-director/billing/status', method: 'GET', headers: authHeaders });
  logResult({
    endpoint: '/api/v1/traffic-director/billing/status',
    method: 'GET',
    status: billingStatus.status,
    passed: billingStatus.status === 200 && (billingStatus.data?.success === true || typeof billingStatus.data?.tier === 'string'),
    notes: `Plan: ${billingStatus.data?.tier || billingStatus.data?.currentPlan?.tier}`
  });

  // 29. Validate Coupon - POST /billing/validate-coupon
  const coupon = await req({ path: '/api/v1/traffic-director/billing/validate-coupon', method: 'POST', headers: authHeaders }, {
    couponCode: 'SAVE20',
    planTier: 'STARTER'
  });
  logResult({
    endpoint: '/api/v1/traffic-director/billing/validate-coupon',
    method: 'POST',
    status: coupon.status,
    passed: coupon.status === 200 && coupon.data?.success === true,
    notes: `Coupon validated (valid: ${coupon.data?.valid})`
  });

  // 30. Create Checkout Session - POST /billing/create-checkout
  const checkout = await req({ path: '/api/v1/traffic-director/billing/create-checkout', method: 'POST', headers: authHeaders }, {
    planTier: 'PRO'
  });
  const checkoutSessionId = checkout.data?.sessionId;
  logResult({
    endpoint: '/api/v1/traffic-director/billing/create-checkout',
    method: 'POST',
    status: checkout.status,
    passed: checkout.status === 200 && checkout.data?.success === true && Boolean(checkoutSessionId),
    notes: `Checkout session created: ${checkoutSessionId}`
  });

  // 31. Confirm Checkout Session - POST /billing/confirm-session
  if (checkoutSessionId) {
    const confirmSub = await req({ path: '/api/v1/traffic-director/billing/confirm-session', method: 'POST', headers: authHeaders }, {
      sessionId: checkoutSessionId
    });
    logResult({
      endpoint: '/api/v1/traffic-director/billing/confirm-session',
      method: 'POST',
      status: confirmSub.status,
      passed: confirmSub.status === 200 && confirmSub.data?.success === true,
      notes: `Confirmed session: ${checkoutSessionId}`
    });
  }

  // 32. Billing Webhook - POST /billing/webhook
  const webhookRes = await req({ path: '/api/v1/traffic-director/billing/webhook', method: 'POST' }, {
    event: 'ping',
    data: { timestamp: Date.now() }
  });
  logResult({
    endpoint: '/api/v1/traffic-director/billing/webhook',
    method: 'POST',
    status: webhookRes.status,
    passed: webhookRes.status === 200,
    notes: `Webhook handled`
  });

  // 33. Public Edge Routing - POST /evaluate/:slug
  const edgeEval = await req({ path: `/evaluate/${testSlug}`, method: 'POST' }, {
    clientIp: '24.48.0.1',
    userAgent: 'Mozilla/5.0 Test'
  });
  logResult({
    endpoint: '/evaluate/:slug',
    method: 'POST',
    status: edgeEval.status,
    passed: edgeEval.status === 200 && edgeEval.data?.success === true,
    notes: `Edge evaluation route: ${edgeEval.data?.route}, latency: ${edgeEval.data?.latencyMs}ms`
  });

  // 31. Public Edge Routing - POST /api/v1/traffic-director/evaluate/:slug (Alias)
  const edgeEvalAlias = await req({ path: `/api/v1/traffic-director/evaluate/${testSlug}`, method: 'POST' }, {
    clientIp: '24.48.0.1'
  });
  logResult({
    endpoint: '/api/v1/traffic-director/evaluate/:slug',
    method: 'POST',
    status: edgeEvalAlias.status,
    passed: edgeEvalAlias.status === 200 && edgeEvalAlias.data?.success === true,
    notes: `Alias evaluated successfully`
  });

  // 32. Dynamic Script Tag - GET /tag/:slug.js
  const tagJs = await req({ path: `/tag/${testSlug}.js`, method: 'GET' });
  logResult({
    endpoint: '/tag/:slug.js',
    method: 'GET',
    status: tagJs.status,
    passed: tagJs.status === 200 && typeof tagJs.data === 'string' && tagJs.data.includes('112233445566778'),
    notes: `JavaScript bundle generated with pixel ID`
  });

  // 33. Dynamic Script Tag - GET /api/v1/traffic-director/tag/:slug (Alias)
  const tagAlias = await req({ path: `/api/v1/traffic-director/tag/${testSlug}`, method: 'GET' });
  logResult({
    endpoint: '/api/v1/traffic-director/tag/:slug',
    method: 'GET',
    status: tagAlias.status,
    passed: tagAlias.status === 200 && typeof tagAlias.data === 'string',
    notes: `Alias script generated`
  });

  // 34. Pixel Event - POST /pixel/event
  const pixelEvent = await req({ path: '/pixel/event', method: 'POST' }, {
    slug: testSlug,
    eventName: 'ViewContent',
    eventId: `test_evt_${Date.now()}`
  });
  logResult({
    endpoint: '/pixel/event',
    method: 'POST',
    status: pixelEvent.status,
    passed: pixelEvent.status === 200 && pixelEvent.data?.success === true,
    notes: `Pixel event ingested`
  });

  // 35. Pixel Event - POST /api/v1/traffic-director/pixel/event (Alias)
  const pixelEventAlias = await req({ path: '/api/v1/traffic-director/pixel/event', method: 'POST' }, {
    slug: testSlug,
    eventName: 'ViewContent',
    eventId: `test_evt_alias_${Date.now()}`
  });
  logResult({
    endpoint: '/api/v1/traffic-director/pixel/event',
    method: 'POST',
    status: pixelEventAlias.status,
    passed: pixelEventAlias.status === 200 && pixelEventAlias.data?.success === true,
    notes: `Pixel event alias ingested`
  });

  // 36. Public Redirect - GET /r/:slug
  const redirect = await req({ path: `/r/${testSlug}`, method: 'GET' });
  logResult({
    endpoint: '/r/:slug',
    method: 'GET',
    status: redirect.status,
    passed: redirect.status === 301 || redirect.status === 302 || redirect.status === 200,
    notes: `Redirect code: ${redirect.status}, Location: ${redirect.headers['location'] || 'Inline body'}`
  });

  // 37. Client Shield Route - GET /shield/:slug
  const shield = await req({ path: `/shield/${testSlug}`, method: 'GET' });
  logResult({
    endpoint: '/shield/:slug',
    method: 'GET',
    status: shield.status,
    passed: shield.status === 200 && typeof shield.data === 'string',
    notes: `Shield page rendered, size: ${shield.data?.length} chars`
  });

  // 38. Client Shield Route - GET /api/v1/traffic-director/shield/:slug (Alias)
  const shieldAlias = await req({ path: `/api/v1/traffic-director/shield/${testSlug}`, method: 'GET' });
  logResult({
    endpoint: '/api/v1/traffic-director/shield/:slug',
    method: 'GET',
    status: shieldAlias.status,
    passed: shieldAlias.status === 200 && typeof shieldAlias.data === 'string',
    notes: `Shield alias rendered`
  });

  // 39. Reverse Proxy Stream - GET /stream-proxy
  const streamProxy = await req({ path: '/stream-proxy?url=https%3A%2F%2Fexample.com', method: 'GET' });
  logResult({
    endpoint: '/stream-proxy',
    method: 'GET',
    status: streamProxy.status,
    passed: streamProxy.status === 200 || streamProxy.status === 302,
    notes: `Stream proxy response: ${streamProxy.status}`
  });

  // 40. Reverse Proxy Asset - GET /asset-proxy
  const assetProxy = await req({ path: '/asset-proxy?url=https%3A%2F%2Fexample.com', method: 'GET' });
  logResult({
    endpoint: '/asset-proxy',
    method: 'GET',
    status: assetProxy.status,
    passed: assetProxy.status === 200 || assetProxy.status === 302 || assetProxy.status === 400,
    notes: `Asset proxy response: ${assetProxy.status}`
  });

  // 41. Rules - DELETE
  const delRule = await req({ path: `/api/v1/traffic-director/rules/${ruleId}`, method: 'DELETE', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/rules/:ruleId`,
    method: 'DELETE',
    status: delRule.status,
    passed: delRule.status === 200,
    notes: `Deleted rule ID: ${ruleId}`
  });

  // 42. Links - Create extra link for bulk delete test
  const extraSlug = `bulk_test_${Date.now()}`;
  const extraLinkRes = await req({ path: '/api/v1/traffic-director/links', method: 'POST', headers: authHeaders }, {
    name: 'Bulk Delete Candidate',
    slug: extraSlug,
    fallbackUrl: 'https://backup-safe.example.com'
  });
  const extraLinkId = extraLinkRes.data?.data?.link?.id || extraLinkRes.data?.data?.id;

  // 43. Links - Bulk Delete via POST /links/bulk-delete
  const bulkDeletePost = await req({ path: '/api/v1/traffic-director/links/bulk-delete', method: 'POST', headers: authHeaders }, {
    linkIds: [extraLinkId]
  });
  logResult({
    endpoint: '/api/v1/traffic-director/links/bulk-delete',
    method: 'POST',
    status: bulkDeletePost.status,
    passed: bulkDeletePost.status === 200 && bulkDeletePost.data?.success === true,
    notes: `Bulk deleted via POST`
  });

  // 44. Links - Bulk Delete via DELETE /links/bulk
  const extraSlug2 = `bulk_test_del_${Date.now()}`;
  const extraLinkRes2 = await req({ path: '/api/v1/traffic-director/links', method: 'POST', headers: authHeaders }, {
    name: 'Bulk Delete Candidate 2',
    slug: extraSlug2,
    fallbackUrl: 'https://backup-safe.example.com'
  });
  const extraLinkId2 = extraLinkRes2.data?.data?.link?.id || extraLinkRes2.data?.data?.id;

  const bulkDeleteHttp = await req({ path: '/api/v1/traffic-director/links/bulk', method: 'DELETE', headers: authHeaders }, {
    linkIds: [extraLinkId2]
  });
  logResult({
    endpoint: '/api/v1/traffic-director/links/bulk',
    method: 'DELETE',
    status: bulkDeleteHttp.status,
    passed: bulkDeleteHttp.status === 200 && bulkDeleteHttp.data?.success === true,
    notes: `Bulk deleted via DELETE method`
  });

  // 45. Links - DELETE by ID (Cleanup)
  const delLink = await req({ path: `/api/v1/traffic-director/links/${linkId}`, method: 'DELETE', headers: authHeaders });
  logResult({
    endpoint: `/api/v1/traffic-director/links/:linkId`,
    method: 'DELETE',
    status: delLink.status,
    passed: delLink.status === 200,
    notes: `Deleted test link ID: ${linkId}`
  });

  // Summary
  console.log('\n================================================================');
  console.log('              EXHAUSTIVE TEST RESULTS SUMMARY                   ');
  console.log('================================================================');
  console.log(`Total Endpoints Tested : ${passCount + failCount}`);
  console.log(`Endpoints Passed       : ${passCount} ✓`);
  console.log(`Endpoints Failed       : ${failCount} ✗`);
  console.log(`Overall Health Status  : ${failCount === 0 ? '100% ALL ACTIVE & HEALTHY 🚀' : 'ISSUES DETECTED ⚠️'}`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

runFullEndpointVerification().catch(err => {
  console.error('Fatal Test Error:', err);
  process.exit(1);
});
