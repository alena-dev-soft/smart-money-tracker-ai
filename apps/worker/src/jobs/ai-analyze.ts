import { createHash } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { Queue, type Job } from 'bullmq';
import { and, desc, eq, ne } from 'drizzle-orm';
import { db } from '@smt/db/client';
import { aiAnalyses, walletsMetadata, walletTransactions } from '@smt/db/schema';
import { redisConnection } from '../redis';

const anthropic = new Anthropic();
const notifyQueue = new Queue('notify', { connection: redisConnection });

const MODEL = 'claude-sonnet-4-5';

const SYSTEM =
  "You are a crypto on-chain trade analyst. Analyze the transaction and return ONLY valid JSON: { comment: string (2-4 sentences in English), riskLevel: 'low'|'medium'|'high', suggestion: string (max 120 chars) }";

export async function aiAnalyzeJob(job: Job) {
  const { walletTxId } = job.data;

  const [tx] = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.id, walletTxId))
    .limit(1);

  if (!tx) throw new Error(`Transaction not found: ${walletTxId}`);

  const [meta] = await db
    .select()
    .from(walletsMetadata)
    .where(and(eq(walletsMetadata.address, tx.address), eq(walletsMetadata.chain, tx.chain)))
    .limit(1);

  const recentTxs = await db
    .select()
    .from(walletTransactions)
    .where(and(eq(walletTransactions.address, tx.address), ne(walletTransactions.id, walletTxId)))
    .orderBy(desc(walletTransactions.blockTimestamp))
    .limit(5);

  const userMessage = JSON.stringify({
    transaction: tx,
    walletMeta: meta ?? null,
    recentTransactions: recentTxs,
  });

  const promptHash = createHash('sha256').update(userMessage).digest('hex');

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const analysis = JSON.parse(cleaned) as { comment: string; riskLevel: string; suggestion: string };

  const [saved] = await db
    .insert(aiAnalyses)
    .values({
      walletTxId,
      model: MODEL,
      promptHash,
      comment: analysis.comment,
      riskLevel: analysis.riskLevel,
      suggestion: analysis.suggestion,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
    })
    .returning();

  console.log('AI analysis saved', saved);

  await notifyQueue.add('notify', { aiAnalysisId: saved.id, walletTxId });
  console.log('Added to notify queue');
}
