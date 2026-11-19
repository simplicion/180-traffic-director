import { Request, Response, NextFunction } from 'express';
import { WebsitesService } from '@workspace/advertising';
import { TrafficDirectorBillingService } from '@workspace/traffic-director';

const userOf = (req: Request): string => {
  const reqAny = req as any;
  return reqAny.userId || reqAny.user?.id || reqAny.user?.userId || '';
};

const handleError = (err: any, res: Response, next: NextFunction) => {
  if (err && typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 500) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }
  if (err?.message === 'Website not found') {
    return res.status(404).json({ error: err.message, code: 'WEBSITE_NOT_FOUND' });
  }
  next(err);
};

export const getWebsites = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await WebsitesService.getWebsites(userOf(req));
    res.json(result);
  } catch (err) {
    handleError(err, res, next);
  }
};

export const checkAvailability = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, customDomain, companySlug } = req.query;
    const result = await WebsitesService.checkAvailability(
      typeof slug === 'string' ? slug : undefined,
      typeof customDomain === 'string' ? customDomain : typeof companySlug === 'string' ? companySlug : undefined
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const createWebsite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userOf(req);
    await TrafficDirectorBillingService.assertCanCreateWebsite(userId);
    const website = await WebsitesService.createWebsite(userId, req.body);
    res.status(201).json({ website });
  } catch (err: any) {
    if (err?.message && String(err.message).includes('SUBSCRIPTION_REQUIRED')) {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        error: err.message.replace(/^SUBSCRIPTION_REQUIRED:\s*/i, '')
      });
    }
    handleError(err, res, next);
  }
};

export const getWebsite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!id || id === 'default') {
      return res.status(200).json({ website: null });
    }
    const website = await WebsitesService.getWebsite(userOf(req), id);
    res.json({ website });
  } catch (err: any) {
    handleError(err, res, next);
  }
};

export const updateWebsite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const website = await WebsitesService.updateWebsite(userOf(req), String(req.params.id), req.body);
    res.json({ website });
  } catch (err: any) {
    handleError(err, res, next);
  }
};

export const deleteWebsite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await WebsitesService.deleteWebsite(userOf(req), String(req.params.id));
    res.json({ message: 'Website deleted' });
  } catch (err: any) {
    handleError(err, res, next);
  }
};

export const getWebsitePixels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pixels = await WebsitesService.getWebsitePixels(userOf(req), String(req.params.id));
    res.json({ pixels });
  } catch (err: any) {
    handleError(err, res, next);
  }
};

export const createWebsitePixel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pixel = await WebsitesService.createWebsitePixel(userOf(req), String(req.params.id), req.body);
    res.status(201).json({ pixel });
  } catch (err: any) {
    handleError(err, res, next);
  }
};

export const getWebsiteStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await WebsitesService.getWebsiteStats(userOf(req), String(req.params.id));
    res.json(stats);
  } catch (err: any) {
    handleError(err, res, next);
  }
};

export const publicGetWebsite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = String(req.query.domain || req.query.slug || '');
    const result = await WebsitesService.publicGetWebsite(domain);
    res.json(result);
  } catch (err: any) {
    if (err.message === 'Domain is required') {
      return res.status(400).json({ error: err.message });
    }
    if (err.message === 'Website not found') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};

export const publicResolveDomain = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = String(req.query.domain || req.query.slug || '');
    if (!domain) {
      return res.status(400).json({ error: 'Domain is required' });
    }
    const result = await WebsitesService.publicGetWebsite(domain);
    return res.json({
      type: 'ADVERTISING_WEBSITE',
      payload: result
    });
  } catch (err: any) {
    if (err.message === 'Website not found') {
      return res.status(404).json({ error: 'Domain not found' });
    }
    next(err);
  }
};

export const publicSubmitWebsiteLead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const domain = String(req.query.domain || req.query.slug || req.body.domain || '');
    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    const result = await WebsitesService.submitWebsiteLead(domain, req.body, {
      ipAddress,
      userAgent
    });
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === 'Website not found' || err.message === 'Domain is required') {
      return res.status(404).json({ error: err.message });
    }
    next(err);
  }
};
