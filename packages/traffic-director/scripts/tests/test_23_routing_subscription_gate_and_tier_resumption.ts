import { TrafficDirectorBillingService } from '../../src/services/billing.service';
import { TrafficLinksService } from '../../src/services/links.service';
import { DecisionEngine } from '../../src/evaluator/decision-engine';
import { prisma as db } from '@workspace/db';

async function runEdgeCloakingSubscriptionGateTest() {
  console.log('========================================================================');
  console.log('🧪 Test 23: Edge Cloaking Subscription Locking & Automatic Resume');
  console.log('========================================================================\n');

  const testUserId = `test-gate-user-${Date.now()}`;
  let passedAssertions = 0;
  let totalAssertions = 0;

  function assert(condition: boolean, description: string) {
    totalAssertions++;
    if (condition) {
      console.log(`  ✅ [PASS] ${description}`);
      passedAssertions++;
    } else {
      console.error(`  ❌ [FAIL] ${description}`);
      throw new Error(`Assertion failed: ${description}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup: Ensure User Record Exists for Foreign Key Constraints
    // -------------------------------------------------------------
    await (db as any).$executeRawUnsafe(
      `INSERT INTO "User" ("id", "name", "email", "createdAt", "updatedAt") 
       VALUES ($1, 'Gate Test User', $2, NOW(), NOW())
       ON CONFLICT ("id") DO NOTHING`,
      testUserId,
      `gate-${Date.now()}@example.com`
    );

    // -------------------------------------------------------------
    // 1. First-Time Auto Provisioned Trial -> Active Cloaking
    // -------------------------------------------------------------
    console.log('1️⃣ Verifying Trial Active Cloaking Evaluation...');
    const statusTrial = await TrafficDirectorBillingService.getSubscriptionStatus(testUserId);
    assert(statusTrial.subscription.status === 'TRIALING', 'User auto-provisioned in TRIALING status');
    assert(statusTrial.subscription.cloakingEnabled === true, 'Cloaking enabled during 7-day trial');

    const { link } = await TrafficLinksService.createLink(testUserId, {
      name: 'Money Offer Alpha',
      slug: `gate-link-${Date.now()}`,
      fallbackUrl: 'https://safepage.example.com/clean',
      cloakedUrl: 'https://moneyoffer.example.com/convert',
      rampUpEnabled: false,
      userId: testUserId,
    });
    assert(Boolean(link?.id), 'Created test link');

    // Simulate clean human visitor
    const humanSignals: any = {
      ip: '98.142.10.5',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15',
      referer: 'https://instagram.com/',
      country: 'US',
      city: 'Los Angeles',
      region: 'CA',
      asn: 7922,
      asOrg: 'Comcast Cable',
      networkType: 'residential',
      isKnownCrawler: false,
      isTorExitNode: false,
      isKnownSpyService: false,
      isKnownVpnOrProxy: false,
      crawlerCategory: null,
      deviceType: 'mobile',
      os: 'iOS',
      browser: 'Mobile Safari',
      browserLanguage: 'en-US',
      queryParams: {},
      rawHeaders: {}
    };

    // Edge check with trial active
    const isSubActiveTrial = await TrafficDirectorBillingService.isUserSubscriptionActive(testUserId);
    assert(isSubActiveTrial === true, 'isUserSubscriptionActive is TRUE during trial');

    const evalTrial = DecisionEngine.evaluate(
      {
        id: link.id,
        fallbackUrl: link.fallbackUrl,
        isActive: Boolean(link.isActive && isSubActiveTrial),
        rules: link.rules
      },
      humanSignals
    );
    assert(evalTrial.destinationUrl === 'https://moneyoffer.example.com/convert', `Trial delivers money offer (got: ${evalTrial.destinationUrl})`);
    assert(evalTrial.isFallback === false, 'isFallback is FALSE during trial for qualified visitor');

    // -------------------------------------------------------------
    // 2. Trial Expiration -> Automatic Edge Cloaking Lockout
    // -------------------------------------------------------------
    console.log('\n2️⃣ Verifying Edge Behavior When Trial Expires...');
    // Artificially expire the trial
    await (db as any).$executeRawUnsafe(
      `UPDATE "TrafficDirectorSubscription" 
       SET "trialEndsAt" = NOW() - INTERVAL '2 days', "status" = 'EXPIRED', "updatedAt" = NOW()
       WHERE "userId" = $1`,
      testUserId
    );
    TrafficDirectorBillingService.invalidateSubscriptionCache(testUserId);

    const isSubActiveExpired = await TrafficDirectorBillingService.isUserSubscriptionActive(testUserId);
    assert(isSubActiveExpired === false, 'isUserSubscriptionActive is FALSE when trial expires');

    const evalExpired = DecisionEngine.evaluate(
      {
        id: link.id,
        fallbackUrl: link.fallbackUrl,
        isActive: Boolean(link.isActive && isSubActiveExpired),
        rules: link.rules
      },
      humanSignals
    );
    assert(evalExpired.destinationUrl === 'https://safepage.example.com/clean', `Expired subscription safely routes to fallback page (got: ${evalExpired.destinationUrl})`);
    assert(evalExpired.isFallback === true, 'isFallback is TRUE when subscription is expired (cloaking paused)');

    // -------------------------------------------------------------
    // 3. Subscription Upgrade -> Automatic Resume
    // -------------------------------------------------------------
    console.log('\n3️⃣ Verifying Automatic Cloaking Resumption Upon Subscription Upgrade...');
    // Simulate 180 Pay webhook subscription.activated
    await TrafficDirectorBillingService.handleWebhookEvent({
      event: 'subscription.activated',
      data: {
        subscriptionId: `sub_180_${Date.now()}`,
        planCode: 'pro-monthly',
        amount: 50,
        currency: 'USD',
        metadata: {
          userId: testUserId,
          planTier: 'PRO'
        }
      }
    });

    const statusAfterUpgrade = await TrafficDirectorBillingService.getSubscriptionStatus(testUserId);
    assert(statusAfterUpgrade.subscription.status === 'ACTIVE', 'Subscription status updated to ACTIVE');
    assert(statusAfterUpgrade.subscription.planTier === 'PRO', 'Plan tier updated to PRO ($50 Armor)');
    assert(statusAfterUpgrade.subscription.cloakingEnabled === true, 'Cloaking enabled is TRUE after upgrade');
    assert(statusAfterUpgrade.subscription.hasAdvancedAnalytics === true, 'hasAdvancedAnalytics is TRUE for PRO tier');

    const isSubActiveUpgraded = await TrafficDirectorBillingService.isUserSubscriptionActive(testUserId);
    assert(isSubActiveUpgraded === true, 'isUserSubscriptionActive is TRUE after upgrade');

    // Automatic resume: Same link, same rules, zero manual intervention
    const evalUpgraded = DecisionEngine.evaluate(
      {
        id: link.id,
        fallbackUrl: link.fallbackUrl,
        isActive: Boolean(link.isActive && isSubActiveUpgraded),
        rules: link.rules
      },
      humanSignals
    );
    assert(evalUpgraded.destinationUrl === 'https://moneyoffer.example.com/convert', `AUTOMATIC RESUME: Traffic immediately routes to money offer again (got: ${evalUpgraded.destinationUrl})`);
    assert(evalUpgraded.isFallback === false, 'isFallback is FALSE after upgrade');

    // -------------------------------------------------------------
    // 4. Starter Plan Analytics Gating ($25 Plan)
    // -------------------------------------------------------------
    console.log('\n4️⃣ Verifying Starter Plan ($25) Analytics Gating...');
    await TrafficDirectorBillingService.handleWebhookEvent({
      event: 'subscription.activated',
      data: {
        subscriptionId: `sub_starter_${Date.now()}`,
        planCode: 'starter-monthly',
        amount: 25,
        currency: 'USD',
        metadata: {
          userId: testUserId,
          planTier: 'STARTER'
        }
      }
    });

    const statusStarter = await TrafficDirectorBillingService.getSubscriptionStatus(testUserId);
    assert(statusStarter.subscription.planTier === 'STARTER', 'Plan tier is STARTER');
    assert(statusStarter.subscription.hasAdvancedAnalytics === false, 'hasAdvancedAnalytics is FALSE for STARTER ($25 basic plan)');
    assert(statusStarter.subscription.cloakingEnabled === true, 'Cloaking enabled is TRUE on STARTER');
    assert(statusStarter.subscription.maxLinks === 2, 'maxLinks is 2 on STARTER');

    // Cleanup
    await (db as any).$executeRawUnsafe(`DELETE FROM "TrafficRule" WHERE "linkId" = $1`, link.id);
    await (db as any).$executeRawUnsafe(`DELETE FROM "TrafficLink" WHERE "userId" = $1`, testUserId);
    await (db as any).$executeRawUnsafe(`DELETE FROM "TrafficDirectorSubscription" WHERE "userId" = $1`, testUserId);
    await (db as any).$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = $1`, testUserId);

    console.log('\n========================================================================');
    console.log(`🎉 ALL ASSERTIONS PASSED: ${passedAssertions}/${totalAssertions} Verified!`);
    console.log('========================================================================\n');
  } catch (error: any) {
    console.error('\n❌ Test failed with error:', error);
    try {
      await (db as any).$executeRawUnsafe(`DELETE FROM "TrafficLink" WHERE "userId" = $1`, testUserId);
      await (db as any).$executeRawUnsafe(`DELETE FROM "TrafficDirectorSubscription" WHERE "userId" = $1`, testUserId);
      await (db as any).$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = $1`, testUserId);
    } catch (_) {}
    process.exit(1);
  }
}

runEdgeCloakingSubscriptionGateTest().then(() => process.exit(0));
