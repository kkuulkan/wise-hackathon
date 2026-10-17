import type { Transaction } from "./types";

/**
 * Balance over time, derived rather than invented.
 *
 * Transactions arrive newest first. Walking back through them, the balance
 * before each payment was higher by its amount, so the series is the current
 * balance with each spend added back on. Returned oldest to newest.
 */
export function balanceSeries(
  transactions: Transaction[],
  currentEur: number,
  points = 30,
): number[] {
  const series = [currentEur];
  let running = currentEur;

  for (const transaction of transactions.slice(0, points - 1)) {
    running += transaction.amountEur;
    series.unshift(running);
  }

  return series;
}

export type SpendSlice = {
  category: string;
  totalEur: number;
  /** Share of the window's spend, 0 to 1. */
  share: number;
};

const DAY_MS = 86_400_000;

/**
 * Spend in the last `days`, grouped by category, largest first.
 *
 * The window ends at the newest transaction rather than the system clock, so
 * the figures stay put if the demo runs past midnight.
 */
export function recentSpend(
  transactions: Transaction[],
  days = 7,
): { totalEur: number; slices: SpendSlice[] } {
  if (transactions.length === 0) return { totalEur: 0, slices: [] };

  const newest = new Date(`${transactions[0].date}T00:00:00Z`).getTime();
  const cutoff = newest - (days - 1) * DAY_MS;

  const byCategory = new Map<string, number>();
  let totalEur = 0;

  for (const transaction of transactions) {
    const at = new Date(`${transaction.date}T00:00:00Z`).getTime();
    if (at < cutoff) continue;

    byCategory.set(
      transaction.category,
      (byCategory.get(transaction.category) ?? 0) + transaction.amountEur,
    );
    totalEur += transaction.amountEur;
  }

  const slices = [...byCategory.entries()]
    .map(([category, total]) => ({
      category,
      totalEur: total,
      share: totalEur === 0 ? 0 : total / totalEur,
    }))
    .sort((a, b) => b.totalEur - a.totalEur);

  return { totalEur, slices };
}
