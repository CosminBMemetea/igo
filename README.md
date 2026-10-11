# igo

Fleet product for trucks, agricultural machinery and vans. The owner sees two numbers first: **Economie %** (fuel saved vs the baseline) and **Profit pe cursă** (revenue − diesel − tolls − driver − other).

> **Demo build.** All vehicles, trips, clients and receipts are fictional and generated deterministically (`src/lib/fleet/`). The UI labels this with a "Demo · date fictive" badge.

## Stack
- Next.js 14 (App Router, TypeScript), server components + API routes, region `fra1` (`vercel.json`).
- i18n ro / en / pl from day one (`src/lib/i18n`, cookie `igo-locale`, `?lang=`). Dark / light themes (`?theme=`).
- Leaflet + markercluster for maps.
- Groq (server only, `GROQ_API_KEY`) for the assistant (tool-calling) and receipt reading (vision). Without the key both fall back: rule-based answers, manual receipt entry.

## Data layer
Pages and API routes read only through `IgoRepository` (`src/lib/repo.ts`), resolved per request by `tenant()` (`src/lib/tenant.ts`):

- **Demo firm**: `DemoRepository` (seeded, in-memory, read-only sandbox). Used by the "Intră ca demo" user, by the admin until he opens a firm in `/admin`, and by an owner whose firm has **Date demo** switched on.
- **Real firm**: `FirmRepository` over a `Store` (`src/lib/store`): `PgStore` (Postgres via Drizzle; Neon serverless driver for `*.neon.tech`, node-postgres otherwise) when `DATABASE_URL` is set, else `MemStore` (in-memory fallback; admins see a banner). Every query is filtered by `firm_id`; documents/trips also check that the truck belongs to the same firm.

Schema: `src/db/schema.ts` (firms, users, invites, trucks, documents, trips, support_requests). Migrations: `drizzle/` (generate with `npm run db:generate`, apply with `npm run db:migrate`; `npm run build` applies them first and skips when `DATABASE_URL` is missing).

### Multi-tenant flow
- `/signup`: owner email + password (scrypt) + firm name (CUI optional) → empty firm on the 14-day trial → `/setup`.
- `/setup`: 5 steps with progress (firm + currency, trucks, driver invites, documents with expiry, first trip / fuel-card CSV placeholder).
- Driver invite: a signed (HMAC, `SESSION_SECRET`) single-use link valid 14 days → `/join` → phone + 6-digit PIN → driver session limited to `/driver`. Drivers sign in later with phone + PIN.
- `/support` ("Asistență Querra") stores a request; the admin sees all firms and requests at `/admin`.

Local Postgres test: `TEST_DATABASE_URL=postgres://… npm run build && npm run smoke:tenant` (the test database is wiped).

| Path | What |
|---|---|
| `src/lib/calc.ts` | Profit per trip and savings % formulas |
| `src/lib/fleet/rules.ts` | Fuel-theft rules (ported from qerradoc `/flota`) |
| `src/lib/features.ts` | Plans × features matrix: single source of truth for gating |
| `src/lib/query.ts` | Safe read functions (summaries, live positions) |
| `src/lib/ask.ts` | Assistant: tools, rule fallback, rendering with real numbers only |

## Plans and demo switches
`?plan=trial|start|pro|business` switches the plan (cookie `igo-plan`). Trial = 14 days, counted from the first visit (cookie `igo-trial-start`). Prices are **proposals**.

## Scripts
```
npm run dev
npm run typecheck && npm run lint && npm run build
npm run smoke        # calc, i18n, rules, ask
```

## Map tiles: licensing note
The demo uses Esri **World Dark/Light Gray Canvas** tiles (no key) with OpenStreetMap attribution. That is acceptable for a demo only. Before production, move to a licensed provider (e.g. MapTiler, Stadia, or a paid Esri/ArcGIS plan) and keep attribution.

## Environment
See `.env.example`. `GROQ_API_KEY` is optional.

## Accounts and roles
- `/login`: admin signs in with `ADMIN_EMAIL` + password, checked server-side against `ADMIN_PASSWORD_HASH` (scrypt). Missing env vars mean admin login is disabled (no default password).
- "Intră ca demo" creates a regular **user** session on the demo company.
- Session: httpOnly cookie `igo-session`, HMAC-SHA256 signed with `SESSION_SECRET`, 7 days. All pages and `/api/*` (except `/api/auth/*`) require it.
- **Admin** sees everything unlocked, plus an account menu with *Mod: Admin / Utilizator* and a plan preview (Probă/Start/Pro/Business). `?plan=` and `?view=` work only for admins. A **user** sees only the company's plan.

Generate the hash locally (the password is typed masked and never stored):
```
npm run hash-password
```
