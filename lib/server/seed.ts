import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import categoriesJson from "@/data/seed/categories.json";

import { db, schema } from "./db";
import type { CategoryDef, SeedTransaction } from "./types";

/**
 * Read-only data about people: users and their transactions come from the
 * database (loaded by `npm run db:seed`), standing in for the bank's own
 * profile and transaction services. The category taxonomy is configuration,
 * so it stays a file. Prices live in pricedata.ts; mutable state in store.ts.
 */

export type Profile = {
  userId: string;
  holder: string;
  firstName: string;
  homeCity: string;
  homeCountry: string;
  balances: { value: number; currency: string; primary: boolean }[];
};

function toProfile(row: typeof schema.users.$inferSelect): Profile {
  return {
    userId: row.id,
    holder: row.holder,
    firstName: row.holder.split(" ")[0],
    homeCity: row.homeCity,
    homeCountry: row.homeCountry,
    balances: row.balances,
  };
}

export async function getProfiles(): Promise<Profile[]> {
  const rows = await db().select().from(schema.users).orderBy(asc(schema.users.id));
  return rows.map(toProfile);
}

export async function getProfile(userId: string): Promise<Profile | undefined> {
  const [row] = await db().select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row ? toProfile(row) : undefined;
}

/** The user's statement, newest first. */
export async function getTransactions(userId: string): Promise<SeedTransaction[]> {
  const rows = await db()
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.userId, userId))
    .orderBy(desc(schema.transactions.date), asc(schema.transactions.id));

  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    merchant: row.merchant,
    category: row.category,
    city: row.city,
    countryCode: row.countryCode,
    amount: { value: row.amount, currency: row.currency },
    amountEur: row.amountEur,
  }));
}

export function getCategoryDefs(): CategoryDef[] {
  return categoriesJson.categories as CategoryDef[];
}

export function getCategoryDef(slug: string): CategoryDef | undefined {
  return getCategoryDefs().find((category) => category.slug === slug);
}
