import { PrismaClient } from '@workspace/db';

const corePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://pitchin_admin:P8DeNPdMPsIipBRv0ZgiVbgrmIJcziQp@pitchin-db.csne8mek4dog.us-east-1.rds.amazonaws.com:5432/180core_db?sslmode=require'
    }
  }
});

async function updateOAuthApp() {
  const clientId = '180_client_39d675390e2ddf3a518b8c436ae665f5';

  const newOrigins = [
    'https://180trafficdirector.pro',
    'https://www.180trafficdirector.pro',
    'https://180workspace-traffic.pages.dev',
    'https://edge.180trafficdirector.pro',
    'https://api.180trafficdirector.pro',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3006',
    'http://127.0.0.1:3006',
    'http://localhost:3009',
    'http://127.0.0.1:3009',
    'http://localhost:3002',
    'http://127.0.0.1:3002',
    'https://traffic-director.180workspace.com',
    'https://trafficdirector.180workspace.com',
    'https://traffic.180workspace.com',
    'https://*.180workspace.com',
    'https://*.180trafficdirector.pro'
  ];

  const newRedirectUris = [
    'https://180trafficdirector.pro/callback',
    'https://180trafficdirector.pro/oauth/callback',
    'https://www.180trafficdirector.pro/callback',
    'https://www.180trafficdirector.pro/oauth/callback',
    'https://180workspace-traffic.pages.dev/callback',
    'https://180workspace-traffic.pages.dev/oauth/callback',
    'http://localhost:3000/callback',
    'http://localhost:3000/oauth/callback',
    'http://localhost:3006/callback',
    'http://localhost:3006/oauth/callback',
    'http://localhost:3009/callback',
    'http://localhost:3009/oauth/callback',
    'http://localhost:3002/callback',
    'http://localhost:3002/oauth/callback',
    'http://127.0.0.1:3000/callback',
    'http://127.0.0.1:3006/callback',
    'http://127.0.0.1:3009/callback',
    'http://127.0.0.1:3002/callback',
    'https://traffic-director.180workspace.com/callback'
  ];

  const rows: any[] = await corePrisma.$queryRawUnsafe(`
    SELECT id, name, "clientId", "redirectUris", "allowedOrigins" 
    FROM "OAuthApp" 
    WHERE "clientId" = $1
  `, clientId);

  if (!rows || rows.length === 0) {
    console.error(`OAuthApp with clientId ${clientId} not found in 180core_db!`);
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
      "homepageUrl" = 'https://180trafficdirector.pro',
      "isActive" = true,
      "enableAuth" = true,
      "enablePay" = true,
      "isVerified" = true
    WHERE "clientId" = $3
  `, mergedOrigins, mergedRedirectUris, clientId);

  console.log('✅ Successfully updated 180 Traffic Director OAuthApp in 180core_db!');
  console.log(`   App: ${app.name} (${app.clientId})`);
  console.log('   Allowed Origins count:', mergedOrigins.length);
  console.log('   Allowed Origins:', mergedOrigins);
  console.log('   Redirect URIs count:', mergedRedirectUris.length);
  console.log('   Redirect URIs:', mergedRedirectUris);
}

updateOAuthApp()
  .catch(console.error)
  .finally(() => corePrisma.$disconnect());
