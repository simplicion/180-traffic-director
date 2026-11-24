import { Request, Response } from 'express';
import { DomainsService } from '@workspace/public';

const userOf = (req: Request): string => {
  const reqAny = req as any;
  return reqAny.userId || reqAny.user?.id || reqAny.user?.userId || '';
};

export const addCustomDomain = async (req: Request, res: Response) => {
  try {
    const userId = userOf(req);
    const { domain, type, targetId } = req.body;

    if (!domain || !type || !targetId) {
      return res.status(400).json({ error: 'domain, type, and targetId are required fields.' });
    }

    const result = await DomainsService.addDomain(userId || 'default', {
      domain,
      type,
      targetId
    });

    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to add custom domain.' });
  }
};

export const verifyCustomDomain = async (req: Request, res: Response) => {
  try {
    const userId = userOf(req) || 'default';
    const domain = String(req.params.domain || req.query.domain || '');

    if (!domain) {
      return res.status(400).json({ error: 'Domain parameter is required.' });
    }

    const result = await DomainsService.verifyDomain(userId, domain);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to verify custom domain.' });
  }
};

export const getCustomDomainStatus = async (req: Request, res: Response) => {
  try {
    const userId = userOf(req) || 'default';
    const domain = String(req.params.domain || req.query.domain || '');

    if (!domain) {
      return res.status(400).json({ error: 'Domain parameter is required.' });
    }

    const result = await DomainsService.getDomainStatus(userId, domain);
    if (!result) {
      return res.status(404).json({ error: 'Domain not found.' });
    }

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to fetch domain status.' });
  }
};

export const checkSubdomainAvailability = async (req: Request, res: Response) => {
  try {
    const slug = String(req.query.slug || req.query.subdomain || '');
    const targetId = req.query.targetId ? String(req.query.targetId) : undefined;
    const userId = userOf(req) || 'default';

    if (!slug) {
      return res.status(400).json({ error: 'Slug parameter is required.' });
    }

    const rootDomain = req.query.rootDomain ? String(req.query.rootDomain) : undefined;

    const result = await DomainsService.checkSubdomainAvailability(slug, {
      targetId,
      companyId: userId,
      rootDomain
    });

    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to check subdomain availability.' });
  }
};

export const removeCustomDomain = async (req: Request, res: Response) => {
  try {
    const userId = userOf(req) || 'default';
    const domain = String(req.params.domain || '');

    if (!domain) {
      return res.status(400).json({ error: 'Domain parameter is required.' });
    }

    const result = await DomainsService.removeDomain(userId, domain);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Failed to remove custom domain.' });
  }
};
