# OtherWise

Spots the things you already buy that cost less where you are right now.

Built for BME HackNight & Day × Wise, **Max Ease** challenge.

## The idea

Wise users who spend across borders have no idea which of their routine purchases
are genuinely cheaper where they currently are. A haircut, a jar of coffee or a
bottle of olive oil can be half price two countries over, and nobody researches
that per purchase.

OtherWise reads what a signed-in traveller actually buys, notices they have
arrived in another EU country, and tells them which of *their own* categories cost
less here — with real prices and a link to the source.

## What a recommendation has to earn

Two different numbers do two different jobs. Conflating them is the easiest way to
make this product useless.

- A **category** appears because it is officially cheaper in the destination than
  in the traveller's **home country**. That comparison is
  [Eurostat `prc_ppp_ind`](https://ec.europa.eu/eurostat) price levels, not our
  own arithmetic, and a category needs at least **5%**
  (`MIN_CATEGORY_SAVING_PCT`).
- A **product** under it is a real observed price in the destination, against a
  home price that is either `observed` (the same barcode verified at home) or
  `estimated` (local price × Eurostat sub-index ratio). The response always says
  which, so an estimate is never shown as a fact.

Which categories are considered at all comes from the traveller's own 90 days of
transactions, ranked by

```
score = 0.5 × (spend / top spend) + 0.5 × (count / top count)
```

so a cheap weekly habit can outrank one expensive purchase. At most **5**
categories are shown.

Two filters matter more than the ranking:

- **Only what you can choose where to buy.** Each category is `take-home`
  (groceries, coffee, skincare, clothing, electronics), `timeable` (a haircut you
  need anyway) or `local-only`. Local-only spend — cafés, restaurants, transport,
  mobile data — is never recommended and never allowed to crowd out a category
  you could act on. A cheaper bus fare is not a saving if you were going to be on
  that bus regardless.
- **Never surface what shouldn't be surfaced.** Pharmacy and gambling are
  `sensitive`; rent, insurance and digital games are `non-actionable`. Neither
  kind is ever ranked or shown.

A category you actually spend in is kept even with no product rows — its
official comparison is still real, and services simply have no shelf data. A
*general* suggestion with no products has nothing to show, so it is dropped and
the next one moves up: a filled slot always carries something true.

## Screens

| Route | What it is |
|---|---|
| `/` | The account. Cover, balance, recent payments, the consent gate, and the arrival ticket that appears when the traveller lands somewhere cheaper. |
| `/cheaper` | The visa spread: each qualifying category as a sticker with its saving, products, prices and source. |

Both pages are **partially prerendered** — a static shell with the per-traveller
content streamed in, since every number depends on who is signed in.

There are 13 route handlers under `app/api/`. The full contract is in
[BACKEND_PROGRESS.md §4](BACKEND_PROGRESS.md).

## Run it

Needs Node 20+ and a Postgres database (Neon).

```bash
npm install

npm i -g neon && neon login   # one-off
neon env pull                 # writes DATABASE_URL + DATABASE_URL_UNPOOLED to .env.local
neon checkout dev             # work on the dev branch, not production

npm run db:migrate            # create the 13 tables
npm run db:seed               # 3 demo travellers + 138 transactions (idempotent)
npm run db:load-prices        # data/real/*.json -> a current price snapshot

npm run dev                   # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js dev server, production build, production server |
| `npm run lint` | ESLint |
| `npm run smoke` | End-to-end checks against a running server. **Resets app state**, so point it at the `dev` database branch |
| `npm run fetch-data` | Rebuilds `data/real/` from the live sources through the verification gates (~30s) |
| `npm run db:migrate` / `db:seed` / `db:load-prices` | Schema, demo travellers, price snapshot |

`npm run build` works without a database — the client is created lazily and every
DB-reading route is dynamic. At runtime, if the database is unreachable the
catalog falls back to the bundled snapshot in `data/real/` (`source: "fallback"`)
and user routes return a clean JSON `503`.

Optional env: `OTHERWISE_TODAY` pins "today" so the demo is stable,
`OTHERWISE_CATALOG_MODE=fail|slow` demonstrates the outage fallback,
`OTHERWISE_ALLOW_RESET` permits `/api/dev/reset` outside a dev branch.

Caching note: after `db:seed` or `db:load-prices`, restart the server. The price
snapshot and the traveller data are cached (`cacheLife` of days and hours); trips
and consent deliberately are not.

## Data

Prices are **real**. Only the travellers are invented.

| Path | Contents |
|---|---|
| `data/seed/users.json` | 3 fictional travellers: Aoife (Dublin), Jonas (Berlin), Saoirse (Dublin) |
| `data/seed/transactions.json` | 138 transactions keyed by traveller, including rows that *must* be ignored (rent, insurance, pharmacy, gambling) |
| `data/seed/categories.json` | The 16-category taxonomy with `kind` and `buyWhere` |
| `data/real/*.json` | **Generated** by `npm run fetch-data`. Do not edit by hand |

Sources behind `data/real/`:

| File | Source |
|---|---|
| `price-levels.json` | Eurostat `prc_ppp_ind`, 2024 — the category comparison |
| `products.json` | 151 shelf prices from Open Prices / Open Food Facts (ODbL), each backed by a receipt or price-tag photo |
| `reference-items.json` | 4 items priced officially by both CSO Ireland and KSH Hungary, matched by hand |
| `brand-prices.json` | 365 Microsoft Store SKUs at official MSRP per market |
| `fx.json` | ECB reference rate (363.08 HUF/EUR), cross-checked against Eurostat `ert_bil_eur_d` |
| `verification-report.json` | Per-gate counts and rejected examples, per country |

The pipeline is gated, and **writes nothing if a hard gate fails**, so a bad
fetch can never replace a good snapshot. Prices must carry a barcode, come from a
shop in that country in the right currency, be seen within 365 days, be
undiscounted, and sit within ½×–2× of the product's median. The gates are
described in [BACKEND_PROGRESS.md §12](BACKEND_PROGRESS.md); the snapshot itself
is stored in Postgres alongside its verification report, with the JSON kept in git
as the audit trail.

### Honesty notes

- **Products exist only where real data does.** Groceries, packaged coffee and a
  few toiletries. Restaurants, transport, mobile, haircuts, clothing and
  electronics are category-level only, and coverage is thin in Ireland (9
  products) and Hungary (1).
- **Most product home prices are estimates**, derived from the Eurostat
  sub-index ratio and labelled `homePriceBasis: "estimated"`.
- **Eurostat indices are national annual averages** (2024), not city- or
  shop-level. Skincare uses the broad "Miscellaneous goods and services" index.
- **Crowdsourced prices are not national averages.** Where ≥5 similar verified
  products exist in a country, `localComparison` says so as "below the median of
  N similar products seen here" — never as "the average". Where that isn't
  honest, it is `null`.
- **The data is allowed to kill a feature.** Jonas's top category is electronics,
  and it never shows: Eurostat has Portugal 2% dearer and Spain only 1% cheaper
  than Germany. Microsoft's own list prices say the same thing from the other
  direction — from Ireland, a median 0% difference across 86 identical SKUs in
  Spain, because brands set one euro-area price and differ only by VAT. Our
  original mock had Spanish electronics cheaper. The mock lost.
- Sign-in is a demo picker with no password; the cookie holds a plain traveller id.
- No real push delivery, no quiet hours, no VPN detection. Copy is English only.

## Architecture

```
app/
  page.tsx            Account (partial prerender)
  cheaper/page.tsx    Visa spread (partial prerender)
  api/**/route.ts     13 handlers: thin — auth, validate, call lib/server, JSON
components/           Cover, Hero, ArrivalTicket, VisaSpread, Visa, TitleFlight, Sparkline, CountUp
components/live/      Client pieces that talk to the API: DemoBar, ConsentGate, ConsentPanel, CountryPicker, FlightSpinner, TrackView
lib/
  live.ts             Server-only adapter: lib/server shapes -> the frontend's types
  server/             recommendations, personalize (pure ranking), catalog, trips, store, pricedata, session, config
  db/schema.ts        13 tables (Drizzle)
  balance.ts ink.ts format.ts flag.ts ticket.ts scroller.ts
data/seed/            Demo travellers and taxonomy
data/real/            Verified price snapshot
drizzle/              Migration
scripts/              fetch-real-data.mjs, db-seed.mjs, smoke.mjs
```

Next.js 16 App Router with Cache Components, TypeScript, CSS Modules, Neon
Postgres via Drizzle and `pg`, GSAP for motion, Lenis for smooth scroll.

Two deliberate boundaries:

- **Server components read at the source, not over HTTP.** Pages call
  `lib/server` through `lib/live.ts`; only user *actions* go through
  `app/api/`. Calling your own route handlers from a server component fails at
  build time and adds a round trip.
- **Privacy by type.** `queryCatalog({ category, from, to })` has no parameter
  that *could* hold user data, and `GET /api/catalog` rejects any extra query
  parameter with a 400. The `events` table has no user, amount or merchant
  column.

Postgres enforces what the app would otherwise have to remember: one active trip
per traveller, one thumbs-down per item per trip, exactly one current price
snapshot — each as a partial unique index, so a bug becomes a rejected write
rather than bad data.

## Design

Direction: **The Booklet**. The whole app is a passport, not a page that
references one. Screen 1 is the data page. Screen 2 is the visa spread, where
each category is a visa sticker with the saving stamped over it, and a plane
crosses the destination's name as the spread turns.

Two colours, mapped the way a passport is built: navy `#0f2c5c` is the cover the
booklet sits on, beige `#f0f0b6` is the page you read. Raised items on the page
take a lighter beige, security tints a darker one. Emphasis comes from inversion
and weight rather than extra hues; the only other inks are the per-category ones
in [`lib/ink.ts`](lib/ink.ts). Tokens are in
[`app/globals.css`](app/globals.css).

Motion carries the arrival: the cover opens, the ticket slides in when a trip
starts, and the same plane that covers the account on the way out parks over the
destination on the way in. Reduced motion is respected throughout.

The covering elements — the booklet cover and the turning page — are
`display: none` by default, and only enabled once the script is alive and motion
is allowed, with a safety timeout behind that. Gating in CSS rather than in
markup keeps the server and client output identical, and means a script failure
uncovers the content rather than hiding the screen.

Day grouping on the account screen is anchored to the newest transaction date
rather than the system clock, so "Today" does not drift if the demo runs past
midnight.

## AI usage

Required disclosure for the report. Keep this current as work continues.

| Tool | Used for | Team's own work and verification |
|---|---|---|
| Claude Code | Scaffolding, components and CSS, route handlers, the Drizzle schema, the data-fetch pipeline, this README | Team set the comparison model, the category taxonomy, the take-home/local-only distinction, the ranking formula and the visual direction. Every data source was chosen and measured by hand first (see BACKEND_PROGRESS.md §12, §15), including rejecting Apple, Alza and Keepa for licence, access or cost reasons. Gate thresholds and spot-checked prices verified against the published sources. |

**No AI runs inside the product.** There is no model call at request time. The
categorisation and price matching that would benefit from one are described as
the next step.

## Further reading

| Doc | What it is |
|---|---|
| [PRD_OtherWise.md](PRD_OtherWise.md) | Product spec: user stories, functional requirements, edge cases |
| [BACKEND_PROGRESS.md](BACKEND_PROGRESS.md) | Source of truth for the API contract, business rules, data pipeline, database and caching |
| [BMExWise.txt](BMExWise.txt) | The hackathon brief and rubric |
