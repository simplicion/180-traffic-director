import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { protect } from './src/middleware/auth';
import trafficDirectorRoutes from './src/routes/traffic-director.routes';
import publicRoutingRoutes from './src/routes/public-routing.routes';
import { PublicRoutingController } from './src/controllers/public-routing.controller';
import { TorExitSyncService } from '@workspace/traffic-director';

// Load environment configuration
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
const PORT = process.env.TD_PORT || process.env.TRAFFIC_DIRECTOR_PORT || 4005;

// Basic security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false
}));

// CORS configuration supporting frontend apps, edge scripts, and landing pages
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, or public script tags)
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-company-id',
    'x-180-signature',
    'x-180-timestamp',
    'Range'
  ]
}));

// Request body parsers
app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: '180 Traffic Director Dedicated Edge Backend',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// ─── Local Dev OAuth Token Issuer ───────────────────────────────────────────
app.post('/oauth/dev-token', async (req, res) => {
  try {
    const { prisma } = require('@workspace/db');
    const jwt = require('jsonwebtoken');
    const email = req.body?.email || 'simplicion.com@gmail.com';
    
    let user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      include: { company: true }
    });

    if (!user) {
      let company = await prisma.company.findFirst();
      if (!company) {
        company = await prisma.company.create({
          data: {
            name: 'Simplicion',
            slug: 'simplicion',
            adminEmail: email,
            subscriptionStatus: 'active',
            accountStatus: 'active',
          }
        });
      }
      user = await prisma.user.create({
        data: {
          email,
          name: 'Simplicion Admin',
          role: 'ADMIN',
          companyId: company.id,
        },
        include: { company: true }
      });
    }

    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '180workspace_traffic_director_default_secure_vault_key_2026';
    const token = jwt.sign(
      { 
        id: user.id, 
        sub: user.id, 
        userId: user.id, 
        email: user.email, 
        companyId: user.companyId, 
        role: user.role || 'admin' 
      },
      secret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId,
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('[TrafficDirectorDevToken] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Public Edge Routing & Tag Generators ───────────────────────────────────
// Direct tag, evaluation, pixel event, and reverse proxy handlers
app.options('/evaluate/:slug', (_req, res) => res.status(200).end());
app.post('/evaluate/:slug', PublicRoutingController.handleEdgeEvaluate);

app.options('/api/v1/traffic-director/evaluate/:slug', (_req, res) => res.status(200).end());
app.post('/api/v1/traffic-director/evaluate/:slug', PublicRoutingController.handleEdgeEvaluate);

app.all('/tag/:slug', PublicRoutingController.handleDynamicTag);
app.all('/api/v1/traffic-director/tag/:slug', PublicRoutingController.handleDynamicTag);

app.options('/pixel/event', (_req, res) => res.status(200).end());
app.post('/pixel/event', PublicRoutingController.handlePixelEvent);

app.options('/api/v1/traffic-director/pixel/event', (_req, res) => res.status(200).end());
app.post('/api/v1/traffic-director/pixel/event', PublicRoutingController.handlePixelEvent);

app.all('/shield/:slug', PublicRoutingController.handleShieldRoute);
app.all('/api/v1/traffic-director/shield/:slug', PublicRoutingController.handleShieldRoute);

app.all('/stream-proxy', PublicRoutingController.handleProxyStream);
app.all('/api/v1/traffic-director/stream-proxy', PublicRoutingController.handleProxyStream);

app.all('/asset-proxy', PublicRoutingController.handleProxyAsset);
app.all('/api/v1/traffic-director/asset-proxy', PublicRoutingController.handleProxyAsset);

// Public redirect route /r/:slug
app.use('/r', publicRoutingRoutes);

// ─── Authenticated Management API ───────────────────────────────────────────
app.use('/api/v1/traffic-director', protect, trafficDirectorRoutes);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[TrafficDirectorBackend] Unhandled Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n================================================================`);
  console.log(` 🚀 180 TRAFFIC DIRECTOR DEDICATED BACKEND ONLINE`);
  console.log(` 🌐 Listening on: http://localhost:${PORT}`);
  console.log(` 🛡️  Edge Public Redirects: http://localhost:${PORT}/r/:slug`);
  console.log(` 📦 Dynamic Pixel Tags:   http://localhost:${PORT}/tag/:slug.js`);
  console.log(` ⚡ CAPI Beacon Ingest:    http://localhost:${PORT}/pixel/event`);
  console.log(` 🔑 Management API:       http://localhost:${PORT}/api/v1/traffic-director`);
  console.log(`================================================================\n`);

  // Start background Tor exit node synchronization
  TorExitSyncService.syncTorExitNodes().catch((e: any) => {
    console.warn('[TorExitSync] Initial sync warning:', e.message);
  });
});
