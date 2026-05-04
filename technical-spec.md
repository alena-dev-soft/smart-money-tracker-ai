# Smart Money Tracker — технический спек + учебный путеводитель

> **Формат:** инженерный документ + личная learning roadmap для перехода с .NET на TypeScript/Web3.
> **Автор-куратор:** Olena.
> **Контекст:** Таиланд, разработка в одиночку с активным AI-вайбкодингом, продукт пока не публичный.
> **Дата:** май 2026.

---

## Как читать этот документ

1. Если ты опытный .NET-разработчик и твоя цель — **разобраться в стеке, прежде чем писать код**, проходи документ по порядку. В каждой технической секции есть мини-врезка **«.NET → новое»** — там аналогии, которые ускорят понимание.
2. Если цель — **сразу вайбить**, прыгай в раздел *MVP по неделям* в конце. Там минимальный набор фич + точные команды старта.
3. Все ссылки на код, схему БД, типы и промпты — **готовы к копированию в IDE**. Это не псевдо-код. Любой блок на TypeScript/SQL — рабочая основа, в которой нужно подкрутить названия таблиц/полей под себя.
4. Документ намеренно **избыточен по объяснениям**. Это твой учебник по web3-стеку, а не корпоративный ТЗ. Если что-то кажется очевидным — пропускай.

---

## Оглавление

1. [Продукт: что мы делаем и для кого](#1-продукт)
2. [Архитектура высокого уровня](#2-архитектура)
3. [Технологический стек и почему именно он](#3-стек)
4. [Схема БД](#4-схема-бд)
5. [Доменная модель и TypeScript-типы](#5-доменная-модель)
6. [API: REST + RPC сигнатуры](#6-api)
7. [Воркеры, очереди и фоновые задачи](#7-воркеры)
8. [Web3-интеграции: RPC, индексаторы, on-chain данные](#8-web3-интеграции)
9. [AI-слой: промпты, контекст, защита](#9-ai-слой)
10. [Telegram-бот: команды и состояния](#10-telegram-бот)
11. [Аутентификация и безопасность](#11-auth-безопасность)
12. [Деплой, мониторинг, секреты](#12-деплой)
13. [Учебный план: 6 недель .NET → TS/Web3](#13-учебный-план)
14. [Глоссарий: .NET → TypeScript/Web3](#14-глоссарий)
15. [MVP: чек-лист «готово к first user»](#15-mvp-чек-лист)

---

## 1. Продукт

### Кратко

**Smart Money Tracker** — read-only сервис, который отслеживает on-chain активность «умных» крипто-кошельков (исторически прибыльных трейдеров) и через AI-агента рассказывает пользователю, что они делают и стоит ли это копировать.

### Value proposition в одном предложении

> «Получай в Telegram умные комментарии к каждой сделке топ-кошельков крипты — до того, как тренд станет очевиден.»

### Целевые персоны

- **Активный крипто-трейдер 25–40 лет**, торгует на Hyperliquid / Binance / Solana DEX-ах, читает Crypto Twitter, использует Cielo / GMGN / Photon, готов платить $20–100/мес за edge.
- **Пассивный инвестор**, хочет понимать «что покупают умные», но не успевает следить вручную. Платит за peace of mind и weekly digest.
- **B2B сегмент (на v2)**: маленькие фонды и пропы, которые хотят корпоративный feed.

### Чего продукт **не** делает (намеренно — границы скоупа)

- **Не подписывает транзакции.** Только read-only, никаких приватных ключей, никакой кастодии. Это снимает 95% юридических рисков и весь scope аудита смарт-контрактов.
- **Не торгует за пользователя.** Только инфо + alerts.
- **Не агрегирует CEX-балансы.** Это можно добавить во v2, но MVP — чисто on-chain.
- **Не делает свой индексатор блокчейна.** Берём готовое (Alchemy, Helius, Zerion API).

### Метрики успеха MVP

- 30 платящих за месяц после личного запуска через узкий круг.
- D7 retention ≥ 40% (пользователь должен открывать Telegram-бота через неделю — иначе цикл alerts работает плохо).
- AI-комментарий получает оценку «полезно» (👍) ≥ 60% случаев (встроенная feedback-кнопка под каждым сообщением).

---

## 2. Архитектура

### Диаграмма

```
                       ┌──────────────────┐
                       │  Пользователь    │
                       │  (Telegram /     │
                       │   Web dashboard) │
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

### Компоненты — что делает каждый

| Компонент | Роль | .NET-аналог |
|---|---|---|
| Next.js Frontend | UI: dashboard, подписки, настройки | Razor Pages / Blazor |
| Next.js API Routes | REST/RPC эндпоинты, server actions | ASP.NET Core Controllers |
| Hono (опц.) | Лёгкий API-фреймворк, если выносим бэкенд отдельно | Minimal APIs в .NET 8 |
| Supabase (Postgres) | Главная БД + auth + storage | EF Core + Identity + Azure Blob |
| Drizzle ORM | TypeScript ORM поверх Postgres | EF Core (но без change tracker, ближе к Dapper) |
| Upstash Redis | Кеш, rate limiting, очереди | StackExchange.Redis |
| BullMQ | Очереди задач (Node.js) | Hangfire / Quartz |
| Alchemy | EVM RPC + webhooks (Ethereum, Base, Arbitrum) | Аналога нет — это специфика web3 |
| Helius | Solana RPC + webhooks + парсинг | То же |
| Zerion / DeBank API | Готовый агрегированный портфель | То же |
| Claude API | LLM-аналитик сделок | Azure OpenAI / Semantic Kernel |
| grammY | Telegram-бот фреймворк (TS) | Telegram.Bot (NuGet) |
| Reown AppKit | UX подключения web3-кошелька | Аналога нет |

### Ключевые поток данных

**Поток A: Пользователь добавляет «следящий» адрес.**
1. Пользователь в боте: `/follow 0xabc...`
2. Бот валидирует адрес (виemis `isAddress()`), сохраняет в `tracked_wallets`.
3. Создаём webhook на Alchemy/Helius для этого адреса.
4. Бот отвечает: «Кошелёк X отслеживается. Last 30d ROI: +127%, winrate 71%.»

**Поток B: On-chain событие → alert.**
1. Alchemy шлёт webhook на наш `POST /api/webhooks/alchemy` при любой транзакции отслеживаемого адреса.
2. Webhook handler кладёт raw-событие в очередь `bullmq:enrich`.
3. Воркер `enrichWorker`: декодирует tx (свап? трансфер? стейкинг?), достаёт цены через CoinGecko, записывает в `wallet_transactions`.
4. Кладёт обогащённое событие в очередь `bullmq:ai-analysis`.
5. Воркер `aiWorker`: формирует контекст, шлёт Claude, получает комментарий.
6. Воркер `notifyWorker`: рассылает в Telegram всем пользователям, у которых этот адрес в подписке.

**Поток C: AI weekly digest.**
1. Cron в воскресенье 09:00 UTC.
2. Для каждого активного пользователя: достать всё, что произошло у его кошельков за неделю, агрегировать.
3. Скормить Claude с шаблоном «weekly digest».
4. Отправить персонализированный отчёт.

---

## 3. Стек

### TL;DR-таблица

| Слой | Технология | Версия (май 2026) | Зачем |
|---|---|---|---|
| Язык | TypeScript | 5.6+ | Один язык фронт + бэк, экосистема web3 |
| Frontend framework | Next.js (App Router) | 15.x | SSR + RSC + API в одном репо |
| UI | Tailwind + shadcn/ui | latest | Скорость с AI, design-system из коробки |
| Wallet UX | Reown AppKit | 1.x | Стандарт де-факто, замена WalletConnect v3 |
| Web3 client | viem + wagmi | viem 2.x, wagmi 2.x | Современная замена ethers |
| Solana | @solana/web3.js + Helius SDK | 1.x | Solana — обязательна для memecoin-сегмента |
| Backend | Next.js API Routes (или Hono) | — | Минимум boilerplate |
| ORM | Drizzle | latest | Лучший TS ORM для Postgres |
| DB | Supabase Postgres | 15 | Postgres + auth + realtime + storage в одной коробке |
| Cache + queues | Upstash Redis + BullMQ | latest | Serverless Redis, идеально для Vercel |
| AI | Claude Sonnet 4.6 | — | Лучший на анализе финансовых текстов |
| Telegram | grammY | 1.x | TS-нативный, активно поддерживается |
| Платежи | Stripe + Cryptomus | — | Карты + крипта |
| Auth | Supabase Auth + SIWE | — | Email/Google + Sign-In With Ethereum |
| Hosting | Vercel (frontend) + Railway (workers) | — | Автодеплой из git |
| Мониторинг | Sentry + Axiom | — | Errors + structured logs |
| Тесты | Vitest + Playwright | — | Unit + e2e |
| Линтер | Biome | 1.x | Замена eslint+prettier, в 10x быстрее |

### Объяснения для .NET-разработчика

**Почему TypeScript, а не C#?**
.NET 8 быстрее в раннтайме на CPU-bound задачах. Но 99% работы здесь — I/O (RPC-вызовы к Alchemy, очереди, БД). Здесь TS на Node.js не проигрывает. А выигрывает в:
- экосистеме web3 (`viem`, `wagmi`, `@solana/web3.js` — это TS first, .NET эквиваленты либо отсутствуют, либо мёртвые),
- скорости вайб-итерации (Claude/GPT в TS на порядок продуктивнее),
- одном языке для фронта и бэка.

**Next.js — это что-то типа ASP.NET MVC?**
Близко, но с двумя ключевыми отличиями:
- React Server Components: компоненты могут рендериться **на сервере** и стримиться в браузер кусками. Никакой явной разделки «вью + контроллер» — компонент сам по себе полу-серверный, полу-клиентский.
- API routes (`app/api/foo/route.ts`) — это аналог Minimal API. Один файл = один эндпоинт.

**Drizzle vs EF Core**: Drizzle ближе к Dapper, чем к EF Core. Нет change tracker, нет lazy loading, нет миграций «магией». Зато всё типизировано до уровня колонок и SQL генерируется предсказуемый. Для маленького проекта — то что нужно.

**BullMQ vs Hangfire/Quartz**: концептуально то же самое — очереди фоновых задач с retry/backoff/cron. Только под Node.js и поверх Redis. Воркеры запускаются как отдельный процесс, в нашем случае — на Railway, а не на Vercel (т.к. Vercel — serverless и не подходит для long-running воркеров).

**viem — что это, если ты слышала только про ethers?**
Современная замена ethers.js. Основные плюсы: tree-shakeable (меньше бандл), полностью типизированный (можно вывести типы прямо из ABI смарт-контракта), стабильнее в API. В 2026 году `viem` — стандарт, `ethers` — legacy.

**Reown AppKit (бывший WalletConnect)**: это библиотека, которая даёт готовый UI «Подключить кошелёк», поддерживает 300+ кошельков (MetaMask, Phantom, Rabby, Trust, hardware wallets). Сама договаривается с кошельком пользователя, тебе остаётся только обработать `address` и `chainId`.

---

## 4. Схема БД

### Принципы

- Всё в Postgres. Никаких отдельных хранилищ для time-series — вместо TimescaleDB на старте используем партиционирование по месяцам через нативный Postgres 15. Если data grows — мигрируем потом.
- Каждой таблице — `id` (uuid v7 для упорядоченности по времени), `created_at`, `updated_at`. Soft delete через `deleted_at`.
- Все цены, балансы, объёмы — **`numeric(38, 18)`**. Никогда `float`. Никогда `bigint` для денег. Это критично — потеря точности в крипте = реальные деньги.
- Адреса EVM хранятся **в нижнем регистре**. Адреса Solana — как есть (case-sensitive).
- Транзакционные хеши — `text`, не `bytea` (проще для отладки и индексации).

### ER-диаграмма (текстом)

```
users ──┬── tracked_wallets ──── wallet_transactions ─── tx_alerts
        │                           │
        ├── subscriptions            └── (тип, токены, сумма)
        ├── telegram_link
        └── alert_settings

wallets_metadata (cache: ROI, winrate, label)
ai_analyses (кеш AI-комментариев по tx)
```

### SQL-схема (Drizzle)

Файл `src/db/schema.ts`:

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
  walletAddress: text('wallet_address'),  // SIWE-вход (EVM)
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
  address: text('address').notNull(),       // lowercase для EVM, as-is для Solana
  chain: chainEnum('chain').notNull(),
  label: text('label'),                      // пользовательская метка ("trader1", "vitalik")
  notifyMinUsd: numeric('notify_min_usd', { precision: 38, scale: 18 }).default('0'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniqueUserWallet: index('tw_user_addr_chain_idx').on(t.userId, t.address, t.chain),
  byAddress: index('tw_addr_chain_idx').on(t.address, t.chain),  // для обратного lookup в webhook
}));

export const walletsMetadata = pgTable('wallets_metadata', {
  address: text('address').notNull(),
  chain: chainEnum('chain').notNull(),
  ensName: text('ens_name'),                  // если EVM
  label: text('label'),                       // публичный лейбл (Vitalik, jump, etc.)
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
  // содержательная часть — варьируется по типу
  payload: jsonb('payload').notNull(),
  // ключевые суммы для быстрых выборок без парсинга payload
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
  promptHash: text('prompt_hash').notNull(),  // sha256 промпта для идемпотентности
  comment: text('comment').notNull(),
  riskLevel: text('risk_level'),              // low|medium|high
  suggestion: text('suggestion'),             // короткая рекомендация
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

### Лимиты по тарифам (хардкод сначала, потом таблица)

| Tier | Цена | Tracked wallets | AI-комменты | Quiet hours | Weekly digest |
|---|---|---|---|---|---|
| free | $0 | 3 | 5/день | нет | нет |
| pro | $29/мес | 25 | unlimited | да | да |
| power | $99/мес | 100 | unlimited + custom фильтры | да | да + кастомный |

Ограничения проверяем в каждом mutation на API-уровне через middleware.

### Миграции

Drizzle Kit:
```bash
pnpm drizzle-kit generate   # создать миграцию из изменений схемы
pnpm drizzle-kit push        # быстрый push в dev (без файлов миграций)
pnpm drizzle-kit migrate     # применить миграции в prod
```

> **.NET-параллель:** `drizzle-kit generate` ≈ `dotnet ef migrations add`. `drizzle-kit migrate` ≈ `dotnet ef database update`. Но Drizzle не делает «магию» — миграция это просто SQL-файл, можно править руками.

### Партиционирование `wallet_transactions` по месяцам

При >10M строк вставка/выборка просядет. Готовим заранее:

```sql
CREATE TABLE wallet_transactions (
  -- ... колонки выше ...
) PARTITION BY RANGE (block_timestamp);

CREATE TABLE wallet_transactions_2026_05
  PARTITION OF wallet_transactions
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
-- и т.д.
```

Можно автоматизировать через `pg_partman` extension в Supabase.

---

## 5. Доменная модель

Всё, что бэкенд и фронт обмениваются — описано через **Zod-схемы**. Это и валидация, и автогенерация TS-типов, и контракт для клиента.

Файл `src/lib/schemas.ts`:

```typescript
import { z } from 'zod';

// ─── Базовые ──────────────────────────────────────────────────────

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

// ─── Сущности ─────────────────────────────────────────────────────

export const trackedWalletSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  address: z.string(),
  chain: chainSchema,
  label: z.string().nullable(),
  notifyMinUsd: z.string(),  // numeric → string в JSON
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
  // ... добавляй типы по мере необходимости
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

> **.NET-параллель:** Zod ≈ FluentValidation + DataAnnotations + автогенерируемые DTO в одном лице. `z.infer<typeof X>` — это как `typeof(X)` в C# для получения типа из выражения.

---

## 6. API

### Принципы

- **REST для всего CRUD**, **server actions Next.js для form-flow**.
- Все эндпоинты защищены через middleware `requireAuth` или `requireSubscription(tier)`.
- Все ответы — `{ ok: true, data: ... }` или `{ ok: false, error: { code, message } }`.
- Pagination — cursor-based: `?cursor=<uuid>&limit=20`.
- Rate limit на эндпоинт через Upstash Ratelimit middleware.

### Эндпоинты

#### Auth

```
POST   /api/auth/email-login         { email, password } → { user, session }
POST   /api/auth/register            { email, password } → { user, session }
POST   /api/auth/siwe/nonce          → { nonce }
POST   /api/auth/siwe/verify         { message, signature } → { user, session }
POST   /api/auth/logout              → { ok }
GET    /api/auth/me                  → { user } | 401
```

#### Tracked wallets

```
GET    /api/wallets                          → { wallets: TrackedWallet[] }
POST   /api/wallets                          { address, chain, label?, notifyMinUsd? } → { wallet }
PATCH  /api/wallets/:id                      { label?, notifyMinUsd?, isActive? } → { wallet }
DELETE /api/wallets/:id                      → { ok }
GET    /api/wallets/:id/transactions         ?cursor=&limit= → { transactions: (WalletTransaction & { ai?: AiAnalysis })[] , nextCursor }
GET    /api/wallets/:id/stats                → { totalPnlUsd, winrate30d, roi30d, txCount30d }
```

#### Discovery (AI-подсказки smart кошельков)

```
GET    /api/discovery/top-wallets    ?chain=&period=30d&limit= → { wallets: WalletMetadata[] }
GET    /api/discovery/search          ?q=<address|ens|label> → { wallets: WalletMetadata[] }
```

#### Alerts feed

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

#### Webhooks (входящие)

```
POST   /api/webhooks/alchemy         ← Alchemy on-chain webhooks (с signature verification)
POST   /api/webhooks/helius          ← Helius webhooks (Solana)
POST   /api/webhooks/telegram        ← Telegram updates (если используем webhook вместо long-polling)
```

### Пример endpoint-а на Next.js App Router

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

  await enforceWalletLimit(user);  // throw 402 if over tier limit

  const normalizedAddr = body.chain === 'solana' ? body.address : body.address.toLowerCase();

  const [wallet] = await db.insert(trackedWallets).values({
    userId: user.id,
    address: normalizedAddr,
    chain: body.chain,
    label: body.label,
    notifyMinUsd: body.notifyMinUsd ?? '0',
  }).returning();

  // Регистрируем webhook у Alchemy/Helius (idempotent — если уже есть, просто вернёт existing id)
  await registerWebhookForAddress(normalizedAddr, body.chain);

  return NextResponse.json({ ok: true, data: { wallet } }, { status: 201 });
}
```

> **.NET-параллель:** `requireAuth(req)` ≈ `[Authorize]` атрибут. `body = createBody.parse(...)` ≈ `[FromBody]` + `ModelState.IsValid`. Только тут это явный вызов в коде, что для маленьких хэндлеров удобнее.

---

## 7. Воркеры

### Архитектурный принцип

Vercel = serverless, плохо подходит для долгоживущих процессов и фоновых задач. Поэтому:

- **Frontend + API routes** → Vercel.
- **Воркеры (BullMQ consumers)** → отдельный процесс на **Railway** (или Render/Fly.io). Один Node.js процесс, который слушает Redis и делает работу.
- **Cron-задачи** → Vercel Cron (для лёгких) + node-cron внутри воркера (для тяжёлых).

> **.NET-параллель:** воркер на Railway = `IHostedService` в отдельном консольном проекте.

### Очереди

Три основные очереди:

| Имя очереди | Что делает | Concurrency | Retry |
|---|---|---|---|
| `enrich` | парсит сырое on-chain событие в `WalletTransaction` | 10 | 3 раза, exponential backoff |
| `ai-analyze` | шлёт в Claude, сохраняет результат | 5 | 3 раза |
| `notify` | рассылает по Telegram/email | 20 | 5 раз |

### Структура воркера

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

// Graceful shutdown — критично, иначе Railway убьёт SIGKILL и потеряются in-flight jobs
const shutdown = async () => {
  logger.info('Shutting down workers...');
  await Promise.all([enrichWorker.close(), aiWorker.close(), notifyWorker.close()]);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

logger.info('Workers started');
```

### Job: enrich (из webhook'а в WalletTransaction)

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

  // Цена в USD на момент блока (используем CoinGecko + кеш)
  const valueUsd = decoded.tokenInSymbol
    ? await fetchUsdPriceAt(decoded.tokenInSymbol, decoded.blockTimestamp)
        .then(p => Number(decoded.amountIn) * p)
    : null;

  // Идемпотентность по (txHash, address): если запись уже есть — просто читаем её и идём дальше
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

  if (!tx) return; // дубль — выходим тихо

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

  // Кто следит за этим адресом — нужно для рассылки
  const followers = await db.query.trackedWallets.findMany({
    where: (w, { eq, and }) => and(eq(w.address, tx.address), eq(w.chain, tx.chain), eq(w.isActive, true)),
  });
  if (followers.length === 0) return;

  const promptInput = { tx, meta };
  const promptHash = crypto.createHash('sha256').update(JSON.stringify(promptInput)).digest('hex');

  // Кешируем по hash промпта — если уже анализировали такой ввод, не платим дважды
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

  // Создаём alerts для каждого подписчика и кидаем в notify-очередь
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

### Cron-задачи

| Задача | Расписание | Где |
|---|---|---|
| Refresh `wallets_metadata` (PnL/winrate) | каждые 6 часов | Vercel Cron → API endpoint → BullMQ |
| Weekly digest всем pro/power | Воскр 09:00 UTC | Vercel Cron |
| Очистка старых alerts (>90 дней) | Раз в сутки 03:00 | Voркер cron |
| Sync Stripe subscription state | Каждые 12 часов | Vercel Cron |

---

## 8. Web3-интеграции

### Какие сети поддерживаем на MVP

- **Ethereum** (mainnet) — обязательно
- **Base** — где живёт основная часть memecoin-трафика 2026
- **Arbitrum** — perps + Camelot/GMX
- **Solana** — обязательно для memecoin / Jupiter / Raydium
- **Hyperliquid** — отдельный API, добавить во вторую итерацию

### Источники данных

| Задача | Сервис | Лимиты бесплатно | Платно |
|---|---|---|---|
| EVM webhooks (отслеживание адресов) | **Alchemy Notify** | 25 webhooks, 100k events/мес | $49/мес → 1k webhooks |
| EVM RPC | Alchemy + QuickNode (бэкап) | 300M CU/мес | от $49 |
| Декодирование EVM-транзакций | viem + ABI из Sourcify | бесплатно | — |
| Solana webhooks | **Helius Webhooks** | 1k webhooks free, 100k events | от $49/мес |
| Solana decoding | Helius Enhanced Transactions API | в составе плана | — |
| Цены токенов | **CoinGecko Demo** + DefiLlama (без ключа) | 30 calls/min | $129/мес |
| Готовый wallet portfolio | **Zerion API** | 500 req/час | от $99/мес |
| Smart money скоринг | Custom через Dune Analytics | 30 query/сутки | $390/мес |
| ENS resolution | viem.getEnsName() через Alchemy | бесплатно | — |

### Webhook-флоу (EVM)

1. При создании tracked_wallet вызываем `alchemy.notify.createWebhook({ network, addresses, webhookType: 'ADDRESS_ACTIVITY' })`.
2. Alchemy шлёт POST на наш `https://app.example.com/api/webhooks/alchemy` при любой транзакции этого адреса.
3. Мы валидируем `x-alchemy-signature` header (HMAC-SHA256 от тела с нашим секретом).
4. Кладём событие в очередь `enrich` и сразу отвечаем 200 OK (важно — Alchemy retry'ит при таймаутах).

### Декодирование EVM-tx (пример swap)

`src/lib/onchain/decode-evm.ts`:

```typescript
import { decodeFunctionData, parseAbi } from 'viem';
import type { AlchemyAddressActivityEvent } from './types';

const uniswapV3Abi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
  // ...другие методы
]);

export async function decodeAlchemyTx(rawEvent: AlchemyAddressActivityEvent, chain: string) {
  const activity = rawEvent.event.activity[0];

  // Простейший transfer
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

  // Swap через known DEX router — декодируем calldata
  if (KNOWN_DEX_ROUTERS.has(activity.toAddress.toLowerCase())) {
    try {
      const decoded = decodeFunctionData({ abi: uniswapV3Abi, data: activity.input });
      // ... обработка результата
    } catch {
      // не наш ABI — fallback в "unknown"
    }
  }

  return { /* unknown fallback */ };
}
```

### Декодирование Solana-tx

Helius уже отдаёт декодированный JSON, не надо вручную:

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
      tokenInSymbol: swap[0].mint, // нужно резолвить через Helius asset API
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

### Безопасность webhook-ов

Каждый входящий webhook **обязательно** валидируется:

```typescript
function verifyAlchemySignature(rawBody: string, signature: string): boolean {
  const expected = crypto
    .createHmac('sha256', process.env.ALCHEMY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
```

> **.NET-параллель:** аналогично HMAC валидации в любых .NET webhook handler'ах. `crypto.timingSafeEqual` — это защита от timing-атак, ничем не отличается от `CryptographicOperations.FixedTimeEquals`.

---

## 9. AI-слой

### Зачем AI здесь нужен

Без AI наш продукт = ещё один Cielo. С AI каждое уведомление превращается из «трейдер X купил Y за Z» в осмысленный комментарий: «Вот это значит, вот риск, вот контекст, вот что можно сделать».

Это **главный differentiator**.

### Что НЕ делаем с AI на MVP

- Не торгуем за пользователя.
- Не даём «прогнозы цен» — это путь в правовые проблемы и репутационный ущерб. Только описание факта + контекст + риск-уровень.
- Не пишем «buy X now» — пишем «эта сделка соответствует bullish-сетапу, исторически такие движения у этого кошелька приводили к +N% в M дней».

### Архитектура

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

### Промпт-шаблон (single trade analysis)

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

### Вызов Claude

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

  // Парсим JSON. Если модель вернула не-JSON — пытаемся вытянуть {} блок.
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

### Стоимость и бюджет

Один вызов: ~1500 input + ~200 output токенов = `1500/1M * 3 + 200/1M * 15 = $0.0045 + $0.003 = ~$0.0075`.

При 100 пользователях × 50 сделок/день × $0.0075 = **$37.5/день = ~$1100/мес**. Это потолок без оптимизации.

Оптимизации:
- **Кеш промптов по `promptHash`** (мы это делаем) — экономит при повторяющихся сценариях.
- **Prompt caching у Anthropic** — кешировать system prompt, экономит ~50% input cost.
- **Батчинг weekly digest** через Claude Batch API — 50% дешевле.
- **На free тарифе** ограничиваем до 5 AI-комментариев в день.

### Защита от prompt injection

Адреса, ENS, мемы и другие user/onchain данные могут содержать опасный контент (например, ENS-имя `Ignore previous instructions and...`).

Защита:
1. Все user-controlled поля **сериализуем через JSON.stringify** — это уже изолирует.
2. `SYSTEM_PROMPT` имеет строгие rules.
3. На выходе **валидируем JSON-схему** через Zod — если модель отклонилась, фоллбек на дефолтный комментарий «Сделка зафиксирована, AI-анализ временно недоступен».
4. Никогда не вставляем сырой текст из промпта в shell, eval, html без экранирования.

### Weekly digest промпт (sketch)

```typescript
export const WEEKLY_DIGEST_SYSTEM = `
You are an analyst writing a personalized weekly crypto digest.
Aggregate the user's tracked wallets' activity, find patterns, and write a narrative
summary in 5–8 sentences. End with one actionable observation. Russian language.
`;

// На вход: user.followedWallets[].lastWeekTransactions[]
// На выход: { summary: string, highlights: string[], actionable: string }
```

---

## 10. Telegram-бот

### Зачем Telegram first

- Низкий CAC: пользователь уже в Telegram, не нужно скачивать приложение.
- Высокий retention: уведомления приходят туда, где он смотрит каждый час.
- Простой UX для нашей основной мысли — alert + комментарий.
- Native в крипто-сообществе.

### Фреймворк: grammY (TS-нативный)

```bash
pnpm add grammy @grammyjs/conversations @grammyjs/menu @grammyjs/i18n
```

### Структура файлов бота

```
apps/bot/
├── src/
│   ├── index.ts              # entry point, запуск polling/webhook
│   ├── bot.ts                # инициализация бота + middlewares
│   ├── commands/
│   │   ├── start.ts          # /start
│   │   ├── connect.ts        # /connect — линковка с web-аккаунтом
│   │   ├── follow.ts         # /follow <addr>
│   │   ├── unfollow.ts       # /unfollow <addr>
│   │   ├── list.ts           # /list — мои отслеживаемые
│   │   ├── settings.ts       # /settings
│   │   ├── help.ts           # /help
│   │   └── upgrade.ts        # /upgrade — ссылка на чекаут
│   ├── conversations/
│   │   ├── add-wallet.ts     # пошаговое добавление кошелька
│   │   └── settings-flow.ts  # пошаговая настройка алертов
│   ├── handlers/
│   │   ├── alert-feedback.ts # callback на 👍/👎
│   │   └── pagination.ts     # /list пагинация
│   ├── middlewares/
│   │   ├── auth.ts           # проверка что юзер залинкован
│   │   ├── tier.ts           # проверка лимитов тарифа
│   │   └── rate-limit.ts
│   └── i18n/
│       ├── ru.ftl            # Fluent localization
│       └── en.ftl
└── package.json
```

### Команды бота

| Команда | Описание | Доступ |
|---|---|---|
| `/start` | Приветствие + быстрая регистрация | все |
| `/connect <token>` | Линковка с web-аккаунтом по одноразовому токену | все |
| `/follow <address> [chain]` | Добавить кошелёк в отслеживание | залогиненные |
| `/unfollow <address>` | Убрать кошелёк | залогиненные |
| `/list` | Показать мои кошельки + их recent stats | залогиненные |
| `/stats <address>` | Полная статистика по кошельку | залогиненные |
| `/discover` | Топ smart кошельков | pro+ |
| `/digest` | Прислать weekly digest сейчас | pro+ |
| `/settings` | Настройки уведомлений | залогиненные |
| `/upgrade` | Перейти на платный тариф | все |
| `/help` | Помощь | все |

### Flow: линковка Telegram ↔ web-аккаунт

1. Пользователь в web: `Settings → Telegram → Connect`. Бэкенд генерит one-time `linkToken` (UUID, TTL 5 мин).
2. Бэкенд возвращает `https://t.me/SmartMoneyTrackerBot?start=link_<token>`.
3. Юзер кликает, в боте срабатывает `/start link_<token>`.
4. Бот вытаскивает `<token>` → ищет в `link_tokens` table → находит `userId` → пишет `users.telegramId = ctx.from.id`.
5. Бот отвечает: «✅ Аккаунт связан».

### Пример: команда /follow

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
  if (!ctx.user) return ctx.reply('⚠️ Сначала свяжи аккаунт через /connect');

  const args = ctx.match?.toString().trim().split(/\s+/) ?? [];
  const [addressRaw, chainArg] = args;

  if (!addressRaw) {
    return ctx.reply('Используй: `/follow 0xabc... ethereum`\nили: `/follow <Solana_address> solana`', { parse_mode: 'Markdown' });
  }

  const chain = chainArg ?? await detectChain(addressRaw);
  if (!chain) return ctx.reply('❌ Не могу определить сеть. Укажи явно: ethereum / base / arbitrum / solana');

  const address = chain === 'solana' ? addressRaw : addressRaw.toLowerCase();
  if (chain !== 'solana' && !isAddress(address)) return ctx.reply('❌ Невалидный EVM-адрес');

  try {
    await enforceWalletLimit(ctx.user);
  } catch (e) {
    return ctx.reply(`❌ Достигнут лимит тарифа. ${(e as Error).message}\n→ /upgrade`);
  }

  await db.insert(trackedWallets).values({
    userId: ctx.user.id, address, chain, label: null,
  }).onConflictDoNothing();

  await registerWebhookForAddress(address, chain);
  const stats = await getOrFetchWalletStats(address, chain);

  const kb = new InlineKeyboard()
    .text('✏️ Дать метку', `label:${address}:${chain}`)
    .text('🔕 Отписаться', `unfollow:${address}:${chain}`);

  await ctx.reply(
    `✅ Отслеживаю \`${address}\` (${chain})\n` +
    `📊 30d ROI: ${stats.roi30d ?? 'n/a'}\n` +
    `🎯 Winrate: ${stats.winrate30d ?? 'n/a'}\n` +
    `📦 Сделок: ${stats.txCount30d ?? 'n/a'}`,
    { parse_mode: 'Markdown', reply_markup: kb }
  );
});
```

### Формат alert-сообщения

```
🐋 Smart wallet activity

vitalik.eth (ROI 30d: +47%, winrate 68%)
ethereum • Uniswap V3

Купил: 12.4 ETH → 38,500 USDC
Сумма: ~$45,200
3 минуты назад

🤖 AI: Похоже на фиксацию прибыли после недавнего ралли ETH.
Кошелёк увеличил долю стейблов с 18% до 31% за неделю.
Это паттерн "risk-off" — возможна локальная коррекция рынка.

⚠️ Risk: medium
💡 Если у тебя крупная позиция в ETH, стоит присмотреться

[👍 Полезно] [👎 Не очень] [📈 Open dashboard]
```

### Кнопки feedback

Inline-кнопки шлют `callback_data: "fb:<alertId>:helpful"` или `:not_helpful`. Хэндлер пишет в `tx_alerts.userFeedback`. Это критично — на этих данных мы будем дотюнивать промпты.

### Throttling и quiet hours

- Перед отправкой смотрим `alert_settings.quietHoursStart/End` пользователя — если попадает, откладываем в job до конца quiet hours.
- Группировка: если у пользователя за 5 минут было 5+ alerts — шлём сводное сообщение.

---

## 11. Auth, безопасность

### Способы входа

1. **Email + пароль** (Supabase Auth) — для обычных пользователей.
2. **Google OAuth** (Supabase Auth) — низкое сопротивление.
3. **Sign-In With Ethereum (SIWE)** — для web3-натуралов. Не нужен email, не нужен пароль.

Все три способа создают одну запись в `users` (мерджим если email совпадает).

### SIWE-флоу подробно

1. Frontend через `useSignMessage` от wagmi: `await signMessage({ message })`.
2. `message` строится через библиотеку `siwe`:
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
3. Подпись отправляется на `/api/auth/siwe/verify`, бэкенд верифицирует через `siwe.verify()`, выдаёт JWT cookie.
4. **Никогда не храним приватные ключи** — нам нужна только подпись для подтверждения владения адресом.

### Сессии

- HTTP-only cookie с JWT.
- TTL 30 дней.
- Refresh token через Supabase, автоматический в SDK.
- CSRF-защита: `sameSite=lax` cookies + double-submit token для мутаций.

### Лимиты по тарифу — middleware

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
    throw new HttpError(402, `${tier} тариф позволяет ${limit} кошельков. Сейчас: ${current}.`);
  }
}
```

### Секреты

Все секреты — **только** в env vars. Никогда в коде. Никогда в git.

| Секрет | Где | Как ротируем |
|---|---|---|
| `DATABASE_URL` | Vercel/Railway env | через UI Supabase |
| `ANTHROPIC_API_KEY` | env | console.anthropic.com |
| `ALCHEMY_API_KEY` + `_WEBHOOK_SECRET` | env | Alchemy dashboard |
| `HELIUS_API_KEY` | env | Helius dashboard |
| `TELEGRAM_BOT_TOKEN` | env | @BotFather |
| `STRIPE_SECRET_KEY` + `_WEBHOOK_SIGNING` | env | Stripe dashboard |
| `JWT_SECRET` | env | сами генерим, ротируем раз в год |
| `SUPABASE_SERVICE_ROLE_KEY` | env (только бэкенд) | Supabase dashboard |

Локально — `.env.local` (в .gitignore!), для продa — Vercel/Railway dashboards.

### Шифрование чувствительных данных в БД

Если когда-то начнём хранить что-то чувствительное (например, email уведомлений), используем `pgcrypto` extension Postgres + `crypto_secretbox` через NaCl. Но на MVP **ничего такого не храним**.

### Аудит

- `pino` logs со structured fields — пишем в Axiom.
- Каждое изменение в `tracked_wallets`, `subscriptions` — пишет audit-запись с user_id, action, payload, ip.
- Sentry для всех ошибок 5xx.

---

## 12. Деплой

### Топология

```
[Vercel]
├── Next.js app (frontend + API)
├── Vercel Cron jobs (HTTP triggers)
└── Edge middleware (auth check)

[Railway]
└── Worker process (BullMQ consumers + node-cron)

[Supabase]
├── Postgres (управляемая)
├── Auth
└── Storage (для будущих аватарок и т.п.)

[Upstash]
└── Redis (для BullMQ + rate limiting + cache)

[External]
├── Alchemy (EVM webhooks + RPC)
├── Helius (Solana webhooks + RPC)
├── Anthropic (Claude API)
├── Stripe + Cryptomus
├── Sentry + Axiom
└── Resend (transactional email)
```

### Стоимость инфры на старте (до 500 пользователей)

| Сервис | Стоимость/мес |
|---|---|
| Vercel Hobby | $0 |
| Railway Hobby | $5 |
| Supabase Free | $0 (до 500MB DB) |
| Upstash Redis Free | $0 (до 10k команд/день — придётся апнуть до Pay-as-you-go ~$10) |
| Alchemy Growth | $49 |
| Helius Developer | $49 |
| Anthropic Claude | ~$50–200 (зависит от объёма) |
| Sentry / Axiom Free | $0 |
| Resend Free | $0 (3k email/мес) |
| Domain + SSL | $10/год |
| **Итого** | **~$150–300/мес** |

### CI/CD

GitHub Actions:
- На push в `main` → автодеплой на Vercel (app) и Railway (worker).
- На PR → `pnpm test`, `biome check`, `tsc --noEmit`.
- На merge → drizzle migrate в проде.

### Sentry / observability

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  environment: process.env.VERCEL_ENV,
});
```

Plus structured logs в Axiom через pino:

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

## 13. Учебный план

### Зачем тебе это в одном документе

Чтобы не было ситуации «вайб накодил → не понимаю что я задеплоила». Каждую неделю осваиваешь блок концепций, потом вайбишь его в проекте — это закрепляет знание лучше любого курса.

### Базовый стек обучения

- **TypeScript Handbook** — официальный, прочесть один раз: https://www.typescriptlang.org/docs/handbook/
- **Total TypeScript** (Matt Pocock) — практические курсы, есть бесплатные.
- **Next.js Learn** — официальный туториал: https://nextjs.org/learn
- **Drizzle docs** — короткие, читаются за час.
- **viem docs** — основной web3-туториал, очень хорошо написан: https://viem.sh
- **wagmi docs** — для React-хуков на основе viem.
- **Solana Cookbook** — для Solana-части.
- **The Anthropic Prompt Engineering Guide** — пригодится для AI-слоя.

### План по неделям

#### Неделя 1 — TypeScript + Node основы

Цель: ты пишешь современный TS-код без удивления.

- День 1–2: TypeScript Handbook (Basics + Everyday Types + Narrowing + Functions). Сделай 5 упражнений на discriminated unions.
- День 3: модули, ESM vs CJS, `tsconfig.json`. Понимай зачем `"moduleResolution": "Bundler"`.
- День 4: `pnpm`, monorepo через Turborepo. Создай скелет проекта со структурой `apps/web`, `apps/worker`, `apps/bot`, `packages/db`, `packages/shared`.
- День 5: async/await паттерны в Node, error handling (`try/catch` + типизация errors через `instanceof`).
- День 6–7: Zod — глубоко. Это будет основа всех контрактов в проекте.

**.NET → TS параллели на эту неделю:**
- `interface`/`class`/`record` → `type`/`interface`/`class`
- `LINQ` → массивные методы (`.map`/`.filter`/`.reduce`) или библиотека `remeda`/`es-toolkit`
- `IEnumerable<T>` → `Iterable<T>`, async `AsyncIterable<T>`
- `Task<T>` → `Promise<T>`
- `IDisposable` + `using` → `await using` (TC39 Resource Management)
- `null` vs `undefined`: оба есть, но используй `undefined` по умолчанию, `null` — когда явно нужно

#### Неделя 2 — Postgres + Drizzle + основы Next.js API routes

Цель: ты можешь написать CRUD-API с типизированной БД.

- День 1: Postgres как СУБД (если знакома только с MS SQL — изучи отличия: `serial`/`uuid`, `jsonb`, `enum`, `numeric`).
- День 2: Drizzle schema, query builder, transactions.
- День 3–4: Next.js App Router — пройди official tutorial.
- День 5: Server Actions vs API Routes — когда что использовать.
- День 6–7: Реализуй CRUD `tracked_wallets` end-to-end (frontend форма → server action → DB → отрисовать список).

#### Неделя 3 — viem + wagmi + Reown AppKit

Цель: ты понимаешь, что такое блокчейн-клиент, RPC, и как подключить кошелёк.

- День 1: понятия — RPC node, public client, wallet client. Что такое `provider` исторически и почему viem от него отказался.
- День 2: viem чтение блокчейна — `getBalance`, `getBlockNumber`, `readContract`. ABI и `parseAbi`.
- День 3: события — `getLogs`, `watchEvent`. Как декодировать `event Transfer(address,address,uint256)`.
- День 4: wagmi хуки на фронте — `useAccount`, `useBalance`, `useReadContract`.
- День 5: Reown AppKit — встроить «Connect Wallet» в твой Next.js.
- День 6–7: SIWE — реализуй полный auth-flow.

**Важно понять концептуально:**
- Блокчейн читается через RPC. Это не БД, не SDK сервера — это узел сети. Alchemy/Infura/QuickNode — это просто managed RPC-узлы.
- Адреса — это публичные ключи в сжатом виде. Ничего «запоминать» не надо, всё в `localStorage` через wagmi.
- Транзакция = подписанное сообщение. Никто, кроме владельца приватного ключа, её подписать не может.

#### Неделя 4 — Solana + AI-слой

Цель: ты понимаешь, чем Solana отличается от EVM, и можешь вызвать Claude из Node.

- День 1: Solana основы — accounts model (вместо EVM smart contracts), токены — это SPL Token Program. Никаких ABI.
- День 2: `@solana/web3.js` базовые операции, Helius API.
- День 3: Anthropic SDK, базовые вызовы Claude API.
- День 4: Prompt engineering — как структурировать промпт под JSON-выход.
- День 5: Streaming, error handling, costs tracking.
- День 6–7: Сделать `analyze-trade` end-to-end — реальная сделка из БД → Claude → JSON → сохранение.

#### Неделя 5 — Очереди (BullMQ) + Telegram-бот (grammY)

Цель: ты можешь написать асинхронный воркер с retry и cron, и Telegram-бот с FSM.

- День 1: Redis базы, BullMQ концепция (queue/worker/job).
- День 2: BullMQ retry, backoff, rate limiting, repeated jobs.
- День 3: grammY основы, обработка команд.
- День 4: grammY conversations (FSM для пошаговых сценариев).
- День 5: inline keyboards, callback queries, edit message.
- День 6–7: Связать всё — Telegram /follow → DB → webhook на Alchemy → enrich job → AI job → notify job → сообщение в Telegram.

#### Неделя 6 — Стрипом, продакшен, мониторинг

Цель: продукт развёрнут, оплата работает, ошибки видны.

- День 1: Stripe Checkout + webhooks. Идемпотентность.
- День 2: Cryptomus интеграция (для крипто-оплаты).
- День 3: Vercel deploy, env, preview deployments.
- День 4: Railway worker deploy, gracefully shutdown.
- День 5: Sentry + Axiom + healthchecks.
- День 6: Drizzle миграции в проде, бэкапы Postgres.
- День 7: Полный e2e тест: новый юзер → подключение → оплата → alerts → cancel.

### Подход к вайбкодингу для обучения

- **Не вайбь то, чего не понимаешь.** Если Claude/Cursor сгенерил кусок и ты не можешь объяснить его за 3 предложения — остановись, прочитай документацию того, что в нём есть.
- **Сначала спроси «как», потом «напиши».** Хороший паттерн: сначала задай вопрос «расскажи как BullMQ обрабатывает retries», вникни. Только потом «напиши воркер для X».
- **Делай маленькие итерации.** Один эндпоинт за раз. Один компонент за раз. После каждого — `git commit` и краткое описание в head.
- **Веди заметки.** В блокноте/Obsidian/`NOTES.md` фиксируй: «сегодня узнала что Drizzle не умеет nested transactions из коробки, нужен `db.transaction(tx => tx.transaction(...))`».

---

## 14. Глоссарий

### .NET → TypeScript

| .NET | TypeScript |
|---|---|
| `class Foo { public string Name { get; set; } }` | `class Foo { name!: string }` или `type Foo = { name: string }` |
| `public record Foo(string Name);` | `type Foo = Readonly<{ name: string }>` |
| `IEnumerable<T>` / `IReadOnlyList<T>` | `readonly T[]` или `Iterable<T>` |
| `LINQ`: `.Where(x => x.Active).Select(x => x.Name)` | `.filter(x => x.active).map(x => x.name)` |
| `LINQ.GroupBy` | `Object.groupBy(arr, x => x.key)` (ES2024) или lodash/remeda |
| `Task<T>` / `await` | `Promise<T>` / `await` |
| `CancellationToken` | `AbortController` / `AbortSignal` |
| `IDisposable` + `using` | `Symbol.dispose` + `using x = ...` (TS 5.2+) |
| `null` (везде) | `null` или `undefined` (договариваемся `undefined` по умолчанию) |
| `string.IsNullOrWhiteSpace(s)` | `!s?.trim()` |
| `nameof(x)` | в TS нет, используй `'x' satisfies keyof T` |
| `JsonSerializer.Serialize(x)` | `JSON.stringify(x)` |
| `JsonSerializer.Deserialize<T>(s)` | `schema.parse(JSON.parse(s))` (через Zod, иначе нет рантайм-проверки!) |
| `Record<TKey, TValue>` (.NET 9) | встроенный `Record<K, V>` |
| `Action<T>` / `Func<T, R>` | `(x: T) => void` / `(x: T) => R` |
| `Tuple<int, string>` | `[number, string]` |
| `enum Color { Red, Green }` | `const Color = { Red: 'red', Green: 'green' } as const; type Color = (typeof Color)[keyof typeof Color]` (или родной TS `enum`, но избегай) |
| `try/catch (Exception ex) when (...)` | `try/catch` без `when`, фильтруй внутри `if (e instanceof XError)` |
| `[Authorize]` | middleware-функция, вызывается в начале хэндлера |
| `[FromBody] FooDto dto` | `const dto = FooSchema.parse(await req.json())` |
| `appsettings.json` | `process.env` + Zod-схема для валидации env при старте |
| `ILogger<T>` через DI | `import { logger } from '@/lib/logger'` (модуль-синглтон) |
| `IServiceCollection` (DI) | в TS обычно нет — простые модули. Если нужно: `awilix`/`tsyringe` |
| `IOptions<T>` | модуль с типизированной env-конфигурацией |
| `EF Core DbContext` | Drizzle `db` + `schema` |
| `dotnet ef migrations add` | `pnpm drizzle-kit generate` |
| `dotnet ef database update` | `pnpm drizzle-kit migrate` |
| `Hangfire` / `Quartz` | `BullMQ` (требует Redis) |
| `IHostedService` | отдельный Node.js процесс с воркером |
| `SignalR` | `@supabase/realtime-js` или нативный WebSocket |
| `MediatR` | в TS обычно нет, события через `EventEmitter` или message queue |
| NUnit / xUnit | Vitest (Jest-совместимый, быстрее) |
| Moq / NSubstitute | `vi.mock(...)` встроенный в Vitest |
| Postman / Swagger UI | `Bruno` (open-source альтернатива) или Swagger UI через `next-swagger-doc` |

### Web3 термины

| Термин | Что означает |
|---|---|
| **EOA** (Externally Owned Account) | обычный кошелёк, контролируется приватным ключом |
| **Smart contract account** / **AA** | кошелёк с кодом (ERC-4337) — programmable, multi-sig, social recovery |
| **RPC node** | сервер, через который ты «говоришь» с блокчейном (read+write) |
| **ABI** | JSON-описание интерфейса смарт-контракта (как Swagger для блокчейна) |
| **Block** | пачка транзакций, подтверждённая сетью |
| **Gas** | оплата за выполнение операций. На L1 ETH дорого, на L2 копейки |
| **L1 / L2** | L1 = базовая сеть (Ethereum, Solana). L2 = нашлёпка для дешевизны (Base, Arbitrum, Optimism) |
| **Webhook** (Alchemy/Helius) | сервис подписки на on-chain события: «дай мне callback при любой tx адреса X» |
| **DEX aggregator** | сервис, выбирающий лучший маршрут свапа (1inch, Jupiter, CowSwap) |
| **Slippage** | проскальзывание цены при свапе из-за низкой ликвидности |
| **Honeypot** | мошеннический токен — купить можно, продать нельзя |
| **Rugpull** | разработчики токена выводят ликвидность → цена в ноль |
| **MEV** | Maximum Extractable Value — заработок на манипуляции порядком tx в блоке |
| **Stablecoin** | токен с привязкой к фиатной валюте (USDC, USDT, DAI) |
| **LP** (Liquidity Provider) | пользователь, давший токены в пул DEX, получает комиссии |
| **TVL** (Total Value Locked) | сколько денег в протоколе |
| **Restaking** | передача стейка ETH в дополнительные сервисы (EigenLayer) |
| **Bridge** | мост между сетями. Очень рискованная штука исторически |
| **SIWE** | Sign-In With Ethereum — вход через подпись сообщения |
| **ENS** | Ethereum Name Service — vitalik.eth → 0xd8da6...96045 |
| **Chain ID** | числовой идентификатор сети (Ethereum=1, Base=8453, Solana — другая модель) |

---

## 15. MVP чек-лист

### Что обязательно для «первого живого пользователя»

**Backend / data plane**
- [ ] Postgres schema через Drizzle, миграции прокатывают.
- [ ] `users`, `tracked_wallets`, `wallet_transactions`, `ai_analyses`, `tx_alerts`, `subscriptions`, `alert_settings` созданы.
- [ ] Webhook endpoint Alchemy с валидацией HMAC.
- [ ] Webhook endpoint Helius (Solana).
- [ ] Worker с тремя очередями: enrich, ai-analyze, notify.
- [ ] Декодирование как минимум: `swap` (Uniswap V3 + Jupiter), `transfer_in/out`, `unknown` fallback.

**Frontend**
- [ ] Лендинг с описанием (одна страница, без подключения).
- [ ] Auth: email + Google + SIWE.
- [ ] Dashboard: список tracked_wallets, форма добавления.
- [ ] Список последних alerts (10 шт. с пагинацией).
- [ ] Settings: notification prefs, telegram link button, тариф.
- [ ] Stripe Checkout flow.

**Telegram**
- [ ] Бот зарегистрирован, BotFather settings: команды, описание, картинка.
- [ ] Команды: `/start`, `/connect`, `/follow`, `/unfollow`, `/list`, `/settings`, `/upgrade`, `/help`.
- [ ] Линковка с web-аккаунтом работает.
- [ ] Alerts шлются в Telegram, кнопки feedback функциональны.

**AI**
- [ ] Промпт `analyze-trade` стабильно возвращает валидный JSON.
- [ ] Кеширование по `promptHash`.
- [ ] Cost tracking в БД (`ai_analyses.costUsd`).

**Платежи**
- [ ] Stripe тесты прошли, webhook subscription.created/updated/deleted обрабатывается.
- [ ] Cryptomus pending, можно добавить в v1.1.
- [ ] Лимиты тарифа enforced на API.

**Безопасность**
- [ ] Секреты не в репо (проверь `git log -p -S "<токен бывшего>"` на всякий — отзови старые!).
- [ ] HMAC проверка всех webhook'ов.
- [ ] Rate limit на public-эндпоинты (auth, webhooks).
- [ ] CORS настроен (домен фронта only).

**Наблюдаемость**
- [ ] Sentry активен, тестовая ошибка прилетела.
- [ ] Axiom получает логи воркера и API.
- [ ] Vercel/Railway healthchecks отвечают.

**Ops**
- [ ] Production деплой Vercel + Railway.
- [ ] DNS настроен, SSL через Vercel.
- [ ] Бэкапы Supabase автоматические (Pro план обязателен в проде).
- [ ] Прогон полного user journey вручную: регистрация → линковка Telegram → /follow → реальная транзакция → alert пришёл.

### Что НЕ делаем на MVP (отложено)

- ⏳ Web dashboard с графиками (только список + базовая статистика).
- ⏳ Hyperliquid интеграция.
- ⏳ Custom фильтры алертов (порог суммы, типы tx) — только базовый `notifyMinUsd`.
- ⏳ Реферальная программа.
- ⏳ Discord-бот.
- ⏳ Mobile push notifications.
- ⏳ Weekly digest (можно во второй итерации).
- ⏳ Smart money discovery (топ-кошельков) — пока пользователь добавляет вручную.
- ⏳ Translation на английский UI (RU first).

### Когда «можно показывать пользователям»

Не раньше, чем выполнены **все** пункты выше + ты лично прошла e2e flow с реальной on-chain транзакцией и убедилась, что alert пришёл с осмысленным AI-комментарием.

---

## Приложение: команды быстрого старта

```bash
# 1. Создать монорепо
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

# 5. Запуск локально
pnpm --filter web dev          # http://localhost:3000
pnpm --filter worker dev        # запуск воркера
pnpm --filter bot dev           # запуск бота на long polling
```

---

*Конец спека. Этот документ — живой. Обновляй его по мере того, как меняешь архитектуру или принимаешь новые решения. Каждое изменение в коде, которое стоит запомнить, — записывай сюда в виде ADR (architecture decision record).*




### Подключение кошелька пользователя (read-only вход)

Используем **Sign-In With Ethereum (SIWE)** — подпись сообщения для аутентификации без приватного ключа:

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
