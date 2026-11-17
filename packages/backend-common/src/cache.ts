import Redis from 'ioredis';

// Re-use connection from .env (gracefully disabled when REDIS_URL is not configured)
const redisUrl = (process.env.REDIS_URL || '').trim();

// Initialize a single shared Redis client instance only when REDIS_URL is provided
export const redisClient: Redis | null = redisUrl
    ? new Redis(redisUrl, {
        maxRetriesPerRequest: null,
        enableReadyCheck: false
    })
    : null;

if (redisClient) {
    redisClient.on('error', (err: any) => {
        console.error('[Redis Cache] Error:', err);
    });

    redisClient.on('connect', () => {
        console.log('[Redis Cache] Connected successfully');
    });
}

export const getCache = async (key: string): Promise<any | null> => {
    if (!redisClient) return null;
    try {
        const data = await redisClient.get(key);
        if (data) return JSON.parse(data);
        return null;
    } catch (e) {
        console.error('[Redis Cache] Get error for key', key, e);
        return null;
    }
};

export const setCache = async (key: string, value: any, ttlSeconds: number = 300): Promise<void> => {
    if (!redisClient) return;
    try {
        await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (e) {
        console.error('[Redis Cache] Set error for key', key, e);
    }
};

export const delCache = async (key: string): Promise<void> => {
    if (!redisClient) return;
    try {
        await redisClient.del(key);
    } catch (e) {
        console.error('[Redis Cache] Del error for key', key, e);
    }
};

// Aliases used across the codebase
export const getCachedData = getCache;
export const setCachedData = setCache;
export const clearCache = delCache;
