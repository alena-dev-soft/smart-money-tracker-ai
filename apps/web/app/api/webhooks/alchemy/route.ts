import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redis = new IORedis(process.env.UPSTASH_REDIS_URL!, {
  maxRetriesPerRequest: null,
  tls: {},
});

const enrichQueue = new Queue('enrich', { connection: redis });

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-alchemy-signature') ?? '';
  const secret = process.env.ALCHEMY_WEBHOOK_SECRET ?? '';

  const digest = createHmac('sha256', secret).update(rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const digestBuffer = Buffer.from(digest);

  const isValid =
    sigBuffer.length === digestBuffer.length &&
    timingSafeEqual(sigBuffer, digestBuffer);

  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const body = JSON.parse(rawBody) as unknown;
  console.log('[alchemy webhook]', JSON.stringify(body, null, 2));

  await enrichQueue.add('process', {
    source: 'alchemy',
    rawEvent: body,
    receivedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
