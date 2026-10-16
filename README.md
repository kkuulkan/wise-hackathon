# Cheaper Here

Spots the things you already buy that cost less where you are right now.

Built for BME HackNight & Day × Wise, **Max Ease** challenge.

## The idea

Wise users who spend across borders have no idea which of their routine purchases
are genuinely cheaper where they currently are. A haircut, a dental cleaning or a
gym month can be half price two countries over, and nobody researches that per
purchase.

Cheaper Here reads what you actually buy, notices you have arrived somewhere new,
and tells you which of your own recurring purchases cost less here, with places to
go.

## The comparison model

Two different numbers do two different jobs. Conflating them is the easiest way to
make this product useless.

- A **category** appears because it is cheaper in Budapest than in your home city.
  This answers *why am I being told this*. The home side of that comparison comes
  from **your own transactions** — you paid €32 for a haircut in Dublin, so that is
  the baseline. No external dataset needed for your side.
- A **place** inside a category shows its price against the **Budapest average**.
  This answers *is this specific place a good deal*. It is why the app can tell you
  that the coffee shop you already visit is 12% above the local average.

Categories qualify at a minimum saving of 15% and are ranked by **money at stake**
(`saving × your purchases per year`), not headline percentage. A 51% saving on a
monthly gym beats a 57% saving on glasses you buy every two years.

## Screens

| Route | What it is |
|---|---|
| `/` | Account home. Balances, recent activity, and the arrival notification that lands after 1.2s. |
| `/cheaper` | The six qualifying categories, each with places, prices against the local average, and map links. |

## Run it

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
```

No environment variables, no API keys, no database. Both routes are statically
prerendered, so the app works offline apart from the outbound map links.

## Data

All data is mock, in `data/`:

- `account.json` — holder, home and current location, balances.
- `transactions.json` — 25 entries shaped like a Wise balance statement.
- `recommendations.json` — seeded price levels for the two cities, with places.

Derived values are **not** in the JSON. `savingPct`, `annualSavingEur` and each
place's `vsLocalAvgPct` are computed in [`lib/data.ts`](lib/data.ts), so the ranking
logic is inspectable rather than hardcoded.

### Honesty notes

- Local price levels are a **seeded snapshot**, not live data. Every category carries
  a `source` string describing its basis.
- Place names are **illustrative**. Each map link searches the *category within a
  district* rather than naming a specific business, so no invented price is attached
  to a real shop — and the link still lands somewhere useful.
- `transactions.json` matches the Wise balance-statement response shape. Swapping in
  the real API is a change to one function in `lib/data.ts`.

## Architecture

```
app/
  page.tsx          Account home (server component)
  cheaper/page.tsx  Cheaper-here list (server component)
components/         BalanceCard, TransactionList, ArrivalSheet, CategoryList, CategoryCard
lib/
  data.ts           Loaders, qualifying filter, ranking, maps URLs
  format.ts         Currency, percent and date formatting
  types.ts          Shared types
data/               Mock JSON
```

Next.js 16 App Router, TypeScript, CSS Modules, GSAP for two motion moments. The
only client components are the arrival sheet and the category list, both because
they animate.

Day grouping on the account screen is anchored to the newest transaction date rather
than the system clock, so "Today" does not drift if the demo runs past midnight.

## Design

Direction: **Passport Stamp** — warm editorial travel-document look, chosen because
the visual language carries the product insight. The arrival sheet *lands* like a
stamp rather than sliding; category cards turn up like pages. Tokens are in
[`app/globals.css`](app/globals.css); the rules they follow are in
`.claude/skills/frontend-style-guideline/SKILL.md`.

Reduced motion is respected in both animated components, and skipping the tween
leaves content readable rather than invisible.

## AI usage

Required disclosure for the report. Keep this current as work continues.

| Tool | Used for | Team's own work and verification |
|---|---|---|
| Claude Code | Project scaffolding, component and CSS implementation, mock data drafting, this README | Team set the comparison model, the narrow category taxonomy, the own-transaction baseline insight, the ranking formula and the visual direction. Ranking output and all figures verified by hand against the JSON. |

No AI runs inside the product at this scope — there is no model call at request time.
The categorization and price lookup that would need one are described in the project
plan as the next step.
