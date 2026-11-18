import { Request, Response, NextFunction } from 'express';
import { FormsService } from '@workspace/advertising';
import { TrafficDirectorBillingService } from '@workspace/traffic-director';

const userOf = (req: Request): string => {
  const reqAny = req as any;
  return reqAny.userId || reqAny.user?.id || reqAny.user?.userId || '';
};

export const createForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userOf(req);
    await TrafficDirectorBillingService.assertCanCreateForm(userId);
    const form = await FormsService.createForm({
      ...req.body,
      userId
    });

    res.status(201).json({
      status: 'success',
      data: { form }
    });
  } catch (error: any) {
    if (error?.message && String(error.message).includes('SUBSCRIPTION_REQUIRED')) {
      return res.status(403).json({
        success: false,
        code: 'SUBSCRIPTION_REQUIRED',
        error: error.message.replace(/^SUBSCRIPTION_REQUIRED:\s*/i, '')
      });
    }
    next(error);
  }
};

export const getForms = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = userOf(req);
    const forms = await FormsService.getForms(userId);

    res.status(200).json({
      status: 'success',
      results: forms.length,
      data: { forms }
    });
  } catch (error) {
    next(error);
  }
};

export const getForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.id);
    if (!id || id === 'default') {
      return res.status(404).json({ error: 'Placeholder ID' });
    }
    const form = await FormsService.getFormById(id, userOf(req));

    res.status(200).json({
      status: 'success',
      data: { form }
    });
  } catch (error: any) {
    if (error.message === 'No form found with that ID') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const updateForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const form = await FormsService.updateForm(String(req.params.id), req.body, userOf(req));

    res.status(200).json({
      status: 'success',
      data: { form }
    });
  } catch (error: any) {
    if (error.message === 'No form found with that ID') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const regenerateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const apiKey = await FormsService.regenerateApiKey(String(req.params.id), userOf(req));

    res.status(200).json({
      status: 'success',
      data: { apiKey }
    });
  } catch (error: any) {
    if (error.message === 'No form found with that ID') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const deleteForm = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await FormsService.deleteForm(String(req.params.id), userOf(req));

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (error: any) {
    if (error.message === 'No form found with that ID') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const getFormSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const submissions = await FormsService.getFormSubmissions(String(req.params.id), userOf(req));

    res.status(200).json({
      status: 'success',
      results: submissions.length,
      data: { submissions }
    });
  } catch (error: any) {
    if (error.message === 'No form found with that ID') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const exportSubmissionsCsv = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { filename, csv } = await FormsService.exportSubmissionsCsv(String(req.params.id), userOf(req));

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error: any) {
    if (error.message === 'No form found with that ID') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const deleteSubmission = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await FormsService.deleteSubmission(String(req.params.submissionId), userOf(req));

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'Submission not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const bulkDeleteSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { submissionIds } = req.body;
    if (!Array.isArray(submissionIds) || submissionIds.length === 0) {
      return res.status(400).json({ error: 'Please provide an array of submissionIds to delete' });
    }

    const result = await FormsService.deleteSubmissions(submissionIds, userOf(req));

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteAllSubmissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await FormsService.deleteAllSubmissions(String(req.params.id), userOf(req));

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'No form found with that ID') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};

export const updateSubmissionStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Please provide a valid status string' });
    }

    const result = await FormsService.updateSubmissionStatus(String(req.params.submissionId), status, userOf(req));

    res.status(200).json({
      status: 'success',
      data: result
    });
  } catch (error: any) {
    if (error.message === 'Submission not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
};
