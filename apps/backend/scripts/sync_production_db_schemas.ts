import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
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
      "activePlatform" TEXT NOT NULL DEFAULT 'both',
      "masterPixelId" TEXT,
      "backupPixelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
      "capiTokenEnc" TEXT,
      "testEventCode" TEXT,
      "enableCapi" BOOLEAN NOT NULL DEFAULT true,
      "enableLdu" BOOLEAN NOT NULL DEFAULT false,
      "googleConversionId" TEXT,
      "googleConversionLabels" JSONB,
      "enableGoogleEnhancedConversions" BOOLEAN NOT NULL DEFAULT true,
      "enableGoogleConsentMode" BOOLEAN NOT NULL DEFAULT true,
      "googleDefaultConsent" TEXT NOT NULL DEFAULT 'granted',
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
    `CREATE INDEX IF NOT EXISTS "TrafficPixelLog_eventId_idx" ON public."TrafficPixelLog"("eventId");`,

    // 9. Safe Idempotent Column Migrations for Existing Tables
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "activePlatform" TEXT NOT NULL DEFAULT 'both';`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "enableLdu" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "googleConversionId" TEXT;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "googleConversionLabels" JSONB;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "enableGoogleEnhancedConversions" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "enableGoogleConsentMode" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "googleDefaultConsent" TEXT NOT NULL DEFAULT 'granted';`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "capiTokenEnc" TEXT;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "backupPixelIds" TEXT[] DEFAULT ARRAY[]::TEXT[];`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "fireOnBots" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "trackPageViews" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE public."TrafficPixelConfig" ADD COLUMN IF NOT EXISTS "trackOutbound" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE public."DomainRegistry" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
    `CREATE INDEX IF NOT EXISTS "DomainRegistry_userId_idx" ON public."DomainRegistry"("userId");`,
    `ALTER TABLE public."TrafficLink" ADD COLUMN IF NOT EXISTS "safePageProxyMode" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE public."TrafficLink" ADD COLUMN IF NOT EXISTS "rampUpEnabled" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE public."TrafficLink" ADD COLUMN IF NOT EXISTS "rampUpDurationHours" INTEGER NOT NULL DEFAULT 24;`,
    `ALTER TABLE public."TrafficLink" ADD COLUMN IF NOT EXISTS "datacenterBlocked" BOOLEAN NOT NULL DEFAULT true;`,
    `ALTER TABLE public."TrafficLink" ADD COLUMN IF NOT EXISTS "threatFeeds" JSONB;`,
    `ALTER TABLE public."TrafficLink" ADD COLUMN IF NOT EXISTS "customThreatList" JSONB;`,
    `ALTER TABLE public."TrafficLink" ADD COLUMN IF NOT EXISTS "warmupUntil" TIMESTAMP(3);`,
    `ALTER TABLE public."TrafficRule" ADD COLUMN IF NOT EXISTS "actionType" TEXT DEFAULT 'redirect';`,
    `ALTER TABLE public."TrafficRule" ADD COLUMN IF NOT EXISTS "weight" INTEGER DEFAULT 100;`,
    `ALTER TABLE public."TrafficRule" ADD COLUMN IF NOT EXISTS "matchCount" INTEGER DEFAULT 0;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "deviceType" TEXT;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "referrer" TEXT;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "botName" TEXT;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "networkType" TEXT;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "gpuRenderer" TEXT;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "touchPoints" INTEGER;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "batteryLevel" DOUBLE PRECISION;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "isEmulated" BOOLEAN DEFAULT false;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "destinationUrl" TEXT;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "responseStatus" INTEGER DEFAULT 200;`,
    `ALTER TABLE public."TrafficLog" ADD COLUMN IF NOT EXISTS "latencyMs" INTEGER DEFAULT 0;`,

    // 10. 180 Forms & Website Builder Tables (User-Scoped)
    `CREATE TABLE IF NOT EXISTS public."Form" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "companyId" TEXT,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "slug" TEXT NOT NULL,
      "isActive" BOOLEAN NOT NULL DEFAULT true,
      "formType" TEXT NOT NULL DEFAULT 'GENERAL_SURVEY',
      "formCode" TEXT,
      "apiKey" TEXT,
      "settings" JSONB DEFAULT '{}',
      "viewsCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Form_slug_key" ON public."Form"("slug");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Form_apiKey_key" ON public."Form"("apiKey");`,
    `CREATE INDEX IF NOT EXISTS "Form_userId_idx" ON public."Form"("userId");`,
    `CREATE INDEX IF NOT EXISTS "Form_formType_idx" ON public."Form"("formType");`,

    `CREATE TABLE IF NOT EXISTS public."FormField" (
      "id" TEXT NOT NULL,
      "formId" TEXT NOT NULL,
      "label" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "required" BOOLEAN NOT NULL DEFAULT false,
      "placeholder" TEXT,
      "description" TEXT,
      "options" JSONB,
      "validation" JSONB,
      "order" INTEGER NOT NULL DEFAULT 0,
      "mapping" TEXT,
      CONSTRAINT "FormField_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "FormField_formId_fkey" FOREIGN KEY ("formId") REFERENCES public."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "FormField_formId_idx" ON public."FormField"("formId");`,

    `CREATE TABLE IF NOT EXISTS public."FormSubmission" (
      "id" TEXT NOT NULL,
      "formId" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "status" TEXT NOT NULL DEFAULT 'new',
      "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "referrer" TEXT,
      "leadId" TEXT,
      "clientId" TEXT,
      CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "FormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES public."Form"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "FormSubmission_formId_idx" ON public."FormSubmission"("formId");`,
    `CREATE INDEX IF NOT EXISTS "FormSubmission_userId_idx" ON public."FormSubmission"("userId");`,

    `CREATE TABLE IF NOT EXISTS public."FormSubmissionValue" (
      "id" TEXT NOT NULL,
      "submissionId" TEXT NOT NULL,
      "fieldId" TEXT NOT NULL,
      "value" TEXT,
      "fileUrl" TEXT,
      "fileName" TEXT,
      CONSTRAINT "FormSubmissionValue_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "FormSubmissionValue_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES public."FormSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "FormSubmissionValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES public."FormField"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "FormSubmissionValue_submissionId_idx" ON public."FormSubmissionValue"("submissionId");`,
    `CREATE INDEX IF NOT EXISTS "FormSubmissionValue_fieldId_idx" ON public."FormSubmissionValue"("fieldId");`,

    `CREATE TABLE IF NOT EXISTS public."Website" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "companyId" TEXT,
      "name" TEXT NOT NULL,
      "slug" TEXT NOT NULL,
      "customDomain" TEXT,
      "template" TEXT,
      "config" JSONB DEFAULT '{}',
      "publishedConfig" JSONB,
      "isPublished" BOOLEAN NOT NULL DEFAULT false,
      "owner" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "stats" JSONB DEFAULT '{}',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Website_pkey" PRIMARY KEY ("id")
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Website_slug_key" ON public."Website"("slug");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "Website_customDomain_key" ON public."Website"("customDomain");`,
    `CREATE INDEX IF NOT EXISTS "Website_userId_idx" ON public."Website"("userId");`,

    `CREATE TABLE IF NOT EXISTS public."Pixel" (
      "id" TEXT NOT NULL,
      "websiteId" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "provider" TEXT NOT NULL,
      "pixelId" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Pixel_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Pixel_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES public."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "Pixel_websiteId_idx" ON public."Pixel"("websiteId");`,
    `CREATE INDEX IF NOT EXISTS "Pixel_userId_idx" ON public."Pixel"("userId");`,

    `CREATE TABLE IF NOT EXISTS public."WebsiteFormSubmission" (
      "id" TEXT NOT NULL,
      "websiteId" TEXT NOT NULL,
      "userId" TEXT,
      "companyId" TEXT,
      "name" TEXT,
      "email" TEXT,
      "phone" TEXT,
      "message" TEXT,
      "data" JSONB,
      "status" TEXT NOT NULL DEFAULT 'new',
      "ipAddress" TEXT,
      "userAgent" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "WebsiteFormSubmission_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "WebsiteFormSubmission_websiteId_fkey" FOREIGN KEY ("websiteId") REFERENCES public."Website"("id") ON DELETE CASCADE ON UPDATE CASCADE
    );`,
    `CREATE INDEX IF NOT EXISTS "WebsiteFormSubmission_websiteId_idx" ON public."WebsiteFormSubmission"("websiteId");`,
    `CREATE INDEX IF NOT EXISTS "WebsiteFormSubmission_userId_idx" ON public."WebsiteFormSubmission"("userId");`,

    // Safe column additions for existing Form / Website tables if migrated from legacy DB
    `ALTER TABLE public."Form" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
    `ALTER TABLE public."Form" ALTER COLUMN "companyId" DROP NOT NULL;`,
    `ALTER TABLE public."FormSubmission" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
    `ALTER TABLE public."FormSubmission" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'new';`,
    `ALTER TABLE public."FormSubmission" ALTER COLUMN "companyId" DROP NOT NULL;`,
    `ALTER TABLE public."Website" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
    `ALTER TABLE public."Website" ALTER COLUMN "companyId" DROP NOT NULL;`,
    `ALTER TABLE public."Pixel" ADD COLUMN IF NOT EXISTS "userId" TEXT;`,
    `ALTER TABLE public."WebsiteFormSubmission" ADD COLUMN IF NOT EXISTS "userId" TEXT;`
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
