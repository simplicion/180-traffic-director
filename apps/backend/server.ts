import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import axios from 'axios';
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

// Dedicated Traffic Director Backend Server (User Scoped)
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
    'x-user-id',
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

// Health & Telemetry Status Check
app.get(['/health', '/status'], (_req, res) => {
  res.json({
    status: 'healthy',
    service: '180 Traffic Director Dedicated Edge Backend',
    port: PORT,
    timestamp: new Date().toISOString()
  });
});

// Root Gateway Handler - Seamlessly redirects web browsers to Dashboard or serves Edge JSON
app.get(['/', '/dashboard', '/links', '/traffic-director'], (req, res) => {
  const webUrl = (process.env.TRAFFIC_DIRECTOR_WEB_URL || 'http://localhost:3006').replace(/\/+$/, '');
  const targetDashboard = `${webUrl}/traffic-director/links`;

  // Return JSON if requested via format=json, Accept header, or curl/API client
  const acceptsHtml = req.accepts('html');
  const wantsJson = req.query.format === 'json' || req.query.json === 'true' || req.headers.accept?.includes('application/json');

  if (wantsJson || !acceptsHtml) {
    return res.json({
      status: 'online',
      service: '180 Traffic Director Dedicated Edge Backend',
      version: '1.0.0',
      port: PORT,
      webAppUrl: targetDashboard,
      endpoints: {
        health: '/health',
        redirects: '/r/:slug',
        dynamicTags: '/tag/:slug.js',
        edgeEvaluate: '/evaluate/:slug',
        capiPixel: '/pixel/event',
        managementApi: '/api/v1/traffic-director'
      }
    });
  }

  // Instant browser redirect with high-fidelity splash page fallback
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="0; url=${targetDashboard}">
  <title>180 Traffic Director • Edge Gateway</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #090a0f 80%);
      color: #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .card {
      background: rgba(15, 23, 42, 0.75);
      border: 1px solid rgba(99, 102, 241, 0.25);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border-radius: 24px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(99, 102, 241, 0.15);
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 14px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
      margin-bottom: 20px;
    }
    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
    }
    h1 {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 12px 0;
      color: #ffffff;
      letter-spacing: -0.02em;
    }
    p {
      font-size: 13.5px;
      color: #94a3b8;
      line-height: 1.6;
      margin: 0 0 28px 0;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      padding: 13px 24px;
      background: #4f46e5;
      color: white;
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 600;
      border-radius: 14px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4);
    }
    .btn:hover {
      background: #4338ca;
      transform: translateY(-1px);
    }
    .footer-links {
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 11.5px;
      color: #64748b;
    }
    .footer-links a {
      color: #818cf8;
      text-decoration: none;
      margin: 0 8px;
    }
    .footer-links a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge"><span class="dot"></span> Edge Backend Active</div>
    <h1>180 Traffic Director</h1>
    <p>Dedicated Edge Routing & CAPI Decision Engine is running on port ${PORT}. Redirecting to your dashboard...</p>
    <a href="${targetDashboard}" class="btn">Open Web App Dashboard →</a>
    <div class="footer-links">
      <a href="/health">Health Endpoint</a> •
      <a href="/?format=json">JSON Specs</a>
    </div>
  </div>
  <script>
    setTimeout(function() {
      window.location.replace("${targetDashboard}");
    }, 400);
  </script>
</body>
</html>`);
});

// ─── Local Dev OAuth Token Issuer ───────────────────────────────────────────
app.post('/oauth/dev-token', async (req, res) => {
  try {
    const { prisma } = require('@workspace/db');
    const jwt = require('jsonwebtoken');
    const email = req.body?.email || 'simplicion.com@gmail.com';
    
    let user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: 'Simplicion Admin',
          role: 'ADMIN',
        }
      });
    }

    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '180workspace_traffic_director_default_secure_vault_key_2026';
    const token = jwt.sign(
      { 
        id: user.id, 
        sub: user.id, 
        userId: user.id, 
        email: user.email, 
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
        role: user.role
      }
    });
  } catch (err: any) {
    console.error('[TrafficDirectorDevToken] Error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ─── 180 Core OAuth 2.0 Authorization Code Exchange (Server-to-Server) ─────
app.post(['/oauth/exchange', '/oauth/token', '/api/auth/exchange'], async (req, res) => {
  try {
    const { code, redirect_uri, code_verifier } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, error: 'Authorization code is required' });
    }

    const clientId = process.env.TRAFFIC_DIRECTOR_CLIENT_ID || '180_client_39d675390e2ddf3a518b8c436ae665f5';
    const clientSecret = process.env.TRAFFIC_DIRECTOR_CLIENT_SECRET || '180_secret_77d4c99df29f155d1535d7cc608f231622d89a3951f7ec1376399bed929a9434';
    const redirectUri = redirect_uri || 'https://180trafficdirector.pro/callback';

    // 1. Server-to-server exchange with 180 Core Auth Server
    const tokenPayload: any = {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    };
    if (code_verifier) tokenPayload.code_verifier = code_verifier;

    const coreRes = await axios.post('https://api.180core.cloud/api/oauth/token', tokenPayload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000
    });

    const tokenData = coreRes.data;
    const profileUser = tokenData.user || {};
    const email = profileUser.email || `${profileUser.username || 'user'}@180core.cloud`;

    // 2. Ensure user exists in dedicated 180trafficdirector_db
    const { prisma } = require('@workspace/db');
    let user = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: profileUser.name || profileUser.username || '180 User',
          role: profileUser.role || 'ADMIN',
        }
      });
    }

    // 3. Issue edge access token
    const secret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET || '180workspace_traffic_director_default_secure_vault_key_2026';
    const jwt = require('jsonwebtoken');
    const localToken = jwt.sign(
      {
        id: user.id,
        sub: user.id,
        userId: user.id,
        email: user.email,
        role: user.role || 'admin',
        coreSub: profileUser.sub || profileUser.id
      },
      secret,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      access_token: localToken,
      token: localToken,
      id_token: tokenData.id_token,
      core_access_token: tokenData.access_token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: profileUser.picture || profileUser.avatarUrl
      }
    });
  } catch (err: any) {
    console.error('[OAuthExchange] Error:', err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: err.response?.data?.error_description || err.response?.data?.error || err.message || 'Token exchange failed'
    });
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

// 404 Fallback for unmapped routes
app.use((req, res) => {
  const webUrl = (process.env.TRAFFIC_DIRECTOR_WEB_URL || 'http://localhost:3006').replace(/\/+$/, '');
  const targetDashboard = `${webUrl}/traffic-director/links`;

  if (req.accepts('html')) {
    return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 • Not Found - 180 Traffic Director</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #090a0f; color: #f1f5f9; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
    .card { background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 20px; padding: 36px; max-width: 460px; text-align: center; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: rgba(239, 68, 68, 0.15); color: #f87171; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 800; margin: 0 0 10px 0; color: #ffffff; }
    p { font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 24px 0; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; font-size: 13px; font-weight: 600; border-radius: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">404 Not Found</div>
    <h1>Endpoint Not Found</h1>
    <p>The requested route <code>${req.path}</code> was not found on the edge gateway.</p>
    <a href="${targetDashboard}" class="btn">Go to Dashboard →</a>
  </div>
</body>
</html>`);
  }

  return res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.path}`,
    availableEndpoints: ['/health', '/r/:slug', '/tag/:slug.js', '/evaluate/:slug', '/pixel/event', '/api/v1/traffic-director']
  });
});

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
