import { HISTORY_WINDOW_DAYS, RANK_WEIGHTS } from "./config";
import type { CategoryDef, RankedCategory, SeedTransaction } from "./types";

/**
 * Pure ranking logic: no I/O, no store. Everything it needs is passed in, so
 * the result for a given statement and day is fixed and checkable by hand.
 */

const DAY_MS = 86_400_000;

function dayNumber(isoDate: string): number {
  return Math.floor(Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`) / DAY_MS);
}

/**
 * FR-8 / FR-9: rank the user's everyday categories over the last 90 days.
 *
 * score = 0.5 × (spend / top spend) + 0.5 × (count / top count)
 *
 * Normalising each signal to the leader keeps a weekly €50 grocery shop and a
 * daily €4 coffee comparable. Where the purchase happened is ignored (US-3.4):
 * a coffee bought in Barcelona still says "this person buys coffee".
 *
 * Only everyday categories a traveller can act on enter the ranking:
 * sensitive and non-actionable ones never do (rent cannot crowd out
 * groceries, pharmacy spend is never surfaced), and neither do local-only
 * ones, because a cheaper metro ticket or café is bought either way.
 */
export function rankCategories(
  transactions: SeedTransaction[],
  categories: CategoryDef[],
  today: string,
): RankedCategory[] {
  const eligible = new Set(
    categories
      .filter((category) => category.kind === "everyday" && category.buyWhere !== "local-only")
      .map((category) => category.slug),
  );
  const end = dayNumber(today);
  const start = end - HISTORY_WINDOW_DAYS;

  const totals = new Map<string, { spentEur: number; transactionCount: number }>();

  for (const transaction of transactions) {
    const day = dayNumber(transaction.date);
    if (day <= start || day > end) continue;
    if (!eligible.has(transaction.category)) continue;
    // Refunds or reversals would arrive as negatives; they are not purchases.
    if (transaction.amountEur <= 0) continue;

    const total = totals.get(transaction.category) ?? { spentEur: 0, transactionCount: 0 };
    total.spentEur += transaction.amountEur;
    total.transactionCount += 1;
    totals.set(transaction.category, total);
  }

  if (totals.size === 0) return [];

  const maxSpend = Math.max(...[...totals.values()].map((total) => total.spentEur));
  const maxCount = Math.max(...[...totals.values()].map((total) => total.transactionCount));

  return [...totals.entries()]
    .map(([slug, total]) => ({
      slug,
      spentEur: Math.round(total.spentEur * 100) / 100,
      transactionCount: total.transactionCount,
      score:
        RANK_WEIGHTS.spend * (total.spentEur / maxSpend) +
        RANK_WEIGHTS.frequency * (total.transactionCount / maxCount),
    }))
    // Slug as tiebreak keeps the order deterministic.
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));
}
