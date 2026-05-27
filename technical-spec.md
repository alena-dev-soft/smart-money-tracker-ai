# Smart Money Tracker — Technical Spec + Learning Roadmap

> **Format:** Engineering document + personal learning roadmap for transitioning from .NET to TypeScript/Web3.
> **Author:** Olena.
> **Context:** Thailand, solo development with active AI vibe-coding, product not yet public.
> **Date:** May 2026.

---

## How to Read This Document

1. If you're an experienced .NET developer and your goal is to **understand the stack before writing code**, go through the document in order. Each technical section has a **".NET → New"** callout with analogies that will speed up your understanding.
2. If your goal is to **start vibe-coding right away**, jump to the *MVP by week* section at the end. It has the minimal feature set + exact startup commands.
3. All code, DB schema, types, and prompts are **ready to copy into your IDE**. This is not pseudo-code. Every TypeScript/SQL block is a working foundation — just adjust table/field names to match your setup.
4. The document is intentionally **verbose on explanations**. This is your web3 stack textbook, not a corporate spec. If something seems obvious — skip it.

---

## Table of Contents

1. [Product: what we build and for whom](#1-product)
2. [High-level architecture](#2-architecture)
3. [Tech stack and why](#3-stack)
4. [DB schema](#4-db-schema)
5. [Domain model and TypeScript types](#5-domain-model)
6. [API: REST + RPC signatures](#6-api)
7. [Workers, queues, and background tasks](#7-workers)
8. [Web3 integrations: RPC, indexers, on-chain data](#8-web3-integrations)
9. [AI layer: prompts, context, protection](#9-ai-layer)
10. [Telegram bot: commands and states](#10-telegram-bot)
11. [Authentication and security](#11-auth-security)
12. [Deploy, monitoring, secrets](#12-deploy)
13. [Learning plan: 6 weeks .NET → TS/Web3](#13-learning-plan)
14. [Glossary: .NET → TypeScript/Web3](#14-glossary)
15. [MVP: checklist "ready for first user"](#15-mvp-checklist)

---

## 1. Product

### In Brief

**Smart Money Tracker** is a read-only service that tracks the on-chain activity of "smart" crypto wallets (historically profitable traders) and uses an AI agent to explain what they're doing and whether it's worth copying.

### Value Proposition in One Sentence

> "Get AI-powered commentary on every trade by top crypto wallets — before the trend becomes obvious."

### Target Personas

- **Active crypto trader, 25–40 years old**, trades on Hyperliquid / Binance / Solana DEXes, follows Crypto Twitter, uses Cielo / GMGN / Photon, willing to pay $20–100/month for an edge.
- **Passive investor**, wants to understand "what smart money is buying" but doesn't have time to track manually. Pays for peace of mind and a weekly digest.
- **B2B segment (v2)**: small funds and prop shops that want a corporate feed.

### What the Product **Does NOT** Do (intentionally — scope boundaries)

- **Does not sign transactions.** Read-only only, no private keys, no custody. This eliminates 95% of legal risks and the entire smart contract audit scope.
- **Does not trade on behalf of the user.** Information + alerts only.
- **Does not aggregate CEX balances.** Can be added in v2, but MVP is purely on-chain.
- **Does not build its own blockchain indexer.** Uses existing services (Alchemy, Helius, Zerion API).

### MVP Success Metrics

- 30 paying users within a month after a soft launch to a close circle.
- D7 retention ≥ 40% (users must open the Telegram bot a week later — otherwise the alert cycle isn't working).
- AI comment rated "helpful" (👍) in ≥ 60% of cases (built-in feedback button under each message).

---

## 2. Architecture

### Diagram

```
                       ┌──────────────────┐
                       │     User         │
                       │  (Telegram /     │
                       │  Web dashboard)  │
                       └────────┬─────────┘
                                │
                ┌───────────────┼─────────────────┐
                │               │                 │
                ▼               ▼                 ▼
        ┌──────────────┐  ┌────────────┐   ┌───────────────┐
        │ Telegram Bot │  │  Next.js   │   │ Webhook RX    │
        │   (grammY)   │  │  Frontend  │   │  endpoint     │
        └──────┬───────┘  └─────┬──────┘   └───────┬───────┘
               │                │                   │
               └────────┬───────┴───────────────────┘
                        ▼
               ┌─────────────────┐
               │  API layer      │
               │  Next.js Route  │
               │  Handlers /     │
               │  Hono           │
               └────────┬────────┘
                        │
        ┌───────────────┼─────────────────┬──────────────┐
        ▼               ▼                 ▼              ▼
  ┌──────────┐    ┌──────────┐      ┌──────────┐   ┌─────────┐
  │ Postgres │    │  Redis   │      │  BullMQ  │   │ Claude  │
  │(Supabase)│    │ (Upstash)│      │  workers │   │   API   │
  └──────────┘    └──────────┘      └────┬─────┘   └─────────┘
                                          │
                       ┌──────────────────┼──────────────┐
                       ▼                  ▼              ▼
                 ┌──────────┐       ┌──────────┐   ┌──────────┐
                 │ Alchemy  │       │  Helius  │   │ Zerion / │
                 │ (EVM)    │       │ (Solana) │   │ DeBank   │
                 └──────────┘       └──────────┘   └──────────┘
```

### Components — What Each Does

| Component | Role | .NET Equivalent |
|---|---|---|
| Next.js Frontend | UI: dashboard, subscriptions, settings | Razor Pages / Blazor |
| Next.js API Routes | REST/RPC endpoints, server actions | ASP.NET Core Controllers |
| Hono (optional) | Lightweight API framework if separating backend | Minimal APIs in .NET 8 |
| Supabase (Postgres) | Primary DB + auth + storage | EF Core + Identity + Azure Blob |
| Drizzle ORM | TypeScript ORM on top of Postgres | EF Core (but no change tracker, closer to Dapper) |
| Upstash Redis | Cache, rate limiting, queues | StackExchange.Redis |
| BullMQ | Task queues (Node.js) | Hangfire / Quartz |
| Alchemy | EVM RPC + webhooks (Ethereum, Base, Arbitrum) | No equivalent — web3-specific |
| Helius | Solana RPC + webhooks + parsing | Same |
| Zerion / DeBank API | Pre-aggregated wallet portfolio | Same |
| Claude API | LLM trade analyst | Azure OpenAI / Semantic Kernel |
| grammY | Telegram bot framework (TS) | Telegram.Bot (NuGet) |
| Reown AppKit | Web3 wallet connect UX | No equivalent |

### Key Data Flows

**Flow A: User adds a wallet to track.**
1. User in bot: `/follow 0xabc...`
2. Bot validates the address (viem's `isAddress()`), saves to `tracked_wallets`.
3. We create a webhook on Alchemy/Helius for that address.
4. Bot replies: "Wallet X is being tracked. Last 30d ROI: +127%, winrate 71%."

**Flow B: On-chain event → alert.**
1. Alchemy sends a webhook to our `POST /api/webhooks/alchemy` on any transaction by a tracked address.
2. Webhook handler puts the raw event into the `bullmq:enrich` queue.
3. `enrichWorker`: decodes the tx (swap? transfer? staking?), fetches prices from CoinGecko, saves to `wallet_transactions`.
4. Puts the enriched event into `bullmq:ai-analysis` queue.
5. `aiWorker`: builds context, sends to Claude, gets a comment.
6. `notifyWorker`: sends the alert via Telegram to all users who follow that address.

**Flow C: AI weekly digest.**
1. Cron job on Sunday at 09:00 UTC.
2. For each active user: fetch everything that happened with their wallets over the week, aggregate.
3. Feed to Claude with a "weekly digest" template.
4. Send a personalized report.

---

## 3. Stack

### TL;DR Table

| Layer | Technology | Version (May 2026) | Why |
|---|---|---|---|
| Language | TypeScript | 5.6+ | One language for frontend + backend, web3 ecosystem |
| Frontend framework | Next.js (App Router) | 15.x | SSR + RSC + API in one repo |
| UI | Tailwind + shadcn/ui | latest | AI-speed development, design system out of the box |
| Wallet UX | Reown AppKit | 1.x | De-facto standard, replaces WalletConnect v3 |
| Web3 client | viem + wagmi | viem 2.x, wagmi 2.x | Modern replacement for ethers |
| Solana | @solana/web3.js + Helius SDK | 1.x | Solana is required for the memecoin segment |
| Backend | Next.js API Routes (or Hono) | — | Minimal boilerplate |
| ORM | Drizzle | latest | Best TS ORM for Postgres |
| DB | Supabase Postgres | 15 | Postgres + auth + realtime + storage in one box |
| Cache + queues | Upstash Redis + BullMQ | latest | Serverless Redis, ideal for Vercel |
| AI | Claude Sonnet 4.6 | — | Best for financial text analysis |
| Telegram | grammY | 1.x | TS-native, actively maintained |
| Payments | Stripe + Cryptomus | — | Cards + crypto |
| Auth | Supabase Auth + SIWE | — | Email/Google + Sign-In With Ethereum |
| Hosting | Vercel (frontend) + Railway (workers) | — | Auto-deploy from git |
| Monitoring | Sentry + Axiom | — | Errors + structured logs |
| Tests | Vitest + Playwright | — | Unit + e2e |
| Linter | Biome | 1.x | Replaces eslint+prettier, 10x faster |

### Notes for .NET Developers

**Why TypeScript and not C#?**
.NET 8 is faster at runtime on CPU-bound tasks. But 99% of the work here is I/O (RPC calls to Alchemy, queues, DB). TS on Node.js doesn't lose there. And it wins on:
- the web3 ecosystem (`viem`, `wagmi`, `@solana/web3.js` are TS-first; .NET equivalents either don't exist or are abandoned),
- speed of vibe-coding iterations (Claude/GPT in TS is orders of magnitude more productive),
- one language for both frontend and backend.

**Next.js — is it like ASP.NET MVC?**
Close, but with two key differences:
- React Server Components: components can render **on the server** and stream to the browser in chunks. No explicit "view + controller" split — a component is semi-server, semi-client on its own.
- API routes (`app/api/foo/route.ts`) are Minimal API equivalents. One file = one endpoint.

**Drizzle vs EF Core**: Drizzle is closer to Dapper than EF Core. No change tracker, no lazy loading, no "magic" migrations. But everything is typed down to the column level and the generated SQL is predictable. Perfect for a small project.

**BullMQ vs Hangfire/Quartz**: conceptually the same — background task queues with retry/backoff/cron. Just for Node.js and on top of Redis. Workers run as a separate process — in our case on Railway, not Vercel (because Vercel is serverless and doesn't support long-running workers).

**viem — what is it if you only know ethers?**
A modern replacement for ethers.js. Key benefits: tree-shakeable (smaller bundle), fully typed (you can infer types directly from smart contract ABIs), more stable API. In 2026, `viem` is the standard; `ethers` is legacy.

**Reown AppKit (formerly WalletConnect)**: a library that provides a ready-made "Connect Wallet" UI, supports 300+ wallets (MetaMask, Phantom, Rabby, Trust, hardware wallets). It handles the wallet connection handshake for you — you just process the resulting `address` and `chainId`.

---

## 4. DB Schema

### Principles

- Everything in Postgres. No separate time-series storage — instead of TimescaleDB at the start, we use native Postgres 15 monthly partitioning. If data grows — migrate later.
- Every table gets `id` (uuid v7 for time-ordering), `created_at`, `updated_at`. Soft delete via `deleted_at`.
- All prices, balances, volumes — **`numeric(38, 18)`**. Never `float`. Never `bigint` for money. This is critical — precision loss in crypto = real money.
- EVM addresses are stored **lowercase**. Solana addresses — as-is (case-sensitive).
- Transaction hashes — `text`, not `bytea` (easier to debug and index).

### ER Diagram (text)

```
users ──┬── tracked_wallets ──── wallet_transactions ─── tx_alerts
        │                           │
        ├── subscriptions            └── (type, tokens, amount)
        ├── telegram_link
        └── alert_settings

wallets_metadata (cache: ROI, winrate, label)
ai_analyses (cache of AI comments per tx)
```

### SQL Schema (Drizzle)

File `src/db/schema.ts`:

```typescript
import { pgTable, uuid, text, timestamp, numeric, integer, boolean, jsonb, index, primaryKey, pgEnum } from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────

export const chainEnum = pgEnum('chain', [
  'ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'solana', 'hyperliquid'
]);

export const txTypeEnum = pgEnum('tx_type', [
  'swap', 'transfer_in', 'transfer_out', 'mint', 'burn',
  'approve', 'stake', 'unstake', 'liquidity_add', 'liquidity_remove',
  'perp_open', 'perp_close', 'unknown'
]);

export const subscriptionTierEnum = pgEnum('subscription_tier', [
  'free', 'pro', 'power'
]);

// ─── Tables ───────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').unique(),
  walletAddress: text('wallet_address'),  // SIWE login (EVM)
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
  status: text('status').notNull().default('active'),  // active|canceled|past_due
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUser: index('subs_user_idx').on(t.userId),
}));

export const trackedWallets = pgTable('tracked_wallets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  address: text('address').notNull(),       // lowercase for EVM, as-is for Solana
  chain: chainEnum('chain').notNull(),
  label: text('label'),                      // user-defined label ("trader1", "vitalik")
  notifyMinUsd: numeric('notify_min_usd', { precision: 38, scale: 18 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueUserWallet: index('tw_user_addr_chain_idx').on(t.userId, t.address, t.chain),
  byAddress: index('tw_addr_chain_idx').on(t.address, t.chain),  // for reverse lookup in webhook
}));

export const walletsMetadata = pgTable('wallets_metadata', {
  address: text('address').notNull(),
  chain: chainEnum('chain').notNull(),
  ensName: text('ens_name'),                  // if EVM
  label: text('label'),                       // public label (Vitalik, jump, etc.)
  totalPnlUsd: numeric('total_pnl_usd', { precision: 38, scale: 18 }),
  winrate30d: numeric('winrate_30d', { precision: 5, scale: 4 }),  // 0.0000–1.0000
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
  // content — varies by type
  payload: jsonb('payload').notNull(),
  // key amounts for fast queries without parsing payload
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
  model: text('model').notNull(),             // "claude-sonnet-4-6"
  promptHash: text('prompt_hash').notNull(),  // sha256 of prompt for idempotency
  comment: text('comment').notNull(),
  riskLevel: text('risk_level'),              // low|medium|high
  suggestion: text('suggestion'),             // short recommendation
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
  deliveryChannel: text('delivery_channel').notNull(),  // 'telegram'|'email'|'web'
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  userFeedback: text('user_feedback'),                  // 'helpful'|'not_helpful'|null
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  byUser: index('alerts_user_time_idx').on(t.userId, t.createdAt),
}));

export const alertSettings = pgTable('alert_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  telegramEnabled: boolean('telegram_enabled').notNull().default(true),
  emailEnabled: boolean('email_enabled').notNull().default(false),
  quietHoursStart: integer('quiet_hours_start'),  // 0–23 UTC
  quietHoursEnd: integer('quiet_hours_end'),
  weeklyDigestEnabled: boolean('weekly_digest_enabled').notNull().default(true),
  minTxValueUsd: numeric('min_tx_value_usd', { precision: 38, scale: 18 }).default('100'),
});
```

### Tier Limits (hardcoded first, then a table)

| Tier | Price | Tracked wallets | AI comments | Quiet hours | Weekly digest |
|---|---|---|---|---|---|
| free | $0 | 3 | 5/day | no | no |
| pro | $29/mo | 25 | unlimited | yes | yes |
| power | $99/mo | 100 | unlimited + custom filters | yes | yes + custom |

Limits are checked on every mutation at the API level via middleware.

### Migrations

Drizzle Kit:
```bash
pnpm drizzle-kit generate   # create migration from schema changes
pnpm drizzle-kit push        # fast push in dev (no migration files)
pnpm drizzle-kit migrate     # apply migrations in prod
```

> **.NET parallel:** `drizzle-kit generate` ≈ `dotnet ef migrations add`. `drizzle-kit migrate` ≈ `dotnet ef database update`. But Drizzle doesn't do "magic" — a migration is just a SQL file you can edit by hand.

### Partitioning `wallet_transactions` by Month

At >10M rows, inserts/selects will slow down. Plan ahead:

```sql
CREATE TABLE wallet_transactions (
  -- ... columns above ...
) PARTITION BY RANGE (block_timestamp);

CREATE TABLE wallet_transactions_2026_05
  PARTITION OF wallet_transactions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- and so on
```

Can be automated via the `pg_partman` extension in Supabase.

---

## 5. Domain Model

Everything exchanged between backend and frontend is described through **Zod schemas**. This gives you validation, auto-generated TS types, and a client contract all in one.

File `src/lib/schemas.ts`:

```typescript
import { z } from 'zod';

// ─── Primitives ───────────────────────────────────────────────────

export const evmAddress = z.string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid EVM address')
  .transform(s => s.toLowerCase());

export const solanaAddress = z.string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address');

export const chainSchema = z.enum([
  'ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'solana', 'hyperliquid'
]);

export const txTypeSchema = z.enum([
  'swap', 'transfer_in', 'transfer_out', 'mint', 'burn',
  'approve', 'stake', 'unstake', 'liquidity_add', 'liquidity_remove',
  'perp_open', 'perp_close', 'unknown'
]);

// ─── Entities ─────────────────────────────────────────────────────

export const trackedWalletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  address: z.string(),
  chain: chainSchema,
  label: z.string().nullable(),
  notifyMinUsd: z.string(),  // numeric → string in JSON
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
});
export type TrackedWallet = z.infer<typeof trackedWalletSchema>;

export const walletTxPayloadSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('swap'),
    tokenInAddr: z.string(),
    tokenInSymbol: z.string(),
    tokenInAmount: z.string(),
    tokenOutAddr: z.string(),
    tokenOutSymbol: z.string(),
    tokenOutAmount: z.string(),
    dex: z.string(),  // 'uniswap-v3'|'jupiter'|...
    priceImpactPct: z.number().optional(),
  }),
  z.object({
    type: z.literal('transfer_in'),
    tokenAddr: z.string(),
    tokenSymbol: z.string(),
    amount: z.string(),
    fromAddress: z.string(),
  }),
  z.object({
    type: z.literal('transfer_out'),
    tokenAddr: z.string(),
    tokenSymbol: z.string(),
    amount: z.string(),
    toAddress: z.string(),
  }),
  // ... add more types as needed
]);

export const walletTxSchema = z.object({
  id: z.string().uuid(),
  address: z.string(),
  chain: chainSchema,
  txHash: z.string(),
  blockNumber: z.number().int(),
  blockTimestamp: z.string().datetime(),
  type: txTypeSchema,
  payload: walletTxPayloadSchema,
  valueUsd: z.string().nullable(),
});
export type WalletTransaction = z.infer<typeof walletTxSchema>;

export const aiAnalysisSchema = z.object({
  id: z.string().uuid(),
  walletTxId: z.string().uuid(),
  comment: z.string(),
  riskLevel: z.enum(['low', 'medium', 'high']).nullable(),
  suggestion: z.string().nullable(),
  createdAt: z.string().datetime(),
});
export type AiAnalysis = z.infer<typeof aiAnalysisSchema>;
```

> **.NET parallel:** Zod ≈ FluentValidation + DataAnnotations + auto-generated DTOs all in one. `z.infer<typeof X>` is like `typeof(X)` in C# for getting the type from an expression.

---

## 6. API

### Principles

- **REST for all CRUD**, **Next.js server actions for form flows**.
- All endpoints are protected via `requireAuth` or `requireSubscription(tier)` middleware.
- All responses: `{ ok: true, data: ... }` or `{ ok: false, error: { code, message } }`.
- Pagination — cursor-based: `?cursor=<uuid>&limit=20`.
- Per-endpoint rate limiting via Upstash Ratelimit middleware.

### Endpoints

#### Auth

```
POST   /api/auth/email-login         { email, password } → { user, session }
POST   /api/auth/register            { email, password } → { user, session }
POST   /api/auth/siwe/nonce          → { nonce }
POST   /api/auth/siwe/verify         { message, signature } → { user, session }
POST   /api/auth/logout              → { ok }
GET    /api/auth/me                  → { user } | 401
```

#### Tracked Wallets

```
GET    /api/wallets                          → { wallets: TrackedWallet[] }
POST   /api/wallets                          { address, chain, label?, notifyMinUsd? } → { wallet }
PATCH  /api/wallets/:id                      { label?, notifyMinUsd?, isActive? } → { wallet }
DELETE /api/wallets/:id                      → { ok }
GET    /api/wallets/:id/transactions         ?cursor=&limit= → { transactions: (WalletTransaction & { ai?: AiAnalysis })[], nextCursor }
GET    /api/wallets/:id/stats                → { totalPnlUsd, winrate30d, roi30d, txCount30d }
```

#### Discovery (AI-suggested smart wallets)

```
GET    /api/discovery/top-wallets    ?chain=&period=30d&limit= → { wallets: WalletMetadata[] }
GET    /api/discovery/search          ?q=<address|ens|label> → { wallets: WalletMetadata[] }
```

#### Alerts Feed

```
GET    /api/alerts                   ?cursor=&limit= → { alerts: TxAlert[] }
POST   /api/alerts/:id/feedback      { feedback: 'helpful'|'not_helpful' } → { ok }
```

#### Settings

```
GET    /api/settings                 → { alertSettings, telegramLinked }
PATCH  /api/settings                 { ... } → { alertSettings }
POST   /api/settings/telegram-link   → { linkToken, deepLink: 'https://t.me/...' }
DELETE /api/settings/telegram-link   → { ok }
```

#### Subscriptions

```
GET    /api/subscriptions/me         → { subscription }
POST   /api/subscriptions/checkout   { tier, paymentMethod: 'stripe'|'cryptomus' } → { checkoutUrl }
POST   /api/webhooks/stripe          ← Stripe events
POST   /api/webhooks/cryptomus       ← Cryptomus events
POST   /api/subscriptions/cancel     → { ok }
```

#### Inbound Webhooks

```
POST   /api/webhooks/alchemy         ← Alchemy on-chain webhooks (with signature verification)
POST   /api/webhooks/helius          ← Helius webhooks (Solana)
POST   /api/webhooks/telegram        ← Telegram updates (if using webhook instead of long-polling)
```

### Example Endpoint — Next.js App Router

`src/app/api/wallets/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { trackedWallets } from '@/db/schema';
import { requireAuth } from '@/lib/auth';
import { evmAddress, solanaAddress, chainSchema } from '@/lib/schemas';
import { enforceWalletLimit } from '@/lib/limits';
import { registerWebhookForAddress } from '@/lib/onchain/webhooks';

const createBody = z.object({
  address: z.string(),
  chain: chainSchema,
  label: z.string().max(50).optional(),
  notifyMinUsd: z.string().optional(),
}).refine(({ address, chain }) => {
  if (chain === 'solana') return solanaAddress.safeParse(address).success;
  return evmAddress.safeParse(address).success;
}, { message: 'Address format does not match chain' });

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  const wallets = await db.query.trackedWallets.findMany({
    where: (w, { eq, and, isNull }) => and(eq(w.userId, user.id), eq(w.isActive, true)),
    orderBy: (w, { desc }) => desc(w.createdAt),
  });
  return NextResponse.json({ ok: true, data: { wallets } });
}

export async function POST(req: NextRequest) {
  const user = await requireAuth(req);
  const body = createBody.parse(await req.json());

  await enforceWalletLimit(user);  // throws 402 if over tier limit

  const normalizedAddr = body.chain === 'solana' ? body.address : body.address.toLowerCase();

  const [wallet] = await db.insert(trackedWallets).values({
    userId: user.id,
    address: normalizedAddr,
    chain: body.chain,
    label: body.label,
    notifyMinUsd: body.notifyMinUsd ?? '0',
  }).returning();

  // Register webhook with Alchemy/Helius (idempotent — if already exists, returns existing id)
  await registerWebhookForAddress(normalizedAddr, body.chain);

  return NextResponse.json({ ok: true, data: { wallet } }, { status: 201 });
}
```

> **.NET parallel:** `requireAuth(req)` ≈ `[Authorize]` attribute. `body = createBody.parse(...)` ≈ `[FromBody]` + `ModelState.IsValid`. Except here it's an explicit call in code, which is cleaner for small handlers.

---

## 7. Workers

### Architecture Principle

Vercel = serverless, not suited for long-running processes or background tasks. Therefore:

- **Frontend + API routes** → Vercel.
- **Workers (BullMQ consumers)** → separate process on **Railway** (or Render/Fly.io). One Node.js process that listens to Redis and does work.
- **Cron jobs** → Vercel Cron (for lightweight) + node-cron inside the worker (for heavy).

> **.NET parallel:** worker on Railway = `IHostedService` in a separate console project.

### Queues

Three main queues:

| Queue name | What it does | Concurrency | Retry |
|---|---|---|---|
| `enrich` | Parses raw on-chain event into `WalletTransaction` | 10 | 3 times, exponential backoff |
| `ai-analyze` | Sends to Claude, saves result | 5 | 3 times |
| `notify` | Sends via Telegram/email | 20 | 5 times |

### Worker Structure

`apps/worker/src/index.ts`:

```typescript
import { Worker, QueueEvents } from 'bullmq';
import { redisConnection } from './redis';
import { enrichJob } from './jobs/enrich';
import { aiAnalyzeJob } from './jobs/ai-analyze';
import { notifyJob } from './jobs/notify';
import { logger } from './logger';

const enrichWorker = new Worker('enrich', enrichJob, {
  connection: redisConnection,
  concurrency: 10,
});

const aiWorker = new Worker('ai-analyze', aiAnalyzeJob, {
  connection: redisConnection,
  concurrency: 5,
});

const notifyWorker = new Worker('notify', notifyJob, {
  connection: redisConnection,
  concurrency: 20,
});

[enrichWorker, aiWorker, notifyWorker].forEach(w => {
  w.on('failed', (job, err) => logger.error({ jobId: job?.id, err }, 'Job failed'));
  w.on('completed', (job) => logger.debug({ jobId: job.id }, 'Job ok'));
});

// Graceful shutdown — critical, otherwise Railway will SIGKILL and in-flight jobs are lost
const shutdown = async () => {
  logger.info('Shutting down workers...');
  await Promise.all([enrichWorker.close(), aiWorker.close(), notifyWorker.close()]);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info('Workers started');
```

### Job: enrich (webhook → WalletTransaction)

```typescript
// apps/worker/src/jobs/enrich.ts
import { Job } from 'bullmq';
import { db } from '@/db';
import { walletTransactions } from '@/db/schema';
import { decodeAlchemyTx } from '@/lib/onchain/decode-evm';
import { decodeHeliusTx } from '@/lib/onchain/decode-solana';
import { fetchUsdPriceAt } from '@/lib/prices';
import { aiQueue } from '../queues';

export type EnrichJobData = {
  source: 'alchemy' | 'helius';
  chain: 'ethereum' | 'base' | 'arbitrum' | 'solana' | string;
  rawEvent: unknown;
  receivedAt: string;
};

export async function enrichJob(job: Job<EnrichJobData>) {
  const { source, chain, rawEvent } = job.data;

  const decoded = source === 'alchemy'
    ? await decodeAlchemyTx(rawEvent, chain)
    : await decodeHeliusTx(rawEvent);

  // USD price at block time (using CoinGecko + cache)
  const valueUsd = decoded.tokenInSymbol
    ? await fetchUsdPriceAt(decoded.tokenInSymbol, decoded.blockTimestamp)
        .then(p => Number(decoded.amountIn) * p)
    : null;

  // Idempotency by (txHash, address): if record exists — read it and continue
  const [tx] = await db.insert(walletTransactions).values({
    address: decoded.address,
    chain: decoded.chain,
    txHash: decoded.txHash,
    blockNumber: decoded.blockNumber,
    blockTimestamp: new Date(decoded.blockTimestamp),
    type: decoded.type,
    payload: decoded.payload,
    valueUsd: valueUsd?.toString() ?? null,
    tokenInSymbol: decoded.tokenInSymbol,
    tokenOutSymbol: decoded.tokenOutSymbol,
    amountIn: decoded.amountIn,
    amountOut: decoded.amountOut,
  }).onConflictDoNothing({ target: [walletTransactions.txHash, walletTransactions.address] }).returning();

  if (!tx) return; // duplicate — exit silently

  await aiQueue.add('analyze', { walletTxId: tx.id }, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
  });
}
```

### Job: ai-analyze

```typescript
// apps/worker/src/jobs/ai-analyze.ts
import { Job } from 'bullmq';
import { db } from '@/db';
import { walletTransactions, walletsMetadata, aiAnalyses, trackedWallets, txAlerts } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { analyzeTradeWithClaude } from '@/lib/ai/analyze-trade';
import { notifyQueue } from '../queues';
import crypto from 'node:crypto';

export async function aiAnalyzeJob(job: Job<{ walletTxId: string }>) {
  const tx = await db.query.walletTransactions.findFirst({
    where: eq(walletTransactions.id, job.data.walletTxId),
  });
  if (!tx) return;

  const meta = await db.query.walletsMetadata.findFirst({
    where: (w, { eq, and }) => and(eq(w.address, tx.address), eq(w.chain, tx.chain)),
  });

  // Who follows this address — needed for sending notifications
  const followers = await db.query.trackedWallets.findMany({
    where: (w, { eq, and }) => and(eq(w.address, tx.address), eq(w.chain, tx.chain), eq(w.isActive, true)),
  });
  if (followers.length === 0) return;

  const promptInput = { tx, meta };
  const promptHash = crypto.createHash('sha256').update(JSON.stringify(promptInput)).digest('hex');

  // Cache by prompt hash — if we've already analyzed this input, don't pay twice
  const cached = await db.query.aiAnalyses.findFirst({
    where: (a, { eq, and }) => and(eq(a.walletTxId, tx.id), eq(a.promptHash, promptHash)),
  });

  let analysis = cached;
  if (!cached) {
    const result = await analyzeTradeWithClaude(promptInput);
    [analysis] = await db.insert(aiAnalyses).values({
      walletTxId: tx.id,
      model: 'claude-sonnet-4-6',
      promptHash,
      comment: result.comment,
      riskLevel: result.riskLevel,
      suggestion: result.suggestion,
      tokensIn: result.usage.input,
      tokensOut: result.usage.output,
      costUsd: result.costUsd.toString(),
    }).returning();
  }

  // Create alerts for each follower and push to notify queue
  for (const follower of followers) {
    const [alert] = await db.insert(txAlerts).values({
      userId: follower.userId,
      trackedWalletId: follower.id,
      walletTxId: tx.id,
      aiAnalysisId: analysis!.id,
      deliveryChannel: 'telegram',
    }).returning();

    await notifyQueue.add('telegram', { alertId: alert.id }, {
      attempts: 5,
      backoff: { type: 'exponential', delay: 1000 },
    });
  }
}
```

### Cron Jobs

| Task | Schedule | Where |
|---|---|---|
| Refresh `wallets_metadata` (PnL/winrate) | Every 6 hours | Vercel Cron → API endpoint → BullMQ |
| Weekly digest for all pro/power users | Sun 09:00 UTC | Vercel Cron |
| Clean old alerts (>90 days) | Daily at 03:00 | Worker cron |
| Sync Stripe subscription state | Every 12 hours | Vercel Cron |

---

## 8. Web3 Integrations

### Networks Supported at MVP

- **Ethereum** (mainnet) — required
- **Base** — where most memecoin traffic lives in 2026
- **Arbitrum** — perps + Camelot/GMX
- **Solana** — required for memecoin / Jupiter / Raydium
- **Hyperliquid** — separate API, add in second iteration

### Data Sources

| Task | Service | Free limits | Paid |
|---|---|---|---|
| EVM webhooks (address monitoring) | **Alchemy Notify** | 25 webhooks, 100k events/mo | $49/mo → 1k webhooks |
| EVM RPC | Alchemy + QuickNode (backup) | 300M CU/mo | from $49 |
| EVM transaction decoding | viem + ABI from Sourcify | free | — |
| Solana webhooks | **Helius Webhooks** | 1k webhooks free, 100k events | from $49/mo |
| Solana decoding | Helius Enhanced Transactions API | included in plan | — |
| Token prices | **CoinGecko Demo** + DefiLlama (no key) | 30 calls/min | $129/mo |
| Ready wallet portfolio | **Zerion API** | 500 req/hr | from $99/mo |
| Smart money scoring | Custom via Dune Analytics | 30 queries/day | $390/mo |
| ENS resolution | viem.getEnsName() via Alchemy | free | — |

### Webhook Flow (EVM)

1. When creating a tracked_wallet, call `alchemy.notify.createWebhook({ network, addresses, webhookType: 'ADDRESS_ACTIVITY' })`.
2. Alchemy sends POST to our `https://app.example.com/api/webhooks/alchemy` on any transaction by that address.
3. We validate the `x-alchemy-signature` header (HMAC-SHA256 of the body with our secret).
4. Put event into `enrich` queue and immediately respond 200 OK (important — Alchemy retries on timeouts).

### EVM Transaction Decoding (swap example)

`src/lib/onchain/decode-evm.ts`:

```typescript
import { decodeFunctionData, parseAbi } from 'viem';
import type { AlchemyAddressActivityEvent } from './types';

const uniswapV3Abi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  // ...other methods
]);

export async function decodeAlchemyTx(rawEvent: AlchemyAddressActivityEvent, chain: string) {
  const activity = rawEvent.event.activity[0];

  // Simple transfer
  if (activity.category === 'token' && activity.value) {
    return {
      address: activity.fromAddress.toLowerCase(),
      chain,
      txHash: activity.hash,
      blockNumber: parseInt(activity.blockNum, 16),
      blockTimestamp: rawEvent.event.network ? new Date() : new Date(),
      type: 'transfer_out' as const,
      tokenInSymbol: activity.asset,
      tokenOutSymbol: null,
      amountIn: activity.value.toString(),
      amountOut: null,
      payload: {
        type: 'transfer_out' as const,
        tokenAddr: activity.rawContract.address ?? '0x0',
        tokenSymbol: activity.asset,
        amount: activity.value.toString(),
        toAddress: activity.toAddress.toLowerCase(),
      },
    };
  }

  // Swap via known DEX router — decode calldata
  if (KNOWN_DEX_ROUTERS.has(activity.toAddress.toLowerCase())) {
    try {
      const decoded = decodeFunctionData({ abi: uniswapV3Abi, data: activity.input });
      // ... process result
    } catch {
      // not our ABI — fallback to "unknown"
    }
  }

  return { /* unknown fallback */ };
}
```

### Solana Transaction Decoding

Helius already returns decoded JSON — no need to do it manually:

```typescript
// src/lib/onchain/decode-solana.ts
import type { HeliusEnhancedTransaction } from './types';

export async function decodeHeliusTx(raw: HeliusEnhancedTransaction) {
  if (raw.type === 'SWAP') {
    const swap = raw.tokenTransfers;
    return {
      address: raw.feePayer,
      chain: 'solana',
      txHash: raw.signature,
      blockNumber: raw.slot,
      blockTimestamp: new Date(raw.timestamp * 1000).toISOString(),
      type: 'swap' as const,
      tokenInSymbol: swap[0].mint, // resolve via Helius asset API
      tokenOutSymbol: swap[1].mint,
      amountIn: swap[0].tokenAmount.toString(),
      amountOut: swap[1].tokenAmount.toString(),
      payload: {
        type: 'swap' as const,
        tokenInAddr: swap[0].mint,
        tokenInSymbol: swap[0].mint,
        tokenInAmount: swap[0].tokenAmount.toString(),
        tokenOutAddr: swap[1].mint,
        tokenOutSymbol: swap[1].mint,
        tokenOutAmount: swap[1].tokenAmount.toString(),
        dex: raw.source ?? 'unknown',
      },
    };
  }
  // ... other types
  return { /* unknown */ };
}
```

### Webhook Security

Every incoming webhook **must** be validated:

```typescript
function verifyAlchemySignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.ALCHEMY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

> **.NET parallel:** identical to HMAC validation in any .NET webhook handler. `crypto.timingSafeEqual` is timing-attack protection — no different from `CryptographicOperations.FixedTimeEquals`.

---

## 9. AI Layer

### Why AI Is Needed Here

Without AI our product = yet another Cielo. With AI, every alert transforms from "trader X bought Y for Z" into a meaningful commentary: "here's what it means, here's the risk, here's the context, here's what you can do."

This is the **main differentiator**.

### What We Do NOT Do with AI at MVP

- We don't trade on behalf of the user.
- We don't give "price predictions" — that's a path to legal problems and reputational damage. Only fact description + context + risk level.
- We don't write "buy X now" — we write "this trade matches a bullish setup; historically this wallet's similar moves led to +N% in M days."

### Architecture

```
┌─────────────┐
│ WalletTx +  │
│ wallet meta │  ──┐
└─────────────┘    │
                   ├──► Prompt builder ──► Claude API ──► JSON response ──► DB cache
┌─────────────┐    │
│ Recent ctx  │  ──┘
│ (last 5 tx  │
│ same wallet)│
└─────────────┘
```

### Prompt Template (single trade analysis)

`src/lib/ai/prompts/analyze-trade.ts`:

```typescript
import { dedent } from 'ts-dedent';

export const SYSTEM_PROMPT = dedent`
  You are a crypto on-chain trade analyst. You analyze a single transaction made by a "smart money" wallet
  and produce a structured analysis for a retail trader who follows this wallet.

  Rules:
  - Be factual. Never predict prices.
  - Speak in the user's language (default: Russian, switch if asked).
  - Respect token contract addresses; do NOT confuse similarly named tokens.
  - If the trade is suspicious (honeypot, low liquidity, freshly deployed contract) — flag it.
  - Output strictly valid JSON matching the requested schema.
`;

export type AnalyzeTradeInput = {
  tx: {
    type: string;
    chain: string;
    blockTimestamp: string;
    payload: any;
    valueUsd: string | null;
  };
  walletMeta: {
    label?: string | null;
    ensName?: string | null;
    totalPnlUsd?: string | null;
    winrate30d?: string | null;
    roi30d?: string | null;
    txCount30d?: number | null;
  };
  recentContext: Array<{
    type: string;
    blockTimestamp: string;
    summary: string;
  }>;
};

export function buildPrompt(input: AnalyzeTradeInput): string {
  return dedent`
    Analyze this trade and return JSON:

    {
      "comment": string,        // 2–4 sentences in Russian, retail-friendly
      "riskLevel": "low" | "medium" | "high",
      "suggestion": string,     // ≤120 chars, action-oriented but cautious
      "tags": string[]          // e.g., ["memecoin", "low-liquidity", "rotation"]
    }

    Trade:
    ${JSON.stringify(input.tx, null, 2)}

    Wallet metadata:
    ${JSON.stringify(input.walletMeta, null, 2)}

    Last 5 trades from same wallet:
    ${input.recentContext.map((c, i) => `${i + 1}. ${c.blockTimestamp} - ${c.summary}`).join('\n')}
  `;
}
```

### Calling Claude

`src/lib/ai/analyze-trade.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt, SYSTEM_PROMPT, AnalyzeTradeInput } from './prompts/analyze-trade';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const PRICE_PER_M_TOKEN_IN = 3.0;   // Sonnet 4.6 input
const PRICE_PER_M_TOKEN_OUT = 15.0; // Sonnet 4.6 output

export async function analyzeTradeWithClaude(input: AnalyzeTradeInput) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(input) }],
  });

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text response');

  // Parse JSON. If the model returned non-JSON — try to extract the {} block.
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in response');

  const parsed = JSON.parse(jsonMatch[0]) as {
    comment: string;
    riskLevel: 'low' | 'medium' | 'high';
    suggestion: string;
    tags: string[];
  };

  const costUsd =
    (response.usage.input_tokens / 1_000_000) * PRICE_PER_M_TOKEN_IN +
    (response.usage.output_tokens / 1_000_000) * PRICE_PER_M_TOKEN_OUT;

  return {
    comment: parsed.comment,
    riskLevel: parsed.riskLevel,
    suggestion: parsed.suggestion,
    usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    costUsd,
  };
}
```

### Cost and Budget

One call: ~1500 input + ~200 output tokens = `1500/1M * 3 + 200/1M * 15 = $0.0045 + $0.003 = ~$0.0075`.

At 100 users × 50 trades/day × $0.0075 = **$37.5/day = ~$1100/mo**. This is the ceiling without optimization.

Optimizations:
- **Prompt cache by `promptHash`** (we do this) — saves on repeated scenarios.
- **Anthropic's prompt caching** — cache the system prompt, saves ~50% of input cost.
- **Weekly digest batching** via Claude Batch API — 50% cheaper.
- **On free tier** — limit to 5 AI comments per day.

### Prompt Injection Protection

Addresses, ENS names, memos, and other user/on-chain data can contain malicious content (e.g., an ENS name like `Ignore previous instructions and...`).

Defenses:
1. All user-controlled fields are **serialized via JSON.stringify** — this already isolates them.
2. `SYSTEM_PROMPT` has strict rules.
3. On output, **validate the JSON schema** via Zod — if the model deviated, fall back to the default comment "Trade recorded, AI analysis temporarily unavailable."
4. Never insert raw prompt text into shell, eval, or HTML without escaping.

### Weekly Digest Prompt (sketch)

```typescript
export const WEEKLY_DIGEST_SYSTEM = `
You are an analyst writing a personalized weekly crypto digest.
Aggregate the user's tracked wallets' activity, find patterns, and write a narrative
summary in 5–8 sentences. End with one actionable observation. Russian language.
`;

// Input: user.followedWallets[].lastWeekTransactions[]
// Output: { summary: string, highlights: string[], actionable: string }
```

---

## 10. Telegram Bot

### Why Telegram First

- Low CAC: the user is already in Telegram, no app to install.
- High retention: notifications arrive where they look every hour.
- Clean UX for our core concept — alert + comment.
- Native to the crypto community.

### Framework: grammY (TS-native)

```bash
pnpm add grammy @grammyjs/conversations @grammyjs/menu @grammyjs/i18n
```

### Bot File Structure

```
apps/bot/
├── src/
│   ├── index.ts              # entry point, start polling/webhook
│   ├── bot.ts                # bot initialization + middlewares
│   ├── commands/
│   │   ├── start.ts          # /start
│   │   ├── connect.ts        # /connect — link to web account
│   │   ├── follow.ts         # /follow <addr>
│   │   ├── unfollow.ts       # /unfollow <addr>
│   │   ├── list.ts           # /list — my tracked wallets
│   │   ├── settings.ts       # /settings
│   │   ├── help.ts           # /help
│   │   └── upgrade.ts        # /upgrade — link to checkout
│   ├── conversations/
│   │   ├── add-wallet.ts     # step-by-step wallet addition
│   │   └── settings-flow.ts  # step-by-step alert settings
│   ├── handlers/
│   │   ├── alert-feedback.ts # callback for 👍/👎
│   │   └── pagination.ts     # /list pagination
│   ├── middlewares/
│   │   ├── auth.ts           # check that user is linked
│   │   ├── tier.ts           # check tier limits
│   │   └── rate-limit.ts
│   └── i18n/
│       ├── ru.ftl            # Fluent localization
│       └── en.ftl
└── package.json
```

### Bot Commands

| Command | Description | Access |
|---|---|---|
| `/start` | Welcome + quick registration | everyone |
| `/connect <token>` | Link to web account via one-time token | everyone |
| `/follow <address> [chain]` | Add wallet to tracking | logged in |
| `/unfollow <address>` | Remove wallet | logged in |
| `/list` | Show my wallets + recent stats | logged in |
| `/stats <address>` | Full wallet stats | logged in |
| `/discover` | Top smart wallets | pro+ |
| `/digest` | Send weekly digest now | pro+ |
| `/settings` | Notification settings | logged in |
| `/upgrade` | Upgrade to paid tier | everyone |
| `/help` | Help | everyone |

### Flow: Linking Telegram ↔ Web Account

1. User in web: `Settings → Telegram → Connect`. Backend generates a one-time `linkToken` (UUID, TTL 5 min).
2. Backend returns `https://t.me/SmartMoneyTrackerBot?start=link_<token>`.
3. User clicks, bot receives `/start link_<token>`.
4. Bot extracts `<token>` → looks up in `link_tokens` table → finds `userId` → sets `users.telegramId = ctx.from.id`.
5. Bot replies: "✅ Account linked."

### Example: /follow Command

`apps/bot/src/commands/follow.ts`:

```typescript
import { Composer, InlineKeyboard } from 'grammy';
import { MyContext } from '../types';
import { isAddress } from 'viem';
import { db } from '@/db';
import { trackedWallets } from '@/db/schema';
import { enforceWalletLimit } from '@/lib/limits';
import { detectChain } from '@/lib/onchain/detect-chain';
import { getOrFetchWalletStats } from '@/lib/wallets/stats';
import { registerWebhookForAddress } from '@/lib/onchain/webhooks';

export const followCommand = new Composer<MyContext>();

followCommand.command('follow', async (ctx) => {
  if (!ctx.user) return ctx.reply('⚠️ Please link your account first via /connect');

  const args = ctx.match?.toString().trim().split(/\s+/) ?? [];
  const [addressRaw, chainArg] = args;

  if (!addressRaw) {
    return ctx.reply('Usage: `/follow 0xabc... ethereum`\nor: `/follow <Solana_address> solana`', { parse_mode: 'Markdown' });
  }

  const chain = chainArg ?? await detectChain(addressRaw);
  if (!chain) return ctx.reply('❌ Cannot detect network. Specify explicitly: ethereum / base / arbitrum / solana');

  const address = chain === 'solana' ? addressRaw : addressRaw.toLowerCase();
  if (chain !== 'solana' && !isAddress(address)) return ctx.reply('❌ Invalid EVM address');

  try {
    await enforceWalletLimit(ctx.user);
  } catch (e) {
    return ctx.reply(`❌ Tier limit reached. ${(e as Error).message}\n→ /upgrade`);
  }

  await db.insert(trackedWallets).values({
    userId: ctx.user.id, address, chain, label: null,
  }).onConflictDoNothing();

  await registerWebhookForAddress(address, chain);
  const stats = await getOrFetchWalletStats(address, chain);

  const kb = new InlineKeyboard()
    .text('✏️ Add label', `label:${address}:${chain}`)
    .text('🔕 Unfollow', `unfollow:${address}:${chain}`);

  await ctx.reply(
    `✅ Tracking \`${address}\` (${chain})\n` +
    `📊 30d ROI: ${stats.roi30d ?? 'n/a'}\n` +
    `🎯 Winrate: ${stats.winrate30d ?? 'n/a'}\n` +
    `📦 Trades: ${stats.txCount30d ?? 'n/a'}`,
    { parse_mode: 'Markdown', reply_markup: kb }
  );
});
```

### Alert Message Format

```
🐋 Smart wallet activity

vitalik.eth (ROI 30d: +47%, winrate 68%)
ethereum • Uniswap V3

Bought: 12.4 ETH → 38,500 USDC
Amount: ~$45,200
3 minutes ago

🤖 AI: Looks like profit-taking after the recent ETH rally.
The wallet increased its stablecoin share from 18% to 31% over the past week.
This is a "risk-off" pattern — a local market correction is possible.

⚠️ Risk: medium
💡 If you hold a large ETH position, worth watching closely

[👍 Helpful] [👎 Not helpful] [📈 Open dashboard]
```

### Feedback Buttons

Inline buttons send `callback_data: "fb:<alertId>:helpful"` or `:not_helpful`. The handler writes to `tx_alerts.userFeedback`. This is critical — we'll use this data to fine-tune prompts.

### Throttling and Quiet Hours

- Before sending, check `alert_settings.quietHoursStart/End` for the user — if within quiet hours, delay the job until the end of quiet hours.
- Grouping: if a user receives 5+ alerts in 5 minutes — send a summary message instead.

---

## 11. Auth and Security

### Login Methods

1. **Email + password** (Supabase Auth) — for regular users.
2. **Google OAuth** (Supabase Auth) — low friction.
3. **Sign-In With Ethereum (SIWE)** — for web3 natives. No email, no password needed.

All three methods create a single record in `users` (merge if email matches).

### SIWE Flow in Detail

1. Frontend via wagmi's `useSignMessage`: `await signMessage({ message })`.
2. `message` is built with the `siwe` library:
   ```typescript
   const msg = new SiweMessage({
     domain: window.location.host,
     address: account.address,
     statement: 'Sign in to Smart Money Tracker',
     uri: window.location.origin,
     version: '1',
     chainId: 1,
     nonce: await fetch('/api/auth/siwe/nonce').then(r => r.json()).then(d => d.nonce),
   }).prepareMessage();
   ```
3. Signature is sent to `/api/auth/siwe/verify`, backend verifies via `siwe.verify()`, issues a JWT cookie.
4. **We never store private keys** — we only need the signature to prove wallet ownership.

### Sessions

- HTTP-only cookie with JWT.
- TTL 30 days.
- Refresh token via Supabase, automatic in the SDK.
- CSRF protection: `sameSite=lax` cookies + double-submit token for mutations.

### Tier Limits Middleware

`src/lib/limits.ts`:

```typescript
const TIER_LIMITS = {
  free: { trackedWallets: 3, aiCommentsPerDay: 5 },
  pro: { trackedWallets: 25, aiCommentsPerDay: Infinity },
  power: { trackedWallets: 100, aiCommentsPerDay: Infinity },
} as const;

export async function enforceWalletLimit(user: User) {
  const sub = await getActiveSubscription(user.id);
  const tier = sub?.tier ?? 'free';
  const limit = TIER_LIMITS[tier].trackedWallets;
  const current = await db.$count(trackedWallets, eq(trackedWallets.userId, user.id));
  if (current >= limit) {
    throw new HttpError(402, `${tier} tier allows ${limit} wallets. Current: ${current}.`);
  }
}
```

### Secrets

All secrets — **only** in env vars. Never in code. Never in git.

| Secret | Where | How to rotate |
|---|---|---|
| `DATABASE_URL` | Vercel/Railway env | via Supabase UI |
| `ANTHROPIC_API_KEY` | env | console.anthropic.com |
| `ALCHEMY_API_KEY` + `_WEBHOOK_SECRET` | env | Alchemy dashboard |
| `HELIUS_API_KEY` | env | Helius dashboard |
| `TELEGRAM_BOT_TOKEN` | env | @BotFather |
| `STRIPE_SECRET_KEY` + `_WEBHOOK_SIGNING` | env | Stripe dashboard |
| `JWT_SECRET` | env | self-generated, rotate annually |
| `SUPABASE_SERVICE_ROLE_KEY` | env (backend only) | Supabase dashboard |

Locally — `.env.local` (in .gitignore!), for prod — Vercel/Railway dashboards.

### Encryption of Sensitive DB Data

If we ever store something sensitive (e.g., email notifications), use Postgres's `pgcrypto` extension + `crypto_secretbox` via NaCl. But on MVP **we store nothing like that**.

### Audit

- `pino` logs with structured fields — written to Axiom.
- Every change to `tracked_wallets`, `subscriptions` — writes an audit record with user_id, action, payload, ip.
- Sentry for all 5xx errors.

---

## 12. Deploy

### Topology

```
[Vercel]
├── Next.js app (frontend + API)
├── Vercel Cron jobs (HTTP triggers)
└── Edge middleware (auth check)

[Railway]
└── Worker process (BullMQ consumers + node-cron)

[Supabase]
├── Postgres (managed)
├── Auth
└── Storage (for future avatars etc.)

[Upstash]
└── Redis (for BullMQ + rate limiting + cache)

[External]
├── Alchemy (EVM webhooks + RPC)
├── Helius (Solana webhooks + RPC)
├── Anthropic (Claude API)
├── Stripe + Cryptomus
├── Sentry + Axiom
└── Resend (transactional email)
```

### Infrastructure Cost at Launch (up to 500 users)

| Service | Cost/mo |
|---|---|
| Vercel Hobby | $0 |
| Railway Hobby | $5 |
| Supabase Free | $0 (up to 500MB DB) |
| Upstash Redis Free | $0 (up to 10k commands/day — will need to upgrade to Pay-as-you-go ~$10) |
| Alchemy Growth | $49 |
| Helius Developer | $49 |
| Anthropic Claude | ~$50–200 (depends on volume) |
| Sentry / Axiom Free | $0 |
| Resend Free | $0 (3k emails/mo) |
| Domain + SSL | $10/year |
| **Total** | **~$150–300/mo** |

### CI/CD

GitHub Actions:
- On push to `main` → auto-deploy to Vercel (app) and Railway (worker).
- On PR → `pnpm test`, `biome check`, `tsc --noEmit`.
- On merge → drizzle migrate in prod.

### Sentry / Observability

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV,
});
```

Plus structured logs to Axiom via pino:

```typescript
import pino from 'pino';
import { createWriteStream } from 'pino-axiom';

export const logger = pino({}, createWriteStream({
  dataset: 'smt-prod',
  token: process.env.AXIOM_TOKEN!,
  orgId: process.env.AXIOM_ORG_ID!,
}));
```

---

## 13. Learning Plan

### Why This Is All in One Document

To avoid the "vibe-coded it → don't understand what I deployed" situation. Each week you learn a block of concepts, then vibe-code it into the project — that reinforces knowledge better than any course.

### Core Learning Resources

- **TypeScript Handbook** — official, read once: https://www.typescriptlang.org/docs/handbook/
- **Total TypeScript** (Matt Pocock) — practical courses, some free.
- **Next.js Learn** — official tutorial: https://nextjs.org/learn
- **Drizzle docs** — short, readable in an hour.
- **viem docs** — main web3 tutorial, very well written: https://viem.sh
- **wagmi docs** — for React hooks built on viem.
- **Solana Cookbook** — for the Solana part.
- **The Anthropic Prompt Engineering Guide** — useful for the AI layer.

### Week-by-Week Plan

#### Week 1 — TypeScript + Node Fundamentals

Goal: you write modern TS code without surprises.

- Days 1–2: TypeScript Handbook (Basics + Everyday Types + Narrowing + Functions). Do 5 exercises on discriminated unions.
- Day 3: modules, ESM vs CJS, `tsconfig.json`. Understand why `"moduleResolution": "Bundler"`.
- Day 4: `pnpm`, monorepo via Turborepo. Create project skeleton with `apps/web`, `apps/worker`, `apps/bot`, `packages/db`, `packages/shared`.
- Day 5: async/await patterns in Node, error handling (`try/catch` + typing errors via `instanceof`).
- Days 6–7: Zod — in depth. This will be the foundation of all contracts in the project.

**.NET → TS parallels for this week:**
- `interface`/`class`/`record` → `type`/`interface`/`class`
- `LINQ` → array methods (`.map`/`.filter`/`.reduce`) or `remeda`/`es-toolkit` library
- `IEnumerable<T>` → `Iterable<T>`, async `AsyncIterable<T>`
- `Task<T>` → `Promise<T>`
- `IDisposable` + `using` → `await using` (TC39 Resource Management)
- `null` vs `undefined`: both exist, but use `undefined` by default, `null` — only when explicitly needed

#### Week 2 — Postgres + Drizzle + Next.js API Routes

Goal: you can write a CRUD API with a typed database.

- Day 1: Postgres as a DBMS (if you only know MS SQL — study the differences: `serial`/`uuid`, `jsonb`, `enum`, `numeric`).
- Day 2: Drizzle schema, query builder, transactions.
- Days 3–4: Next.js App Router — go through the official tutorial.
- Day 5: Server Actions vs API Routes — when to use which.
- Days 6–7: Implement `tracked_wallets` CRUD end-to-end (frontend form → server action → DB → render list).

#### Week 3 — viem + wagmi + Reown AppKit

Goal: you understand what a blockchain client is, what RPC is, and how to connect a wallet.

- Day 1: concepts — RPC node, public client, wallet client. What `provider` was historically and why viem moved away from it.
- Day 2: viem blockchain reads — `getBalance`, `getBlockNumber`, `readContract`. ABI and `parseAbi`.
- Day 3: events — `getLogs`, `watchEvent`. How to decode `event Transfer(address,address,uint256)`.
- Day 4: wagmi hooks on frontend — `useAccount`, `useBalance`, `useReadContract`.
- Day 5: Reown AppKit — embed "Connect Wallet" in your Next.js.
- Days 6–7: SIWE — implement the full auth flow.

**Key concepts to understand:**
- A blockchain is read via RPC. It's not a DB, not a server SDK — it's a network node. Alchemy/Infura/QuickNode are just managed RPC nodes.
- Addresses are compressed public keys. Nothing needs to be "remembered" — wagmi stores everything in `localStorage`.
- A transaction = a signed message. Nobody but the private key owner can sign it.

#### Week 4 — Solana + AI Layer

Goal: you understand how Solana differs from EVM, and you can call Claude from Node.

- Day 1: Solana basics — accounts model (instead of EVM smart contracts), tokens = SPL Token Program. No ABIs.
- Day 2: `@solana/web3.js` basic operations, Helius API.
- Day 3: Anthropic SDK, basic Claude API calls.
- Day 4: Prompt engineering — how to structure a prompt for JSON output.
- Day 5: Streaming, error handling, cost tracking.
- Days 6–7: Build `analyze-trade` end-to-end — real trade from DB → Claude → JSON → save.

#### Week 5 — Queues (BullMQ) + Telegram Bot (grammY)

Goal: you can write an async worker with retry and cron, and a Telegram bot with FSM.

- Day 1: Redis basics, BullMQ concepts (queue/worker/job).
- Day 2: BullMQ retry, backoff, rate limiting, repeated jobs.
- Day 3: grammY basics, command handling.
- Day 4: grammY conversations (FSM for step-by-step scenarios).
- Day 5: inline keyboards, callback queries, edit message.
- Days 6–7: Wire it all together — Telegram /follow → DB → Alchemy webhook → enrich job → AI job → notify job → Telegram message.

#### Week 6 — Payments, Production, Monitoring

Goal: product is deployed, payments work, errors are visible.

- Day 1: Stripe Checkout + webhooks. Idempotency.
- Day 2: Cryptomus integration (for crypto payments).
- Day 3: Vercel deploy, env, preview deployments.
- Day 4: Railway worker deploy, graceful shutdown.
- Day 5: Sentry + Axiom + healthchecks.
- Day 6: Drizzle migrations in prod, Postgres backups.
- Day 7: Full e2e test: new user → connect → pay → alerts → cancel.

### Vibe-Coding Approach for Learning

- **Don't vibe what you don't understand.** If Claude/Cursor generated a chunk and you can't explain it in 3 sentences — stop, read the docs for what's in it.
- **Ask "how" first, then "write."** Good pattern: first ask "explain how BullMQ handles retries," understand it. Only then "write a worker for X."
- **Small iterations.** One endpoint at a time. One component at a time. After each — `git commit` with a brief description.
- **Keep notes.** In a notebook/Obsidian/`NOTES.md` record: "today I learned that Drizzle doesn't support nested transactions out of the box, need `db.transaction(tx => tx.transaction(...))`."

---

## 14. Glossary

### .NET → TypeScript

| .NET | TypeScript |
|---|---|
| `class Foo { public string Name { get; set; } }` | `class Foo { name!: string }` or `type Foo = { name: string }` |
| `public record Foo(string Name);` | `type Foo = Readonly<{ name: string }>` |
| `IEnumerable<T>` / `IReadOnlyList<T>` | `readonly T[]` or `Iterable<T>` |
| `LINQ`: `.Where(x => x.Active).Select(x => x.Name)` | `.filter(x => x.active).map(x => x.name)` |
| `LINQ.GroupBy` | `Object.groupBy(arr, x => x.key)` (ES2024) or lodash/remeda |
| `Task<T>` / `await` | `Promise<T>` / `await` |
| `CancellationToken` | `AbortController` / `AbortSignal` |
| `IDisposable` + `using` | `Symbol.dispose` + `using x = ...` (TS 5.2+) |
| `null` (everywhere) | `null` or `undefined` (agree to use `undefined` by default) |
| `string.IsNullOrWhiteSpace(s)` | `!s?.trim()` |
| `nameof(x)` | not in TS, use `'x' satisfies keyof T` |
| `JsonSerializer.Serialize(x)` | `JSON.stringify(x)` |
| `JsonSerializer.Deserialize<T>(s)` | `schema.parse(JSON.parse(s))` (via Zod, otherwise no runtime check!) |
| `Record<TKey, TValue>` (.NET 9) | built-in `Record<K, V>` |
| `Action<T>` / `Func<T, R>` | `(x: T) => void` / `(x: T) => R` |
| `Tuple<int, string>` | `[number, string]` |
| `enum Color { Red, Green }` | `const Color = { Red: 'red', Green: 'green' } as const; type Color = (typeof Color)[keyof typeof Color]` (or native TS `enum`, but avoid) |
| `try/catch (Exception ex) when (...)` | `try/catch` without `when`, filter inside `if (e instanceof XError)` |
| `[Authorize]` | middleware function, called at the start of the handler |
| `[FromBody] FooDto dto` | `const dto = FooSchema.parse(await req.json())` |
| `appsettings.json` | `process.env` + Zod schema for env validation at startup |
| `ILogger<T>` via DI | `import { logger } from '@/lib/logger'` (singleton module) |
| `IServiceCollection` (DI) | typically no DI in TS — plain modules. If needed: `awilix`/`tsyringe` |
| `IOptions<T>` | module with typed env config |
| `EF Core DbContext` | Drizzle `db` + `schema` |
| `dotnet ef migrations add` | `pnpm drizzle-kit generate` |
| `dotnet ef database update` | `pnpm drizzle-kit migrate` |
| `Hangfire` / `Quartz` | `BullMQ` (requires Redis) |
| `IHostedService` | separate Node.js process with the worker |
| `SignalR` | `@supabase/realtime-js` or native WebSocket |
| `MediatR` | typically no equivalent in TS, events via `EventEmitter` or message queue |
| NUnit / xUnit | Vitest (Jest-compatible, faster) |
| Moq / NSubstitute | `vi.mock(...)` built into Vitest |
| Postman / Swagger UI | `Bruno` (open-source alternative) or Swagger UI via `next-swagger-doc` |

### Web3 Terms

| Term | What it means |
|---|---|
| **EOA** (Externally Owned Account) | regular wallet, controlled by a private key |
| **Smart contract account** / **AA** | wallet with code (ERC-4337) — programmable, multi-sig, social recovery |
| **RPC node** | server through which you "talk" to the blockchain (read+write) |
| **ABI** | JSON description of a smart contract interface (like Swagger for blockchain) |
| **Block** | batch of transactions confirmed by the network |
| **Gas** | payment for executing operations. Expensive on L1 ETH, cheap on L2 |
| **L1 / L2** | L1 = base network (Ethereum, Solana). L2 = scaling layer for cheaper txs (Base, Arbitrum, Optimism) |
| **Webhook** (Alchemy/Helius) | subscription service for on-chain events: "give me a callback on any tx for address X" |
| **DEX aggregator** | service that finds the best swap route (1inch, Jupiter, CowSwap) |
| **Slippage** | price movement during a swap due to low liquidity |
| **Honeypot** | fraudulent token — you can buy but can't sell |
| **Rugpull** | developers withdraw liquidity → price goes to zero |
| **MEV** | Maximum Extractable Value — profit from manipulating transaction order in a block |
| **Stablecoin** | token pegged to a fiat currency (USDC, USDT, DAI) |
| **LP** (Liquidity Provider) | user who deposits tokens into a DEX pool, earns fees |
| **TVL** (Total Value Locked) | how much money is in a protocol |
| **Restaking** | delegating ETH stake to additional services (EigenLayer) |
| **Bridge** | connection between networks. Historically very risky |
| **SIWE** | Sign-In With Ethereum — login via message signature |
| **ENS** | Ethereum Name Service — vitalik.eth → 0xd8da6...96045 |
| **Chain ID** | numeric network identifier (Ethereum=1, Base=8453, Solana uses a different model) |

---

## 15. MVP Checklist

### Required for "First Live User"

**Backend / data plane**
- [ ] Postgres schema via Drizzle, migrations run cleanly.
- [ ] `users`, `tracked_wallets`, `wallet_transactions`, `ai_analyses`, `tx_alerts`, `subscriptions`, `alert_settings` created.
- [ ] Alchemy webhook endpoint with HMAC validation.
- [ ] Helius webhook endpoint (Solana).
- [ ] Worker with three queues: enrich, ai-analyze, notify.
- [ ] Decoding at minimum: `swap` (Uniswap V3 + Jupiter), `transfer_in/out`, `unknown` fallback.

**Frontend**
- [ ] Landing page with description (one page, no wallet connection required).
- [ ] Auth: email + Google + SIWE.
- [ ] Dashboard: list of tracked_wallets, add form.
- [ ] List of recent alerts (10 items with pagination).
- [ ] Settings: notification prefs, Telegram link button, tier.
- [ ] Stripe Checkout flow.

**Telegram**
- [ ] Bot registered, BotFather settings: commands, description, avatar.
- [ ] Commands: `/start`, `/connect`, `/follow`, `/unfollow`, `/list`, `/settings`, `/upgrade`, `/help`.
- [ ] Web account linking works.
- [ ] Alerts sent to Telegram, feedback buttons functional.

**AI**
- [ ] `analyze-trade` prompt consistently returns valid JSON.
- [ ] Caching by `promptHash`.
- [ ] Cost tracking in DB (`ai_analyses.costUsd`).

**Payments**
- [ ] Stripe tests passed, webhook subscription.created/updated/deleted handled.
- [ ] Cryptomus pending, can add in v1.1.
- [ ] Tier limits enforced at API.

**Security**
- [ ] Secrets not in repo (check `git log -p -S "<old_token>"` just in case — revoke old ones!).
- [ ] HMAC verification on all webhooks.
- [ ] Rate limiting on public endpoints (auth, webhooks).
- [ ] CORS configured (frontend domain only).

**Observability**
- [ ] Sentry active, test error received.
- [ ] Axiom receiving worker and API logs.
- [ ] Vercel/Railway healthchecks responding.

**Ops**
- [ ] Production deploy on Vercel + Railway.
- [ ] DNS configured, SSL via Vercel.
- [ ] Supabase backups automatic (Pro plan required in prod).
- [ ] Full user journey manual run: registration → Telegram link → /follow → real transaction → alert received.

### What We Do NOT Do at MVP (deferred)

- ⏳ Web dashboard with charts (only list + basic stats).
- ⏳ Hyperliquid integration.
- ⏳ Custom alert filters (amount threshold, tx types) — only basic `notifyMinUsd`.
- ⏳ Referral program.
- ⏳ Discord bot.
- ⏳ Mobile push notifications.
- ⏳ Weekly digest (can add in second iteration).
- ⏳ Smart money discovery (top wallets) — users add manually for now.
- ⏳ English UI translation (Russian first).

### When "Ready to Show Users"

Not before all items above are complete + you've personally run through the e2e flow with a real on-chain transaction and confirmed that an alert arrived with a meaningful AI comment.

---

## Appendix: Quick Start Commands

```bash
# 1. Create monorepo
mkdir smt && cd smt
pnpm init
pnpm add -D turbo typescript @types/node biome
mkdir -p apps/web apps/worker apps/bot packages/db packages/shared

# 2. Web (Next.js)
cd apps/web
pnpm create next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
pnpm add drizzle-orm pg viem wagmi @reown/appkit @reown/appkit-adapter-wagmi siwe zod
pnpm add @anthropic-ai/sdk @supabase/supabase-js stripe
pnpm add -D drizzle-kit @types/pg

# 3. Worker
cd ../worker
pnpm init
pnpm add bullmq ioredis pino @anthropic-ai/sdk drizzle-orm pg viem
pnpm add -D typescript tsx @types/node

# 4. Bot
cd ../bot
pnpm init
pnpm add grammy @grammyjs/conversations @grammyjs/menu @grammyjs/i18n
pnpm add drizzle-orm pg
pnpm add -D typescript tsx @types/node

# 5. Run locally
pnpm --filter web dev          # http://localhost:3000
pnpm --filter worker dev        # start worker
pnpm --filter bot dev           # start bot in long polling mode
```

---

### Connecting a User Wallet (read-only login)

We use **Sign-In With Ethereum (SIWE)** — signing a message for authentication without exposing a private key:

```typescript
// src/app/api/auth/siwe/verify/route.ts
import { SiweMessage } from 'siwe';

export async function POST(req: NextRequest) {
  const { message, signature } = await req.json();

  const siwe = new SiweMessage(message);
  const result = await siwe.verify({ signature, nonce: await getStoredNonce(siwe.address) });

  if (!result.success) {
    return NextResponse.json({ ok: false, error: 'Invalid signature' }, { status: 401 });
  }

  const user = await upsertUserByWallet(siwe.address);
  await issueSessionCookie(user);

  return NextResponse.json({ ok: true, data: { user } });
}
```

---

*End of spec. This document is alive. Update it as you change the architecture or make new decisions. Every code change worth remembering — record it here as an ADR (architecture decision record).*