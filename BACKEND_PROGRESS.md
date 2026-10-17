# OtherWise Backend Progress: `backend` branch

> **For other Claude sessions and teammates:** this file is the source of truth for what the
> `backend` branch adds, why, and how to merge or build on it. Read it fully before merging
> `backend` into your branch or branching off it. It is updated at the end of every backend session.
> Owner: aim-t (backend). Product spec: [PRD_OtherWise.md](PRD_OtherWise.md). Hackathon brief and rubric: [BMExWise.txt](BMExWise.txt).

---

## 1. Status at a glance

| Field | Value |
|---|---|
| Branch | **`main` now contains everything** (fast-forwarded to `integration` at `7eb6e85` on 2026-10-17): backend + frontend + wiring. Start new work from `main`. `backend` and `integration` are kept for history |
| Last updated | 2026-10-17 |
| Phase | **Real data.** Prices come from Eurostat, Open Prices and the ECB through a verified snapshot (§12). Two demo users, frontend wired |
| Breaking changes for frontend | **None.** No existing file under `app/` (pages), `components/`, `lib/data.ts`, `lib/types.ts`, `lib/format.ts` or `data/*.json` was modified. |
| New dependencies | `pg`, `drizzle-orm`, `@vercel/functions`, `@neon/config`, `@neon/env`; dev: `drizzle-kit`, `@types/pg` (§16). Runtime `npm audit`: 0 vulnerabilities |
| Env vars | **Required:** `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` (direct), written by `neon env pull`/`neon deploy`. Optional: `OTHERWISE_TODAY`, `OTHERWISE_CATALOG_MODE`, `OTHERWISE_ALLOW_RESET` (§16) |
| Verification | `npm run build` passes (with or without a database), `eslint` is clean, `npm run smoke` passes **78/78 against Neon**; restart persistence, DB integrity rules and DB-down fallback verified (§16) |

### Scope decisions (from aim-t, 2026-10-17)

- App name is **OtherWise**. The `frontend` branch already renamed the UI and package; `main` still says "Cheaper Here".
- **Comparison only.** No "Only here" / "Exclusive" section and no "Popular" picks. Both were removed from the backend.
- **Two demo users**, each with their own transaction history. Whoever is signed in sees recommendations from *their* spending,
  compared against *their* home country.

### Work log (newest first)

| Date | Change | Merge impact |
|---|---|---|
| 2026-10-17 | Neon `dev` branch for local work and smoke tests; `/api/dev/reset` refuses on the `production` branch (§16) | Run `neon checkout dev` locally |
| 2026-10-17 | All API routes wrapped in `handle()`: clean JSON 503 when the database is down, JSON 500 otherwise (§16). Route handlers are now `export const GET = handle(get)` | If you add a route, wrap it the same way |
| 2026-10-17 | **Neon Postgres database** (§16). Users, transactions, trips, notifications, consent, feedback, events and verified price snapshots now live in 13 tables (Drizzle schema + migration). `lib/server/store.ts` and `seed.ts` are DB-backed and async; new `pricedata.ts`, `db.ts`; `neon.ts` added by `neon init`. `app/page.tsx` gains one `await`. `/api/dev/reset` is blocked in production unless `OTHERWISE_ALLOW_RESET=true` | **After pulling: run `neon env pull` (or set `DATABASE_URL`), then `npm run db:migrate && npm run db:seed && npm run db:load-prices`** |
| 2026-10-17 | **Third user `saoirse`** (Dublin gamer) + Microsoft Store official list prices for electronics with a VAT-normalised consistency gate (§15). New `listPriceCheck` on categories; new `digital-games` category (never recommended). `data/real/brand-prices.json` added | Additive. The user picker now lists 3 users |
| 2026-10-17 | `products[].localComparison`: national average, per-kg/L vs the median of ≥5 similar verified products in the same country, or `null` (§14). Fetch script computes per-type medians (`products.json` → `localStats`) | Additive. **Frontend action needed in `Visa`** (§14) |
| 2026-10-17 | **Only recommend what a traveller can buy here instead of at home** (§13). Categories gain `buyWhere`; transport, mobile, dining and the new `cafe` category are never recommended. Coffee means coffee to take home. Groceries are shelf-stable take-home goods only. New official matched items from CSO Ireland + KSH Hungary (haircuts, sugar). Product lists vary across sub-categories. Café transactions re-tagged `cafe` | Additive API (`evidence` is now a union, see §13). `categories.json` and `transactions.json` changed |
| 2026-10-17 | **Real data replaces the mock catalog.** New `scripts/fetch-real-data.mjs` (`npm run fetch-data`) builds `data/real/` from Eurostat, Open Prices and the ECB through verification gates. `data/seed/catalog.json` deleted. Category savings now come from official price levels; products are real shelf prices; FX is the real ECB rate (363 HUF, was a hard-coded 395). `categories.json` gains `priceLevel`. API responses gain fields (none removed); `products` may now be empty. `lib/live.ts` adapted | Additive API. Frontend reading `products[0]` must handle empty lists (§12) |
| 2026-10-17 | `main` fast-forwarded to `integration` and pushed. Build passes on `main` | Pull `main` before branching |
| 2026-10-17 | `integration`: wired the frontend pages to the backend through `lib/live.ts` and `components/live/*`; only `app/page.tsx` and `app/cheaper/page.tsx` edited | See §11 |
| 2026-10-17 | Created branch `integration` from `backend` and merged `origin/frontend` (`790d2e8`). Clean merge, build + lint pass, smoke 58/58, `/` and `/cheaper` render | See §11 |
| 2026-10-17 | Two demo users plus a cookie sign-in (`/api/users`, `/api/session`). All user data and state is per user. Exclusives removed. German prices added to the catalog. Name set to OtherWise. Smoke test now covers both users (58 checks) | Additive. `data/seed/transactions.json` changed shape (keyed by user id) |
| 2026-10-17 | Initial backend: route handlers, `lib/server/**`, `data/seed/**`, `scripts/smoke.mjs`, `npm run smoke` | Additive. `package.json` gains one script line |
| 2026-10-17 | Created this progress file | None |

---

## 2. What we are building

**OtherWise** is a feature for a Wise-style banking app, aimed at budget travellers who live in the EU. When a signed-in user arrives
in another EU country, the app notifies them. Tapping the notification opens a **comparison screen**: the user's own top spending
categories (from *their* transaction history) that are cheaper in the destination than in *their* home country. Each category has
products showing *home price* vs *local price* and a link.

UI reference: the HTML prototype `travel-savings-prototype.html` (shared by aim-t, not in the repo). Use its phone frame,
"Simulate arrival" picker, push notification and the **"Cheaper in {country}"** section only. Drop its "Only here" section.

### Demo users (`data/seed/users.json`)

| id | Name | Home | Spending profile (last 90 days) | In Portugal they see |
|---|---|---|---|---|
| `aoife` | Aoife Brennan | Dublin, IE | Groceries weekly, coffee twice a week, dining, skincare, trainers. Rent, insurance and pharmacy are ignored | Groceries, Coffee, Dining out, Sneakers & clothing, Skincare & beauty |
| `jonas` | Jonas Keller | Berlin, DE | Electronics (top spend), trainers, monthly haircut, transport pass, prepaid SIM, takeaway. Rent and gambling are ignored | Sneakers & clothing, Dining out, Local transport, Hair & personal care, Mobile data |

A good demo beat: Jonas's top category is **electronics**, but it is **absent in Portugal** because every electronics item there costs more
than in Germany. Switch him to **Spain** and electronics appears. This shows the app only recommends real savings (FR-14).

Both people are fictional; the balances are mock data.

---

## 3. Architecture

```
Browser / frontend ──fetch (cookie: otherwise_user)──► app/api/**/route.ts   (thin: auth, validate, call lib/server, JSON)
                                                              │
                                                              ▼
                                                       lib/server/
                                                         session.ts          demo sign-in cookie → Profile, or 401
                                                         recommendations.ts  orchestrates one user's comparison screen
                                                         personalize.ts      PURE ranking of a user's categories (no I/O)
                                                         catalog.ts          "product & price API": category + country pair ONLY
                                                         trips.ts            arrival / trip / notification logic
                                                         store.ts            in-memory state, per user (+ shared events and cache)
                                                         seed.ts             read-only seed loaders
                                                         config.ts           every tunable + country list + FX
                                                         http.ts             error shape, body parsing, validation helpers
                                                         types.ts            backend types and HTTP response contracts
                                                              │
                                                              ▼
                                                       data/seed/  users.json · transactions.json · categories.json · catalog.json
```

Key decisions:
- **Route Handlers in the same Next app.** There is no separate service, so `npm run dev` runs everything.
- **Demo sign-in** is an httpOnly cookie `otherwise_user=<userId>` set by `POST /api/session`. There is no password because both users are fictional.
  It stands in for the bank app's real session. Every user-specific route starts with `requireUser()` and returns 401 otherwise.
- **Per-user state.** Trips, notifications, consent and feedback are stored per user. Analytics events and the catalog cache are shared because they hold no personal data.
- **Privacy boundary by type (FR-15).** `queryCatalog({ category, from, to })` has no parameter that could hold user data.
  `GET /api/catalog` **refuses** any extra query parameter with a 400 and needs no sign-in.
- **Cache Components is on** in `next.config.ts`. In this Next version, a GET handler that reads no request data is **prerendered at build time**.
  Routes that read the cookie are dynamic automatically. Stateful routes without a cookie (`/api/events`, `GET /api/feedback`)
  call `await connection()` from `next/server`. `export const dynamic` no longer exists in Next 16 with Cache Components.
  **If you add a stateful GET route, make sure it is dynamic**, or it will serve a frozen build-time snapshot.
- **State is in memory** on `globalThis` (survives dev hot reloads, resets on restart). To use a database, reimplement the accessors in `store.ts`.

---

## 4. API contract (for the frontend)

All responses are JSON. **Every error** has this shape: `{ "error": { "code": string, "message": string } }`.
`message` is safe to show to users. User-specific routes return **401 `not_signed_in`** without a session.
Browser `fetch` sends the cookie automatically on same-origin requests.

### Mapping the prototype onto the API

| Prototype element | Call |
|---|---|
| (new) User picker / sign in | `GET /api/users`, then `POST /api/session { userId }` |
| "Arrive in …" dropdown | `GET /api/destinations` |
| "Simulate arrival" button | `POST /api/location { countryCode }`, then show `notification` if not null |
| Notification title/body | `notification.title`, `notification.body` |
| Tap notification | navigate to `notification.deepLink` (`/cheaper?country=PT`) |
| Home screen (greeting, balance, recent activity) | `GET /api/account`, `GET /api/transactions` |
| "Your picks for {country}" | `GET /api/recommendations?country=PT`, `country.name` |
| "Cheaper in {country}" cards | `categories[]` (max 5) |
| "↓ ~41% cheaper than home" badge | `categories[i].savingPct` |
| "You spent $212 here recently" | `categories[i].reason.spentEur` (null means a general suggestion, so label it as such per US-7.2) |
| Struck-through home price / green local price | `products[j].homePrice.amount` / `products[j].localPrice.amount` (EUR) |
| Product link ↗ | `products[j].url` (Google Shopping/Maps search, no user data) |
| "See all {category}" | all `products[]` are already returned (max 5). The prototype shows the first 2 |
| Thumbs-down (PRD US-8, not in the prototype) | `POST /api/feedback` |

### Endpoints

| Method & path | Auth | Body / query | Returns | PRD |
|---|---|---|---|---|
| `GET /api/users` | none | | `{ users: [{ id, holder, homeCity, home{code,name} }] }` | demo |
| `GET /api/session` | none | | `{ user: { id, holder, firstName } \| null }` | |
| `POST /api/session` | none | `{ userId }` | `{ user }` and sets the cookie. 404 for an unknown id | US-2.2 (stand-in) |
| `DELETE /api/session` | none | | `{ user: null }` and clears the cookie | |
| `GET /api/account` | user | | `{ id, holder, firstName, homeCity, home{code,name}, balances[], activeTrip: null \| { id, startedAt, country{code,name}, countriesVisited[] } }` | FR-7 |
| `GET /api/transactions` | user | | `{ transactions: SeedTransaction[] }` newest first, this user's only | |
| `GET /api/destinations` | user | | `{ home, destinations: [{ code, name, eligible }] }` (JP/MX ineligible) | FR-4 |
| `POST /api/location` | user | `{ countryCode: "PT", signal?: "gps" \| "card" }` | `{ status, country, trip, notification, suppressedBecause? }`. `status` is one of `"arrived" \| "already-seen" \| "home" \| "ineligible"` | FR-1–5, US-1 |
| `GET /api/notifications` | user | | `{ notifications[] }` newest first | FR-5 |
| `GET /api/recommendations` | user | `?country=PT` (optional, defaults to active trip) | `RecommendationsResponse`. 409 `no_active_trip`, 422 `not_eligible`, 400 `bad_request` | FR-8–14, US-3/4/7 |
| `GET /api/catalog` | none | `?category=&from=&to=` and **nothing else** | `{ category, from, to, products[], source, fetchedAt }` | FR-11, 15–17 |
| `GET /api/consent` | user | | `{ personalisation, notifications, updatedAt }` | US-6.3 |
| `PUT /api/consent` | user | `{ personalisation?: bool, notifications?: bool }` | same, plus `confirmation` text | FR-20/21, US-6 |
| `POST /api/feedback` | user | `{ kind: "category" \| "product", id, country }` | `{ ok, hiddenFor: "trip", tripId }`. 409 if no trip to that country | US-8 |
| `GET /api/feedback` | none | | `{ feedback[] }` for team analysis, without user ids | US-8.3 |
| `POST /api/events` | none | `{ type, country?, category?, productId? }`. Extra fields are rejected | 201 `{ ok }` | FR-23 |
| `GET /api/events` | none | | `{ events[] }` | FR-23 |
| `POST /api/dev/reset` | none | | wipes all in-memory state for every user (does not sign out) | demo |

**Events, and who sends them.** The server already logs `notification_sent`, `opt_in`, `opt_out` and `feedback`.
The **frontend should POST** `notification_opened`, `recommendations_viewed`, `category_viewed` and `product_tapped`.

### `RecommendationsResponse`

```jsonc
{
  "country": { "code": "PT", "name": "Portugal" },
  "home": { "code": "IE", "name": "Ireland", "currency": "EUR" },   // the signed-in user's home
  "tripId": "trip-1",                 // null when browsing outside a trip
  "personalised": true,               // false when consent is off or history is empty
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
  "source": "live",                    // "live" | "cache" | "fallback". The UI may show "showing saved prices" on fallback
  "generatedAt": "2026-10-17T…Z"
}
```

`icon` is a neutral name (`cart`, `cup`, `plate`, `train`, `phone`, `bottle`, `shoe`, `headphones`, `scissors`).
The frontend maps it to its own icon set.

---

## 5. Business rules implemented (with PRD references)

| Rule | Where | PRD |
|---|---|---|
| Ranks **the signed-in user's** categories over the last 90 days: `score = 0.5·spend/maxSpend + 0.5·count/maxCount`, tie broken by slug | `personalize.ts` | FR-8, FR-9 |
| The comparison base is the **user's own home country** (Aoife: IE prices, Jonas: DE prices) | `recommendations.ts` | FR-11 |
| Purchase location ignored in ranking (Aoife's Barcelona dinner still counts) | `personalize.ts` | US-3.4 |
| Only `kind: "everyday"` categories are ranked or served. `sensitive` (pharmacy, gambling) and `non-actionable` (rent, insurance, other) are never used | `categories.json`, `personalize.ts`, `/api/catalog` | Edge cases 11, 13 |
| Max 5 categories. A category with 0 cheaper products is skipped and the next one moves up | `recommendations.ts` | US-3.1, US-3.3 |
| Slots left over are filled from the default everyday set, marked `personalised: false`, `reason: null` | `recommendations.ts` | FR-10, US-7 |
| Consent off means **no transaction data read at all**; defaults only. Per user | `recommendations.ts` | US-6.2 |
| Products: only if local < home; ranked by saving %, id as tiebreak; max 5 | `catalog.ts` | FR-12, FR-14, US-4.4 |
| Age-restricted items excluded; prices older than 90 days dropped; malformed or duplicate rows discarded | `catalog.ts` | Edge cases 17, 18, 21 |
| Catalog cache per `from:to:category`, 6 h TTL; 3 s timeout; on failure, stale cache then static catalog; `source` reported | `catalog.ts`, `store.ts` | FR-16, FR-17 |
| Trip = leave home → return home, per user. One notification per country per trip. Non-EU destination means no notification | `trips.ts` | FR-2–4, US-1, edge cases 1–3, 7 |
| Notifications off means the trip is still recorded (home banner works) but nothing is sent | `trips.ts` | US-6.2, FR-7 |
| Deep link carries only the country; outbound URLs are built from catalog text + country name | `trips.ts`, `catalog.ts` | FR-6, US-5.3 |
| Feedback hides an item for that user's **current trip only** | `store.ts`, `recommendations.ts` | US-8 |
| Events accept a fixed field set; any other field gets a 400 | `/api/events` | FR-23 |

---

## 6. Running and verifying

```bash
npm install
npm run dev                       # http://localhost:3000
npm run smoke                     # second terminal; 58 end-to-end checks. NOTE: resets server state
BASE_URL=http://localhost:3123 npm run smoke   # against another port
```

Optional env:
- `OTHERWISE_TODAY=2026-10-17`: the "today" for the 90-day window and price ages. It is pinned, so the demo is stable.
- `OTHERWISE_CATALOG_MODE=fail|slow`: simulates a catalog outage or timeout to demo the FR-17 fallback (`source: "fallback"`).

Quick manual demo with curl (`-c`/`-b` keep the session cookie):
```bash
curl -c jar -XPOST localhost:3000/api/session -H 'content-type: application/json' -d '{"userId":"jonas"}'
curl -b jar -XPOST localhost:3000/api/location -H 'content-type: application/json' -d '{"countryCode":"PT"}'
curl -b jar localhost:3000/api/recommendations
```

---

## 7. Seed data (`data/seed/`) and real data (`data/real/`)

**Prices are real data now. See §12.** `data/seed/catalog.json` has been deleted. Users and transactions are still demo seed.

| File | Contents |
|---|---|
| `users.json` | The two demo profiles: id, name, home city and country, balances |
| `transactions.json` | `{ transactions: { aoife: [...62], jonas: [...34] } }`, keyed by user id. Each row has the same shape as `data/transactions.json`. Deliberately includes rows that must be ignored (rent, insurance, pharmacy, gambling, one electronics row outside the window). **Generated** once by a script; edit the JSON directly |
| `categories.json` | 14-category taxonomy with `kind` and `isDefault` |
| `categories.json` `priceLevel` | The Eurostat category that prices each everyday category (coffee uses restaurants, because the users' coffee is café spending) |
| `data/real/*.json` | **Generated** by `npm run fetch-data`. Do not edit by hand. See §12 |

**To add a user:** add a profile to `users.json` and a key with their transactions to `transactions.json`. Their home country must have prices in the catalog.
**To add a country:** add it to `COUNTRIES` in `lib/server/config.ts` and to `COUNTRIES` in `scripts/fetch-real-data.mjs` (with its OSM country name and currency), then run `npm run fetch-data`.

`data/account.json`, `data/transactions.json` and `data/recommendations.json` on `main` are **untouched**, and the current `/` and `/cheaper` pages still use them.

---

## 8. Merge notes for other branches

- **Purely additive.** New directories: `app/api/`, `lib/server/`, `data/seed/`, `scripts/`. The only edited file is `package.json` (adds `"smoke"`).
  Conflicts are only possible if your branch also creates `app/api/**` or edits the `scripts` block of `package.json`.
- Do **not** import `lib/server/*` from client components. Those modules use `import "server-only"`, and the build will fail if you do.
  Server components *may* call `buildRecommendations(profile, country)` directly, getting `profile` from `currentUser()` in `lib/server/session.ts`.
- The notification deep link points at **`/cheaper?country=XX`** (`RECOMMENDATIONS_PATH` in `lib/server/trips.ts`). If the frontend renames
  the route, change that one constant.
- **Frontend wiring is not done.** The frontend needs: a user picker that calls `POST /api/session`; `/` reading `/api/account` and `/api/transactions`;
  `/cheaper` reading `searchParams.country` and rendering `RecommendationsResponse`. The old `Category` type in `lib/types.ts` is a different shape,
  so this is a re-render, not a drop-in swap.

## 9. Known limitations (be honest about these in the report)

- Sign-in is a demo picker with no password. The cookie holds a plain user id, so anyone can sign in as either user. `/api/dev/reset` is open.
- State is in memory and lost on restart. Not safe with multiple server instances.
- The "catalog service" is in-process and reads the verified snapshot. Its fallback reads the same snapshot, so the fallback path is real but not a different data source.
- Real-data limits are listed in §12 (product coverage, estimated home prices, coarse personal-care index). No real push delivery, no quiet hours, no VPN/spoof detection.
- Notification copy and API messages are English only (the PRD wants EN/ES/DE).

## 10. Open decisions (need team input)

1. Should the old services data (gym, physio, dental on `main`) be folded into `data/seed/catalog.json`? Physio and dental are
   health-adjacent, so they hit PRD edge case 11.

## 11. Integration with `frontend` (branch `integration`)

`integration` = `backend` + `origin/frontend` (`790d2e8`, Linh Vu's passport-themed UI). Checked on 2026-10-17:

| Check | Result |
|---|---|
| `git merge origin/frontend` | **No conflicts.** The two branches touch disjoint files, apart from `package.json`, which auto-merged: frontend's name `otherwise` and new deps `@tabler/icons-react`, `lenis`, plus backend's `smoke` script |
| `npm install`, `eslint .` | Clean |
| `npm run build` | Passes. Pages `/` and `/cheaper` are static; all 14 `/api/*` routes are present |
| `npm run smoke` against `next start` | 58/58 |
| `GET /`, `GET /cheaper` | 200, `<title>OtherWise</title>`, no server errors |

### Wiring (done on `integration`, 2026-10-17)

The pages are connected to the backend. **No backend file and no component or CSS file was changed.** Only the two pages were edited,
and three glue files were added:

| File | Kind | What it does |
|---|---|---|
| `lib/live.ts` | new, server-only | Adapter: reads the signed-in user, trip, transactions and recommendations from `lib/server` and returns the frontend's own `Account`, `Transaction[]` and `Category[]` shapes from `lib/types.ts`. Calls `connection()` so pages never prerender backend state |
| `components/live/DemoBar.tsx` + `.module.css` | new, client | Traveller picker (`GET /api/users`, `POST`/`DELETE /api/session`), "Arrive in" + "Simulate arrival" (`GET /api/destinations`, `POST /api/location`), "Fly home", and the notification card that links to its `deepLink` (logs `notification_opened`). Calls `router.refresh()` after each action |
| `components/live/TrackView.tsx` | new, client | Posts one analytics event on mount (`recommendations_viewed` on `/cheaper`) |
| `app/page.tsx` | edited | Data loading only: `<Suspense>` around an async part that uses `lib/live.ts`; renders `DemoBar` above `Hero`. Benefits tile copy rewritten so it is true for backend data |
| `app/cheaper/page.tsx` | edited | Reads `?country=` (deep link) or the active trip; signed-out / at-home / outside-EU messages; footer shows the backend's disclosure, FX and fallback note |

Why server components don't fetch `/api/*`: the Next 16 docs (`02-guides/backend-for-frontend.md`) say to read data at its source
from server components, because calling your own route handlers fails at build time and adds a round trip. So reads go
through `lib/server` (the same functions the routes call), and **user actions go through the HTTP API**.

How backend fields map onto the old `Category` shape (in `lib/live.ts`):

| Frontend field | From backend |
|---|---|
| `savingPct` | `category.savingPct` |
| `homeAvgEur` / `localAvgEur` | mean of the shown products' `homePrice` / `localPrice` |
| `annualSavingEur` | `reason.spentEur × 365/90 × savingPct` (0 for general suggestions) |
| `purchasesPerYear` | `reason.transactionCount × 365/90` |
| `unit` | "From your own spending" or "General suggestion" |
| product `area` | product `description` |
| product `priceEur` / `priceHuf` | `localPrice.amount` / `localPrice.local.amount`, or EUR × 395 outside Hungary |
| product `vsLocalAvgPct` | 0. Catalog prices *are* typical local prices, so each shows "At {country} avg" |
| product `mapsQuery` | `"{product name} {country}"` |
| transaction `category` | the category's label, so `Payments` shows "Skincare & beauty" rather than the slug |

Verified: build and lint clean; `/` and `/cheaper` are partially prerendered (static shell plus per-user streamed content); signed-out, at-home,
Aoife in PT/HU, Jonas in PT and Jonas with `?country=JP` all render the right content over HTTP; 0 server errors; smoke 58/58.
**Not yet clicked in a real browser:** the DemoBar's interactions were checked through the API calls they make, not by clicking.

Known rough edges that need a **frontend** change (left alone on purpose):
- `Visa` always prints a forint line (`formatHuf`), so Portugal and Spain show a converted HUF price. Better to hide it when `fx` is null.
- `Visa`'s map pin always opens Google Maps. The backend's own `products[].url` (shop or maps search) is more accurate.
- `Hero`'s "Welcome to …" uses `currentCity`, which is the country name now (the backend has no city).

## 12. Real data (2026-10-17)

### Why a hybrid
Before any code was written, the candidate sources were measured. Free APIs cannot give the *same product* priced in both home and destination for our users:

| Source | Coverage for IE / DE / PT / HU / ES (prices since 2025) | Verdict |
|---|---|---|
| Open Prices, product level | 47 / 12,691 / 364 / 29 / 721. **No barcode priced in Ireland is priced in any destination**; DE shares 9 with ES and 4 with PT | Real and proven, but too sparse to compare the same product. Used for **destination shelf prices** |
| Eurostat `prc_ppp_ind`, category level | All 5 countries × every category we need, official, 2024 | Used for the **category comparison** and to **estimate home prices** |
| ECB rate (Frankfurter) vs Eurostat `ert_bil_eur_d` | 363.08 vs 363.6 HUF/EUR, a 0.14% gap | Agree, so used. The old hard-coded 395 was about 9% off |

aim-t chose the hybrid: Eurostat decides how much cheaper a **category** is; under it, real Open Prices products seen in the destination; their home price is
`observed` (same barcode verified at home) or `estimated` (local price × Eurostat sub-index ratio, e.g. bread, dairy, oils), and the response says which.

### Pipeline: `npm run fetch-data` → `scripts/fetch-real-data.mjs` → `data/real/`
PRD open questions 3 and 4 ("prebuilt catalog… preprocessing", "validation pipeline with gates and filters"). It runs in about 30 s. If any hard gate fails,
it writes **nothing** and exits non-zero, so the app keeps the last good snapshot. Files: `fx.json`, `price-levels.json`, `products.json`,
`verification-report.json` (counts per gate and rejected examples, per country).

| Gates | Rule |
|---|---|
| FX (hard) | ECB and Eurostat rates agree within 1% |
| Eurostat (hard) | Every needed category × country has a value; values within 20–300; year-on-year change ≤ 30% |
| Open Prices, per price | Has barcode and name · shop is in that country · currency matches the country · seen in the last 365 days · **not discounted** · backed by a **receipt or price-tag photo** · maps to an OtherWise category and isn't excluded (alcohol, baby milk, supplements, coffee drinks) · **coffee sold by weight (g)**, which catches mis-tagged milk and ready-to-drink coffee · €0.05–€200 |
| Open Prices, per product | Observations outside ½×–2× of the product's median are dropped; the price is the median of the rest; top 10 per sub-category by number of observations, then recency |

The 2026-10-17 run kept **190 products** (DE 80, ES 56, PT 42, IE 11, HU 1). The biggest rejection was discounted prices (757 in DE). A manual review then found
ready-to-drink coffee and a milk carton tagged as coffee capsules, which is why the unit gate exists. Spot checks matched each country's price levels
(Emmental 150 g €1.69 in Porto, milk €1.59 in Spain, brown bread €3.00 at Tesco Swords, whole milk €0.95 in Munich).

Category → Eurostat index: groceries `A010101` Food (products use their sub-index: bread `A01010101`, meat `…02`, fish `…03`, dairy `…04`, oils `…05`, fruit and veg `…06`) ·
coffee and dining out `A0111` Restaurants (coffee products use `A010102` Non-alcoholic beverages) · clothing `A0103` · transport `A010703` · telecom `A0108` ·
electronics `A010901` · skincare and personal care `A0112` Miscellaneous goods and services.

### What changed in the API (all additive, nothing removed)
- `categories[].savingPct` now = `round((1 − localIndex/homeIndex) × 100)` from Eurostat. A category needs **≥ 5%** (`MIN_CATEGORY_SAVING_PCT`).
- `categories[].comparison`: `{ savingPct, homeIndex, localIndex, index, indexLabel, year, source: "Eurostat prc_ppp_ind" }`.
- `categories[].typicalPurchase`: the user's own average purchase at home and the same spend here at the official ratio. `null` for general suggestions.
- **`categories[].products` may be empty.** Services and clothing have no shelf data. A personalised category still shows (its comparison and typical purchase are real);
  a general suggestion with no products is skipped.
- Products: `homePriceBasis: "observed" | "estimated"`, `evidence: { observations, shops, proofs, source: "Open Prices" }`, `url` = the product's public Open Prices page,
  `description` = quantity and shop, `priceUpdatedAt` = last verified sighting. For HU, `localPrice.local` is the real HUF shelf price.
- `GET /api/catalog` gains `comparison`. `fx.rate` is the verified ECB rate. `disclosure` credits Eurostat and Open Prices (ODbL attribution).

### What the demo shows now
| | Portugal | Spain | Hungary |
|---|---|---|---|
| Aoife (vs IE) | Groceries 10% (5 products), Coffee 42% (3 products), Dining 42%, Clothing 7%, Skincare 38% | Groceries 15%, Coffee 35%, Dining 35%, Clothing 9%, Skincare 35% | Groceries 16% (1 product), Coffee 44%, Dining 44%, Clothing 14%, Skincare 54% |
| Jonas (vs DE) | Clothing 8%, Dining 33%, Transport 32%, Personal care 18%, Mobile 15%. No products (all services) | similar, Mobile 30% | Transport 48%, Personal care 39% |

Jonas's top category, electronics, never shows: Eurostat has PT 2% dearer and ES only 1% cheaper than DE. The real data contradicts the old mock, which had ES electronics cheaper.

### Limitations (put these in the report)
- Product rows exist only for groceries, packaged coffee and a few toiletries, and are thin in IE (11) and HU (1). Restaurants, transport, mobile, haircuts, clothing and electronics are category-level only.
- Product home prices are mostly **estimates** (sub-index ratio), labelled as such. Eurostat indices are national annual averages (2024), not city- or shop-level.
- Skincare and personal care use Eurostat's broad "Miscellaneous goods and services" index, which also covers e.g. insurance.
- Crowdsourced prices come from a few shops per country, so they aren't a national average.
- **Frontend `Visa`** still prints "At {country} avg" for each product (`vsLocalAvgPct: 0` from `lib/live.ts`). With real shelf prices that line is no longer accurate.
  The component should show `description` (quantity and shop) and `homePriceBasis` instead. It also prints a forint line outside Hungary, and its map pin should open `url`.

## 13. Take-home and timeable only (2026-10-17)

**Decision (aim-t):** a lower price only helps if the traveller *chooses where to buy*. Every category now has `buyWhere`:

| `buyWhere` | Meaning | Categories | Recommended? |
|---|---|---|---|
| `take-home` | Buy here instead of at home (no customs limits within the EU for personal use) | groceries (shelf-stable), coffee (beans, ground, capsules), skincare & beauty, sneakers & clothing, electronics | ✅ |
| `timeable` | Needed anyway, can be done while here | personal care (haircuts) | ✅ |
| `local-only` | Bought here either way | `cafe`, dining-out, transport, telecom (and EU roam-like-at-home makes a local SIM rarely worth it) | ❌ never ranked or shown |

- `personalize.ts` skips local-only spend, so it can't push take-home categories down. Aoife's café visits are now `cafe` transactions, separate from `coffee` (bought to take home).
- The default set for thin history is take-home staples: groceries, coffee, skincare, clothing. A general suggestion still needs at least one real product.
- Long-stay users (Erasmus, foreign workers) would benefit from a separate "living costs here" view for transport, mobile and rent. That's not built.

**Data changes in `scripts/fetch-real-data.mjs`:**
- Groceries are limited to take-home shelf goods: olive and vegetable oils, canned fish, cheese, chocolate, honey, jam, pasta, rice, cereals, biscuits. Fresh produce, meat, milk and bread were dropped. New Eurostat sub-index `A01010199` (other food).
- **Official matched items (`data/real/reference-items.json`):** named items priced by both CSO Ireland (CPM12, monthly) and KSH Hungary (ara0004, 2025 annual average), matched by hand and normalised per unit.
  Kept: men's haircut (note: Ireland's figure is a dry cut), women's wash-cut-blow-dry, butter, sugar. Rejected after review: jam (KSH requires ≥50% fruit), spaghetti (egg pasta),
  cheese (trappist vs cheddar), flour (plain vs self-raising). Gates: both values published, CSO ≤ 550 days old, IE/HU ratio within 5×, and **at least one item must survive** (this
  caught a period-parsing bug that had silently rejected everything). Germany, Portugal and Spain publish no comparable averages, so only Ireland ↔ Hungary has these.
- For Aoife in Budapest: women's wash-cut-blow-dry €58.32 → €20.93 (64%), men's haircut €21.46 → €11.04 (49%), sugar 45%. Butter is left out because it's dearer in Hungary (€15.53 vs €9.34 per kg).

**API changes (additive):**
- `products[].evidence` is now either `{ source: "Open Prices", observations, shops, proofs }` or `{ source: "National statistics", home, local, note }`.
  The second kind has `homePriceBasis: "observed"`, `url` pointing to the destination's statistics table, and `description` = "per cut · national average". **Show `evidence.note` when present.**
- Official items come first in a category, then shelf products ranked by saving, with at most 2 per Eurostat sub-category and no duplicate names.
- Categories may now include general (`personalised: false`) take-home suggestions after the personal ones, e.g. "Coffee to take home" for Aoife in Portugal.

## 14. "vs local average" on each product (2026-10-17)

**Problem:** the frontend `Visa` card prints a "vs {country} avg" line for every product from `vsLocalAvgPct`. The adapter used to send `0` ("At {country} avg"),
which is false for a single shop's shelf price.

**Backend (done):** every product now has `localComparison`:

| Value | When | Honest wording |
|---|---|---|
| `{ basis: "national-average", pct: 0 }` | CSO/KSH official items | "National average" |
| `{ basis: "similar-products", pct, typeLabel, sampleSize, unit }` | Shelf products whose type has ≥5 distinct verified products in that country; per kg or L | "8% below the median of 14 canned tuna seen in Portugal (per kg)". Negative `pct` = above |
| `null` | No honest comparison: all of IE and HU, and thin types elsewhere | Say nothing about the average |

Coverage on the 2026-10-17 snapshot: 18 types in DE, 7 in ES, 4 in PT, 0 in IE and HU; 106 of 151 shown products have one.
These are medians of crowdsourced products (often branded or specialty), **not national averages**, so the wording must say "similar products seen here".

**Frontend (handoff to the frontend owner), `components/Visa.tsx`:**
1. Read `localComparison` instead of `vsLocalAvgPct`. Today `lib/live.ts` maps it to `vsLocalAvgPct` (`null` → `0`) only because `Visa` requires a number.
2. `null` → **hide** the average line and show where and when it was seen instead. The API already has `evidence.shops[0]`, `evidence.proofs` and `priceUpdatedAt`,
   e.g. "Lidl, Porto · receipt · Sep 2026". For official items show `evidence.note` when present (e.g. Ireland's haircut is a dry cut).
3. Word the line from `basis` (table above). Don't call a similar-products median an "average".
4. Also outstanding: show `homePriceBasis` ("estimated" vs "observed"); hide the forint line when `fx` is null; let the map pin open `url`.
Once `Visa` takes these, `lib/live.ts` can pass the fields straight through and drop `vsLocalAvgPct`.

## 15. Third user and electronics (2026-10-17)

**Saoirse Nolan** (`saoirse`, Dublin, IE): a gamer whose biggest spend is electronics (Currys, Smyths, Amazon.ie, GAME), plus Steam, PlayStation Store and Game Pass.
Those last three are the new `digital-games` category (`non-actionable`, never recommended).

### Research summary (what was checked before building)
| Source | Result |
|---|---|
| Digital games (Steam, Microsoft Store), tested live | **Identical prices** in all 5 countries (Steam €17.99/€59.99 everywhere) and tied to the account's country, so nothing to save |
| Apple (apple.de/.hu…) | ❌ Apple's terms forbid scraping **and "any similar or equivalent manual process"** to copy or monitor prices. Not used |
| Alza | ❌ No public or partner price API (supplier feeds only); also only HU and DE among our countries |
| eBay Browse API | Official and free, covers IE/DE/ES. aim-t's developer account is still under review |
| Keepa (Amazon) | Covers IE/DE/ES; €49/month, which the team can't pay |
| SerpApi (Google Shopping) | Free tier, needs a sign-up key. **Not yet evaluated.** Use only if it shows real shop offers |
| **Microsoft Store catalogue** | ✅ Used. Public, undocumented endpoint the store itself uses; official MSRP per market; hardware sold in IE, DE, PT, ES (not HU) |

### Microsoft list prices (`npm run fetch-data` → `data/real/brand-prices.json`)
Gates: new only (not refurbished) · **MSRP, never ListPrice** (ListPrice carries temporary sales; controllers looked cheaper in DE and ES only because of a 16–19 Oct sale) ·
currency matches the market · same SKU in ≥2 of our markets · **pre-VAT consistency**: each market's price ÷ (1 + VAT) must be within 10% of the others' median.
That gate removed the stale Xbox Series S/X listings (DE €599.99/€749.99 vs PT/ES €399.99/€549.99 on old 2020 SKUs) and a mouse priced €53 vs €79 in two markets.
It's a **soft** source: if the endpoint fails, the previous file is kept and the rest of the snapshot still refreshes.

Result (2026-10-17): 361 devices, 365 SKUs kept. From Ireland: **median 0% difference** in DE (174 items), ES (86), PT (86); largest gap 3.7%; **0 items ≥5% cheaper**.
Brands set one euro-area price and differ only by VAT.

### API (additive)
- `categories[].listPriceCheck` / catalog `listPriceCheck`: `{ brand, itemsCompared, medianPct, itemsCheaper, source }` or `null`.
- Brand SKUs appear as products only when ≥5% cheaper (`MIN_LIST_PRICE_SAVING_PCT`), with `evidence: { source: "Manufacturer list price", brand }`,
  `homePriceBasis: "observed"` and `url` = the local Microsoft Store page (checked: `microsoft.com/{locale}/d/_/{productId}` returns 200).
- **What Saoirse sees in Spain:** Electronics 8% cheaper (Eurostat: what shops charge) **and** "Microsoft's official prices for 86 identical items: median 0% difference",
  i.e. the saving comes from shop prices, not the brand. In Hungary, electronics doesn't show (only 4% cheaper).
- `lib/live.ts` puts the list-price sentence into the card's `source` line, so the current UI already shows it.

### To get product-level shop prices for electronics later
eBay (when approved) or a free SerpApi key. Either would plug in as another source behind `queryCatalog`, with the same gates (new, fixed price, seller located in that country, outlier and VAT consistency).

## 16. Database: Neon Postgres (2026-10-17)

### Setup (one-off per machine)
```bash
npm i -g neon && neon login             # Neon CLI, signed in
neon env pull                           # writes DATABASE_URL (+ _UNPOOLED, NEON_BRANCH) to .env.local; the repo is linked via .neon (git-ignored)
npm run db:migrate                      # create the 13 tables (drizzle/0000_init.sql)
npm run db:seed                         # 3 demo users + 134 transactions (idempotent)
npm run db:load-prices                  # data/real/*.json → a new current price snapshot (one transaction)
```
Neon project `wispy-field-62093327`, region **aws-us-east-2**. Two branches:

| Branch | Used by | Notes |
|---|---|---|
| `production` (default) | **Vercel / the live demo** | Set Vercel's `DATABASE_URL` to this branch's pooled URL; function region `iad1` |
| `dev` | **local development and `npm run smoke`** | Copy-on-write clone of production. `neon checkout dev` points `.env.local` at it. The `neon.ts` policy gives new branches a 7-day TTL (current `dev` expires 2026-10-24); `neon checkout dev --create` recreates it |

`neon checkout production` switches local back to production if ever needed. **`/api/dev/reset` refuses to run when `NEON_BRANCH` is `production` or `main`**, so a smoke run can't wipe the live demo, even with `OTHERWISE_ALLOW_RESET=true`.

### Driver (per the installed Neon agent skill and Neon's Vercel guide)
`pg` (node-postgres) Pool + `attachDatabasePool` from `@vercel/functions` + Drizzle (`drizzle-orm/node-postgres`), on the **pooled** `DATABASE_URL`.
Migrations and seed scripts use the **direct** `DATABASE_URL_UNPOOLED`. Connections request `sslmode=verify-full` explicitly.
The client is created lazily, so `next build` needs no database; every DB-reading route is dynamic.

### Schema (`lib/db/schema.ts`, 13 tables)
| Group | Tables | Integrity enforced by Postgres |
|---|---|---|
| People | `users`, `transactions` (index on user+date) | FK user → transactions |
| App state | `trips`, `trip_countries`, `notifications`, `consent`, `feedback`, `events` | **one active trip per user** (partial unique index); **one thumbs-down per item per trip**; FKs with cascade; `events` has no user/amount/merchant columns (FR-23) |
| Prices | `snapshots`, `price_levels`, `products`, `reference_items`, `brand_prices` | every price row belongs to a snapshot; **exactly one current snapshot** (partial unique index); a load inserts rows and flips "current" in **one transaction** |

`data/real/*.json` stays in git as the audit trail; the database holds the same snapshot, plus its verification report, in `snapshots.verification_report`.
The category taxonomy stays a config file. The catalog cache stays in memory (no user data).

### Runtime behaviour
- `store.ts` (trips, consent, feedback, events, notifications) and `seed.ts` (users, transactions) are DB-backed and async. Trip upserts and resets run in transactions.
- `pricedata.ts` reads the current snapshot (5-minute in-process cache). **If the database is unreachable, the catalog serves the bundled verified files** with `source: "fallback"`; it switches back to `live` automatically.
- Every route is wrapped in `handle()` (`lib/server/http.ts`): database unreachable → **`503 {error:{code:"unavailable"}}`**, anything else unexpected → `500 {error:{code:"internal"}}`. Details go to the server log only. `unstable_rethrow` is called first so Next's own signals (`cookies()`, `searchParams`, redirects) are never swallowed.
- `/api/dev/reset` clears app state only (never users, transactions or prices) and is **disabled in production** unless `OTHERWISE_ALLOW_RESET=true`.

### Verified on 2026-10-17 (first on `production` while it was empty, then on `dev`)
| Check | Result |
|---|---|
| `npm run build` | passes, with and without `DATABASE_URL` |
| `npm run smoke` | **78/78**, 0 server errors (~28 s; DB in us-east-2) |
| Restart persistence | killed the server mid-trip, started a new process: active trip, `notifications: false` consent, thumbs-down (coffee hidden) and the stored notification all survived; re-arriving gave `already-seen`, no duplicate notification |
| DB integrity | Postgres rejected: a second current snapshot, a second active trip, a transaction for an unknown user, a duplicate thumbs-down (all attempts rolled back) |
| DB unreachable | catalog answered from the bundled snapshot (`source: "fallback"`, 200); user endpoints return JSON `503 unavailable`; home page 200; back to `live` when the DB returned |
| Smoke on `dev` | **78/78**; an app write landed on `dev` (trips 1, events 1) while `production` stayed at 0, checked by branch id |
| Reset guard | with `NEON_BRANCH=production`, reset returns 403 and the smoke test stops with that message |

