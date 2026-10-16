import accountJson from "@/data/account.json";
import transactionsJson from "@/data/transactions.json";
import recommendationsJson from "@/data/recommendations.json";

import type {
  Account,
  Category,
  Product,
  RawCategory,
  RecommendationData,
  Transaction,
} from "./types";

/**
 * A category has to beat home by at least this much to be worth interrupting
 * someone about. Below it, the advice is noise.
 */
export const MIN_SAVING_PCT = 15;

export function getAccount(): Account {
  return accountJson as Account;
}

export function getTransactions(): Transaction[] {
  return transactionsJson.transactions as Transaction[];
}

export function getFxRate() {
  return transactionsJson.fxRate;
}

function toProduct(raw: RawCategory["products"][number], localAvgEur: number): Product {
  return {
    ...raw,
    // Positive means below the local average, which is the good direction.
    vsLocalAvgPct: ((localAvgEur - raw.priceEur) / localAvgEur) * 100,
  };
}

function toCategory(raw: RawCategory): Category {
  const savingPct = ((raw.homeAvgEur - raw.localAvgEur) / raw.homeAvgEur) * 100;

  return {
    ...raw,
    savingPct,
    // What they would actually keep over a year, at their own frequency.
    annualSavingEur: (raw.homeAvgEur - raw.localAvgEur) * raw.purchasesPerYear,
    products: raw.products
      .map((product) => toProduct(product, raw.localAvgEur))
      .sort((a, b) => a.priceEur - b.priceEur),
  };
}

/**
 * Categories that are meaningfully cheaper here, ranked by the money actually
 * at stake rather than by headline percentage. A 51% saving on a monthly gym
 * beats a 57% saving on glasses bought once every two years.
 */
export function getCategories(): Category[] {
  const data = recommendationsJson as RecommendationData;

  return data.categories
    .map(toCategory)
    .filter((category) => category.savingPct >= MIN_SAVING_PCT)
    .sort((a, b) => b.annualSavingEur - a.annualSavingEur);
}

export function getRecommendationMeta() {
  const data = recommendationsJson as RecommendationData;
  return {
    city: data.city,
    comparedTo: data.comparedTo,
    fxRate: data.fxRate,
  };
}

/** Total yearly saving if they switched every qualifying category. */
export function getTotalAnnualSaving(categories: Category[]): number {
  return categories.reduce((total, category) => total + category.annualSavingEur, 0);
}

const EXTRA_LABELS: Record<string, string> = {
  other: "Other",
};

/** Display name for a category slug, drawn from the seed data. */
export function categoryLabel(slug: string): string {
  const data = recommendationsJson as RecommendationData;
  const match = data.categories.find((category) => category.slug === slug);
  return match?.label ?? EXTRA_LABELS[slug] ?? slug;
}

export function mapsUrl(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
