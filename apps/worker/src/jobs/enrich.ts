import { Job } from 'bullmq';
import { db } from '@smt/db/client';
import { walletTransactions } from '@smt/db/schema';

export async function enrichJob(job: Job) {
  console.log('Processing job:', job.data);

  const activity = job.data.rawEvent?.event?.activity?.[0];
  if (!activity) return;

  const result = await db
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
    .onConflictDoNothing();

  console.log('Saved transaction:', result);
}
