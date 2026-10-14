# Querra Fleet

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

### Fleet reliability changes (branch `codex/fleet-reliability`)

Owners manage vehicles at `/trucks` and people at `/drivers`. Adding a driver creates
one pending identity; a truck can be assigned before the invitation is accepted.
Invitations expire after 14 days. A truck has at most one enabled driver; assignment
changes require the affected shifts to end. Disabling a driver closes their shift,
releases the truck and invalidates their existing sessions.

Real financial reports use the current calendar month. Completed trips retain their
own recorded or estimated fuel consumption: a fuel purchase is not charged to every
trip on the same day. Unconfigured vehicle costs start at zero and trip details show
that costs are incomplete. Configure actual costs before relying on profit figures.
Past planned trips remain planned until explicitly completed. Archived vehicles retain
financial history. Currency selection is limited to RON until end-to-end conversion
is implemented. Real cost profiles are versioned by calendar month. Edits take effect next month;
repeated edits replace that scheduled version. Existing profiles remain the baseline
for older trips. Offline driver submissions and full multicurrency reporting remain
follow-up work. Migration `0012` adds the monthly history without altering existing costs.

Deployment notes:

- Back up the production database before applying migration `0011`.
- Check for conflicting assignments with the query below. Resolve each conflict with
  the fleet owner before migration; the unique index deliberately rejects duplicates.
- Real production accounts require `DATABASE_URL`. Set a strong `SESSION_SECRET` and
  `CRON_SECRET`; cron requests require the bearer secret.
- Files use Postgres unless both `BLOB_READ_WRITE_TOKEN` and `BLOB_ACCESS=private` are
  configured for a private Vercel store. Existing public Blob URLs are not made private
  by this code change; migrate those files and remove the public originals separately.
- Set `APP_URL` to the canonical HTTPS origin for driver invitations.

```sql
SELECT firm_id, truck_id, count(*)
FROM users
WHERE role = 'driver' AND disabled_at IS NULL AND truck_id IS NOT NULL
GROUP BY firm_id, truck_id
HAVING count(*) > 1;
```

Validation: run `npm run build`, then the smoke suite. Set `TEST_DATABASE_URL` only
to a disposable database: the existing tenant, fuel and documents suites DROP their
schemas. Run these suites sequentially. `npm run smoke:reliability:pg` requires that
variable and verifies concurrent invite acceptance, assignment conflicts, receipt
idempotency, tenant isolation, shift state and session version changes on Postgres.
It cleans up only its own fixtures. The same suite without `:pg` covers memory storage
and financial/date regressions.

### Owner trip workflow

Owners have Home, Trips, Trucks and Drivers in the main navigation. Secondary tools
are in More. Trips can be searched and filtered by status, truck and month; completed
trips cannot be rewritten through the planned-trip editor.

Dictation uses a short recording (up to 60 seconds / 2 MB) and Groq transcription when
`GROQ_API_KEY` is configured. The UI explains the audio transfer before recording.
Audio is forwarded transiently, not saved to the application's file storage. Without
that configuration, supported browsers use their native speech recognition. Microphone
permission, silence and service failures show actionable messages; typing remains
available. Real microphone/device testing is still required on the target phones.

`npm run smoke:trip-workflow` checks natural language parsing and ambiguous driver
names. The tenant suite tests the transcription HTTP contract using a local synthetic
provider, without recording a user or sending test audio to an external service.

### Trip progress and connection loss

Trips progress through Planned, Loaded, Delivered and Completed. The driver confirms
loading/delivery; the owner completes a delivered trip for financial reporting.
Before loading, an owner can cancel with a reason; cancelled trips stay in history
and are excluded from financial totals. Loaded trips cannot be edited or cancelled
through these controls. Migration 0013 backfills progress from existing events.

The driver page saves trip events and fuel receipts (including photos) in IndexedDB
before sending. It retries in order while the page is open, on reconnect and every
30 seconds. Stable request keys prevent duplicate events/receipts. A rejected action
blocks later actions until reviewed; pending data is never presented as confirmed.
Queues are scoped to firm and user, and replay checks the signed-in user and current
assignment. Storage failure leaves the receipt form intact. The limit is 20 pending
actions; event timestamps must be within 30 days. Device storage can be cleared by
the browser/user, so it is not a server backup. Initial page loading, shifts/GPS and
CMR/POD uploads still require internet. No background service worker is installed.
Queued trip events do not include GPS coordinates.

`npm run smoke:outbox` exercises ordering, retained requests, conflicts and receipt
payloads. Reliability tests exercise concurrent event retries and lifecycle guards
in memory and Postgres; tenant tests cover the authenticated HTTP workflow.

### UI hardening checks

Shared controls now have explicit keyboard focus, readable completed states, larger
touch targets and reduced-motion support. Mobile trip rows use cards instead of a
horizontal table. New-trip dialogs use the native modal focus boundary and restore
focus on dismissal. Zero tonnage survives the edit form. Receipt OCR failures retain
valid photos and manual fields; stale OCR results cannot replace a newer selection.
The latest receipt follows server refreshes, and offline events keep their original
time in the activity feed. Outbox retry/discard storage failures show an error.

Regression checks: run the full smoke suite on a disposable Postgres database, plus
`smoke:reliability:pg`. Tenant tests cover owner page rendering, invalid numbers and
dates, zero values, permissions, event timestamps and concurrent workflow guards.
Browser QA covers owner/driver controls, narrow layouts, light/dark colors, dialog
validation, Escape and focus return. Real iOS/Android microphone, camera, storage
pressure and prolonged offline use still require device testing.


## Demo Europa și audit de regresie — octombrie 2026

- Demo-ul public are exact 7 camioane și 7 șoferi, cu 7 curse curente și 49 curse istorice. Coridoare: Viena–München, Frankfurt–Rotterdam, Timișoara–Budapesta, Ljubljana–Milano, Zürich–Lyon, Bratislava–Katowice, Sofia–Istanbul. 13 țări în punctele traseelor; date fictive, mutate relativ la ziua curentă.
- Acasă prezintă flota pe hartă și lista echipajelor; Camioane/Șoferi sunt accesibile și în demo, cu căutare și detalii. Modificările demo ale pauzei private continuă să ascundă poziția.
- Corecții demo: o singură direcție per cursă (fără retur ascuns în kilometri), ETA cu pauze, ore de plecare pozitive, reluare limitată la ora demo, retururi cu geometria inversată, CMR/POD și evenimente generate din cursa corespunzătoare. Etichetele hărții se orientează spre interior la marginea dreaptă.
- Corecții reale: API-ul de curse raportează modul corect; încasările clienților exclud cursele anulate și încă neîncheiate; modul demo nu poate folosi endpointurile `writableFirm` pentru a modifica firma reală; reîncercarea creării unei curse nu o dublează.
- Migrația `0014` adaugă o cheie de cerere unică per firmă și amprenta datelor inițiale. Aceeași cheie/date returnează cursa salvată, aceeași cheie/alte date produce 409. Interfața păstrează cheia la reîncercare, o schimbă dacă formularul se modifică și limitează așteptarea salvării la 20 de secunde. Clienții vechi fără cheie rămân compatibili, dar nu au această deduplicare.
- Verificări: `smoke:demo` include flota 7/7, asocierile, țările, coordonatele, geometria, timpii de condus, pauzele, combustibilul, confidențialitatea și totalurile financiare. `smoke:reliability` verifică 8 creări concurente, coliziuni de cheie, izolare între firme și reîncercare după editare, în memorie și PostgreSQL. `smoke:tenant` verifică și comportamentul HTTP pentru aceste cazuri și paginile demo.
- Limite: testele nu reprezintă certificare de tahograf/rutare pentru camioane; OSRM generează doar geometria exemplului. GPS-ul pe telefon cu ecranul blocat, dictarea cu microfon real și comportamentul rețelelor mobile necesită probe pe Android/iPhone. Înainte de comercializare: pilot cu firme reale, verificarea profitului estimat față de costurile confirmate, flux de facturare/încasare, restaurare backup verificată, monitorizare și măsurarea costului OCR/AI per client.
