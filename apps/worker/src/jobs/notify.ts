import { type Job } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { db } from '@smt/db/client';
import { aiAnalyses, trackedWallets, users, walletTransactions } from '@smt/db/schema';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

export async function notifyJob(job: Job) {
  const { aiAnalysisId, walletTxId } = job.data;

  const [analysis] = await db
    .select()
    .from(aiAnalyses)
    .where(eq(aiAnalyses.id, aiAnalysisId))
    .limit(1);

  if (!analysis) throw new Error(`AI analysis not found: ${aiAnalysisId}`);

  const [tx] = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.id, walletTxId))
    .limit(1);

  if (!tx) throw new Error(`Transaction not found: ${walletTxId}`);

  const active = await db
    .select()
    .from(trackedWallets)
    .where(
      and(
        eq(trackedWallets.address, tx.address),
        eq(trackedWallets.chain, tx.chain),
        eq(trackedWallets.isActive, true),
      ),
    );

  for (const wallet of active) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, wallet.userId))
      .limit(1);

    if (!user?.telegramId) continue;

    const text =
      `🐋 Smart wallet activity\n\n` +
      `Address: ${tx.address} (${tx.chain})\n\n` +
      `Type: ${tx.type}\n` +
      `Value: ${tx.valueUsd ?? '—'} USD\n\n` +
      `🤖 AI: ${analysis.comment}\n\n` +
      `⚠️ Risk: ${analysis.riskLevel}\n` +
      `💡 ${analysis.suggestion}`;

    await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: user.telegramId, text }),
    });

    console.log(`Notification sent to telegram: ${user.telegramId}`);
  }
}
