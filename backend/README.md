# Nest backend (Cloudflare Workers + Neon)

Backend production-ready, simples e barato de operar para o app PWA Nest.
Stack:

- Cloudflare Workers (runtime edge, fetch handler nativo)
- TypeScript estrito
- Neon Postgres (`@neondatabase/serverless`)
- Drizzle ORM + drizzle-kit
- Anthropic API (Sonnet/Haiku) para o Copiloto IA (recurso premium)

Sem D1/KV/R2, sem Hono/Express, sem classes/DI/abstrações enterprise.

---

## Variáveis de ambiente

Configurar como **secrets** (`wrangler secret put`):

- `DATABASE_URL` — connection string Postgres (Neon, com `sslmode=require`)
- `ANTHROPIC_API_KEY` — chave da Anthropic (apenas para Copiloto)
- `NAPZ_ADMIN_TOKEN` — token usado nas rotas `/api/v1/admin/*`

E em `wrangler.toml` (não-secreto):

- `CORS_ORIGIN` — origem permitida (use o domínio do app em produção)

Para `wrangler dev` localmente, crie `backend/.dev.vars`:

```
DATABASE_URL=postgresql://...:...@...neon.tech/dbname?sslmode=require
ANTHROPIC_API_KEY=sk-ant-...
NAPZ_ADMIN_TOKEN=algum-token-bem-aleatorio
```

---

## Setup

```
cd backend
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

- `npm run db:generate` — gera o SQL das migrations a partir de `src/schema.ts` (em `drizzle/`).
- `npm run db:migrate` — aplica as migrations no banco apontado por `DATABASE_URL`.
- `npm run dev` — sobe Wrangler local em `http://127.0.0.1:8787`.
- `npm run deploy` — publica na Cloudflare.

> `drizzle-kit` lê `DATABASE_URL` do ambiente. Em CI/local você pode usar:
> `DATABASE_URL=postgres://... npm run db:migrate`.

---

## Endpoints

Todas as rotas de usuário usam `device_id` + `device_secret` (header
`X-Device-Id`/`X-Device-Secret` ou no body). No primeiro uso o backend salva
`SHA-256(secret)`; depois valida o hash a cada request. Falha → `401
{ "error": "device_auth_failed" }`.

- `GET  /health`
- `POST /api/v1/trial/start`
- `POST /api/v1/copilot`
- `POST /api/v1/sync/push`
- `GET  /api/v1/sync/pull`
- `POST /api/v1/activate`
- `GET  /api/v1/entitlement`
- `POST /api/v1/admin/seed`              (header `X-Admin-Token`)
- `GET  /api/v1/admin/licenses`          (header `X-Admin-Token`)
- `POST /api/v1/admin/deactivate`        (header `X-Admin-Token`)
- `POST /api/v1/admin/grant-lifetime`    (header `X-Admin-Token`)
- `GET  /api/v1/admin/usage?days=30`     (header `X-Admin-Token`)

### Copiloto

- Acesso exclusivo a `premium` e `lifetime`.
- `trial` ⇒ `403 { error: "copiloto_bloqueado", reason: "trial_sem_copilot" }`.
- Modelo:
  - `lifetime` → sempre Sonnet (`claude-sonnet-4-20250514`)
  - `premium` → Sonnet se `despertares_ultima_noite >= 3` ou `contextFlags.length > 0`; senão Haiku (`claude-haiku-4-5-20251001`).
- Timeout: 18s (`AbortController`).
- Dedup: SHA-256(`device_id` + JSON normalizado do contexto), TTL 60s, cleanup a cada 100 chamadas.
- Rate limit:
  - mensal visível: `premium` 200/mês, `lifetime` ilimitado.
  - hard cap invisível: 30/h por device.
- Se a IA falhar (timeout/HTTP/empty) → fallback estruturado (`shouldUseLocalCopilot: true`).

### Sync

Modelo "last write wins". Sem merge granular. Limite de payload: **512KB**.

### Activate

Idempotente: re-ativar com o mesmo `device_id` **não** incrementa `activations`.
Toda a operação roda em uma transaction Drizzle.

---

## Logs

Tudo via `lib/logger.ts` em JSON (`{ level, event, ts, ... }`). Nunca logamos
secrets, tokens ou stacktrace bruto.

## Retention

- `copilot_dedup_cache`: cleanup lazy (TTL 60s, a cada 100 chamadas).
- `copilot_usage`: limpeza opcional > 180 dias via `cleanupOldUsage(db)`
  (chamável de um cron worker se desejado).

---

## Frontend (resumo)

```
const deviceId = localStorage.getItem('nz_device_id') ?? crypto.randomUUID();
const deviceSecret = localStorage.getItem('nz_device_secret') ?? crypto.randomUUID();
localStorage.setItem('nz_device_id', deviceId);
localStorage.setItem('nz_device_secret', deviceSecret);
```

O `device_secret` nunca aparece para o usuário.
