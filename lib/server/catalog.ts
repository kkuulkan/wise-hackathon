import "server-only";

import {
  CATALOG_CACHE_TTL_MS,
  CATALOG_MODE,
  CATALOG_TIMEOUT_MS,
  COUNTRIES,
  DEMO_TODAY,
  FX_PER_EUR,
  MAX_PRICE_AGE_DAYS,
  MAX_PRODUCTS_PER_CATEGORY,
} from "./config";
import { getCategoryDef, getPriceLevels, getRealProducts } from "./seed";
import { readCatalogCache, readStaleCatalogCache, writeCatalogCache } from "./store";
import type {
  CatalogResponse,
  CategoryComparison,
  ComparedProduct,
  Price,
  RealProduct,
} from "./types";

/**
 * The "product and price API" from the PRD, backed by real data:
 *
 *   category level  Eurostat price level indices say how much cheaper the
 *                   whole category is in `to` than in `from`.
 *   product level   verified Open Prices shelf prices seen in `to`. Their home
 *                   price is the same barcode's verified price in `from` when
 *                   one exists, otherwise an estimate from the Eurostat ratio
 *                   of the product's own sub-index (bread, dairy, oils…).
 *
 * Its whole input is a category slug and a country pair (FR-15). It cannot be
 * handed a user, a merchant or an amount, because the signature has nowhere
 * to put one.
 */
export type CatalogQuery = { category: string; from: string; to: string };

const DAY_MS = 86_400_000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** EUR price, plus the local-currency figure when the country is not on EUR. */
export function toPrice(amountEur: number, country: string, localAmount?: number): Price {
  const price: Price = { amount: round2(amountEur), currency: "EUR" };
  const currency = COUNTRIES[country]?.currency;
  const rate = currency ? FX_PER_EUR[currency] : undefined;

  if (currency && currency !== "EUR" && rate) {
    price.local = { amount: Math.round(localAmount ?? amountEur * rate), currency };
  }

  return price;
}

/** FR-12 / FR-14 support: the official category comparison for a country pair. */
export function compareCategory(category: string, from: string, to: string): CategoryComparison | null {
  const code = getCategoryDef(category)?.priceLevel;
  if (!code) return null;

  const { year, levels } = getPriceLevels();
  const level = levels[code];
  const homeIndex = level?.values[from];
  const localIndex = level?.values[to];
  if (typeof homeIndex !== "number" || typeof localIndex !== "number") return null;

  return {
    savingPct: Math.round((1 - localIndex / homeIndex) * 100),
    homeIndex,
    localIndex,
    index: code,
    indexLabel: level.label,
    year,
    source: "Eurostat prc_ppp_ind",
  };
}

function isFresh(lastSeen: string): boolean {
  const age = (Date.parse(`${DEMO_TODAY}T00:00:00Z`) - Date.parse(`${lastSeen}T00:00:00Z`)) / DAY_MS;
  return Number.isFinite(age) && age >= 0 && age <= MAX_PRICE_AGE_DAYS;
}

/**
 * Edge case 18: the snapshot was verified when it was built, but anything
 * malformed here is still discarded rather than shown half-built.
 */
function validProducts(raw: unknown[]): RealProduct[] {
  const seen = new Set<string>();

  return raw.filter((item): item is RealProduct => {
    if (typeof item !== "object" || item === null) return false;
    const product = item as Partial<RealProduct>;
    const ok =
      typeof product.id === "string" &&
      typeof product.code === "string" &&
      typeof product.name === "string" &&
      typeof product.country === "string" &&
      typeof product.category === "string" &&
      typeof product.priceLevel === "string" &&
      typeof product.priceEur === "number" &&
      product.priceEur > 0 &&
      typeof product.lastSeen === "string" &&
      typeof product.url === "string" &&
      product.url.startsWith("https://prices.openfoodfacts.org/") &&
      !seen.has(product.id);

    if (ok) seen.add(product.id!);
    return ok;
  });
}

function describe(product: RealProduct): string {
  return [product.quantity, product.shops[0]].filter(Boolean).join(" · ");
}

function compareProducts(products: RealProduct[], query: CatalogQuery): ComparedProduct[] {
  const { levels } = getPriceLevels();
  const homeByCode = new Map(
    products
      .filter((product) => product.country === query.from && isFresh(product.lastSeen))
      .map((product) => [product.code, product]),
  );

  return products
    .filter((product) => product.country === query.to && product.category === query.category)
    .filter((product) => isFresh(product.lastSeen))
    .flatMap((product): ComparedProduct[] => {
      const observed = homeByCode.get(product.code);
      const homeIndex = levels[product.priceLevel]?.values[query.from];
      const localIndex = levels[product.priceLevel]?.values[query.to];

      let homeEur: number;
      if (observed) {
        homeEur = observed.priceEur;
      } else if (typeof homeIndex === "number" && typeof localIndex === "number") {
        homeEur = product.priceEur * (homeIndex / localIndex);
      } else {
        return [];
      }

      // FR-14: only what is actually cheaper here.
      if (product.priceEur >= homeEur) return [];

      return [
        {
          id: product.id,
          name: product.name,
          description: describe(product),
          homePrice: toPrice(homeEur, query.from, observed?.currency === "EUR" ? undefined : observed?.price),
          homePriceBasis: observed ? "observed" : "estimated",
          localPrice: toPrice(product.priceEur, query.to, product.currency === "EUR" ? undefined : product.price),
          savingPct: Math.round(((homeEur - product.priceEur) / homeEur) * 100),
          approximate: true,
          priceUpdatedAt: product.lastSeen,
          evidence: {
            observations: product.observations,
            shops: product.shops,
            proofs: product.proofs,
            source: "Open Prices",
          },
          url: product.url,
        },
      ];
    })
    // FR-12: biggest saving first, then the best-evidenced, then by id so
    // the order never wobbles.
    .sort(
      (a, b) =>
        b.savingPct - a.savingPct ||
        b.evidence.observations - a.evidence.observations ||
        a.id.localeCompare(b.id),
    )
    .slice(0, MAX_PRODUCTS_PER_CATEGORY);
}

/**
 * Stand-in for the remote catalog service. In production this is an HTTP call
 * to a service holding the verified snapshot; here it reads the snapshot,
 * with switches to demonstrate slowness and outage.
 */
async function fetchFromCatalogService(): Promise<unknown[]> {
  if (CATALOG_MODE === "fail") throw new Error("catalog service unavailable");
  if (CATALOG_MODE === "slow") {
    await new Promise((resolve) => setTimeout(resolve, CATALOG_TIMEOUT_MS + 1000));
  }
  return getRealProducts();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * FR-11, FR-16, FR-17. Order of preference:
 *   1. fresh cache for this (from, to, category)
 *   2. live catalog call, under a 3 s timeout
 *   3. stale cache, then the bundled snapshot
 * The response says which one it came from.
 */
export async function queryCatalog(query: CatalogQuery): Promise<CatalogResponse> {
  const key = `${query.from}:${query.to}:${query.category}`;
  const now = Date.now();
  const comparison = compareCategory(query.category, query.from, query.to);

  const cached = readCatalogCache(key, now);
  if (cached) return { ...cached, source: "cache" };

  try {
    const raw = await withTimeout(fetchFromCatalogService(), CATALOG_TIMEOUT_MS);
    const response: CatalogResponse = {
      ...query,
      comparison,
      products: compareProducts(validProducts(raw), query),
      source: "live",
      fetchedAt: new Date(now).toISOString(),
    };
    writeCatalogCache(key, response, now + CATALOG_CACHE_TTL_MS);
    return response;
  } catch (error) {
    console.warn(`[catalog] ${key} falling back: ${(error as Error).message}`);

    const stale = readStaleCatalogCache(key);
    if (stale) return { ...stale, source: "fallback" };

    return {
      ...query,
      comparison,
      products: compareProducts(validProducts(getRealProducts()), query),
      source: "fallback",
      fetchedAt: new Date(now).toISOString(),
    };
  }
}
