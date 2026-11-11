import { PrismaClient } from '@workspace/db';

/**
 * Registers the Traffic Director portal origins and callback URIs on its 180 Core OAuth app.
 *
 * Required env:
 *   CORE_DATABASE_URL            connection string for the 180 Core database
 *   TRAFFIC_DIRECTOR_CLIENT_ID   OAuth client id to update
 *   TRAFFIC_DIRECTOR_WEB_URL     portal origin (also used as homepageUrl)
 *   OAUTH_ALLOWED_ORIGINS        comma-separated extra origins (optional)
 */
const requireEnv = (name: string): string => {
  const value = (process.env[name] || '').trim();
  if (!value) {
    console.error(`${name} is not set. Add it to your .env file before running this script.`);
    process.exit(1);
  }
  return value;
};

const splitList = (raw?: string) =>
  (raw || '').split(',').map((v) => v.trim().replace(/\/+$/, '')).filter(Boolean);

const coreDatabaseUrl = requireEnv('CORE_DATABASE_URL');
const clientId = requireEnv('TRAFFIC_DIRECTOR_CLIENT_ID');
const portalUrl = requireEnv('TRAFFIC_DIRECTOR_WEB_URL').replace(/\/+$/, '');

const corePrisma = new PrismaClient({
  datasources: { db: { url: coreDatabaseUrl } }
});

async function updateOAuthApp() {
  const newOrigins = Array.from(new Set([portalUrl, ...splitList(process.env.OAUTH_ALLOWED_ORIGINS)]));
  const newRedirectUris = newOrigins.flatMap((origin) => [`${origin}/callback`, `${origin}/oauth/callback`]);

  const rows: any[] = await corePrisma.$queryRawUnsafe(`
    SELECT id, name, "clientId", "redirectUris", "allowedOrigins" 
    FROM "OAuthApp" 
    WHERE "clientId" = $1
  `, clientId);

  if (!rows || rows.length === 0) {
    console.error(`OAuthApp with clientId ${clientId} not found in core database!`);
    return;
  }

  const app = rows[0];
  const mergedOrigins = Array.from(new Set([...(app.allowedOrigins || []), ...newOrigins]));
  const mergedRedirectUris = Array.from(new Set([...(app.redirectUris || []), ...newRedirectUris]));

  await corePrisma.$executeRawUnsafe(`
    UPDATE "OAuthApp"
    SET 
      "allowedOrigins" = $1::text[],
      "redirectUris" = $2::text[],
      "homepageUrl" = $3,
      "isActive" = true,
      "enableAuth" = true,
      "enablePay" = true,
      "isVerified" = true
    WHERE "clientId" = $4
  `, mergedOrigins, mergedRedirectUris, portalUrl, clientId);

  console.log('✅ Successfully updated 180 Traffic Director OAuthApp!');
  console.log(`   App: ${app.name} (${app.clientId})`);
  console.log('   Allowed Origins:', mergedOrigins);
  console.log('   Redirect URIs:', mergedRedirectUris);
}

updateOAuthApp()
  .catch(console.error)
  .finally(() => corePrisma.$disconnect());
