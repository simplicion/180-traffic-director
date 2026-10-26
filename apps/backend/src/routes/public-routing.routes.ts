import { Router } from 'express';
import { PublicRoutingController } from '../controllers/public-routing.controller';

const router = Router();

// Fast Public Redirect & Proxy Routes
router.all('/_proxy/stream', PublicRoutingController.handleProxyStream);
router.all('/_proxy/asset', PublicRoutingController.handleProxyAsset);
router.all('/shield/:slug', PublicRoutingController.handleShieldRoute);
router.all('/tag/:slug', PublicRoutingController.handleDynamicTag);
router.post('/evaluate/:slug', PublicRoutingController.handleEdgeEvaluate);
router.post('/pixel/event', PublicRoutingController.handlePixelEvent);
router.all(['/:slug', '/:slug/*'], PublicRoutingController.handleRedirect);

export default router;
