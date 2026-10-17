# Backend Progress: `backend` branch

> **For other Claude sessions and teammates:** this file is the source of truth for what the
> `backend` branch adds, why, and how to merge or build on it. Read it fully before merging
> `backend` into your branch or branching off it. It is updated at the end of every backend session.
> Owner: aim-t (backend). Product spec: [PRD_OtherWise.md](PRD_OtherWise.md). Hackathon brief and rubric: [BMExWise.txt](BMExWise.txt).

---

## 1. Status at a glance

| Field | Value |
|---|---|
| Branch | `backend` (cut from `main` at `fa2432c`) |
| Last updated | 2026-10-17 |
| Phase | **Backend API complete for the HTML prototype's UI (minus "Popular"). Frontend not wired yet.** |
| Breaking changes for frontend | **None.** No existing file under `app/` (pages), `components/`, `lib/data.ts`, `lib/types.ts`, `lib/format.ts` or `data/*.json` was modified. |
| New dependencies | None (`import "server-only"` is resolved by Next itself) |
| Env vars | None required. Optional: `OTHERWISE_TODAY`, `OTHERWISE_CATALOG_MODE` (see §6) |
| Verification | `npm run build` passes, `eslint` is clean, `npm run smoke` passes **42/42** against `next start` |

### Work log (newest first)

| Date | Change | Merge impact |
|---|---|---|
| 2026-10-17 | Full backend: 11 route handlers under `app/api/**`, server modules under `lib/server/**`, seed data under `data/seed/**`, e2e smoke test `scripts/smoke.mjs`, `npm run smoke` script | Additive only. `package.json` gains one script line. |
| 2026-10-17 | Created this progress file | None |

---

## 2. What we are building

**OtherWise** (the current UI on `main` is branded "Cheaper Here"; the name is still open) is a feature for a Wise-style banking app, aimed at budget travellers who live in the EU. When a user arrives in another EU
country, the app notifies them. Tapping the notification opens a screen with two sections:

1. **Only here in {country}**: products exclusive to the destination.
2. **Cheaper in {country}**: the user's own top spending categories (from their transactions) that are cheaper
   there, each with products showing *home price* vs *local price*, plus a link.

The target UI is the HTML prototype `travel-savings-prototype.html` (shared by aim-t, not in the repo).
It shows a phone with a "Simulate arrival" picker, a push notification, and a recommendations screen.
**Out of scope:** the prototype's **"Popular" chip / popularity-based picks** (PRD "Won't have").
Exclusives are kept and are always labelled `"Exclusive"`.

Demo persona: **Aoife Brennan**, home Ireland (IE), EUR. Read from the existing `data/account.json`.

Built for the BME HackNight × Wise "Max Ease" challenge. Technical execution is 25% of the score, and the
rubric rewards "proper APIs, solid stability, elegant error handling", which this branch targets.

---

## 3. Architecture

```
Browser / frontend ──fetch──► app/api/**/route.ts        (thin: validate input, call lib/server, return JSON)
                                     │
                                     ▼
                              lib/server/
                                recommendations.ts   orchestrates the screen
                                personalize.ts       PURE ranking of the user's categories (no I/O)
                                catalog.ts           "product & price API": category + country pair ONLY
                                trips.ts             arrival / trip / notification logic
                                store.ts             in-memory state (trips, consent, feedback, events, cache)
                                seed.ts              read-only seed loaders
                                config.ts            every tunable + country list + FX
                                http.ts              error shape, body parsing, validation helpers
                                types.ts             backend types and the HTTP response contracts
                                     │
                                     ▼
                              data/seed/  categories.json · catalog.json · transactions.json
                              data/account.json  (shared with the frontend; read only)
```

Key decisions:
- **Route Handlers in the same Next app.** There is no separate service, so `npm run dev` runs everything.
- **Privacy boundary by type (FR-15).** `queryCatalog({ category, from, to })` has no parameter that could hold
  user data. `GET /api/catalog` **refuses** any extra query parameter with a 400.
- **Cache Components is on** in `next.config.ts`. In this Next version, a GET handler that reads no
  request data is **prerendered at build time**. Handlers that read in-memory state therefore call
  `await connection()` from `next/server`. `export const dynamic` no longer exists in Next 16 with Cache Components.
  **If you add a stateful GET route, you must do the same**, or it will serve a frozen build-time snapshot.
- **State is in memory** on `globalThis` (survives dev hot reloads, resets on restart). That is fine for a single-user demo.
  To use a database, reimplement the accessors in `store.ts`. No caller touches state directly.
- **Separate types.** `lib/server/types.ts` is kept apart from `lib/types.ts` so frontend seed types and backend contracts don't collide.

---

## 4. API contract (for the frontend)

All responses are JSON. **Every error** has this shape: `{ "error": { "code": string, "message": string } }`.
`message` is safe to show to users.

### Mapping the HTML prototype onto the API

| Prototype element | Call |
|---|---|
| "Arrive in …" dropdown | `GET /api/destinations` |
| "Simulate arrival" button | `POST /api/location { countryCode }`, then show `notification` if not null |
| Notification title/body | `notification.title`, `notification.body` |
| Tap notification | navigate to `notification.deepLink` (`/cheaper?country=PT`) |
| Home screen ("Good morning", balance, recent activity) | `GET /api/account`, `GET /api/transactions` |
| "Your picks for {country}" | `GET /api/recommendations?country=PT`, `country.name` |
| "Only here in {country}" card | `exclusives[]` (show first 3, "See all" shows the rest, max 5) |
| "Cheaper in {country}" cards | `categories[]` (max 5) |
| "↓ ~41% cheaper than home" badge | `categories[i].savingPct` |
| "You spent $212 here recently" | `categories[i].reason.spentEur` (null means a general suggestion, so label it as such per US-7.2) |
| Struck-through home price / green local price | `products[j].homePrice.amount` / `products[j].localPrice.amount` (EUR) |
| Product link ↗ | `products[j].url` (Google Shopping/Maps search, no user data) |
| "See all {category}" | all `products[]` are already returned (max 5). The prototype shows the first 2 |
| Thumbs-down (PRD US-8, not in the prototype) | `POST /api/feedback` |

### Endpoints

| Method & path | Body / query | Returns | PRD |
|---|---|---|---|
| `GET /api/account` | | `{ holder, firstName, home{code,name}, balances[], activeTrip: null \| { id, startedAt, country{code,name}, countriesVisited[] } }` | FR-7 |
| `GET /api/transactions` | | `{ transactions: SeedTransaction[] }` newest first | |
| `GET /api/destinations` | | `{ home, destinations: [{ code, name, eligible }] }` (includes JP/MX as ineligible) | FR-4 |
| `POST /api/location` | `{ countryCode: "PT", signal?: "gps" \| "card" }` | `{ status, country, trip, notification, suppressedBecause? }`. `status` is one of `"arrived" \| "already-seen" \| "home" \| "ineligible"` | FR-1–5, US-1 |
| `GET /api/notifications` | | `{ notifications[] }` newest first (stands in for the push outbox) | FR-5 |
| `GET /api/recommendations` | `?country=PT` (optional, defaults to active trip) | `RecommendationsResponse` (below). 409 `no_active_trip`, 422 `not_eligible`, 400 `bad_request` | FR-8–14, US-3/4/7 |
| `GET /api/catalog` | `?category=&from=&to=` and **nothing else** | `{ category, from, to, products[], source, fetchedAt }` | FR-11, 15, 16, 17 |
| `GET /api/consent` | | `{ personalisation, notifications, updatedAt }` | US-6.3 |
| `PUT /api/consent` | `{ personalisation?: bool, notifications?: bool }` | same, plus `confirmation` text | FR-20/21, US-6 |
| `POST /api/feedback` | `{ kind: "category" \| "product", id, country }` | `{ ok, hiddenFor: "trip", tripId }`. 409 if no trip to that country | US-8 |
| `GET /api/feedback` | | `{ feedback[] }` for team analysis | US-8.3 |
| `POST /api/events` | `{ type, country?, category?, productId? }`. Extra fields are rejected | 201 `{ ok }` | FR-23 |
| `GET /api/events` | | `{ events[] }` | FR-23 |
| `POST /api/dev/reset` | | wipes all in-memory state for a fresh demo run | demo |

**Events, and who sends them.** The server already logs `notification_sent`, `opt_in`, `opt_out` and `feedback`.
The **frontend should POST** `notification_opened`, `recommendations_viewed`, `category_viewed` and `product_tapped`.

### `RecommendationsResponse`

```jsonc
{
  "country": { "code": "PT", "name": "Portugal" },
  "home": { "code": "IE", "name": "Ireland", "currency": "EUR" },
  "tripId": "trip-1",                 // null when browsing outside a trip
  "personalised": true,               // false when consent is off or history is empty
  "exclusives": [{
    "id": "x-pt-conservas", "category": "groceries", "name": "Tinned fish gift tin",
    "description": "…", "label": "Exclusive",
    "localPrice": { "amount": 9, "currency": "EUR" },
    "approximate": true, "priceUpdatedAt": "2026-10-02", "url": "https://…"
  }],
  "categories": [{
    "slug": "groceries", "label": "Groceries", "icon": "cart",
    "personalised": true,
    "reason": { "spentEur": 625, "transactionCount": 12, "windowDays": 90 },  // null for general suggestions
    "savingPct": 40,
    "products": [{
      "id": "g-bread", "name": "Fresh bakery loaf", "description": "…",
      "homePrice":  { "amount": 3.2, "currency": "EUR" },
      "localPrice": { "amount": 1.4, "currency": "EUR" },   // in HU also has "local": { "amount": 514, "currency": "HUF" }
      "savingPct": 56, "approximate": true, "priceUpdatedAt": "2026-10-01", "url": "https://…"
    }]
  }],
  "disclosure": "Prices are approximate … not financial advice.",   // FR-22: render it
  "fx": null,                          // { pair: "EUR/HUF", rate: 395, asOf } for non-EUR destinations
  "source": "live",                    // "live" | "cache" | "fallback". The UI may show a "showing saved prices" note on fallback
  "generatedAt": "2026-10-17T…Z"
}
```

`icon` is a neutral name (`cart`, `cup`, `plate`, `train`, `phone`, `bottle`, `shoe`, `headphones`, `scissors`, `gift`).
The frontend maps it to its own icon set.

---

## 5. Business rules implemented (with PRD references)

| Rule | Where | PRD |
|---|---|---|
| Ranks the user's categories over the **last 90 days**: `score = 0.5·spend/maxSpend + 0.5·count/maxCount`, tie broken by slug | `personalize.ts` | FR-8, FR-9 |
| Purchase location ignored in ranking (a Barcelona coffee still counts) | `personalize.ts` | US-3.4 |
| Only `kind: "everyday"` categories are ranked or served. `sensitive` (pharmacy, gambling) and `non-actionable` (rent, insurance, other) are never used | `data/seed/categories.json`, `personalize.ts`, `/api/catalog` | Edge cases 11, 13 |
| Max 5 categories. A category with 0 cheaper products is skipped and the next one moves up | `recommendations.ts` | US-3.1, US-3.3 |
| Slots left over are filled from the default everyday set, marked `personalised: false`, `reason: null` | `recommendations.ts` | FR-10, US-7 |
| Consent off means **no transaction data read at all**; defaults only | `recommendations.ts` | US-6.2 |
| Products: only if local < home; ranked by saving %, id as tiebreak; max 5 | `catalog.ts` | FR-12, FR-14, US-4.4 |
| Age-restricted items excluded (`INCLUDE_AGE_RESTRICTED = false`) | `catalog.ts` | Edge case 21 |
| Prices older than 90 days dropped | `catalog.ts` | Edge case 17 |
| Malformed or duplicate catalog rows discarded | `catalog.ts` | Edge case 18 |
| Catalog cache per `from:to:category`, 6 h TTL; 3 s timeout; on failure, stale cache then static catalog; `source` reported | `catalog.ts`, `store.ts` | FR-16, FR-17, NFR |
| Exclusives: destination only, ordered by the user's category ranking | `catalog.ts` | FR-12 |
| Trip = leave home → return home. One notification per country per trip (multi-country trips notify once per country). Non-EU destination or same country means no notification | `trips.ts` | FR-2–4, US-1, edge cases 1–3, 7 |
| Notifications off means the trip is still recorded (home banner works) but nothing is sent | `trips.ts` | US-6.2, FR-7 |
| Deep link carries only the country; outbound URLs are built from catalog text + country name | `trips.ts`, `catalog.ts` | FR-6, US-5.3 |
| Feedback hides an item for the **current trip only** | `store.ts`, `recommendations.ts` | US-8 |
| Events accept a fixed field set; any other field gets a 400 | `/api/events` | FR-23 |

---

## 6. Running and verifying

```bash
npm install
npm run dev                       # http://localhost:3000
npm run smoke                     # in a second terminal; 42 end-to-end checks. NOTE: resets server state
BASE_URL=http://localhost:3123 npm run smoke   # against another port
```

Optional env:
- `OTHERWISE_TODAY=2026-10-17`: the "today" used for the 90-day window and price ages. It is pinned, so the demo is stable.
- `OTHERWISE_CATALOG_MODE=fail|slow`: simulates a catalog outage or timeout to demo the FR-17 fallback (`source: "fallback"`).

Quick manual demo:
```bash
curl -XPOST localhost:3000/api/location -H 'content-type: application/json' -d '{"countryCode":"PT"}'
curl localhost:3000/api/recommendations
```

Expected for PT: Groceries, Coffee, Dining out, Sneakers & clothing, Skincare & beauty, plus 5 exclusives.
Electronics is absent: the only electronics purchase is older than 90 days, and every electronics product is dearer in PT anyway.

---

## 7. Seed data (`data/seed/`)

| File | Contents |
|---|---|
| `categories.json` | 15-category taxonomy with `kind` and `isDefault` |
| `transactions.json` | 62 transactions for Aoife, 2026-06-20 → 2026-10-10. Same shape as `data/transactions.json`. Deliberately includes rent/insurance/pharmacy (must be ignored), one electronics row outside the window, and one dining row in Barcelona. **Generated** by a one-off script; edit the JSON directly if needed |
| `catalog.json` | 38 products, each priced per country (IE, PT, HU, ES) in EUR, plus 14 exclusives (PT, HU, ES). Deliberate traps: dearer-abroad electronics, age-restricted wine and Unicum, stale-priced Levi's |

To **add a destination**: add it to `COUNTRIES` in `lib/server/config.ts` (plus `FX_PER_EUR` if it is not on EUR) and add its
code to the `prices` of catalog products. No logic changes are needed (NFR: extensible without code changes).

`data/account.json`, `data/transactions.json` and `data/recommendations.json` on `main` are **untouched**, and the current `/` and `/cheaper` pages still use them.

---

## 8. Merge notes for other branches

- **Purely additive.** New directories: `app/api/`, `lib/server/`, `data/seed/`, `scripts/`. The only edited file is `package.json` (adds `"smoke"`).
  Conflicts are only possible if your branch also creates `app/api/**` or edits the `scripts` block of `package.json`.
- Do **not** import `lib/server/*` from client components. Those modules use `import "server-only"`, and the build will fail if you do.
  Server components *may* import `buildRecommendations` etc. directly instead of fetching their own API.
- The notification deep link points at **`/cheaper?country=XX`** (`RECOMMENDATIONS_PATH` in `lib/server/trips.ts`). If the frontend renames
  the route, change that one constant.
- **Frontend wiring is not done.** To switch `/cheaper` to the new backend, read `searchParams.country` and render
  `RecommendationsResponse`. The old `Category` type in `lib/types.ts` is a different shape (services and places, home average from seed),
  so this is a re-render, not a drop-in swap.

## 9. Known limitations (be honest about these in the report)

- One hard-coded demo user; **no authentication** (the PRD wants deep links authenticated). `/api/dev/reset` is open.
- State is in memory and lost on restart. Not safe with multiple server instances.
- The "catalog service" is in-process. Its static fallback reads the same seed file, so the fallback path is real but
  not a different data source.
- Exclusives are read straight from the seed (not via the cached or timeout path).
- Prices are mock EUR snapshots; FX is a fixed 395 HUF/EUR. No real push delivery, no quiet hours, no VPN/spoof detection.
- Notification copy and API messages are English only (the PRD wants EN/ES/DE).

## 10. Open decisions (need team input)

1. Product name: "OtherWise" (PRD) or "Cheaper Here" (current UI)?
2. Should the old services data (gym, physio, dental on `main`) be folded into `data/seed/catalog.json`? Physio and dental are
   health-adjacent, so they hit PRD edge case 11.
3. Should the frontend adopt the prototype's two-section layout, or keep the current design and add exclusives?
