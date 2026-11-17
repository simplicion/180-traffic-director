import { prisma, requestContext } from '@workspace/db';
import { buildDefaultWebsiteConfig } from './default-config';

export { buildDefaultWebsiteConfig } from './default-config';

const db = prisma as any;

/**
 * Typed service error. `statusCode` is what the controller returns; `code` is stable for the frontend.
 */
export class WebsiteServiceError extends Error {
  readonly code: string;
  readonly statusCode: number;
  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'WebsiteServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

const notFound = () => new WebsiteServiceError('WEBSITE_NOT_FOUND', 'Website not found', 404);

function resolveUser(userId: string | undefined | null): string {
  const effective = userId || requestContext.getStore()?.userId;
  if (!effective || typeof effective !== 'string') {
    throw new WebsiteServiceError('USER_REQUIRED', 'Authentication is required for websites', 401);
  }
  return effective;
}

/**
 * User-scoped Website Builder service.
 * Every authenticated operation scopes strictly by `userId`.
 */
export class WebsitesService {
  static async getWebsites(userId: string) {
    const uId = resolveUser(userId);
    const websites = await db.website.findMany({
      where: { userId: uId },
      orderBy: { createdAt: 'desc' }
    });

    return { websites, company: null };
  }

  static async checkAvailability(slug?: string, customDomain?: string) {
    if (slug) {
      const cleanSlug = slug.trim().toLowerCase();
      const [existingReg, existingSite] = await Promise.all([
        db.domainRegistry.findFirst({ where: { domain: cleanSlug } }),
        db.website.findFirst({ where: { slug: cleanSlug } })
      ]);
      if (existingReg || existingSite) {
        return { available: false, reason: 'This subdomain is already in use by a website or traffic link.' };
      }
    }

    if (customDomain) {
      const cleanDomain = customDomain.trim().toLowerCase();
      const [existingReg, existingSite] = await Promise.all([
        db.domainRegistry.findFirst({ where: { domain: cleanDomain } }),
        db.website.findFirst({ where: { customDomain: cleanDomain } })
      ]);
      if (existingReg || existingSite) {
        return { available: false, reason: 'This custom domain is already taken.' };
      }
    }

    return { available: true };
  }

  static async createWebsite(userId: string, data: any) {
    const uId = resolveUser(userId);
    const { name, slug, template, config, customDomain } = data || {};

    if (!name || typeof name !== 'string' || !slug || typeof slug !== 'string') {
      throw new WebsiteServiceError('INVALID_INPUT', 'Website name and slug are required.', 400);
    }

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '');
    if (!cleanSlug) {
      throw new WebsiteServiceError('INVALID_INPUT', 'A valid subdomain slug is required.', 400);
    }

    const existing = await db.domainRegistry.findFirst({ where: { domain: cleanSlug } });
    const existingSite = await db.website.findFirst({ where: { slug: cleanSlug } });
    if (existing || existingSite) {
      throw new WebsiteServiceError('DOMAIN_TAKEN', 'This subdomain is already in use by another website.', 409);
    }

    const cleanCustomDomain = typeof customDomain === 'string' && customDomain.trim() ? customDomain.trim().toLowerCase() : null;
    if (cleanCustomDomain) {
      const existingDomain = await db.domainRegistry.findFirst({ where: { domain: cleanCustomDomain } });
      if (existingDomain) {
        throw new WebsiteServiceError('DOMAIN_TAKEN', 'This custom domain is already taken.', 409);
      }
    }

    const website = await db.website.create({
      data: {
        userId: uId,
        name: name.trim(),
        slug: cleanSlug,
        customDomain: cleanCustomDomain,
        template: template || 'default',
        config: config || buildDefaultWebsiteConfig(name),
        owner: uId,
        status: 'active'
      }
    });

    await db.domainRegistry.create({
      data: {
        domain: cleanSlug,
        type: 'ADVERTISING_WEBSITE',
        targetId: website.id,
        userId: uId
      }
    }).catch(() => {});

    if (cleanCustomDomain) {
      await db.domainRegistry.create({
        data: {
          domain: cleanCustomDomain,
          type: 'ADVERTISING_WEBSITE',
          targetId: website.id,
          userId: uId
        }
      }).catch(() => {});
    }

    return website;
  }

  /** Loads a website owned by the user, or throws WEBSITE_NOT_FOUND (404). */
  static async findOwnedWebsite(userId: string, id: string) {
    const uId = resolveUser(userId);
    if (!id || typeof id !== 'string') throw notFound();
    const website = await db.website.findFirst({ where: { id, userId: uId } });
    if (!website) throw notFound();
    return website;
  }

  static async getWebsite(userId: string, id: string) {
    return WebsitesService.findOwnedWebsite(userId, id);
  }

  static async updateWebsite(userId: string, id: string, data: any) {
    const { name, slug, template, config, publishedConfig, isPublished, status, customDomain } = data || {};

    const currentWebsite = await WebsitesService.findOwnedWebsite(userId, id);
    const uId = currentWebsite.userId as string;

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (template !== undefined) updateData.template = template;
    if (config !== undefined) updateData.config = config;
    if (publishedConfig !== undefined) updateData.publishedConfig = publishedConfig;
    if (isPublished !== undefined) updateData.isPublished = isPublished;
    if (status !== undefined) updateData.status = status;

    const cleanSlug = typeof slug === 'string' && slug.trim().length > 0 ? slug.trim().toLowerCase() : '';
    const slugChanged = Boolean(cleanSlug) && cleanSlug !== currentWebsite.slug;
    if (slugChanged) {
      const existing = await db.domainRegistry.findFirst({ where: { domain: cleanSlug } });
      if (existing && (existing.type !== 'ADVERTISING_WEBSITE' || existing.targetId !== id)) {
        throw new WebsiteServiceError('DOMAIN_TAKEN', 'This subdomain is already in use by another website.', 409);
      }
      updateData.slug = cleanSlug;
    }

    if (customDomain !== undefined) {
      const cleanCustom = typeof customDomain === 'string' && customDomain.trim() ? customDomain.trim().toLowerCase() : null;
      if (cleanCustom) {
        const existing = await db.domainRegistry.findFirst({ where: { domain: cleanCustom } });
        if (existing && (existing.type !== 'ADVERTISING_WEBSITE' || existing.targetId !== id)) {
          throw new WebsiteServiceError('DOMAIN_TAKEN', 'Custom domain already taken', 409);
        }
      }
      updateData.customDomain = cleanCustom;
    }

    const { count } = await db.website.updateMany({
      where: { id, userId: uId },
      data: updateData
    });
    if (!count) throw notFound();
    const website = await db.website.findFirst({ where: { id, userId: uId } });

    if (slugChanged) {
      await db.domainRegistry.deleteMany({
        where: { domain: currentWebsite.slug, type: 'ADVERTISING_WEBSITE', targetId: id }
      });
      const alreadyRegistered = await db.domainRegistry.findFirst({ where: { domain: cleanSlug } });
      if (!alreadyRegistered) {
        await db.domainRegistry.create({
          data: { domain: cleanSlug, type: 'ADVERTISING_WEBSITE', targetId: id, userId: uId }
        }).catch(() => {});
      }
    }

    if (customDomain !== undefined) {
      const cleanCustom = updateData.customDomain;
      if (currentWebsite.customDomain && currentWebsite.customDomain !== cleanCustom) {
        await db.domainRegistry.deleteMany({
          where: { domain: currentWebsite.customDomain, type: 'ADVERTISING_WEBSITE', targetId: id }
        });
      }
      if (cleanCustom && cleanCustom !== currentWebsite.customDomain) {
        await db.domainRegistry.create({
          data: {
            domain: cleanCustom,
            type: 'ADVERTISING_WEBSITE',
            targetId: id,
            userId: uId
          }
        }).catch(() => {});
      }
    }

    return website;
  }

  static async deleteWebsite(userId: string, id: string) {
    const currentWebsite = await WebsitesService.findOwnedWebsite(userId, id);

    const { count } = await db.website.deleteMany({ where: { id, userId: currentWebsite.userId } });
    if (!count) throw notFound();

    await db.domainRegistry.deleteMany({
      where: { type: 'ADVERTISING_WEBSITE', targetId: id }
    });

    return true;
  }

  static async getWebsitePixels(userId: string, websiteId: string) {
    await WebsitesService.findOwnedWebsite(userId, websiteId);
    return db.pixel.findMany({ where: { websiteId } });
  }

  static async createWebsitePixel(userId: string, websiteId: string, data: any) {
    const website = await WebsitesService.findOwnedWebsite(userId, websiteId);
    const { provider, pixelId, status } = data || {};
    if (!provider || typeof provider !== 'string' || !pixelId || typeof pixelId !== 'string') {
      throw new WebsiteServiceError('INVALID_INPUT', 'provider and pixelId are required.', 400);
    }

    return db.pixel.create({
      data: {
        provider,
        pixelId,
        ...(typeof status === 'string' ? { status } : {}),
        websiteId,
        userId: website.userId
      }
    });
  }

  static async getWebsiteStats(userId: string, websiteId: string) {
    const website = await WebsitesService.findOwnedWebsite(userId, websiteId);
    return {
      views: (website.stats as any)?.views || 0,
      leads: (website.stats as any)?.leads || 0,
    };
  }

  // --- Public Endpoints ---

  static async publicGetWebsite(domain: string) {
    if (!domain) throw new Error('Domain is required');

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').split(':')[0];
    const rootDomain = (process.env.ROOT_DOMAIN || process.env.DEFAULT_EDGE_DOMAIN || process.env.NEXT_PUBLIC_ROOT_DOMAIN || '').trim().toLowerCase();
    const isSubdomain = (rootDomain && cleanDomain.endsWith(`.${rootDomain}`)) || cleanDomain.includes('localhost');
    const subdomainSlug = isSubdomain ? cleanDomain.split('.')[0] : (!cleanDomain.includes('.') ? cleanDomain : null);

    let website = await db.website.findFirst({
      where: {
        OR: [
          { customDomain: cleanDomain },
          { slug: cleanDomain },
          ...(subdomainSlug ? [{ slug: subdomainSlug }] : [])
        ],
        status: 'active'
      }
    });

    if (!website && cleanDomain.startsWith('www.')) {
      const baseDomain = cleanDomain.slice(4);
      website = await db.website.findFirst({
        where: { customDomain: baseDomain, status: 'active' }
      });
    }

    if (!website) {
      // Fallback: DomainRegistry lookup
      const reg = await db.domainRegistry.findFirst({
        where: {
          domain: { in: [cleanDomain, ...(subdomainSlug ? [subdomainSlug] : [])] },
          type: 'ADVERTISING_WEBSITE'
        }
      });
      if (reg?.targetId) {
        website = await db.website.findFirst({
          where: { id: reg.targetId, status: 'active' }
        });
      }
    }

    if (!website) {
      throw new Error('Website not found');
    }

    // Fire and forget view count update
    Promise.resolve().then(async () => {
      try {
        const stats: any = website.stats || { views: 0 };
        stats.views = (stats.views || 0) + 1;

        const today = new Date().toISOString().slice(0, 10);
        stats.viewsByDate = stats.viewsByDate || {};
        stats.viewsByDate[today] = (stats.viewsByDate[today] || 0) + 1;

        await db.website.update({ where: { id: website.id }, data: { stats } });
      } catch (_) {}
    });

    const pixels = await db.pixel.findMany({
      where: { websiteId: website.id, status: 'active' }
    });

    if (website.isPublished && website.publishedConfig) {
      website.config = website.publishedConfig;
    }

    return { website, pixels };
  }

  static async submitWebsiteLead(
    domain: string,
    payload: { name?: string; email?: string; phone?: string; message?: string; [key: string]: any },
    meta?: { ipAddress?: string; userAgent?: string }
  ) {
    const { website } = await WebsitesService.publicGetWebsite(domain);

    const submission = await db.websiteFormSubmission.create({
      data: {
        websiteId: website.id,
        userId: website.userId,
        name: payload.name || null,
        email: payload.email || null,
        phone: payload.phone || null,
        message: payload.message || null,
        data: payload || {},
        status: 'new',
        ipAddress: meta?.ipAddress || null,
        userAgent: meta?.userAgent || null
      }
    });

    // Update lead counter asynchronously
    Promise.resolve().then(async () => {
      try {
        const stats: any = website.stats || { views: 0, leads: 0 };
        stats.leads = (stats.leads || 0) + 1;
        await db.website.update({ where: { id: website.id }, data: { stats } });
      } catch (_) {}
    });

    return { submission };
  }
}
