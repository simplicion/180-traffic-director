import { Router } from 'express';
import formBuilderRoutes from './forms/form-builder.routes';
import publicFormsRoutes from './forms/public-forms.routes';
import * as publicFormsController from './forms/public-forms.controller';
import websiteRoutes from './websites/website.routes';
import websitePublicRoutes from './websites/website-public.routes';
import * as websiteController from './websites/website.controller';
import mediaUploadRoutes, { uploadDir } from './storage/media-upload.routes';
import domainsRoutes from './domains/domains.routes';

export const advertisingProtectedRoutes = Router();
export const advertisingPublicRoutes = Router();

advertisingProtectedRoutes.use('/forms', formBuilderRoutes);
advertisingProtectedRoutes.use('/websites', websiteRoutes);

advertisingPublicRoutes.use('/forms', publicFormsRoutes);
advertisingPublicRoutes.post('/capture/:slug', publicFormsController.captureHeadlessSubmission);
advertisingPublicRoutes.use('/websites', websitePublicRoutes);
advertisingPublicRoutes.get('/domains/resolve', websiteController.publicResolveDomain);

export {
  formBuilderRoutes,
  publicFormsRoutes,
  websiteRoutes,
  websitePublicRoutes,
  mediaUploadRoutes,
  domainsRoutes,
  uploadDir,
};
