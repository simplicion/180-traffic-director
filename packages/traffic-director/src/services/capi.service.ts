import { prisma } from '@workspace/db';
import { PixelManagerService } from './pixel.service';
import { CapiUserData, CapiCustomData } from '../types';

export interface IngestPixelEventParams {
  slug: string;
  eventName: string;
  eventId: string;
  eventSourceUrl: string;
  customData?: CapiCustomData;
  userData?: {
    email?: string;
    phone?: string;
    country?: string;
    fbp?: string;
    fbc?: string;
  };
  clientIp?: string;
  userAgent?: string;
  isBot?: boolean;
}

export interface CapiDispatchResult {
  success: boolean;
  eventId: string;
  browserFired?: boolean;
  capiFired: boolean;
  isBotFiltered: boolean;
  eventsReceived?: number;
  error?: string;
  latencyMs?: number;
}

/**
 * Meta Conversions API (CAPI) Dispatcher & Queue Engine
 * 
 * Handles server-to-server conversion dispatch to Meta Graph API v19.0+,
 * deduplication with browser events via shared `event_id`, and threat-shielded bot suppression.
 */
export class CapiDispatcherService {
  private static readonly GRAPH_API_VERSION = 'v19.0';
  private static readonly GRAPH_API_HOST = 'https://graph.facebook.com';

  /**
   * Ingests a client event and dispatches to Meta CAPI if eligible.
   */
  static async ingestAndDispatch(params: IngestPixelEventParams): Promise<CapiDispatchResult> {
    const startTime = Date.now();
    const {
      slug,
      eventName,
      eventId,
      eventSourceUrl,
      customData = {},
      userData = {},
      clientIp,
      userAgent,
      isBot = false
    } = params;

    const cleanSlug = slug.replace(/\.js$/, '');

    // 1. Resolve Link & Pixel Configuration
    const link = await prisma.trafficLink.findUnique({
      where: { slug: cleanSlug },
      include: { pixelConfig: true }
    });

    if (!link || !link.pixelConfig) {
      return {
        success: false,
        eventId,
        capiFired: false,
        isBotFiltered: false,
        error: 'Pixel configuration not found for link'
      };
    }

    const cfg = link.pixelConfig;

    // 2. Bot Shield Check (Preserve Meta Ads Machine Learning)
    if (isBot && !cfg.fireOnBots) {
      // Record suppressed event in pixel log for audit transparency
      setImmediate(async () => {
        try {
          await prisma.trafficPixelLog.create({
            data: {
              linkId: link.id,
              companyId: link.companyId,
              pixelId: cfg.masterPixelId,
              eventId,
              eventName,
              deliverySource: 'server_capi',
              browserFired: false,
              capiFired: false,
              capiStatus: 'bot_suppressed',
              capiLatencyMs: Date.now() - startTime,
              isBotFiltered: true,
              ipAddress: clientIp || null,
              userAgent: userAgent || null
            }
          });
        } catch (err) {}
      });

      return {
        success: true,
        eventId,
        capiFired: false,
        isBotFiltered: true,
        error: 'Event filtered: bot/emulated traffic suppressed'
      };
    }

    // 3. Verify CAPI is enabled and has token
    if (!cfg.enableCapi || !cfg.capiTokenEnc) {
      return {
        success: true,
        eventId,
        capiFired: false,
        isBotFiltered: false
      };
    }

    // 4. Decrypt Meta CAPI Access Token
    const plainToken = PixelManagerService.decryptToken(cfg.capiTokenEnc);
    if (!plainToken) {
      return {
        success: false,
        eventId,
        capiFired: false,
        isBotFiltered: false,
        error: 'Failed to decrypt Meta CAPI token'
      };
    }

    // 5. Assemble Normalized Meta CAPI Payload
    const normalizedUserData: CapiUserData = PixelManagerService.normalizeUserData({
      email: userData.email,
      phone: userData.phone,
      country: userData.country,
      ipAddress: clientIp,
      userAgent,
      fbp: userData.fbp,
      fbc: userData.fbc
    });

    const eventPayload: any = {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      event_source_url: eventSourceUrl || 'https://unknown.com',
      action_source: 'website',
      user_data: normalizedUserData,
      custom_data: customData
    };

    const requestBody: any = {
      data: [eventPayload]
    };

    if (cfg.testEventCode) {
      requestBody.test_event_code = cfg.testEventCode;
    }

    // 6. Execute Dispatch to Meta Graph API
    let capiStatus = 'success';
    let eventsReceived = 1;
    let dispatchError: string | undefined;

    try {
      const targetUrl = `${this.GRAPH_API_HOST}/${this.GRAPH_API_VERSION}/${cfg.masterPixelId}/events?access_token=${encodeURIComponent(plainToken)}`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const resJson: any = await response.json();
      if (!response.ok) {
        capiStatus = 'failed';
        dispatchError = resJson?.error?.message || `HTTP ${response.status}`;
      } else {
        eventsReceived = resJson?.events_received || 1;
      }
    } catch (err: any) {
      capiStatus = 'network_error';
      dispatchError = err.message || 'Meta API Timeout';
    }

    const latencyMs = Date.now() - startTime;

    // 7. Non-blocking Asynchronous Log Persistence
    setImmediate(async () => {
      try {
        await prisma.trafficPixelLog.create({
          data: {
            linkId: link.id,
            companyId: link.companyId,
            pixelId: cfg.masterPixelId,
            eventId,
            eventName,
            deliverySource: 'hybrid_dedup',
            browserFired: true,
            capiFired: capiStatus === 'success',
            capiStatus,
            capiLatencyMs: latencyMs,
            isBotFiltered: false,
            ipAddress: clientIp || null,
            userAgent: userAgent || null,
            fbp: userData.fbp || null,
            fbc: userData.fbc || null
          }
        });
      } catch (logErr) {
        console.error('[CapiDispatcherService.logError]', logErr);
      }
    });

    return {
      success: capiStatus === 'success',
      eventId,
      browserFired: true,
      capiFired: capiStatus === 'success',
      isBotFiltered: false,
      eventsReceived,
      latencyMs,
      error: dispatchError
    };
  }
}
