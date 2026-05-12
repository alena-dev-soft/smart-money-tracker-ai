import {
  pgTable, uuid, text, timestamp, numeric, integer, boolean,
  jsonb, index, primaryKey, pgEnum,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────

export const chainEnum = pgEnum('chain', [
  'ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'solana', 'hyperliquid',
]);

export const txTypeEnum = pgEnum('tx_type', [
  'swap', 'transfer_in', 'transfer_out', 'mint', 'burn',
  'approve', 'stake', 'unstake', 'liquidity_add', 'liquidity_remove',
  'perp_open', 'perp_close', 'unknown',
]);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'free', 'pro', 'power',
]);

// ─── Tables ───────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  walletAddress: text('wallet_address'),
  telegramId: text('telegram_id').unique(),
  telegramUsername: text('telegram_username'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  byTelegram: index('users_telegram_idx').on(t.telegramId),
  byWallet: index('users_wallet_idx').on(t.walletAddress),
}));

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tier: subscriptionTierEnum('tier').notNull().default('free'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id'),
  cryptomusInvoiceId: text('cryptomus_invoice_id'),
  status: text('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUser: index('subs_user_idx').on(t.userId),
}));

export const trackedWallets = pgTable('tracked_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  address: text('address').notNull(),
  chain: chainEnum('chain').notNull(),
  label: text('label'),
  notifyMinUsd: numeric('notify_min_usd', { precision: 38, scale: 18 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueUserWallet: index('tw_user_addr_chain_idx').on(t.userId, t.address, t.chain),
  byAddress: index('tw_addr_chain_idx').on(t.address, t.chain),
}));

export const walletsMetadata = pgTable('wallets_metadata', {
  address: text('address').notNull(),
  chain: chainEnum('chain').notNull(),
  ensName: text('ens_name'),
  label: text('label'),
  totalPnlUsd: numeric('total_pnl_usd', { precision: 38, scale: 18 }),
  winrate30d: numeric('winrate_30d', { precision: 5, scale: 4 }),
  roi30d: numeric('roi_30d', { precision: 38, scale: 18 }),
  txCount30d: integer('tx_count_30d'),
  lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
}, (t) => ({
  pk: primaryKey({ columns: [t.address, t.chain] }),
}));

export const walletTransactions = pgTable('wallet_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  address: text('address').notNull(),
  chain: chainEnum('chain').notNull(),
  txHash: text('tx_hash').notNull(),
  blockNumber: integer('block_number').notNull(),
  blockTimestamp: timestamp('block_timestamp', { withTimezone: true }).notNull(),
  type: txTypeEnum('type').notNull(),
  payload: jsonb('payload').notNull(),
  valueUsd: numeric('value_usd', { precision: 38, scale: 18 }),
  tokenInSymbol: text('token_in_symbol'),
  tokenOutSymbol: text('token_out_symbol'),
  amountIn: numeric('amount_in', { precision: 38, scale: 18 }),
  amountOut: numeric('amount_out', { precision: 38, scale: 18 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueTxAddress: index('wt_tx_addr_idx').on(t.txHash, t.address),
  byAddress: index('wt_addr_time_idx').on(t.address, t.blockTimestamp),
  byTime: index('wt_time_idx').on(t.blockTimestamp),
}));

export const aiAnalyses = pgTable('ai_analyses', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletTxId: uuid('wallet_tx_id').notNull().references(() => walletTransactions.id, { onDelete: 'cascade' }),
  model: text('model').notNull(),
  promptHash: text('prompt_hash').notNull(),
  comment: text('comment').notNull(),
  riskLevel: text('risk_level'),
  suggestion: text('suggestion'),
  tokensIn: integer('tokens_in'),
  tokensOut: integer('tokens_out'),
  costUsd: numeric('cost_usd', { precision: 10, scale: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byTx: index('ai_tx_idx').on(t.walletTxId),
}));

export const txAlerts = pgTable('tx_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  trackedWalletId: uuid('tracked_wallet_id').notNull().references(() => trackedWallets.id, { onDelete: 'cascade' }),
  walletTxId: uuid('wallet_tx_id').notNull().references(() => walletTransactions.id, { onDelete: 'cascade' }),
  aiAnalysisId: uuid('ai_analysis_id').references(() => aiAnalyses.id),
  deliveryChannel: text('delivery_channel').notNull(),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  userFeedback: text('user_feedback'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUser: index('alerts_user_time_idx').on(t.userId, t.createdAt),
}));

export const alertSettings = pgTable('alert_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  telegramEnabled: boolean('telegram_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(false),
  quietHoursStart: integer('quiet_hours_start'),
  quietHoursEnd: integer('quiet_hours_end'),
  weeklyDigestEnabled: boolean('weekly_digest_enabled').notNull().default(true),
  minTxValueUsd: numeric('min_tx_value_usd', { precision: 38, scale: 18 }).default('100'),
});
