/**
 * OtherWise database schema (Neon Postgres, via Drizzle).
 *
 * Three groups:
 *   people      users and their transactions: what a bank's own systems hold
 *   app state   trips, notifications, consent, feedback, events: written by the API
 *   prices      verified real-data snapshots loaded from data/real/ by
 *               `npm run db:load-prices`. Every price row belongs to a snapshot;
 *               exactly one snapshot is current, so a bad load never goes live.
 *
 * Plain module (no "server-only") so drizzle-kit can read it to generate migrations.
 */
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

// People

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  holder: text("holder").notNull(),
  homeCity: text("home_city").notNull(),
  homeCountry: text("home_country").notNull(),
  balances: jsonb("balances").$type<{ value: number; currency: string; primary: boolean }[]>().notNull(),
  createdAt: createdAt(),
});

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    merchant: text("merchant").notNull(),
    category: text("category").notNull(),
    city: text("city").notNull(),
    countryCode: text("country_code").notNull(),
    amount: money("amount").notNull(),
    currency: text("currency").notNull(),
    amountEur: money("amount_eur").notNull(),
  },
  (table) => [index("transactions_user_date_idx").on(table.userId, table.date)],
);

// App state

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    currentCountry: text("current_country").notNull(),
  },
  // A user is on at most one trip at a time; the database enforces it.
  (table) => [uniqueIndex("trips_one_active_per_user").on(table.userId).where(sql`${table.endedAt} is null`)],
);

export const tripCountries = pgTable(
  "trip_countries",
  {
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    country: text("country").notNull(),
    arrivedAt: timestamp("arrived_at", { withTimezone: true }).notNull(),
    signal: text("signal").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.tripId, table.country] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    country: text("country").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    deepLink: text("deep_link").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_idx").on(table.userId, table.createdAt)],
);

/** One row per user. No row means the PRD default: opted in (open question 5). */
export const consent = pgTable("consent", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  personalisation: boolean("personalisation").notNull(),
  notifications: boolean("notifications").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

export const feedback = pgTable(
  "feedback",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    itemId: text("item_id").notNull(),
    country: text("country").notNull(),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("feedback_once_per_trip").on(table.userId, table.tripId, table.kind, table.itemId)],
);

/** FR-23: deliberately no user id, amount or merchant column. */
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  country: text("country"),
  category: text("category"),
  productId: text("product_id"),
  at: timestamp("at", { withTimezone: true }).notNull(),
});

// Prices (verified snapshots)

export const snapshots = pgTable(
  "snapshots",
  {
  id: serial("id").primaryKey(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  loadedAt: createdAt(),
  isCurrent: boolean("is_current").notNull().default(false),
  /** ECB rate cross-checked with Eurostat: { base, perEur, asOf }. */
  fx: jsonb("fx").$type<{ perEur: Record<string, number>; asOf: string }>().notNull(),
  priceLevelYear: text("price_level_year").notNull(),
  /** Per country, per product type: median unit price from ≥5 verified products. */
  localStats: jsonb("local_stats").notNull(),
  /** The fetch script's verification-report.json, kept with the data it vouches for. */
  verificationReport: jsonb("verification_report").notNull(),
  },
  // Exactly one snapshot can be live; switching is one atomic batch.
  (table) => [uniqueIndex("snapshots_one_current").on(table.isCurrent).where(sql`${table.isCurrent}`)],
);

export const priceLevels = pgTable(
  "price_levels",
  {
    snapshotId: integer("snapshot_id").notNull().references(() => snapshots.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    label: text("label").notNull(),
    country: text("country").notNull(),
    value: doublePrecision("value").notNull(),
  },
  (table) => [primaryKey({ columns: [table.snapshotId, table.code, table.country] })],
);

export const products = pgTable(
  "products",
  {
    snapshotId: integer("snapshot_id").notNull().references(() => snapshots.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    code: text("code").notNull(),
    country: text("country").notNull(),
    category: text("category").notNull(),
    priceLevel: text("price_level").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    quantity: text("quantity"),
    price: money("price").notNull(),
    currency: text("currency").notNull(),
    priceEur: money("price_eur").notNull(),
    type: text("type"),
    unit: text("unit"),
    unitPriceEur: money("unit_price_eur"),
    observations: integer("observations").notNull(),
    firstSeen: date("first_seen").notNull(),
    lastSeen: date("last_seen").notNull(),
    shops: jsonb("shops").$type<string[]>().notNull(),
    proofs: jsonb("proofs").$type<string[]>().notNull(),
    url: text("url").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.snapshotId, table.id] }),
    index("products_lookup_idx").on(table.snapshotId, table.country, table.category),
  ],
);

export const referenceItems = pgTable(
  "reference_items",
  {
    snapshotId: integer("snapshot_id").notNull().references(() => snapshots.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    category: text("category").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    note: text("note"),
    /** Per country: { price, currency, priceEur, period, source, url }. */
    prices: jsonb("prices").notNull(),
  },
  (table) => [primaryKey({ columns: [table.snapshotId, table.id] })],
);

export const brandPrices = pgTable(
  "brand_prices",
  {
    snapshotId: integer("snapshot_id").notNull().references(() => snapshots.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    category: text("category").notNull(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    /** Per country: { price, currency, priceEur, url }. */
    prices: jsonb("prices").notNull(),
  },
  (table) => [primaryKey({ columns: [table.snapshotId, table.id] })],
);
