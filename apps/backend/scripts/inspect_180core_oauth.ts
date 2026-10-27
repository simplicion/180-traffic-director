import { PrismaClient } from '@workspace/db';

const corePrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://pitchin_admin:P8DeNPdMPsIipBRv0ZgiVbgrmIJcziQp@pitchin-db.csne8mek4dog.us-east-1.rds.amazonaws.com:5432/180core_db?sslmode=require'
    }
  }
});

async function main() {
  const apps: any[] = await corePrisma.$queryRawUnsafe(`
    SELECT id, name, "clientId", "redirectUris", "allowedOrigins", "isActive", "enableAuth" 
    FROM "OAuthApp"
  `);
  console.log('--- OAuth Apps in 180core_db ---');
  for (const app of apps) {
    console.log(`App: ${app.name} | ClientID: ${app.clientId} | Active: ${app.isActive} | Auth: ${app.enableAuth}`);
    console.log(`  Origins: ${JSON.stringify(app.allowedOrigins)}`);
    console.log(`  RedirectUris: ${JSON.stringify(app.redirectUris)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => corePrisma.$disconnect());
