import "server-only";

import accountJson from "@/data/account.json";
import catalogJson from "@/data/seed/catalog.json";
import categoriesJson from "@/data/seed/categories.json";
import transactionsJson from "@/data/seed/transactions.json";

import type {
  CatalogExclusive,
  CatalogProduct,
  CategoryDef,
  SeedTransaction,
} from "./types";

/**
 * Read-only seed data. Mutable state (trips, consent, feedback) lives in
 * store.ts; this file is what a real deployment would replace with the
 * profile, transaction and catalog services.
 */

export type Profile = {
  userId: string;
  holder: string;
  firstName: string;
  homeCountry: string;
  balances: { value: number; currency: string; primary: boolean }[];
};

/**
 * The demo account. Reuses data/account.json so the frontend and backend agree
 * on who the user is. Its currentCountry fields are ignored: location now
 * comes from POST /api/location.
 */
export function getProfile(): Profile {
  return {
    userId: "demo-user",
    holder: accountJson.holder,
    firstName: accountJson.holder.split(" ")[0],
    homeCountry: accountJson.homeCountryCode,
    balances: accountJson.balances,
  };
}

export function getSeedTransactions(): SeedTransaction[] {
  return transactionsJson.transactions as SeedTransaction[];
}

export function getCategoryDefs(): CategoryDef[] {
  return categoriesJson.categories as CategoryDef[];
}

export function getCategoryDef(slug: string): CategoryDef | undefined {
  return getCategoryDefs().find((category) => category.slug === slug);
}

export function getCatalogProducts(): CatalogProduct[] {
  return catalogJson.products as CatalogProduct[];
}

export function getCatalogExclusives(): CatalogExclusive[] {
  return catalogJson.exclusives as CatalogExclusive[];
}
