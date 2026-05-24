import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@smt/db/client';
import { linkTokens } from '@smt/db/schema';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.insert(linkTokens).values({ token, userId: user.id, expiresAt });

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;
  const deepLink = `https://t.me/${botUsername}?start=link_${token}`;

  return NextResponse.json({ token, deepLink });
}
