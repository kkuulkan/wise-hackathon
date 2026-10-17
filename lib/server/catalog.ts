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
  MIN_LIST_PRICE_SAVING_PCT,
} from "./config";
import {
  getBrandListItems,
  getCategoryDef,
  getLocalStats,
  getPriceLevels,
  getRealProducts,
  getReferenceItems,
} from "./seed";
import { readCatalogCache, readStaleCatalogCache, writeCatalogCache } from "./store";
import type {
  CatalogResponse,
  CategoryComparison,
  ComparedProduct,
  ListPriceCheck,
  LocalComparison,
  Price,
  RealProduct,
} from "./types";

/**
 * The "product and price API" from the PRD, backed by real data:
 *
 *   category level  Eurostat price level indices say how much cheaper the
 *                   whole category is in `to` than in `from`.
 *   item level      named items both statistics offices price (CSO Ireland,
 *                   KSH Hungary), e.g. a men's haircut. Observed on both sides,
 *                   so they come first.
 *   product level   verified Open Prices shelf prices seen in `to`. Their home
 *                   price is the same barcode's verified price in `from` when
 *                   one exists, otherwise an estimate from the Eurostat ratio
 *                   of the product's own sub-index (oils, cheese, pasta…).
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

/**
 * Official annual averages are published after the year ends, so they get a
 * longer window than shelf prices; the fetch script uses the same limit.
 */
const MAX_REFERENCE_AGE_DAYS = 550;

function isFresh(date: string, maxAgeDays = MAX_PRICE_AGE_DAYS): boolean {
  const age = (Date.parse(`${DEMO_TODAY}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / DAY_MS;
  // A month-end period can sit a few days after the pinned demo date.
  return Number.isFinite(age) && age >= -31 && age <= maxAgeDays;
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

/** Official items priced in both countries. FR-14 still applies. */
function compareReferenceItems(query: CatalogQuery): ComparedProduct[] {
  return getReferenceItems()
    .filter((item) => item.category === query.category)
    .flatMap((item): ComparedProduct[] => {
      const home = item.prices[query.from];
      const local = item.prices[query.to];
      if (!home || !local || !isFresh(local.period, MAX_REFERENCE_AGE_DAYS)) return [];
      if (local.priceEur >= home.priceEur) return [];

      return [
        {
          id: item.id,
          name: item.name,
          description: [item.unit, "national average"].join(" · "),
          homePrice: toPrice(home.priceEur, query.from, home.currency === "EUR" ? undefined : home.price),
          homePriceBasis: "observed",
          localPrice: toPrice(local.priceEur, query.to, local.currency === "EUR" ? undefined : local.price),
          savingPct: Math.round(((home.priceEur - local.priceEur) / home.priceEur) * 100),
          localComparison: { basis: "national-average", pct: 0 },
          approximate: true,
          // The older of the two sides, so the date never overstates freshness.
          priceUpdatedAt: [home.period, local.period].sort()[0],
          evidence: { source: "National statistics", home: home.source, local: local.source, note: item.note },
          url: local.url,
        },
      ];
    });
}

/** The same brand SKUs priced in both countries, home and here. */
function brandPairs(query: CatalogQuery) {
  return getBrandListItems()
    .filter((item) => item.category === query.category)
    .flatMap((item) => {
      const home = item.prices[query.from];
      const local = item.prices[query.to];
      return home && local ? [{ item, home, local, pct: ((home.priceEur - local.priceEur) / home.priceEur) * 100 }] : [];
    });
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Summary of how a brand's official prices compare for this pair. */
export function checkListPrices(query: CatalogQuery): ListPriceCheck | null {
  const pairs = brandPairs(query);
  if (pairs.length === 0) return null;

  return {
    brand: pairs[0].item.brand,
    itemsCompared: pairs.length,
    medianPct: Math.round(median(pairs.map((pair) => pair.pct)) * 10) / 10,
    itemsCheaper: pairs.filter((pair) => pair.pct >= MIN_LIST_PRICE_SAVING_PCT).length,
    source: "Microsoft Store official list prices (MSRP), new items, identical SKUs",
  };
}

/** Brand SKUs whose official price is meaningfully lower here. */
function compareBrandItems(query: CatalogQuery): ComparedProduct[] {
  return brandPairs(query)
    .filter((pair) => pair.pct >= MIN_LIST_PRICE_SAVING_PCT)
    .map(({ item, home, local, pct }) => ({
      id: item.id,
      name: item.name,
      description: `${item.brand} official list price`,
      homePrice: toPrice(home.priceEur, query.from, home.currency === "EUR" ? undefined : home.price),
      homePriceBasis: "observed" as const,
      localPrice: toPrice(local.priceEur, query.to, local.currency === "EUR" ? undefined : local.price),
      savingPct: Math.round(pct),
      localComparison: null,
      approximate: true as const,
      priceUpdatedAt: DEMO_TODAY,
      evidence: { source: "Manufacturer list price" as const, brand: item.brand },
      url: local.url,
    }));
}

/** Per kg/L against similar verified products in the same country, or null. */
function localComparisonFor(product: RealProduct): LocalComparison | null {
  const stat = product.type ? getLocalStats()[product.country]?.[product.type] : undefined;
  if (!stat || product.unitPriceEur === null || product.unit !== stat.unit) return null;

  return {
    basis: "similar-products",
    pct: Math.round(((stat.medianUnitPriceEur - product.unitPriceEur) / stat.medianUnitPriceEur) * 100),
    typeLabel: stat.label,
    sampleSize: stat.sampleSize,
    unit: stat.unit,
  };
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
          localComparison: localComparisonFor(product),
          approximate: true,
          priceUpdatedAt: product.lastSeen,
          evidence: {
            source: "Open Prices",
            observations: product.observations,
            shops: product.shops,
            proofs: product.proofs,
          },
          url: product.url,
        },
      ];
    })
    .sort(bySaving)
    .filter(variety(new Map(products.map((product) => [product.id, product.priceLevel]))));
}

/**
 * Estimated savings are equal within a Eurostat sub-index, so ranking alone
 * would fill every slot from one shelf (three tins of tuna). Keep one product
 * per name and at most two per sub-index, so the list spans the category.
 */
const MAX_PER_SUB_INDEX = 2;

function variety(subIndexOf: Map<string, string>) {
  const names = new Set<string>();
  const perIndex = new Map<string, number>();
  return (product: ComparedProduct) => {
    const name = product.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
    const index = subIndexOf.get(product.id) ?? "";
    if (names.has(name) || (perIndex.get(index) ?? 0) >= MAX_PER_SUB_INDEX) return false;
    names.add(name);
    perIndex.set(index, (perIndex.get(index) ?? 0) + 1);
    return true;
  };
}

const evidenceRank = (product: ComparedProduct) =>
  product.evidence.source === "Open Prices" ? product.evidence.observations : Number.MAX_SAFE_INTEGER;

/** FR-12: biggest saving first, then the best-evidenced, then by id so the order never wobbles. */
function bySaving(a: ComparedProduct, b: ComparedProduct): number {
  return b.savingPct - a.savingPct || evidenceRank(b) - evidenceRank(a) || a.id.localeCompare(b.id);
}

/** Observed-on-both-sides items lead; shelf products fill the rest. */
function compareAll(products: RealProduct[], query: CatalogQuery): ComparedProduct[] {
  return [
    ...[...compareReferenceItems(query), ...compareBrandItems(query)].sort(bySaving),
    ...compareProducts(products, query),
  ].slice(
    0,
    MAX_PRODUCTS_PER_CATEGORY,
  );
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
      listPriceCheck: checkListPrices(query),
      products: compareAll(validProducts(raw), query),
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
      listPriceCheck: checkListPrices(query),
      products: compareAll(validProducts(getRealProducts()), query),
      source: "fallback",
      fetchedAt: new Date(now).toISOString(),
    };
  }
}
