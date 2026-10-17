import "server-only";

import priceLevelsJson from "@/data/real/price-levels.json";
import productsJson from "@/data/real/products.json";
import referenceItemsJson from "@/data/real/reference-items.json";
import categoriesJson from "@/data/seed/categories.json";
import transactionsJson from "@/data/seed/transactions.json";
import usersJson from "@/data/seed/users.json";

import type {
  CategoryDef,
  LocalTypeStat,
  PriceLevels,
  RealProduct,
  ReferenceItem,
  SeedTransaction,
} from "./types";

/**
 * Read-only data. Users and transactions are demo seed; price levels and
 * products are the verified real-data snapshot in data/real/, rebuilt by
 * `npm run fetch-data`. Mutable state (trips, consent, feedback) lives in
 * store.ts.
 */

export type Profile = {
  userId: string;
  holder: string;
  firstName: string;
  homeCity: string;
  homeCountry: string;
  balances: { value: number; currency: string; primary: boolean }[];
};

export function getProfiles(): Profile[] {
  return usersJson.users.map((user) => ({
    userId: user.id,
    holder: user.holder,
    firstName: user.holder.split(" ")[0],
    homeCity: user.homeCity,
    homeCountry: user.homeCountry,
    balances: user.balances,
  }));
}

export function getProfile(userId: string): Profile | undefined {
  return getProfiles().find((profile) => profile.userId === userId);
}

export function getSeedTransactions(userId: string): SeedTransaction[] {
  const byUser = transactionsJson.transactions as Record<string, SeedTransaction[]>;
  return byUser[userId] ?? [];
}

export function getCategoryDefs(): CategoryDef[] {
  return categoriesJson.categories as CategoryDef[];
}

export function getCategoryDef(slug: string): CategoryDef | undefined {
  return getCategoryDefs().find((category) => category.slug === slug);
}

/** Verified Open Prices products for every country. */
export function getRealProducts(): RealProduct[] {
  return productsJson.products as RealProduct[];
}

/** Median unit price per product type, per country (see LocalTypeStat). */
export function getLocalStats(): Record<string, Record<string, LocalTypeStat>> {
  return productsJson.localStats as Record<string, Record<string, LocalTypeStat>>;
}

/** Official national average prices matched across countries (CSO, KSH). */
export function getReferenceItems(): ReferenceItem[] {
  return referenceItemsJson.items as ReferenceItem[];
}

/** Eurostat price level indices (EU27 = 100) by category and country. */
export function getPriceLevels(): PriceLevels {
  return priceLevelsJson as PriceLevels;
}
