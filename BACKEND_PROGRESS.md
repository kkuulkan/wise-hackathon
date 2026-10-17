# OtherWise Backend Progress: `backend` branch

> **For other Claude sessions and teammates:** this file is the source of truth for what the
> `backend` branch adds, why, and how to merge or build on it. Read it fully before merging
> `backend` into your branch or branching off it. It is updated at the end of every backend session.
> Owner: aim-t (backend). Product spec: [PRD_OtherWise.md](PRD_OtherWise.md). Hackathon brief and rubric: [BMExWise.txt](BMExWise.txt).

---

## 1. Status at a glance

| Field | Value |
|---|---|
| Branch | `backend` (cut from `main` at `fa2432c`). **`integration`** = `backend` + `origin/frontend` merged (see §11) |
| Last updated | 2026-10-17 |
| Phase | **Backend API complete for the comparison feature with two demo users. Frontend not wired yet.** |
| Breaking changes for frontend | **None.** No existing file under `app/` (pages), `components/`, `lib/data.ts`, `lib/types.ts`, `lib/format.ts` or `data/*.json` was modified. |
| New dependencies | None (`import "server-only"` is resolved by Next itself) |
| Env vars | None required. Optional: `OTHERWISE_TODAY`, `OTHERWISE_CATALOG_MODE` (see §6) |
| Verification | `npm run build` passes, `eslint` is clean, `npm run smoke` passes **58/58** against `next start` |

### Scope decisions (from aim-t, 2026-10-17)

- App name is **OtherWise**. The `frontend` branch already renamed the UI and package; `main` still says "Cheaper Here".
- **Comparison only.** No "Only here" / "Exclusive" section and no "Popular" picks. Both were removed from the backend.
- **Two demo users**, each with their own transaction history. Whoever is signed in sees recommendations from *their* spending,
  compared against *their* home country.

### Work log (newest first)

| Date | Change | Merge impact |
|---|---|---|
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

## 7. Seed data (`data/seed/`)

| File | Contents |
|---|---|
| `users.json` | The two demo profiles: id, name, home city and country, balances |
| `transactions.json` | `{ transactions: { aoife: [...62], jonas: [...34] } }`, keyed by user id. Each row has the same shape as `data/transactions.json`. Deliberately includes rows that must be ignored (rent, insurance, pharmacy, gambling, one electronics row outside the window). **Generated** once by a script; edit the JSON directly |
| `categories.json` | 14-category taxonomy with `kind` and `isDefault` |
| `catalog.json` | 35 products, each priced in EUR for IE, DE, PT, HU, ES. Deliberate traps: dearer-abroad electronics, age-restricted wine, stale-priced Levi's |

**To add a user:** add a profile to `users.json` and a key with their transactions to `transactions.json`. Their home country must have prices in the catalog.
**To add a country:** add it to `COUNTRIES` in `lib/server/config.ts` (plus `FX_PER_EUR` if it isn't on EUR) and add its code to each product's `prices`. No logic changes are needed.

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
- The "catalog service" is in-process. Its static fallback reads the same seed file, so the fallback path is real but not a different data source.
- Prices are mock EUR snapshots; FX is a fixed 395 HUF/EUR. No real push delivery, no quiet hours, no VPN/spoof detection.
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

**The halves run side by side but are not yet connected.** The frontend pages still read `data/account.json`, `data/transactions.json` and
`data/recommendations.json` through `lib/data.ts` (single user Aoife, services such as gym and physio, Budapest). The backend serves
two users and the product catalog from `data/seed/`. Nothing in the UI calls `/api/*` yet. Wiring needed:

1. A user picker (Aoife / Jonas) that calls `POST /api/session`.
2. A "Simulate arrival" control that calls `POST /api/location` and shows the returned `notification`.
3. `/` reading `/api/account` and `/api/transactions` instead of `lib/data.ts`.
4. `/cheaper` reading `searchParams.country` and rendering `RecommendationsResponse` (§4). `VisaSpread` and `Benefits` currently take the
   old `Category` type (`homeAvgEur`, `annualSavingEur`, places with districts). They need adapting to `categories[].products[]` with
   `homePrice` / `localPrice`. The backend has no `annualSavingEur`. If the UI wants a yearly figure, ask backend to add it.

