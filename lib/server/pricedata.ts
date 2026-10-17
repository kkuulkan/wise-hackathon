import "server-only";

import { desc, eq } from "drizzle-orm";

import brandPricesJson from "@/data/real/brand-prices.json";
import fxJson from "@/data/real/fx.json";
import priceLevelsJson from "@/data/real/price-levels.json";
import productsJson from "@/data/real/products.json";
import referenceItemsJson from "@/data/real/reference-items.json";

import { db, schema } from "./db";
import type { BrandListItem, LocalTypeStat, PriceLevels, RealProduct, ReferenceItem } from "./types";

/**
 * Everything the catalog needs to price a comparison, from one verified
 * snapshot. Read from the database's current snapshot; the same snapshot's
 * files are bundled with the app as the fallback (FR-17) when the database is
 * unreachable.
 */
export type PriceData = {
  /** Database snapshot id, or "bundled" for the files shipped with the app. */
  snapshot: number | "bundled";
  fetchedAt: string;
  fx: { perEur: Record<string, number>; asOf: string };
  levels: PriceLevels;
  products: RealProduct[];
  localStats: Record<string, Record<string, LocalTypeStat>>;
  referenceItems: ReferenceItem[];
  brandItems: BrandListItem[];
};

/** Snapshots change only when someone runs db:load-prices, so a short cache is safe. */
const CACHE_MS = 5 * 60 * 1000;
let cached: { data: PriceData; at: number } | undefined;
let inFlight: Promise<PriceData> | undefined;

export async function getPriceData(): Promise<PriceData> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  inFlight ??= loadCurrentSnapshot()
    .then((data) => {
      cached = { data, at: Date.now() };
      return data;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

export function clearPriceDataCache(): void {
  cached = undefined;
}

async function loadCurrentSnapshot(): Promise<PriceData> {
  const [snapshot] = await db()
    .select()
    .from(schema.snapshots)
    .where(eq(schema.snapshots.isCurrent, true))
    .orderBy(desc(schema.snapshots.id))
    .limit(1);
  if (!snapshot) throw new Error("No current price snapshot. Run `npm run db:load-prices`.");

  const id = snapshot.id;
  const [levelRows, productRows, referenceRows, brandRows] = await Promise.all([
    db().select().from(schema.priceLevels).where(eq(schema.priceLevels.snapshotId, id)),
    db().select().from(schema.products).where(eq(schema.products.snapshotId, id)),
    db().select().from(schema.referenceItems).where(eq(schema.referenceItems.snapshotId, id)),
    db().select().from(schema.brandPrices).where(eq(schema.brandPrices.snapshotId, id)),
  ]);

  const levels: PriceLevels = { year: snapshot.priceLevelYear, updated: snapshot.fetchedAt.toISOString(), levels: {} };
  for (const row of levelRows) {
    levels.levels[row.code] ??= { label: row.label, values: {} };
    levels.levels[row.code].values[row.country] = row.value;
  }

  return {
    snapshot: id,
    fetchedAt: snapshot.fetchedAt.toISOString(),
    fx: snapshot.fx,
    levels,
    products: productRows.map((row) => ({
      id: row.id,
      code: row.code,
      country: row.country,
      category: row.category,
      priceLevel: row.priceLevel,
      name: row.name,
      brand: row.brand,
      quantity: row.quantity,
      price: row.price,
      currency: row.currency,
      priceEur: row.priceEur,
      type: row.type,
      unit: row.unit as RealProduct["unit"],
      unitPriceEur: row.unitPriceEur,
      observations: row.observations,
      firstSeen: row.firstSeen,
      lastSeen: row.lastSeen,
      shops: row.shops,
      proofs: row.proofs,
      url: row.url,
    })),
    localStats: snapshot.localStats as PriceData["localStats"],
    referenceItems: referenceRows.map((row) => ({ ...row, prices: row.prices as ReferenceItem["prices"] })),
    brandItems: brandRows.map((row) => ({ ...row, prices: row.prices as BrandListItem["prices"] })),
  };
}

/** The verified snapshot files bundled with the app: the fallback when the database is down. */
export function getBundledPriceData(): PriceData {
  return {
    snapshot: "bundled",
    fetchedAt: productsJson.fetchedAt,
    fx: { perEur: fxJson.perEur, asOf: fxJson.asOf },
    levels: priceLevelsJson as PriceLevels,
    products: productsJson.products as RealProduct[],
    localStats: productsJson.localStats as PriceData["localStats"],
    referenceItems: referenceItemsJson.items as ReferenceItem[],
    brandItems: brandPricesJson.items as BrandListItem[],
  };
}

/** Exchange rates, from the database snapshot when reachable, else the bundled one. */
export async function getFx(): Promise<PriceData["fx"]> {
  try {
    return (await getPriceData()).fx;
  } catch {
    return getBundledPriceData().fx;
  }
}
