# Smart Money Tracker — What's Left to Ship

## ✅ Done

- Postgres schema (Drizzle) — all tables
- Alchemy webhook with HMAC validation
- BullMQ workers: enrich → ai-analyze → notify
- Claude Sonnet AI analysis
- Telegram bot: /start, /follow, /unfollow, /list
- Telegram ↔ account linking
- Supabase Auth (email)
- Dashboard (basic)
- Vercel + Railway deploy

---

## 🔴 Must-have before first real user

### Backend
- [ ] **Helius webhook** (Solana) — endpoint + worker decoding
- [ ] **Proper tx decoding** — currently saves everything as `unknown`. Need real swap detection (Uniswap V3, Jupiter). Without this AI context is weak.
- [ ] **Token prices** — fetch USD value at time of tx via CoinGecko API. Currently `valueUsd` is just raw ETH value, not converted properly.
- [ ] **Alchemy webhook auto-registration** — when user does `/follow`, we need to call Alchemy API to add address to webhook. Currently webhook is static (only Vitalik).
- [ ] **AI cost tracking** — `ai_analyses.costUsd` is null. Need to calculate and save.
- [ ] **Prompt caching** — `promptHash` idempotency is there, but Anthropic-level prompt caching not enabled (saves ~50% cost).

### Frontend
- [ ] **Landing page** — currently just redirects to /auth. Need one public page explaining what the product does.
- [ ] **Alerts feed on dashboard** — list of recent alerts with AI comments. Right now dashboard only shows tracked wallets.
- [ ] **Add wallet form on dashboard** — currently wallets can only be added via Telegram bot. Need a web form too.
- [ ] **Settings page** — quiet hours, min tx value, email toggle.
- [ ] **Google OAuth** — Supabase Auth supports it, just needs enabling.

### Telegram bot
- [ ] **Feedback buttons** 👍/👎 under each alert — critical for measuring AI quality. Spec says ≥60% "helpful" is the success metric.
- [ ] **/settings command** — quiet hours, min USD threshold.
- [ ] **/help command**
- [ ] **Bot description + picture** in BotFather — looks unprofessional without it.
- [ ] **Address validation** — currently no check if address is valid EVM format before saving.

### Payments
- [ ] **Stripe Checkout** — without payments there's no business. Free beta is fine but needs a path to paid.
- [ ] **Tier limits enforced** — free: 3 wallets, 5 AI/day. Currently unlimited.
- [ ] **/upgrade command** in bot

### Security
- [ ] **Rate limiting** — on /api/auth and /api/webhooks endpoints (Upstash Ratelimit).
- [ ] **CORS config** — currently open, should restrict to vercel domain only.
- [ ] **Audit git history** — check no secrets were ever committed: `git log -p -S "YOUR_SECRET"`

### Observability
- [ ] **Sentry** — zero error visibility right now. One line to add.
- [ ] **Structured logging** — Railway logs are just console.log. Need pino + Axiom.
- [ ] **Healthcheck endpoints** — Railway needs `/health` to know if service is alive.

---

## 🟡 Important but not blocking

- [ ] **wallets_metadata** — ROI, winrate, txCount per wallet. Bot currently responds with "n/a" for all stats after /follow.
- [ ] **ENS resolution** — show "vitalik.eth" instead of raw address in alerts.
- [ ] **Quiet hours** — alert_settings table exists but not used.
- [ ] **Min tx value filter** — notifyMinUsd column exists but not enforced in notify worker.
- [ ] **Weekly digest** — cron every Sunday, aggregate week's activity per user.
- [ ] **Base + Arbitrum** — same Alchemy infrastructure, just different network param.

---

## 🟢 v2 (after first paying users)

- [ ] Solana full support (Helius)
- [ ] Smart wallet discovery / leaderboard
- [ ] Cryptomus (crypto payments)
- [ ] Discord bot
- [ ] Hyperliquid integration
- [ ] Mobile push notifications
- [ ] B2B / team plans

---

## Priority order recommendation

If goal is **first paying user in 2 weeks**:

1. Alchemy auto-registration on /follow
2. Feedback buttons 👍/👎 in Telegram
3. Tier limits + Stripe Checkout
4. Landing page
5. Alerts feed on dashboard
6. Sentry + rate limiting
7. wallets_metadata (ROI/winrate on /follow)
8. Address validation in bot

Everything else can wait for v1.1.