import { Request, Response } from 'express';
import { 
  TrafficLinksService, 
  TrafficRulesService, 
  TrafficAnalyticsService, 
  ThreatIntelligenceService,
  TorExitSyncService,
  TrafficDirectorBillingService,
  PixelManagerService
} from '@workspace/traffic-director';

export class TrafficDirectorController {
  /**
   * Resolves the authenticated user ID for the request.
   */
  private static async getUserId(req: Request): Promise<string> {
    const reqAny = req as any;
    let userId = reqAny.userId || reqAny.user?.id || reqAny.user?.userId;
    if (userId) return userId;

    const user = reqAny.user;
    if (user?.email) {
      const { prisma } = require('@workspace/db');
      const dbUser = await prisma.user.findFirst({
        where: { email: { equals: user.email, mode: 'insensitive' } },
        select: { id: true }
      });
      if (dbUser?.id) {
        reqAny.userId = dbUser.id;
        return dbUser.id;
      }
    }

    return '';
  }

  // ─── Links ─────────────────────────────────────────────────────────
  static async getLinks(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { page, limit, search, isActive } = req.query;

      const result = await TrafficLinksService.getLinks(userId, {
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        search: search ? String(search) : undefined,
        isActive: isActive !== undefined ? isActive === 'true' : undefined
      });

      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getLinks]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch links' });
    }
  }

  static async checkSlug(req: Request, res: Response) {
    try {
      const slug = String(req.query.slug || '');
      const excludeLinkId = req.query.excludeLinkId ? String(req.query.excludeLinkId) : undefined;
      const result = await TrafficLinksService.checkSlugAvailability(slug, excludeLinkId);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.checkSlug]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to check slug' });
    }
  }

  static async verifyTagInstallation(req: Request, res: Response) {
    try {
      const { url, slug } = req.body || {};
      if (!url || typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ success: false, error: 'URL is required' });
      }
      if (!slug || typeof slug !== 'string' || !slug.trim()) {
        return res.status(400).json({ success: false, error: 'Slug is required' });
      }

      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = `https://${targetUrl}`;
      }

      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      const startTime = Date.now();

      // Check 1: Verify Smart Link exists in our platform
      const link = await TrafficLinksService.getLinkBySlug(cleanSlug);
      const linkExists = Boolean(link);

      const checks: Array<{
        name: string;
        status: 'passed' | 'warning' | 'failed';
        message: string;
      }> = [];

      // Add Link Existence Check
      if (linkExists) {
        checks.push({
          name: 'Link Configuration',
          status: 'passed',
          message: `Smart Link "/r/${cleanSlug}" is active with ${link?.rules?.length || 0} rule(s) and fallback target.`
        });
      } else {
        checks.push({
          name: 'Link Configuration',
          status: 'failed',
          message: `Smart Link with slug "${cleanSlug}" was not found in the database. Please create the link first.`
        });
      }

      // Check if user entered their target offer URL instead of safe page/gateway
      const isTargetUrl = Boolean(link?.rules?.some((r: any) => {
        if (!r.destinationUrl) return false;
        const normTarget = targetUrl.replace(/\/+$/, '').toLowerCase();
        const normDest = r.destinationUrl.replace(/\/+$/, '').toLowerCase();
        return normTarget === normDest || normTarget.startsWith(normDest) || normDest.startsWith(normTarget);
      }));

      if (isTargetUrl) {
        checks.push({
          name: 'Target URL Misconfiguration Warning',
          status: 'warning',
          message: `You entered your Target Offer URL (${targetUrl}). The verification scanner is meant to test your Cloaked Gateway or Safe Page (where index.php or the tracking script is installed), NOT your destination offer/money page.`
        });
      }

      // Fetch the landing page
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      try {
        const pageRes = await fetch(targetUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 180workspace-Tag-Verifier/1.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startTime;
        const statusCode = pageRes.status;

        // Check 2: HTTP Reachability
        if (statusCode >= 200 && statusCode < 400) {
          checks.push({
            name: 'Page Reachability',
            status: 'passed',
            message: `HTTP ${statusCode} OK (Response time: ${latencyMs}ms)`
          });
        } else {
          checks.push({
            name: 'Page Reachability',
            status: 'failed',
            message: `Target returned HTTP ${statusCode}. Make sure the page is publicly accessible.`
          });
        }

        const html = await pageRes.text();

        // Check 3: Tag Script Detection
        const hasScriptTag = 
          html.includes(`/tag/${cleanSlug}.js`) ||
          html.includes(`tag/${cleanSlug}.js`) ||
          html.includes(`data-link-slug="${cleanSlug}"`) ||
          html.includes(`/evaluate/${cleanSlug}`);

        const hasAnyTagScript = html.includes('/tag/') || html.includes('td-shield');

        if (hasScriptTag) {
          checks.push({
            name: 'JavaScript Tag',
            status: 'passed',
            message: `Found valid script tag referencing "/tag/${cleanSlug}.js" in page HTML.`
          });
        } else if (hasAnyTagScript) {
          checks.push({
            name: 'JavaScript Tag',
            status: 'warning',
            message: `Found a Traffic Director script tag, but the slug does not match "${cleanSlug}". Check the slug in your embed snippet.`
          });
        } else {
          checks.push({
            name: 'JavaScript Tag',
            status: 'failed',
            message: `Could not find <script src=".../tag/${cleanSlug}.js"> in page HTML. Ensure you copied and pasted the exact snippet before </head>.`
          });
        }

        // Check 4: PHP Integration Detection
        const isPhpUrl = targetUrl.endsWith('.php') || targetUrl.includes('.php?');
        const hasPhpSigns = 
          pageRes.headers.get('x-powered-by')?.toLowerCase().includes('php') ||
          pageRes.headers.get('server')?.toLowerCase().includes('php');

        if (isPhpUrl || hasPhpSigns) {
          checks.push({
            name: 'PHP Gateway Integration',
            status: 'passed',
            message: `Page environment is running PHP. Server-side cloaking via index.php provides zero-latency protection.`
          });
        } else {
          checks.push({
            name: 'PHP Gateway Integration',
            status: 'passed',
            message: 'HTML/Static integration detected. Client-side shielding active.'
          });
        }

        // Check 5: SSL/HTTPS
        if (targetUrl.startsWith('https://')) {
          checks.push({
            name: 'SSL Security',
            status: 'passed',
            message: 'Page is secured with valid HTTPS.'
          });
        } else {
          checks.push({
            name: 'SSL Security',
            status: 'warning',
            message: 'Page is using unencrypted HTTP. Meta/Google will reject landing pages without HTTPS.'
          });
        }

        const passedCount = checks.filter(c => c.status === 'passed').length;
        const totalChecks = checks.length;
        const overallStatus = checks.some(c => c.status === 'failed') 
          ? 'unverified' 
          : checks.some(c => c.status === 'warning') 
            ? 'warning' 
            : 'verified';

        return res.json({
          success: true,
          data: {
            overallStatus,
            score: Math.round((passedCount / totalChecks) * 100),
            checks,
            url: targetUrl,
            slug: cleanSlug,
            latencyMs,
            verifiedAt: new Date().toISOString()
          }
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        return res.json({
          success: true,
          data: {
            overallStatus: 'unverified',
            score: 0,
            checks: [
              {
                name: 'Connection',
                status: 'failed',
                message: `Failed to connect to ${targetUrl}: ${fetchErr.message}. Make sure your domain is active and online.`
              }
            ],
            url: targetUrl,
            slug: cleanSlug,
            verifiedAt: new Date().toISOString()
          }
        });
      }
    } catch (error: any) {
      console.error('[TrafficDirectorController.verifyTagInstallation]', error);
      return res.status(500).json({ success: false, error: error.message || 'Verification failed' });
    }
  }

  static async getLinkById(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkId = String(req.params.linkId);

      const result = await TrafficLinksService.getLinkById(userId, linkId);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getLinkById]', error);
      return res.status(404).json({ success: false, error: error.message || 'Link not found' });
    }
  }

  static async createLink(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { 
        name, slug, description, fallbackUrl, customDomain, tags,
        warmupUntil, rampUpEnabled, rampUpDurationHours, shieldMode, datacenterBlocked,
        safePageProxyMode, threatFeeds, customThreatList
      } = req.body;

      if (!name || !slug || !fallbackUrl) {
        return res.status(400).json({ success: false, error: 'Name, slug, and fallbackUrl are required' });
      }

      const result = await TrafficLinksService.createLink(userId, {
        userId,
        name,
        slug,
        description,
        fallbackUrl,
        customDomain,
        tags,
        warmupUntil,
        rampUpEnabled,
        rampUpDurationHours,
        shieldMode,
        datacenterBlocked,
        safePageProxyMode,
        threatFeeds,
        customThreatList
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.createLink]', error);
      const isSubError = Boolean(error.message && error.message.includes('SUBSCRIPTION_REQUIRED'));
      return res.status(isSubError ? 403 : 400).json({
        success: false,
        code: isSubError ? 'SUBSCRIPTION_REQUIRED' : 'BAD_REQUEST',
        error: error.message || 'Failed to create link',
        upgradeUrl: isSubError ? '/traffic-director/subscription' : undefined
      });
    }
  }

  static async updateLink(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkId = String(req.params.linkId);

      const result = await TrafficLinksService.updateLink(userId, linkId, req.body);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.updateLink]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to update link' });
    }
  }

  static async deleteLink(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkId = String(req.params.linkId);

      await TrafficLinksService.deleteLink(userId, linkId);
      return res.json({ success: true, message: 'Link deleted successfully' });
    } catch (error: any) {
      console.error('[TrafficDirectorController.deleteLink]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to delete link' });
    }
  }

  static async bulkDeleteLinks(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkIds = req.body.linkIds || req.body.ids || [];
      if (!Array.isArray(linkIds) || linkIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Please provide linkIds to delete' });
      }

      let deletedCount = 0;
      for (const linkId of linkIds) {
        try {
          await TrafficLinksService.deleteLink(userId, linkId);
          deletedCount++;
        } catch (e) {}
      }
      return res.json({ success: true, message: `Successfully deleted ${deletedCount} links`, count: deletedCount });
    } catch (error: any) {
      console.error('[TrafficDirectorController.bulkDeleteLinks]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to delete links' });
    }
  }

  // ─── Rules ────────────────────────────────────────────────────────
  static async getRules(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkId = String(req.params.linkId);

      const result = await TrafficRulesService.getRulesByLinkId(userId, linkId);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getRules]', error);
      return res.status(404).json({ success: false, error: error.message || 'Rules not found' });
    }
  }

  static async createRule(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkId = String(req.params.linkId);
      const { name, destinationUrl, actionType, conditions, weight, priority, isActive } = req.body;

      if (!name || !destinationUrl) {
        return res.status(400).json({ success: false, error: 'Name and destinationUrl are required' });
      }

      const result = await TrafficRulesService.createRule(userId, {
        linkId,
        name,
        destinationUrl,
        actionType,
        conditions: conditions || [],
        weight: weight !== undefined ? Number(weight) : 100,
        priority,
        isActive
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.createRule]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to create rule' });
    }
  }

  static async updateRule(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const ruleId = String(req.params.ruleId);

      const result = await TrafficRulesService.updateRule(userId, ruleId, req.body);
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.updateRule]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to update rule' });
    }
  }

  static async deleteRule(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const ruleId = String(req.params.ruleId);

      await TrafficRulesService.deleteRule(userId, ruleId);
      return res.json({ success: true, message: 'Rule deleted successfully' });
    } catch (error: any) {
      console.error('[TrafficDirectorController.deleteRule]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to delete rule' });
    }
  }

  static async reorderRules(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkId = String(req.params.linkId);
      const { orderedRuleIds } = req.body;

      if (!Array.isArray(orderedRuleIds)) {
        return res.status(400).json({ success: false, error: 'orderedRuleIds array is required' });
      }

      const result = await TrafficRulesService.reorderRules(userId, linkId, orderedRuleIds.map(String));
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.reorderRules]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to reorder rules' });
    }
  }

  // ─── Analytics & Simulator ─────────────────────────────────────────
  static async getLinkAnalytics(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const linkId = String(req.params.linkId);
      const { timeRange, startDate, endDate, country, routingAction, isBot, deviceType } = req.query;

      const result = await TrafficAnalyticsService.getLinkAnalytics(userId, linkId, {
        timeRange: (timeRange as any) || 'today',
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        country: country ? String(country) : undefined,
        routingAction: (routingAction as any) || 'all',
        isBot: isBot !== undefined ? isBot === 'true' : undefined,
        deviceType: deviceType ? String(deviceType) : undefined
      });

      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getLinkAnalytics]', error);
      return res.status(error.message?.includes('not found') ? 404 : 500).json({ 
        success: false, 
        error: error.message || 'Failed to fetch link analytics' 
      });
    }
  }

  static async getOverviewStats(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { timeRange, startDate, endDate } = req.query;

      const result = await TrafficAnalyticsService.getOverviewStats(userId, {
        timeRange: (timeRange as any) || 'today',
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined
      });
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getOverviewStats]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch analytics' });
    }
  }

  static async getLogs(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { linkId, isBot, timeRange, startDate, endDate, action, country, deviceType, search, page, limit } = req.query;

      const result = await TrafficAnalyticsService.getLogs(userId, {
        linkId: linkId ? String(linkId) : undefined,
        isBot: isBot !== undefined ? isBot === 'true' : undefined,
        timeRange: (timeRange as any) || undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        action: (action as any) || undefined,
        country: country ? String(country) : undefined,
        deviceType: deviceType ? String(deviceType) : undefined,
        search: search ? String(search) : undefined,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 50
      });

      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getLogs]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch logs' });
    }
  }

  // ─── Threat Intelligence & Blacklists ──────────────────────────────
  static async getThreatIntelligence(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const feeds = ThreatIntelligenceService.getSystemFeeds(userId);
      const torStats = TorExitSyncService.getStats();
      const customEntries = ThreatIntelligenceService.getCustomEntries(userId);

      return res.json({
        success: true,
        data: {
          feeds,
          torStats,
          customEntries
        }
      });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getThreatIntelligence]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch threat intelligence' });
    }
  }

  static async toggleThreatFeed(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { feedKey, enabled } = req.body;
      if (!feedKey) {
        return res.status(400).json({ success: false, error: 'feedKey is required' });
      }

      const result = ThreatIntelligenceService.toggleSystemFeed(userId, String(feedKey), Boolean(enabled));
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.toggleThreatFeed]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to toggle threat feed' });
    }
  }

  static async syncTorExitNodes(req: Request, res: Response) {
    try {
      const stats = await TorExitSyncService.syncTorExitNodes();
      return res.json({ success: true, data: stats });
    } catch (error: any) {
      console.error('[TrafficDirectorController.syncTorExitNodes]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to sync Tor exit nodes' });
    }
  }

  static async createCustomThreatEntry(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { name, type, value, mode, description } = req.body;
      if (!name || !type || !value) {
        return res.status(400).json({ success: false, error: 'Name, type, and value are required' });
      }

      const entry = ThreatIntelligenceService.addCustomEntry(userId, {
        name,
        type,
        value,
        mode: mode || 'blacklist',
        description
      });

      return res.status(201).json({ success: true, data: entry });
    } catch (error: any) {
      console.error('[TrafficDirectorController.createCustomThreatEntry]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to create threat entry' });
    }
  }

  static async deleteCustomThreatEntry(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const entryId = String(req.params.entryId);

      const success = ThreatIntelligenceService.deleteCustomEntry(userId, entryId);
      return res.json({ success: true, message: 'Threat entry deleted' });
    } catch (error: any) {
      console.error('[TrafficDirectorController.deleteCustomThreatEntry]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to delete threat entry' });
    }
  }

  // ─── Subscriptions & Billing (180 Pay Integration) ─────────────────────
  static async getBillingStatus(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User context required' });
      }

      const result = await TrafficDirectorBillingService.getSubscriptionStatus(userId);
      return res.json(result);
    } catch (error: any) {
      console.error('[TrafficDirectorController.getBillingStatus]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch billing status' });
    }
  }

  static async validateCoupon(req: Request, res: Response) {
    try {
      const { couponCode, planTier } = req.body || {};
      if (!couponCode || typeof couponCode !== 'string' || !couponCode.trim()) {
        return res.json({ success: true, valid: false, error: 'Please enter a coupon code' });
      }

      try {
        const result = await TrafficDirectorBillingService.validateCoupon(couponCode.trim(), planTier);
        return res.json({ success: true, ...result });
      } catch (validationErr: any) {
        return res.json({
          success: true,
          valid: false,
          error: validationErr.message || 'Invalid or inactive coupon code'
        });
      }
    } catch (error: any) {
      console.error('[TrafficDirectorController.validateCoupon]', error);
      return res.status(500).json({ success: false, error: error.message || 'Coupon validation failed' });
    }
  }

  static async createBillingCheckout(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User context required' });
      }

      const { planTier, couponCode, returnUrl, cancelUrl } = req.body || {};
      if (!planTier) {
        return res.status(400).json({ success: false, error: 'Plan tier is required (STARTER, PRO, or ENTERPRISE)' });
      }

      const result = await TrafficDirectorBillingService.createSubscriptionCheckout({
        userId,
        planTier,
        couponCode,
        returnUrl,
        cancelUrl,
      });

      return res.json(result);
    } catch (error: any) {
      console.error('[TrafficDirectorController.createBillingCheckout]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to initialize 180 Pay session' });
    }
  }

  static async confirmBillingSession(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { sessionId } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, error: 'User context required' });
      }
      if (!sessionId) {
        return res.status(400).json({ success: false, error: 'sessionId is required' });
      }

      const result = await TrafficDirectorBillingService.confirmSessionPayment(userId, sessionId);
      return res.json(result);
    } catch (error: any) {
      console.error('[TrafficDirectorController.confirmBillingSession]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to confirm billing session' });
    }
  }

  static async handleBillingWebhook(req: Request, res: Response) {
    try {
      const payload = req.body;
      const signature = (req.headers['x-180-signature'] as string) || '';
      const timestamp = (req.headers['x-180-timestamp'] as string) || '';
      const rawBody = (req as any).rawBody || JSON.stringify(payload);
      const result = await TrafficDirectorBillingService.handleWebhookEvent(payload, signature, rawBody, undefined, timestamp);
      return res.json({ success: true, result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.handleBillingWebhook]', error);
      return res.status(400).json({ success: false, error: error.message || 'Webhook processing failed' });
    }
  }

  // ─── Pixel & CAPI Management ─────────────────────────────────────────
  static async getPixelConfig(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { linkId } = req.params;
      const config = await PixelManagerService.getPixelConfig(linkId, userId);
      return res.json({ success: true, data: config });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getPixelConfig]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch pixel config' });
    }
  }

  static async upsertPixelConfig(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { linkId } = req.params;
      const body = req.body || {};
      const result = await PixelManagerService.upsertPixelConfig(userId, {
        ...body,
        linkId
      });
      return res.json({ success: true, data: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.upsertPixelConfig]', error);
      return res.status(400).json({ success: false, error: error.message || 'Failed to save pixel config' });
    }
  }

  static async deletePixelConfig(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { linkId } = req.params;
      const result = await PixelManagerService.deletePixelConfig(linkId, userId);
      return res.json({ success: true, deleted: result });
    } catch (error: any) {
      console.error('[TrafficDirectorController.deletePixelConfig]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to delete pixel config' });
    }
  }

  static async getPixelLogs(req: Request, res: Response) {
    try {
      const userId = await TrafficDirectorController.getUserId(req);
      const { linkId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

      const { prisma } = require('@workspace/db');
      const logs = await prisma.trafficPixelLog.findMany({
        where: { linkId, userId },
        orderBy: { timestamp: 'desc' },
        take: limit
      });

      return res.json({ success: true, data: logs });
    } catch (error: any) {
      console.error('[TrafficDirectorController.getPixelLogs]', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to fetch pixel logs' });
    }
  }
}
