import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@smt/db/client';
import { trackedWallets } from '@smt/db/schema';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const wallets = await db
    .select()
    .from(trackedWallets)
    .where(eq(trackedWallets.userId, user.id));

  return NextResponse.json(wallets);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { address: string; chain: string; label?: string };

  const [wallet] = await db
    .insert(trackedWallets)
    .values({
      userId: user.id,
      address: body.address,
      chain: body.chain as typeof trackedWallets.$inferInsert['chain'],
      label: body.label ?? null,
    })
    .returning();

  return NextResponse.json(wallet, { status: 201 });
}
