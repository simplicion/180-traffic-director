import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const requireEnv = (name) => {
  const value = (process.env[name] || '').trim();
  if (!value) {
    console.error(`${name} is not set. Add it to your .env file before running this script.`);
    process.exit(1);
  }
  return value;
};
const splitList = (raw) => (raw || '').split(',').map((v) => v.trim().replace(/\/+$/, '')).filter(Boolean);
const portalUrl = requireEnv('TRAFFIC_DIRECTOR_WEB_URL').replace(/\/+$/, '');
const oauthOrigins = Array.from(new Set([portalUrl, ...splitList(process.env.OAUTH_ALLOWED_ORIGINS)]));
const oauthRedirectUris = oauthOrigins.map((origin) => `${origin}/callback`);

async function main() {
  console.log('[Seed] Seeding 180 Traffic Director OAuth App...');

  const systemUser =
    (await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } })) ||
    (await prisma.user.findFirst());

  if (!systemUser) {
    console.error('[Seed] No user found in database to associate OAuthApp with.');
    process.exit(1);
  }

  const clientId = requireEnv('TRAFFIC_DIRECTOR_CLIENT_ID');
  const secret = process.env.TRAFFIC_DIRECTOR_CLIENT_SECRET || `180_secret_${crypto.randomBytes(24).toString('hex')}`;
  const secretHash = crypto.createHash('sha256').update(secret).digest('hex');

  const appData = {
    name: '180 Traffic Director',
    description: 'Enterprise Edge Traffic Router, Safe-Page Cloaker & Click Armor',
    clientId,
    clientSecretHash: secretHash,
    clientSecretHint: secret.slice(-4),
    redirectUris: oauthRedirectUris,
    allowedOrigins: oauthOrigins,
    allowedScopes: ['openid', 'identity:read', 'identity:email'],
    isVerified: true,
    isActive: true,
    logoUrl: '/icon.svg',
    homepageUrl: portalUrl,
    userId: systemUser.id,
  };

  const existing = await prisma.oAuthApp.findUnique({
    where: { clientId },
  });

  if (existing) {
    await prisma.oAuthApp.update({
      where: { clientId },
      data: appData,
    });
    console.log('✅ Updated existing OAuthApp for 180-traffic-director');
  } else {
    await prisma.oAuthApp.create({
      data: appData,
    });
    console.log('✅ Created new OAuthApp for 180-traffic-director');
  }

  console.log(`Client ID: ${clientId}`);
  console.log(`Client Secret: ${secret}`);
  console.log(`Whitelisted Origins:`, appData.allowedOrigins);
  console.log(`Redirect URIs:`, appData.redirectUris);
}

main()
  .catch((e) => {
    console.error('[Seed] Error seeding traffic director OAuth app:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
