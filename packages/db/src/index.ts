import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'async_hooks';

export { PrismaClient, Prisma };

export const queryMetricsStorage = new AsyncLocalStorage<any>();

// Global singleton to prevent connection exhaustion in dev
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Environment-aware Prisma log levels.
 * - Production: only 'error' and 'warn' — never log raw SQL.
 * - Development: 'error' + 'warn', plus 'query' when PRISMA_QUERY_LOGGING=true.
 */
function getPrismaLogLevels(): Prisma.LogLevel[] {
  const levels: Prisma.LogLevel[] = ['error', 'warn'];
  if (process.env.NODE_ENV !== 'production' && process.env.PRISMA_QUERY_LOGGING === 'true') {
    levels.push('query');
  }
  return levels;
}

export const requestContext = new AsyncLocalStorage<{ userId?: string, [key: string]: any }>();

export const SAFE_QUERY_LIMIT = 100;
export const MAX_ALLOWED_TAKE = 500;

/**
 * Universal Query Guardrail
 * Protects database and Node memory from unbounded O(N) queries across all models.
 */
export function applyQueryGuardrails(model: string, operation: string, anyArgs: any): any {
  if (operation === 'findMany') {
    const bypass = anyArgs?._bypassGuardrail === true || anyArgs?.where?._bypassGuardrail === true;
    if (bypass) {
      if (anyArgs?._bypassGuardrail !== undefined) delete anyArgs._bypassGuardrail;
      if (anyArgs?.where?._bypassGuardrail !== undefined) delete anyArgs.where._bypassGuardrail;
      return anyArgs;
    }

    if (anyArgs.take === undefined || anyArgs.take === null) {
      anyArgs.take = SAFE_QUERY_LIMIT;
      if (process.env.NODE_ENV !== 'production' && process.env.PRISMA_GUARDRAIL_SILENT !== 'true') {
        console.warn(`[Prisma Guardrail] Auto-capped unbounded findMany on '${model}' to ${SAFE_QUERY_LIMIT} records.`);
      }
    } else if (typeof anyArgs.take === 'number' && anyArgs.take > MAX_ALLOWED_TAKE) {
      if (process.env.NODE_ENV !== 'production' && process.env.PRISMA_GUARDRAIL_SILENT !== 'true') {
        console.warn(`[Prisma Guardrail] Clamped excessive take (${anyArgs.take}) on '${model}' to ${MAX_ALLOWED_TAKE}.`);
      }
      anyArgs.take = MAX_ALLOWED_TAKE;
    }
  }
  return anyArgs;
}

export const rawPrisma: any =
  globalForPrisma.prisma ??
  new PrismaClient({ log: getPrismaLogLevels() });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = rawPrisma;

export const basePrisma: any = (rawPrisma as any).$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }: any) {
        let anyArgs: any = args || {};
        anyArgs = applyQueryGuardrails(model, operation, anyArgs);
        return query(anyArgs);
      }
    }
  }
});

export const prisma: any = new Proxy(basePrisma, {
  get(target, prop) {
    const value = (target as any)[prop];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

export const getUserPrisma = (_userId?: string): any => {
  return prisma;
};

