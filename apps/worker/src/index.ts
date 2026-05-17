import { Worker } from 'bullmq';
import { redisConnection } from './redis';
import { enrichJob } from './jobs/enrich';

const worker = new Worker('enrich', enrichJob, {
  connection: redisConnection,
  concurrency: 10,
});

worker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('🚀 Worker started');
