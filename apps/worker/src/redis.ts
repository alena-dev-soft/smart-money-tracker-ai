import { Redis } from 'ioredis';

export const redisConnection = new Redis(process.env.UPSTASH_REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {},
});
