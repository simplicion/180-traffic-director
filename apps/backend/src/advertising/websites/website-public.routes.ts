import { Router } from 'express';
import * as websiteController from './website.controller';

const router = Router();

router.get('/resolve', websiteController.publicGetWebsite);
router.post('/resolve/lead', websiteController.publicSubmitWebsiteLead);

export default router;
