import { PrismaClient } from '@workspace/db';

const coreDatabaseUrl = process.env.CORE_DATABASE_URL;
if (!coreDatabaseUrl) {
  console.error('CORE_DATABASE_URL is not set. Add it to your .env file before running this script.');
  process.exit(1);
}

const corePrisma = new PrismaClient({
  datasources: { db: { url: coreDatabaseUrl } }
});

async function main() {
  const apps: any[] = await corePrisma.$queryRawUnsafe(`
    SELECT id, name, "clientId", "redirectUris", "allowedOrigins", "isActive", "enableAuth" 
    FROM "OAuthApp"
  `);
  console.log('--- OAuth Apps in core database ---');
  for (const app of apps) {
    console.log(`App: ${app.name} | ClientID: ${app.clientId} | Active: ${app.isActive} | Auth: ${app.enableAuth}`);
    console.log(`  Origins: ${JSON.stringify(app.allowedOrigins)}`);
    console.log(`  RedirectUris: ${JSON.stringify(app.redirectUris)}`);
  }
}

main()
  .catch(console.error)
  .finally(() => corePrisma.$disconnect());
