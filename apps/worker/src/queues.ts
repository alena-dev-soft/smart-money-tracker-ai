import { Queue } from 'bullmq';
import { redisConnection } from './redis';

export const enrichQueue = new Queue('enrich', { connection: redisConnection });
