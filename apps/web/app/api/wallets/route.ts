import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@smt/db/client';
import { trackedWallets } from '@smt/db/schema';

// TODO: replace with real auth
const TEST_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function GET() {
  const wallets = await db
    .select()
    .from(trackedWallets)
    .where(eq(trackedWallets.userId, TEST_USER_ID));

  return NextResponse.json(wallets);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { address: string; chain: string; label?: string };

  const [wallet] = await db
    .insert(trackedWallets)
    .values({
      userId: TEST_USER_ID,
      address: body.address,
      chain: body.chain as typeof trackedWallets.$inferInsert['chain'],
      label: body.label ?? null,
    })
    .returning();

  return NextResponse.json(wallet, { status: 201 });
}
