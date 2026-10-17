import "server-only";

import catalogJson from "@/data/seed/catalog.json";
import categoriesJson from "@/data/seed/categories.json";
import transactionsJson from "@/data/seed/transactions.json";
import usersJson from "@/data/seed/users.json";

import type { CatalogProduct, CategoryDef, SeedTransaction } from "./types";

/**
 * Read-only seed data. Mutable state (trips, consent, feedback) lives in
 * store.ts; this file is what a real deployment would replace with the
 * profile, transaction and catalog services.
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

export function getCatalogProducts(): CatalogProduct[] {
  return catalogJson.products as CatalogProduct[];
}
