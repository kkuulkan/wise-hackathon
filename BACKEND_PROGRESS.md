# Backend Progress — `backend` branch

> **For other Claude sessions / teammates:** this file is the single source of truth for what the
> `backend` branch changes, why, and how to merge it. Read it fully before merging `backend` into
> your branch or branching off it. It is updated at the end of every backend work session.
> Owner: aim-t (backend). Product spec: [PRD_OtherWise.md](PRD_OtherWise.md). Hackathon brief and rubric: [BMExWise.txt](BMExWise.txt).

---

## 1. Status at a glance

| Field | Value |
|---|---|
| Branch | `backend` (cut from `main` at `fa2432c`) |
| Last updated | 2026-10-17 |
| Phase | **0 — Baseline documented, no backend code yet** |
| Breaking changes for frontend | None yet |
| New dependencies | None yet |
| Env vars required | None yet |

### Work log (newest first)

| Date | Change | Files | Merge impact |
|---|---|---|---|
| 2026-10-17 | Created this progress file; documented baseline and backend plan | `BACKEND_PROGRESS.md` | None |

---

## 2. Project in one paragraph

**OtherWise** (the UI is currently branded "Cheaper Here") is a Wise-style banking feature for EU
budget travelers. When a user arrives in another EU country, the app notifies them and shows the
spending **categories they already buy** (from their transaction history) that are cheaper in the
destination than at home, each with 3–5 products/places and a price comparison. Built for the
BME HackNight × Wise "Max Ease" challenge, 16-hour budget. Rubric weights: Friction 25%,
Technical/Architecture 25% ("proper APIs, solid stability, elegant error handling" scores high),
Pitch 35%, AI disclosure 15%.

Demo persona: **Aoife Brennan**, home Dublin (IE), arrived Budapest (HU) on 2026-10-15.

---

## 3. Baseline on `main` (what existed before backend work)

Stack: **Next.js 16.4 App Router**, React 19.3, TypeScript, CSS Modules, GSAP. `next.config.ts`
enables `cacheComponents` and `partialPrefetching`. Note `AGENTS.md`: this Next version has breaking
changes — read `node_modules/next/dist/docs/` before writing Next-specific code.

There is **no backend**. Server components import mock JSON directly:

```
app/page.tsx, app/cheaper/page.tsx  ──►  lib/data.ts  ──►  data/*.json (static imports)
```

| File | Role |
|---|---|
| `data/account.json` | Holder, home/current city+country, `arrivedOn`, balances (EUR, HUF) |
| `data/transactions.json` | 25 txns shaped like a Wise balance statement; `category` is a slug; `amountEur` precomputed; FX EUR/HUF = 395 |
| `data/recommendations.json` | 6 categories for Dublin→Budapest, each with `homeAvgEur`, `localAvgEur`, `purchasesPerYear`, `products[]` |
| `lib/types.ts` | Shared types: `Account`, `Transaction`, `RawCategory`, `Category`, `Product`, … |
| `lib/data.ts` | Loaders + logic: `MIN_SAVING_PCT = 15`, `savingPct`, `annualSavingEur = (home − local) × purchasesPerYear`, ranking by `annualSavingEur`, `vsLocalAvgPct` per product |
| `lib/format.ts` | EUR/HUF/percent/date formatting (pure, client-safe) |

### Gaps between baseline and PRD (what backend work must close)

| # | PRD requirement | Baseline behavior |
|---|---|---|
| G1 | FR-8/9: categories derived from **last 90 days of transactions**, ranked by spend + frequency, max 5 | Categories and `homeAvgEur` / `purchasesPerYear` are **hardcoded** in `recommendations.json`; transactions are only displayed. All 6 shown. |
| G2 | FR-1–4: trip detection (country ≠ home, EU only, one notification per country per trip) | `away = currentCountryCode !== homeCountryCode` inline in `app/page.tsx`; no trip state |
| G3 | FR-11–17: product/price API called with **only category + country pair**, cached, static fallback on failure/3s timeout | No API; JSON imported directly |
| G4 | FR-14 / US-4.4: exclude products pricier than home | Not filtered per product |
| G5 | US-4.1: 3–5 products per category | Some categories have 2 |
| G6 | FR-10 / US-7: default categories when history is thin | None |
| G7 | FR-20/21 / US-6: consent opt-in/out | None |
| G8 | FR-23: analytics events without personal financial data | None |
| G9 | US-8 (could-have): thumbs-down feedback hidden for the trip | None |
| G10 | Edge case 11/13: exclude sensitive (health? gambling) and non-actionable (rent, insurance) categories | None — note physio/dental are health-adjacent; team decision pending |

---

## 4. Backend plan

**Approach:** Next.js **Route Handlers** under `app/api/**` plus server-only modules under
`lib/server/**`. No separate service, no database, no new dependencies — state lives in an
in-memory store seeded from `data/*.json` (resets on server restart; fine for the demo, documented as a
limitation). This keeps `npm run dev` the only command needed.

Design rules:
1. **Privacy boundary (FR-15):** the catalog/product API module takes only `{ category, from, to }`.
   It never receives account, merchant names or amounts. Personalization happens on our side.
2. **Pure logic separated from I/O** so it is testable: `personalize(transactions, now)`,
   `detectTrip(profile, trips, countryCode)`, `selectProducts(catalog, homePrices)`.
3. **Graceful degradation (FR-17, NFR Reliability):** catalog fetch has a timeout and falls back to the
   static seed; the response says `source: "live" | "cache" | "fallback"`.
4. **Frontend contract stability:** existing `lib/types.ts` shapes (`Category`, `Product`) stay
   compatible so the UI keeps working while it migrates from direct imports to `fetch`.

### Planned endpoints

| Method & path | Purpose | PRD |
|---|---|---|
| `GET /api/account` | Profile, balances, active trip | FR-7 |
| `GET /api/transactions` | Statement list | — |
| `POST /api/location` `{ countryCode }` | Trip detection; returns `{ trip, shouldNotify }` | FR-1–5, US-1 |
| `GET /api/recommendations` | Personalized ranked categories (≤5) with products for the active trip; fallback-labeled when history thin | FR-8–14, US-3/4/7 |
| `GET /api/catalog?category=&from=&to=` | The "product and price API": catalog lookup by category + country pair only, cached | FR-11, 15, 16, 17 |
| `GET` / `PUT /api/consent` | Read / set opt-in and notifications | FR-20, 21, US-6 |
| `POST /api/events` | Analytics event sink (no financial data) | FR-23 |
| `POST /api/feedback` | Thumbs-down; hides item for the trip | US-8 |

### Planned files

```
app/api/<route>/route.ts     one handler per endpoint above
lib/server/store.ts          in-memory state seeded from data/*.json
lib/server/trips.ts          trip detection, EU member list
lib/server/personalize.ts    90-day window, spend+frequency ranking, home baselines from txns, fallback
lib/server/catalog.ts        category+country-pair lookup, cache, timeout, fallback, product filtering
data/catalog/*.json          catalog seed (may replace / extend recommendations.json)
```

### Milestones

- [ ] **M1** Personalization from transactions (G1, G4, G5, G6) + `/api/recommendations`, `/api/catalog`
- [ ] **M2** Trip detection + `/api/location`, `/api/account` (G2)
- [ ] **M3** Consent (G7)
- [ ] **M4** Events + feedback (G8, G9)
- [ ] **M5** Frontend wiring handoff notes (which components switch from `lib/data.ts` to `fetch`)

---

## 5. Merge notes for other branches

- Nothing on this branch conflicts with frontend work yet.
- When backend code lands, this section will list: files moved/renamed, type changes in `lib/types.ts`,
  data file changes, and the exact steps for a frontend branch to adopt the API.
- Convention: backend will **not** edit `components/**` or `*.module.css`. If an `app/*/page.tsx`
  change is required to wire data, it will be listed here explicitly.

## 6. Open decisions (need team input)

1. Product name in UI: "OtherWise" (PRD) vs "Cheaper Here" (current UI/README).
2. Are physiotherapy / dental "sensitive health" categories under PRD edge case 11? They are the
   strongest demo savings.
3. Demo arrival trigger: simulated `POST /api/location` from a dev control, or keep the timed sheet?
