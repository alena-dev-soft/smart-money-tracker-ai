import { Job, Queue } from 'bullmq';
import { db } from '@smt/db/client';
import { walletTransactions } from '@smt/db/schema';
import { redisConnection } from '../redis';

const aiAnalyzeQueue = new Queue('ai-analyze', { connection: redisConnection });

export async function enrichJob(job: Job) {
  console.log('Processing job:', job.data);

  const activity = job.data.rawEvent?.event?.activity?.[0];
  if (!activity) return;

  const [tx] = await db
    .insert(walletTransactions)
    .values({
      address: activity.fromAddress.toLowerCase(),
      chain: 'ethereum',
      txHash: activity.hash,
      blockNumber: parseInt(activity.blockNum, 16),
      blockTimestamp: new Date(),
      type: 'unknown',
      payload: activity,
      valueUsd: activity.value?.toString() ?? null,
      tokenInSymbol: activity.asset ?? null,
    })
    .onConflictDoNothing()
    .returning();

  if (!tx) return;

  console.log('Saved transaction:', tx);

  await aiAnalyzeQueue.add('ai-analyze', { walletTxId: tx.id });
  console.log('Added to ai-analyze queue');
}
