# igo

Fleet product for trucks, agricultural machinery and vans. The owner sees two numbers first: **Economie %** (fuel saved vs the baseline) and **Profit pe cursă** (revenue − diesel − tolls − driver − other).

> **Demo build.** All vehicles, trips, clients and receipts are fictional and generated deterministically (`src/lib/fleet/`). The UI labels this with a "Demo · date fictive" badge.

## Stack
- Next.js 14 (App Router, TypeScript), server components + API routes, region `fra1` (`vercel.json`).
- i18n ro / en / pl from day one (`src/lib/i18n`, cookie `igo-locale`, `?lang=`). Dark / light themes (`?theme=`).
- Leaflet + markercluster for maps.
- Groq (server only, `GROQ_API_KEY`) for the assistant (tool-calling) and receipt reading (vision). Without the key both fall back: rule-based answers, manual receipt entry.

## Data layer
Pages and API routes read only through `IgoRepository` (`src/lib/repo.ts`). The demo implementation is in-memory; a Postgres (Neon Frankfurt) implementation slots in behind the same interface.

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
