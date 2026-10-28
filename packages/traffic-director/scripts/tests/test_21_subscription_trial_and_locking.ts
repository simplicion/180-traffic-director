import { TrafficDirectorBillingService } from '../../src/services/billing.service';
import { TrafficLinksService } from '../../src/services/links.service';
import { prisma as db } from '@workspace/db';

async function runSubscriptionTrialAndLockingTest() {
  console.log('================================================================');
  console.log('🧪 180 Traffic Director Subscription & 7-Day Free Trial Test');
  console.log('================================================================\n');

  const testUserId = `test-trial-user-${Date.now()}`;
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
       VALUES ($1, 'Trial Test User', $2, NOW(), NOW())
       ON CONFLICT ("id") DO NOTHING`,
      testUserId,
      `trial-${Date.now()}@example.com`
    );

    // -------------------------------------------------------------
    // Test 1: First-Time User Login / Auto-Provision 7-Day Trial
    // -------------------------------------------------------------
    console.log('1️⃣ Testing First-Time Login 7-Day Free Trial Auto-Provisioning...');
    const status1 = await TrafficDirectorBillingService.getSubscriptionStatus(testUserId);

    assert(status1.success === true, 'getSubscriptionStatus returns success: true');
    assert(status1.subscription.status === 'TRIALING', `status is TRIALING (got: ${status1.subscription.status})`);
    assert(status1.subscription.planTier === 'FREE', `planTier is FREE (got: ${status1.subscription.planTier})`);
    assert(status1.subscription.isTrialing === true, 'isTrialing is true');
    assert(status1.subscription.isTrialExpired === false, 'isTrialExpired is false');
    assert(status1.subscription.trialDaysLeft >= 6 && status1.subscription.trialDaysLeft <= 7, `trialDaysLeft is between 6 and 7 (got: ${status1.subscription.trialDaysLeft})`);
    assert(status1.subscription.isSubscriptionActive === true, 'isSubscriptionActive is true during trial');
    assert(status1.subscription.canCreateMoreLinks === true, 'canCreateMoreLinks is true during trial');
    assert(status1.subscription.cloakingEnabled === true, 'cloakingEnabled is true during trial');
    assert(status1.subscription.hasAdvancedAnalytics === false, 'hasAdvancedAnalytics is false for Free Trial');
    assert(status1.subscription.maxLinks === 1, `Trial maxLinks is 1 (got: ${status1.subscription.maxLinks})`);

    // -------------------------------------------------------------
    // Test 2: Link Quota Enforcement Under Trial (Limit = 1 Link)
    // -------------------------------------------------------------
    console.log('\n2️⃣ Testing Link Quota Enforcement Under Trial (Limit = 1)...');
    
    // Create 1st Link (Allowed)
    const { link: link1 } = await TrafficLinksService.createLink(testUserId, {
      name: 'Trial Test Link 1',
      slug: `trial-link-1-${Date.now()}`,
      fallbackUrl: 'https://example.com/safe',
      userId: testUserId,
    });
    assert(Boolean(link1?.id), 'Successfully created Link 1 under trial');

    // Attempt 2nd Link (Must be BLOCKED on server side)
    let link2Blocked = false;
    try {
      await TrafficLinksService.createLink(testUserId, {
        name: 'Trial Test Link 2',
        slug: `trial-link-2-${Date.now()}`,
        fallbackUrl: 'https://example.com/safe',
        userId: testUserId,
      });
    } catch (err: any) {
      link2Blocked = true;
      assert(err.message.includes('SUBSCRIPTION_REQUIRED') || err.message.includes('limit reached'), `Link 2 blocked with quota message: "${err.message}"`);
    }
    assert(link2Blocked, 'Link 2 was properly blocked by server-side quota limit for Free accounts');

    // -------------------------------------------------------------
    // Test 3: Trial Expiration Scenario & Feature Locking
    // -------------------------------------------------------------
    console.log('\n3️⃣ Testing Trial Expiration & Auto-Locking...');
    
    // Artificially expire the trial
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    try {
      await (db as any).$executeRawUnsafe(
        `UPDATE "TrafficDirectorSubscription" SET "trialEndsAt" = $1, "status" = 'TRIALING' WHERE "userId" = $2`,
        pastDate,
        testUserId
      );
    } catch (e) {}

    // Check status after expiry
    const expiredStatus = await TrafficDirectorBillingService.getSubscriptionStatus(testUserId);
    assert(expiredStatus.subscription.isTrialExpired === true, 'isTrialExpired is true after trialEndsAt elapsed');
    assert(expiredStatus.subscription.status === 'EXPIRED', `status auto-updated to EXPIRED (got: ${expiredStatus.subscription.status})`);
    assert(expiredStatus.subscription.isSubscriptionActive === false, 'isSubscriptionActive is false after trial expired');
    assert(expiredStatus.subscription.canCreateMoreLinks === false, 'canCreateMoreLinks is false when expired');
    assert(expiredStatus.subscription.cloakingEnabled === false, 'cloakingEnabled is false when expired');

    // Test: New link creation blocked with expired message
    let expiredCreateBlocked = false;
    try {
      await TrafficLinksService.createLink(testUserId, {
        name: 'Expired Test Link',
        slug: `expired-link-${Date.now()}`,
        fallbackUrl: 'https://example.com/safe',
        userId: testUserId,
      });
    } catch (err: any) {
      expiredCreateBlocked = true;
      assert(err.message.includes('expired'), `New link blocked with expiration message: "${err.message}"`);
    }
    assert(expiredCreateBlocked, 'New link creation blocked when trial expired');

    // Test: Cloaking power activation toggle blocked when expired
    let cloakingActivationBlocked = false;
    try {
      await TrafficLinksService.updateLink(testUserId, link1.id, { isActive: true });
    } catch (err: any) {
      cloakingActivationBlocked = true;
      assert(err.message.includes('subscription') || err.message.includes('trial'), `Cloaking activation blocked with message: "${err.message}"`);
    }
    assert(cloakingActivationBlocked, 'Cloaking power toggle is locked when trial expired');

    // -------------------------------------------------------------
    // Test 4: Upgrade to PRO Plan ($50, 5 Links, Advanced Analytics)
    // -------------------------------------------------------------
    console.log('\n4️⃣ Testing Upgrade to PRO Plan ($50 Armor)...');
    
    // Simulate paid subscription activation
    try {
      await (db as any).$executeRawUnsafe(
        `UPDATE "TrafficDirectorSubscription" 
         SET "planTier" = 'PRO', "maxLinks" = 5, "status" = 'ACTIVE', "amountCharged" = 50.0, "updatedAt" = NOW()
         WHERE "userId" = $1`,
        testUserId
      );
    } catch (e) {}

    const proStatus = await TrafficDirectorBillingService.getSubscriptionStatus(testUserId);
    assert(proStatus.subscription.status === 'ACTIVE', `PRO status is ACTIVE (got: ${proStatus.subscription.status})`);
    assert(proStatus.subscription.planTier === 'PRO', `planTier is PRO (got: ${proStatus.subscription.planTier})`);
    assert(proStatus.subscription.maxLinks === 5, `maxLinks is 5 (got: ${proStatus.subscription.maxLinks})`);
    assert(proStatus.subscription.isSubscriptionActive === true, 'isSubscriptionActive is true for PRO');
    assert(proStatus.subscription.cloakingEnabled === true, 'cloakingEnabled is true for PRO');
    assert(proStatus.subscription.hasAdvancedAnalytics === true, 'hasAdvancedAnalytics is true for PRO');
    assert(proStatus.subscription.canCreateMoreLinks === true, 'canCreateMoreLinks is true for PRO tier');

    // Test: Can now activate link cloaking
    const activatedLink = await TrafficLinksService.updateLink(testUserId, link1.id, { isActive: true });
    assert(activatedLink.link.isActive === true, 'Cloaking power button successfully activated after upgrade to PRO');

    // Test: Can create link 3 (now quota allows up to 5)
    const { link: link3 } = await TrafficLinksService.createLink(testUserId, {
      name: 'PRO Link 3',
      slug: `pro-link-3-${Date.now()}`,
      fallbackUrl: 'https://example.com/safe',
      userId: testUserId,
    });
    assert(Boolean(link3?.id), 'Successfully created Link 3 under PRO tier (3/5)');

    // -------------------------------------------------------------
    // Test 5: Upgrade to ENTERPRISE Plan ($75, Unlimited Links)
    // -------------------------------------------------------------
    console.log('\n5️⃣ Testing Upgrade to ENTERPRISE Plan ($75 Sovereign)...');

    try {
      await (db as any).$executeRawUnsafe(
        `UPDATE "TrafficDirectorSubscription" 
         SET "planTier" = 'ENTERPRISE', "maxLinks" = -1, "status" = 'ACTIVE', "amountCharged" = 75.0, "updatedAt" = NOW()
         WHERE "userId" = $1`,
        testUserId
      );
    } catch (e) {}

    const entStatus = await TrafficDirectorBillingService.getSubscriptionStatus(testUserId);
    assert(entStatus.subscription.planTier === 'ENTERPRISE', 'planTier is ENTERPRISE');
    assert(entStatus.subscription.maxLinks === -1, 'maxLinks is -1 (Unlimited)');
    assert(entStatus.subscription.isUnlimited === true, 'isUnlimited is true');
    assert(entStatus.subscription.canCreateMoreLinks === true, 'canCreateMoreLinks is true for Unlimited');
    assert(entStatus.subscription.hasAdvancedAnalytics === true, 'hasAdvancedAnalytics is true for ENTERPRISE');

    // Cleanup test data
    try {
      await (db as any).$executeRawUnsafe(
        `DELETE FROM "TrafficLink" WHERE "userId" = $1`,
        testUserId
      );
      await (db as any).$executeRawUnsafe(
        `DELETE FROM "TrafficDirectorSubscription" WHERE "userId" = $1`,
        testUserId
      );
      await (db as any).$executeRawUnsafe(
        `DELETE FROM "User" WHERE "id" = $1`,
        testUserId
      );
    } catch (e) {}

    console.log('\n================================================================');
    console.log(`🎉 ALL TESTS PASSED: ${passedAssertions}/${totalAssertions} Assertions Verified!`);
    console.log('================================================================\n');
  } catch (error: any) {
    console.error('\n❌ Test suite encountered an error:', error);
    // Cleanup even on error
    try {
      await (db as any).$executeRawUnsafe(`DELETE FROM "TrafficLink" WHERE "userId" = $1`, testUserId);
      await (db as any).$executeRawUnsafe(`DELETE FROM "TrafficDirectorSubscription" WHERE "userId" = $1`, testUserId);
      await (db as any).$executeRawUnsafe(`DELETE FROM "User" WHERE "id" = $1`, testUserId);
    } catch (e) {}
    process.exit(1);
  }
}

runSubscriptionTrialAndLockingTest().then(() => process.exit(0));
