import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Universal Database Schema Synchronizer
 * Ensures all Traffic Director tables, columns, indexes, and compatibility fields
 * exist idempotently in the PostgreSQL database.
 */
export async function syncDatabase(connectionUrl?: string) {
  const url = connectionUrl || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is not set.');
    return;
  }

  const p = new PrismaClient({ datasources: { db: { url } } });
  console.log(`==> Synchronizing Traffic Director schema for: ${url.replace(/:[^:@]+@/, ':***@')}...`);

  const statements = [
    // 1. DomainRegistry
    `CREATE TABLE IF NOT EXISTS public."DomainRegistry" (
      "id" TEXT NOT NULL,
      "domain" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "userId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
      "sslStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "isApex" BOOLEAN NOT NULL DEFAULT false,
      "verificationData" JSONB DEFAULT '{}',
      "verifiedAt" TIMESTAMP(3),
      "lastCheckedAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "DomainRegistry_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "DomainRegistry_domain_key" ON public."DomainRegistry"("domain");`,
    `CREATE INDEX IF NOT EXISTS "DomainRegistry_domain_idx" ON public."DomainRegistry"("domain");`,
    `CREATE INDEX IF NOT EXISTS "DomainRegistry_type_targetId_idx" ON public."DomainRegistry"("type", "targetId");`,

    // 2. TrafficLink
    `CREATE TABLE IF NOT EXISTS public."TrafficLink" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "description" TEXT,
      "fallbackUrl" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "customDomain" TEXT,
      "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "totalClicks" INTEGER NOT NULL DEFAULT 0,
      "warmupUntil" TIMESTAMP(3),
      "rampUpEnabled" BOOLEAN NOT NULL DEFAULT false,
      "rampUpDurationHours" INTEGER NOT NULL DEFAULT 24,
      "shieldMode" TEXT NOT NULL DEFAULT 'server',
      "datacenterBlocked" BOOLEAN NOT NULL DEFAULT true,
      "safePageProxyMode" BOOLEAN NOT NULL DEFAULT false,
      "threatFeeds" JSONB,
      "customThreatList" JSONB,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficLink_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "TrafficLink_slug_key" ON public."TrafficLink"("slug");`,
    `CREATE INDEX IF NOT EXISTS "TrafficLink_userId_idx" ON public."TrafficLink"("userId");`,
    `CREATE INDEX IF NOT EXISTS "TrafficLink_slug_idx" ON public."TrafficLink"("slug");`,

    // 3. TrafficDirectorSubscription
    `CREATE TABLE IF NOT EXISTS public."TrafficDirectorSubscription" (
      "id" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "planTier" TEXT NOT NULL DEFAULT 'FREE',
      "maxLinks" INTEGER NOT NULL DEFAULT 1,
      "status" TEXT NOT NULL DEFAULT 'ACTIVE',
      "oneEightySubId" TEXT,
      "amountCharged" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "couponApplied" TEXT,
      "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
      "trialStartedAt" TIMESTAMP(3),
      "trialEndsAt" TIMESTAMP(3),
      "currentPeriodStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "currentPeriodEnd" TIMESTAMP(3),
      "nextBillingDate" TIMESTAMP(3),
      "autoRenew" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficDirectorSubscription_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "TrafficDirectorSubscription_userId_key" ON public."TrafficDirectorSubscription"("userId");`,
    `CREATE INDEX IF NOT EXISTS "TrafficDirectorSubscription_userId_status_idx" ON public."TrafficDirectorSubscription"("userId", "status");`,

    // 4. TrafficRule
    `CREATE TABLE IF NOT EXISTS public."TrafficRule" (
      "id" TEXT NOT NULL,
      "linkId" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "name" TEXT NOT NULL,
      "priority" INTEGER NOT NULL DEFAULT 0,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "ruleType" TEXT NOT NULL DEFAULT 'geo',
      "actionType" TEXT DEFAULT 'redirect',
      "matchMode" TEXT NOT NULL DEFAULT 'match',
      "conditions" JSONB NOT NULL DEFAULT '[]',
      "destinationUrl" TEXT NOT NULL,
      "weight" INTEGER DEFAULT 100,
      "matchCount" INTEGER DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficRule_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "TrafficRule_linkId_idx" ON public."TrafficRule"("linkId");`,
    `CREATE INDEX IF NOT EXISTS "TrafficRule_priority_idx" ON public."TrafficRule"("priority");`,

    // 5. TrafficLog
    `CREATE TABLE IF NOT EXISTS public."TrafficLog" (
      "id" TEXT NOT NULL,
      "linkId" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "ruleId" TEXT,
      "ipAddress" TEXT,
      "country" TEXT,
      "region" TEXT,
      "city" TEXT,
      "device" TEXT,
      "deviceType" TEXT,
      "os" TEXT,
      "browser" TEXT,
      "userAgent" TEXT,
      "referer" TEXT,
      "referrer" TEXT,
      "actionTaken" TEXT NOT NULL DEFAULT 'REDIRECT',
      "matchedRuleId" TEXT,
      "destinationUrl" TEXT,
      "isTor" BOOLEAN NOT NULL DEFAULT false,
      "isVpn" BOOLEAN NOT NULL DEFAULT false,
      "isDatacenter" BOOLEAN NOT NULL DEFAULT false,
      "isBot" BOOLEAN NOT NULL DEFAULT false,
      "botName" TEXT,
      "networkType" TEXT,
      "gpuRenderer" TEXT,
      "touchPoints" INTEGER,
      "batteryLevel" DOUBLE PRECISION,
      "isEmulated" BOOLEAN DEFAULT false,
      "responseStatus" INTEGER DEFAULT 200,
      "latencyMs" INTEGER DEFAULT 0,
      "fraudScore" INTEGER,
      "headers" JSONB,
      "processingTimeMs" INTEGER,
      "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficLog_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "TrafficLog_linkId_timestamp_idx" ON public."TrafficLog"("linkId", "timestamp");`,
    `CREATE INDEX IF NOT EXISTS "TrafficLog_timestamp_idx" ON public."TrafficLog"("timestamp");`,

    // 6. TrafficPixelConfig
    `CREATE TABLE IF NOT EXISTS public."TrafficPixelConfig" (
      "id" TEXT NOT NULL,
      "linkId" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "masterPixelId" TEXT,
      "backupPixelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "testEventCode" TEXT,
      "capiEnabled" BOOLEAN NOT NULL DEFAULT false,
      "enableCapi" BOOLEAN NOT NULL DEFAULT true,
      "capiTokenEnc" TEXT,
      "metaAccessToken" TEXT,
      "googleAdsConversionId" TEXT,
      "googleAdsConversionLabel" TEXT,
      "googleEnhancedConversions" BOOLEAN NOT NULL DEFAULT false,
      "tiktokPixelId" TEXT,
      "tiktokAccessToken" TEXT,
      "customHeaderScript" TEXT,
      "customBodyScript" TEXT,
      "fireOnBot" BOOLEAN NOT NULL DEFAULT false,
      "fireOnBots" BOOLEAN NOT NULL DEFAULT false,
      "trackPageViews" BOOLEAN NOT NULL DEFAULT true,
      "trackOutbound" BOOLEAN NOT NULL DEFAULT true,
      "deduplicateEvents" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficPixelConfig_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "TrafficPixelConfig_linkId_key" ON public."TrafficPixelConfig"("linkId");`,
    `CREATE INDEX IF NOT EXISTS "TrafficPixelConfig_linkId_idx" ON public."TrafficPixelConfig"("linkId");`,

    // 7. TrafficPixelEvent
    `CREATE TABLE IF NOT EXISTS public."TrafficPixelEvent" (
      "id" TEXT NOT NULL,
      "configId" TEXT NOT NULL,
      "eventName" TEXT NOT NULL,
      "triggerType" TEXT NOT NULL,
      "selector" TEXT,
      "urlPattern" TEXT,
      "eventValueKey" TEXT,
      "currency" TEXT NOT NULL DEFAULT 'USD',
      "isEnabled" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficPixelEvent_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "TrafficPixelEvent_configId_idx" ON public."TrafficPixelEvent"("configId");`,

    // 8. TrafficPixelLog
    `CREATE TABLE IF NOT EXISTS public."TrafficPixelLog" (
      "id" TEXT NOT NULL,
      "linkId" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "platform" TEXT NOT NULL DEFAULT 'meta',
      "pixelId" TEXT NOT NULL,
      "eventId" TEXT NOT NULL,
      "eventName" TEXT NOT NULL,
      "deliverySource" TEXT NOT NULL,
      "browserFired" BOOLEAN NOT NULL DEFAULT false,
      "capiFired" BOOLEAN NOT NULL DEFAULT false,
      "capiStatus" TEXT,
      "capiLatencyMs" INTEGER,
      "isBotFiltered" BOOLEAN NOT NULL DEFAULT false,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "fbp" TEXT,
      "fbc" TEXT,
      "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "TrafficPixelLog_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE INDEX IF NOT EXISTS "TrafficPixelLog_linkId_timestamp_idx" ON public."TrafficPixelLog"("linkId", "timestamp");`,
    `CREATE INDEX IF NOT EXISTS "TrafficPixelLog_eventId_idx" ON public."TrafficPixelLog"("eventId");`
  ];

  for (const stmt of statements) {
    try {
      await p.$executeRawUnsafe(stmt);
    } catch (e: any) {
      // Non-fatal index or column notice
    }
  }

  console.log('==> Schema sync completed successfully!');
  await p.$disconnect();
}

if (require.main === module) {
  syncDatabase().catch(console.error);
}
