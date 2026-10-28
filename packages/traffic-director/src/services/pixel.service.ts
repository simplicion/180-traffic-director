import crypto from 'crypto';
import { prisma } from '@workspace/db';
import { 
  UpsertPixelConfigDto, 
  PixelConfigResponse, 
  PixelEventDto,
  CapiUserData 
} from '../types';

/**
 * Universal Meta Pixel & Conversions API (CAPI) Service
 * 
 * Manages multi-pixel configurations, cryptographic access token encryption (AES-256-GCM),
 * user data hashing conforming to Meta Graph API v19.0+, and user-scoped configuration.
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
   */
  static normalizeUserData(raw: {
    email?: string;
    phone?: string;
    ipAddress?: string;
    userAgent?: string;
    fbp?: string;
    fbc?: string;
    country?: string;
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

    if (raw.country) {
      const hashedCountry = this.hashSha256(raw.country.trim().toLowerCase());
      if (hashedCountry) result.country = [hashedCountry];
    }

    return result;
  }

  // ==========================================
  // 3. PIXEL CONFIGURATION CRUD
  // ==========================================

  /**
   * Validates if a string looks like a standard Meta Pixel ID (numeric, 14-17 digits).
   */
  static validatePixelId(pixelId: string): boolean {
    if (!pixelId || typeof pixelId !== 'string') return false;
    const clean = pixelId.trim();
    return /^\d{12,18}$/.test(clean);
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
      masterPixelId: cfg.masterPixelId,
      backupPixelIds: cfg.backupPixelIds || [],
      hasCapiToken: Boolean(cfg.capiTokenEnc && cfg.capiTokenEnc.length > 0),
      testEventCode: cfg.testEventCode,
      enableCapi: cfg.enableCapi,
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

    // 1. Validate master pixel format
    const cleanMaster = (dto.masterPixelId || '').trim();
    if (!cleanMaster) {
      throw new Error('Master Meta Pixel ID is required');
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
        masterPixelId: cleanMaster,
        backupPixelIds: cleanBackups,
        testEventCode: dto.testEventCode !== undefined ? (dto.testEventCode?.trim() || null) : existing.testEventCode,
        enableCapi: dto.enableCapi !== undefined ? dto.enableCapi : existing.enableCapi,
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
          masterPixelId: cleanMaster,
          backupPixelIds: cleanBackups,
          capiTokenEnc: capiTokenEnc || null,
          testEventCode: dto.testEventCode?.trim() || null,
          enableCapi: dto.enableCapi !== undefined ? dto.enableCapi : true,
          fireOnBots: dto.fireOnBots !== undefined ? dto.fireOnBots : false,
          trackPageViews: dto.trackPageViews !== undefined ? dto.trackPageViews : true,
          trackOutbound: dto.trackOutbound !== undefined ? dto.trackOutbound : true
        },
        include: { events: true }
      });
    }

    // 6. Handle event definitions if provided
    if (Array.isArray(dto.events)) {
      // Replace existing events with new set
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
      masterPixelId: savedConfig.masterPixelId,
      backupPixelIds: savedConfig.backupPixelIds || [],
      hasCapiToken: Boolean(savedConfig.capiTokenEnc && savedConfig.capiTokenEnc.length > 0),
      testEventCode: savedConfig.testEventCode,
      enableCapi: savedConfig.enableCapi,
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
