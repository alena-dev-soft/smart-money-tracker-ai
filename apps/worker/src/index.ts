import { Worker } from 'bullmq';
import { redisConnection } from './redis';
import { enrichJob } from './jobs/enrich';
import { aiAnalyzeJob } from './jobs/ai-analyze';
import { notifyJob } from './jobs/notify';

const enrichWorker = new Worker('enrich', enrichJob, {
  connection: redisConnection,
  concurrency: 10,
});

enrichWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

enrichWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

const aiAnalyzeWorker = new Worker('ai-analyze', aiAnalyzeJob, {
  connection: redisConnection,
  concurrency: 5,
});

aiAnalyzeWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

aiAnalyzeWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

const notifyWorker = new Worker('notify', notifyJob, {
  connection: redisConnection,
  concurrency: 20,
});

notifyWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed`);
});

notifyWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

const shutdown = async () => {
  await enrichWorker.close();
  await aiAnalyzeWorker.close();
  await notifyWorker.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log('🚀 Worker started');
