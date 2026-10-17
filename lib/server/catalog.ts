import "server-only";

import {
  CATALOG_CACHE_TTL_MS,
  CATALOG_MODE,
  CATALOG_TIMEOUT_MS,
  COUNTRIES,
  DEMO_TODAY,
  FX_PER_EUR,
  INCLUDE_AGE_RESTRICTED,
  MAX_EXCLUSIVES,
  MAX_PRICE_AGE_DAYS,
  MAX_PRODUCTS_PER_CATEGORY,
} from "./config";
import { getCatalogExclusives, getCatalogProducts } from "./seed";
import { readCatalogCache, readStaleCatalogCache, writeCatalogCache } from "./store";
import type {
  CatalogExclusive,
  CatalogProduct,
  CatalogResponse,
  ComparedProduct,
  ExclusiveProduct,
  LinkSpec,
  Price,
} from "./types";

/**
 * The "product and price API" from the PRD.
 *
 * Its whole input is a category slug and a country pair (FR-15). It cannot be
 * handed a user, a merchant or an amount, because the signature has nowhere
 * to put one. That is the privacy boundary, enforced by the type rather than
 * by discipline.
 */
export type CatalogQuery = { category: string; from: string; to: string };

const DAY_MS = 86_400_000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** EUR price, plus the local-currency figure when the destination is not EUR. */
export function toPrice(amountEur: number, localCountry: string): Price {
  const price: Price = { amount: round2(amountEur), currency: "EUR" };
  const currency = COUNTRIES[localCountry]?.currency;
  const rate = currency ? FX_PER_EUR[currency] : undefined;

  if (currency && currency !== "EUR" && rate) {
    price.local = { amount: Math.round(amountEur * rate), currency };
  }

  return price;
}

/**
 * US-5.3 / FR-15: outbound links are built from the catalog's own query and
 * the destination name. Nothing about the user can reach the URL.
 */
export function productUrl(link: LinkSpec, country: string): string {
  const where = COUNTRIES[country]?.name ?? country;
  const q = encodeURIComponent(`${link.query} ${where}`);

  switch (link.type) {
    case "maps":
      return `https://www.google.com/maps/search/?api=1&query=${q}`;
    case "shop":
      return `https://www.google.com/search?tbm=shop&q=${q}`;
    case "web":
      return `https://www.google.com/search?q=${q}`;
  }
}

function isFresh(priceUpdatedAt: string): boolean {
  const age = (Date.parse(`${DEMO_TODAY}T00:00:00Z`) - Date.parse(`${priceUpdatedAt}T00:00:00Z`)) / DAY_MS;
  return Number.isFinite(age) && age <= MAX_PRICE_AGE_DAYS;
}

function isAllowed(item: { ageRestricted?: boolean }): boolean {
  return INCLUDE_AGE_RESTRICTED || !item.ageRestricted;
}

/**
 * Edge case 18: anything malformed is discarded rather than shown half-built.
 * Duplicates by id are dropped too.
 */
function validProducts(raw: unknown[]): CatalogProduct[] {
  const seen = new Set<string>();

  return raw.filter((item): item is CatalogProduct => {
    if (typeof item !== "object" || item === null) return false;
    const product = item as Partial<CatalogProduct>;
    const ok =
      typeof product.id === "string" &&
      typeof product.name === "string" &&
      typeof product.category === "string" &&
      typeof product.priceUpdatedAt === "string" &&
      typeof product.prices === "object" &&
      product.prices !== null &&
      typeof product.link?.query === "string" &&
      !seen.has(product.id);

    if (ok) seen.add(product.id!);
    return ok;
  });
}

/**
 * The comparison itself, shared by live and fallback paths. FR-14: only
 * products cheaper here than at home survive. FR-12: ranked by saving, with
 * id as tiebreak so the order never wobbles.
 */
function compare(products: CatalogProduct[], query: CatalogQuery): ComparedProduct[] {
  return products
    .filter((product) => product.category === query.category)
    .filter(isAllowed)
    .filter((product) => isFresh(product.priceUpdatedAt))
    .flatMap((product) => {
      const home = product.prices[query.from];
      const local = product.prices[query.to];
      if (typeof home !== "number" || typeof local !== "number" || home <= 0) return [];
      if (local >= home) return [];

      return [
        {
          id: product.id,
          name: product.name,
          description: product.description,
          homePrice: toPrice(home, query.from),
          localPrice: toPrice(local, query.to),
          savingPct: Math.round(((home - local) / home) * 100),
          approximate: true as const,
          priceUpdatedAt: product.priceUpdatedAt,
          url: productUrl(product.link, query.to),
        },
      ];
    })
    .sort((a, b) => b.savingPct - a.savingPct || a.id.localeCompare(b.id))
    .slice(0, MAX_PRODUCTS_PER_CATEGORY);
}

/**
 * Stand-in for the remote catalog service. In production this is an HTTP call;
 * here it reads the seed, with switches to demonstrate slowness and outage.
 */
async function fetchFromCatalogService(): Promise<unknown[]> {
  if (CATALOG_MODE === "fail") throw new Error("catalog service unavailable");
  if (CATALOG_MODE === "slow") {
    await new Promise((resolve) => setTimeout(resolve, CATALOG_TIMEOUT_MS + 1000));
  }
  return getCatalogProducts();
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
 *   3. stale cache, then the bundled static catalog
 * The response says which one it came from.
 */
export async function queryCatalog(query: CatalogQuery): Promise<CatalogResponse> {
  const key = `${query.from}:${query.to}:${query.category}`;
  const now = Date.now();

  const cached = readCatalogCache(key, now);
  if (cached) return { ...cached, source: "cache" };

  try {
    const raw = await withTimeout(fetchFromCatalogService(), CATALOG_TIMEOUT_MS);
    const response: CatalogResponse = {
      ...query,
      products: compare(validProducts(raw), query),
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
      products: compare(validProducts(getCatalogProducts()), query),
      source: "fallback",
      fetchedAt: new Date(now).toISOString(),
    };
  }
}

/**
 * FR-12: destination-only products, labelled separately. Products in the
 * user's top categories come first, in the order those categories rank.
 * The "Popular" label from the HTML prototype is out of scope.
 */
export function exclusivesFor(country: string, preferredCategories: string[]): ExclusiveProduct[] {
  const rank = (category: string) => {
    const index = preferredCategories.indexOf(category);
    return index === -1 ? preferredCategories.length : index;
  };

  return getCatalogExclusives()
    .filter((item: CatalogExclusive) => item.country === country)
    .filter(isAllowed)
    .filter((item) => isFresh(item.priceUpdatedAt))
    .sort((a, b) => rank(a.category) - rank(b.category) || a.id.localeCompare(b.id))
    .slice(0, MAX_EXCLUSIVES)
    .map((item) => ({
      id: item.id,
      category: item.category,
      name: item.name,
      description: item.description,
      label: "Exclusive" as const,
      localPrice: toPrice(item.price, country),
      approximate: true as const,
      priceUpdatedAt: item.priceUpdatedAt,
      url: productUrl(item.link, country),
    }));
}
