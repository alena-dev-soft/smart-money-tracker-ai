import { Bot } from 'grammy';
import { and, eq } from 'drizzle-orm';
import { db } from '@smt/db/client';
import { trackedWallets } from '@smt/db/schema';

const HARDCODED_USER_ID = '00000000-0000-0000-0000-000000000001';

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

bot.command('start', (ctx) =>
  ctx.reply(
    'Welcome to Smart Money Tracker!\n\n' +
    'I notify you when tracked wallets make on-chain moves.\n\n' +
    'Commands:\n' +
    '/follow <address> — track an Ethereum wallet\n' +
    '/list — show your tracked wallets',
  ),
);

bot.command('follow', async (ctx) => {
  const address = ctx.match.trim().toLowerCase();

  if (!address) {
    return ctx.reply('Usage: /follow <address>');
  }

  await db
    .insert(trackedWallets)
    .values({
      userId: HARDCODED_USER_ID,
      address,
      chain: 'ethereum',
    })
    .onConflictDoNothing();

  return ctx.reply(`Now tracking: ${address}`);
});

bot.command('unfollow', async (ctx) => {
  const address = ctx.match.trim().toLowerCase();

  if (!address) {
    return ctx.reply('Usage: /unfollow <address>');
  }

  await db
    .update(trackedWallets)
    .set({ isActive: false })
    .where(
      and(
        eq(trackedWallets.address, address),
        eq(trackedWallets.userId, HARDCODED_USER_ID),
      ),
    );

  return ctx.reply(`✅ Stopped tracking: ${address}`);
});

bot.command('list', async (ctx) => {
  const wallets = await db
    .select()
    .from(trackedWallets)
    .where(
      and(
        eq(trackedWallets.userId, HARDCODED_USER_ID),
        eq(trackedWallets.isActive, true),
      ),
    );

  if (wallets.length === 0) {
    return ctx.reply('No tracked wallets yet. Use /follow <address> to add one.');
  }

  const lines = wallets.map((w) => `• ${w.address}`).join('\n');
  return ctx.reply(`Your tracked wallets:\n${lines}`);
});

bot.start();
