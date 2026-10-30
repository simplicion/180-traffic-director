import crypto from 'crypto';
import { prisma } from '@workspace/db';
import { 
  UpsertPixelConfigDto, 
  PixelConfigResponse, 
  PixelEventDto,
  CapiUserData 
} from '../types';

/**
 * Universal Multi-Platform Advertising Pixel & Conversions API (CAPI) Service
 * 
 * Manages:
 * 1. Meta Pixel & Meta Conversions API (CAPI v19.0+) with AES-256-GCM token encryption
 * 2. Google Ads (gtag.js) Conversion IDs, Labels, Enhanced Conversions, and Consent Mode v2
 * 3. Dynamic platform switching ('meta' | 'google' | 'both') with multi-tenant user isolation.
 */
export class PixelManagerService {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 12; // 96 bits for GCM
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits

  /**
   * Resolves the encryption key dynamically from environment.
   * Derives a strict 32-byte key via SHA-256 to ensure cryptographic compatibility.
   */
  private static getMasterKey(customKey?: string): Buffer {
    const rawKey = customKey || 
      process.env.TRAFFIC_DIRECTOR_SECRET_KEY || 
      process.env.JWT_SECRET || 
      '180workspace_traffic_director_default_secure_vault_key_2026';
    return crypto.createHash('sha256').update(rawKey).digest();
  }

  // ==========================================
  // 1. CRYPTOGRAPHIC VAULT (AES-256-GCM)
  // ==========================================

  /**
   * Encrypts a Meta CAPI Access Token using AES-256-GCM.
   * Returns a portable serialized string: "ivHex:authTagHex:encryptedHex"
   */
  static encryptToken(plainToken: string, customKey?: string): string {
    if (!plainToken || typeof plainToken !== 'string') return '';
    const key = this.getMasterKey(customKey);
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv, {
      authTagLength: this.AUTH_TAG_LENGTH
    });

    let encrypted = cipher.update(plainToken, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts an encrypted Meta CAPI Access Token using AES-256-GCM.
   * Guarantees tampering detection via authentication tag validation.
   */
  static decryptToken(cipherPackage: string, customKey?: string): string {
    if (!cipherPackage || typeof cipherPackage !== 'string' || !cipherPackage.includes(':')) {
      return '';
    }

    try {
      const parts = cipherPackage.split(':');
      if (parts.length !== 3) return '';

      const [ivHex, authTagHex, encryptedHex] = parts;
      const key = this.getMasterKey(customKey);
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, {
        authTagLength: this.AUTH_TAG_LENGTH
      });

      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (err) {
      // In case of tampering or key mismatch, fail securely
      return '';
    }
  }

  // ==========================================
  // 2. USER DATA NORMALIZATION & SHA-256
  // ==========================================

  /**
   * Generates a SHA-256 hash formatted as a lowercased hexadecimal string.
   */
  static hashSha256(value: string): string {
    if (!value || typeof value !== 'string') return '';
    return crypto.createHash('sha256').update(value.trim()).digest('hex');
  }

  /**
   * Normalizes an email address per Meta specification:
   * 1. Trim whitespace
   * 2. Lowercase all characters
   * 3. SHA-256 hash
   */
  static normalizeEmail(email: string): string {
    if (!email || typeof email !== 'string') return '';
    const clean = email.trim().toLowerCase();
    return this.hashSha256(clean);
  }

  /**
   * Normalizes a phone number per Meta specification:
   * 1. Strip all non-numeric characters (+, -, spaces, parentheses)
   * 2. Remove leading zeros
   * 3. Retain international country code
   * 4. SHA-256 hash
   */
  static normalizePhone(phone: string): string {
    if (!phone || typeof phone !== 'string') return '';
    let digits = phone.replace(/\D/g, '');
    digits = digits.replace(/^0+/, '');
    if (!digits) return '';
    return this.hashSha256(digits);
  }

  /**
   * Prepares and normalizes client user data for Meta Graph API v19.0 Conversions API.
   * Maximizes Event Match Quality (EMQ) by mapping all available customer identity keys.
   */
  static normalizeUserData(raw: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
    externalId?: string;
    ipAddress?: string;
    userAgent?: string;
    fbp?: string;
    fbc?: string;
  }): CapiUserData {
    const result: CapiUserData = {};

    if (raw.email) {
      const hashedEm = this.normalizeEmail(raw.email);
      if (hashedEm) result.em = [hashedEm];
    }

    if (raw.phone) {
      const hashedPh = this.normalizePhone(raw.phone);
      if (hashedPh) result.ph = [hashedPh];
    }

    if (raw.firstName) {
      const hashedFn = this.hashSha256(raw.firstName.trim().toLowerCase().replace(/[^a-z]/g, ''));
      if (hashedFn) result.fn = [hashedFn];
    }

    if (raw.lastName) {
      const hashedLn = this.hashSha256(raw.lastName.trim().toLowerCase().replace(/[^a-z]/g, ''));
      if (hashedLn) result.ln = [hashedLn];
    }

    if (raw.city) {
      const hashedCt = this.hashSha256(raw.city.trim().toLowerCase().replace(/[^a-z]/g, ''));
      if (hashedCt) result.ct = [hashedCt];
    }

    if (raw.state) {
      const hashedSt = this.hashSha256(raw.state.trim().toLowerCase());
      if (hashedSt) result.st = [hashedSt];
    }

    if (raw.postalCode) {
      const hashedZp = this.hashSha256(raw.postalCode.trim().toLowerCase().replace(/\s/g, ''));
      if (hashedZp) result.zp = [hashedZp];
    }

    if (raw.country) {
      const hashedCountry = this.hashSha256(raw.country.trim().toLowerCase());
      if (hashedCountry) result.country = [hashedCountry];
    }

    if (raw.externalId) {
      const hashedExt = this.hashSha256(raw.externalId.trim());
      if (hashedExt) result.external_id = [hashedExt];
    }

    if (raw.ipAddress) {
      result.client_ip_address = raw.ipAddress.trim();
    }

    if (raw.userAgent) {
      result.client_user_agent = raw.userAgent.trim();
    }

    if (raw.fbp) {
      result.fbp = raw.fbp.trim();
    }

    if (raw.fbc) {
      result.fbc = raw.fbc.trim();
    }

    return result;
  }

  // ==========================================
  // 3. PIXEL CONFIGURATION CRUD
  // ==========================================

  /**
   * Validates if a string looks like a standard Meta Pixel ID (numeric, 12-18 digits).
   */
  static validatePixelId(pixelId: string): boolean {
    if (!pixelId || typeof pixelId !== 'string') return false;
    const clean = pixelId.trim();
    return /^\d{12,18}$/.test(clean);
  }

  /**
   * Validates if a string matches Google Conversion ID format (AW-XXXXXXXXX or digits).
   */
  static validateGoogleConversionId(googleId: string): boolean {
    if (!googleId || typeof googleId !== 'string') return false;
    const clean = googleId.trim().toUpperCase();
    return /^AW-\d{6,15}$/.test(clean) || /^\d{6,15}$/.test(clean);
  }

  /**
   * Validates if a string matches a Google Ads conversion action label.
   * e.g. "AW-123456789/AbC_DeFg123" or action label suffix "AbC_DeFg123"
   */
  static validateConversionLabel(label: string): boolean {
    if (!label || typeof label !== 'string') return false;
    const clean = label.trim();
    return /^(AW-\d{6,15}\/)?[A-Za-z0-9_-]{3,50}$/.test(clean);
  }

  /**
   * Retrieves the pixel configuration for a link, guaranteeing user isolation.
   */
  static async getPixelConfig(linkId: string, userId: string): Promise<PixelConfigResponse | null> {
    if (!linkId) return null;

    // Multi-tenant check on link ownership
    const link = await prisma.trafficLink.findFirst({
      where: { id: linkId, userId },
      include: {
        pixelConfig: {
          include: {
            events: {
              orderBy: { createdAt: 'asc' }
            }
          }
        }
      }
    });

    if (!link || !link.pixelConfig) {
      return null;
    }

    const cfg = link.pixelConfig;

    return {
      id: cfg.id,
      linkId: cfg.linkId,
      userId: cfg.userId,
      activePlatform: (cfg.activePlatform as any) || 'both',
      masterPixelId: cfg.masterPixelId,
      backupPixelIds: cfg.backupPixelIds || [],
      hasCapiToken: Boolean(cfg.capiTokenEnc && cfg.capiTokenEnc.length > 0),
      testEventCode: cfg.testEventCode,
      enableCapi: cfg.enableCapi,
      enableLdu: cfg.enableLdu,
      googleConversionId: cfg.googleConversionId,
      googleConversionLabels: (cfg.googleConversionLabels as any) || null,
      enableGoogleEnhancedConversions: cfg.enableGoogleEnhancedConversions,
      enableGoogleConsentMode: cfg.enableGoogleConsentMode,
      googleDefaultConsent: cfg.googleDefaultConsent,
      fireOnBots: cfg.fireOnBots,
      trackPageViews: cfg.trackPageViews,
      trackOutbound: cfg.trackOutbound,
      events: (cfg.events || []).map((e: any) => ({
        id: e.id,
        eventName: e.eventName,
        triggerType: e.triggerType,
        selector: e.selector || undefined,
        urlPattern: e.urlPattern || undefined,
        eventValueKey: e.eventValueKey || undefined,
        currency: e.currency,
        isEnabled: e.isEnabled
      })),
      createdAt: cfg.createdAt,
      updatedAt: cfg.updatedAt
    };
  }

  /**
   * Upserts the pixel configuration for a link, encrypting any newly provided CAPI token.
   */
  static async upsertPixelConfig(userId: string, dto: UpsertPixelConfigDto): Promise<PixelConfigResponse> {
    if (!userId) throw new Error('User ID is required');
    if (!dto.linkId) throw new Error('Link ID is required');

    const activePlatform = dto.activePlatform || 'both';

    // 1. Validate platform-specific IDs
    let cleanMaster = (dto.masterPixelId || '').trim();
    let cleanGoogleId = (dto.googleConversionId || '').trim();
    if (cleanGoogleId && !cleanGoogleId.toUpperCase().startsWith('AW-') && /^\d+$/.test(cleanGoogleId)) {
      cleanGoogleId = `AW-${cleanGoogleId}`;
    }

    if (activePlatform === 'meta' && !cleanMaster) {
      throw new Error('Master Meta Pixel ID is required for Meta Ads');
    }
    if (activePlatform === 'google' && !cleanGoogleId) {
      throw new Error('Google Conversion ID (AW-XXXXX) is required for Google Ads');
    }
    if (activePlatform === 'both' && !cleanMaster && !cleanGoogleId) {
      throw new Error('Please configure at least one Meta Pixel ID or Google Conversion ID');
    }

    // 2. Validate multi-tenant access to link
    const link = await prisma.trafficLink.findFirst({
      where: { id: dto.linkId, userId }
    });

    if (!link) {
      throw new Error('Smart Link not found or access denied');
    }

    // 3. Clean backup pixel IDs
    const cleanBackups = (dto.backupPixelIds || [])
      .map(p => p.trim())
      .filter(p => p.length > 0 && p !== cleanMaster);

    // 4. Handle CAPI Token Encryption
    let capiTokenEnc: string | undefined = undefined;
    if (dto.capiToken && dto.capiToken.trim()) {
      capiTokenEnc = this.encryptToken(dto.capiToken.trim());
    }

    // 5. Existing config check
    const existing = await prisma.trafficPixelConfig.findUnique({
      where: { linkId: dto.linkId }
    });

    let savedConfig: any;

    if (existing) {
      const updateData: any = {
        activePlatform,
        masterPixelId: cleanMaster || null,
        backupPixelIds: cleanBackups,
        testEventCode: dto.testEventCode !== undefined ? (dto.testEventCode?.trim() || null) : existing.testEventCode,
        enableCapi: dto.enableCapi !== undefined ? dto.enableCapi : existing.enableCapi,
        enableLdu: dto.enableLdu !== undefined ? dto.enableLdu : existing.enableLdu,
        googleConversionId: cleanGoogleId || null,
        googleConversionLabels: dto.googleConversionLabels !== undefined ? dto.googleConversionLabels : existing.googleConversionLabels,
        enableGoogleEnhancedConversions: dto.enableGoogleEnhancedConversions !== undefined ? dto.enableGoogleEnhancedConversions : existing.enableGoogleEnhancedConversions,
        enableGoogleConsentMode: dto.enableGoogleConsentMode !== undefined ? dto.enableGoogleConsentMode : existing.enableGoogleConsentMode,
        googleDefaultConsent: dto.googleDefaultConsent || existing.googleDefaultConsent || 'granted',
        fireOnBots: dto.fireOnBots !== undefined ? dto.fireOnBots : existing.fireOnBots,
        trackPageViews: dto.trackPageViews !== undefined ? dto.trackPageViews : existing.trackPageViews,
        trackOutbound: dto.trackOutbound !== undefined ? dto.trackOutbound : existing.trackOutbound
      };

      if (capiTokenEnc !== undefined) {
        updateData.capiTokenEnc = capiTokenEnc;
      }

      savedConfig = await prisma.trafficPixelConfig.update({
        where: { id: existing.id },
        data: updateData,
        include: { events: true }
      });
    } else {
      savedConfig = await prisma.trafficPixelConfig.create({
        data: {
          linkId: dto.linkId,
          userId,
          activePlatform,
          masterPixelId: cleanMaster || null,
          backupPixelIds: cleanBackups,
          capiTokenEnc: capiTokenEnc || null,
          testEventCode: dto.testEventCode?.trim() || null,
          enableCapi: dto.enableCapi !== undefined ? dto.enableCapi : true,
          enableLdu: dto.enableLdu !== undefined ? dto.enableLdu : false,
          googleConversionId: cleanGoogleId || null,
          googleConversionLabels: dto.googleConversionLabels || null,
          enableGoogleEnhancedConversions: dto.enableGoogleEnhancedConversions !== undefined ? dto.enableGoogleEnhancedConversions : true,
          enableGoogleConsentMode: dto.enableGoogleConsentMode !== undefined ? dto.enableGoogleConsentMode : true,
          googleDefaultConsent: dto.googleDefaultConsent || 'granted',
          fireOnBots: dto.fireOnBots !== undefined ? dto.fireOnBots : false,
          trackPageViews: dto.trackPageViews !== undefined ? dto.trackPageViews : true,
          trackOutbound: dto.trackOutbound !== undefined ? dto.trackOutbound : true
        },
        include: { events: true }
      });
    }

    // 6. Handle event definitions if provided
    if (Array.isArray(dto.events)) {
      await prisma.trafficPixelEvent.deleteMany({
        where: { configId: savedConfig.id }
      });

      if (dto.events.length > 0) {
        await prisma.trafficPixelEvent.createMany({
          data: dto.events.map(e => ({
            configId: savedConfig.id,
            eventName: e.eventName.trim(),
            triggerType: e.triggerType,
            selector: e.selector?.trim() || null,
            urlPattern: e.urlPattern?.trim() || null,
            eventValueKey: e.eventValueKey?.trim() || null,
            currency: e.currency?.trim() || 'USD',
            isEnabled: e.isEnabled !== false
          }))
        });
      }

      savedConfig = await prisma.trafficPixelConfig.findUnique({
        where: { id: savedConfig.id },
        include: { events: true }
      });
    }

    return {
      id: savedConfig.id,
      linkId: savedConfig.linkId,
      userId: savedConfig.userId,
      activePlatform: (savedConfig.activePlatform as any) || 'both',
      masterPixelId: savedConfig.masterPixelId,
      backupPixelIds: savedConfig.backupPixelIds || [],
      hasCapiToken: Boolean(savedConfig.capiTokenEnc && savedConfig.capiTokenEnc.length > 0),
      testEventCode: savedConfig.testEventCode,
      enableCapi: savedConfig.enableCapi,
      enableLdu: savedConfig.enableLdu,
      googleConversionId: savedConfig.googleConversionId,
      googleConversionLabels: (savedConfig.googleConversionLabels as any) || null,
      enableGoogleEnhancedConversions: savedConfig.enableGoogleEnhancedConversions,
      enableGoogleConsentMode: savedConfig.enableGoogleConsentMode,
      googleDefaultConsent: savedConfig.googleDefaultConsent,
      fireOnBots: savedConfig.fireOnBots,
      trackPageViews: savedConfig.trackPageViews,
      trackOutbound: savedConfig.trackOutbound,
      events: (savedConfig.events || []).map((e: any) => ({
        id: e.id,
        eventName: e.eventName,
        triggerType: e.triggerType,
        selector: e.selector || undefined,
        urlPattern: e.urlPattern || undefined,
        eventValueKey: e.eventValueKey || undefined,
        currency: e.currency,
        isEnabled: e.isEnabled
      })),
      createdAt: savedConfig.createdAt,
      updatedAt: savedConfig.updatedAt
    };
  }

  /**
   * Deletes pixel configuration for a link.
   */
  static async deletePixelConfig(linkId: string, userId: string): Promise<boolean> {
    const link = await prisma.trafficLink.findFirst({
      where: { id: linkId, userId },
      include: { pixelConfig: true }
    });

    if (!link || !link.pixelConfig) return false;

    await prisma.trafficPixelConfig.delete({
      where: { id: link.pixelConfig.id }
    });

    return true;
  }
}
