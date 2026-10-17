import "server-only";

import { connection } from "next/server";

import { COUNTRIES, DEMO_TODAY, FX_PER_EUR, HISTORY_WINDOW_DAYS } from "@/lib/server/config";
import { buildRecommendations } from "@/lib/server/recommendations";
import { getCategoryDef, getSeedTransactions, type Profile } from "@/lib/server/seed";
import { currentUser } from "@/lib/server/session";
import { getActiveTrip } from "@/lib/server/store";
import { isEligiblePair } from "@/lib/server/trips";
import type { RecommendationCategory, RecommendationsResponse } from "@/lib/server/types";

import type { Account, Category, CurrencyCode, Transaction } from "./types";

/**
 * Glue between the backend (lib/server) and the frontend components, which
 * were written against the shapes in lib/types.ts. Neither side is changed:
 * this file reads from the backend and returns exactly what the components
 * already accept.
 *
 * Server components read the backend directly rather than over HTTP, as the
 * Next.js docs advise: same functions the /api routes call, no round trip.
 * User actions (sign in, arrival) go through the HTTP API from the client.
 */

const YEAR_OVER_WINDOW = 365 / HISTORY_WINDOW_DAYS;

const round2 = (value: number) => Math.round(value * 100) / 100;
const countryName = (code: string) => COUNTRIES[code]?.name ?? code;

export type LiveSession = {
  profile: Profile;
  account: Account;
  /** Country of the active trip, or null at home. */
  tripCountry: string | null;
};

/** The signed-in user as the frontend's Account, or null when signed out. */
export async function getLiveSession(): Promise<LiveSession | null> {
  // The backend stamps responses with the clock and keeps state in memory, so
  // everything after this point must run per request, never at prerender.
  await connection();
  const profile = await currentUser();
  if (!profile) return null;

  const trip = getActiveTrip(profile.userId);
  const here = trip?.currentCountry ?? profile.homeCountry;
  const away = Boolean(trip) && here !== profile.homeCountry;

  const account: Account = {
    holder: profile.holder,
    homeCity: profile.homeCity,
    homeCountry: countryName(profile.homeCountry),
    homeCountryCode: profile.homeCountry,
    // The backend knows the country, not the city, so the country stands in.
    currentCity: away ? countryName(here) : profile.homeCity,
    currentCountry: countryName(here),
    currentCountryCode: here,
    arrivedOn: trip?.countries[here]?.arrivedAt.slice(0, 10) ?? DEMO_TODAY,
    balances: profile.balances.map((balance) => ({
      ...balance,
      currency: balance.currency as CurrencyCode,
    })),
  };

  return { profile, account, tripCountry: away ? here : null };
}

/**
 * The statement, newest first. Category slugs are swapped for their labels so
 * the existing payments list, which looks labels up in the old seed, shows
 * "Skincare & beauty" rather than "skincare-beauty".
 */
export function getLiveTransactions(profile: Profile): Transaction[] {
  return [...getSeedTransactions(profile.userId)]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((transaction) => ({
      ...transaction,
      category: getCategoryDef(transaction.category)?.label ?? transaction.category,
      amount: { ...transaction.amount, currency: transaction.amount.currency as CurrencyCode },
    }));
}

function toCategory(
  category: RecommendationCategory,
  country: string,
  homeCity: string,
): Category {
  const { products } = category;
  const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const updated = products.map((product) => product.priceUpdatedAt).sort().at(-1);
  const hufPerEur = FX_PER_EUR.HUF;

  // Annualised: what this user spent here in 90 days, scaled to a year, at
  // the category's saving. Default-set categories have no spend, so no claim.
  const annualSavingEur = category.reason
    ? round2(category.reason.spentEur * YEAR_OVER_WINDOW * (category.savingPct / 100))
    : 0;

  return {
    slug: category.slug,
    label: category.label,
    unit: category.personalised ? "From your own spending" : "General suggestion",
    homeAvgEur: round2(mean(products.map((product) => product.homePrice.amount))),
    localAvgEur: round2(mean(products.map((product) => product.localPrice.amount))),
    purchasesPerYear: category.reason
      ? Math.round(category.reason.transactionCount * YEAR_OVER_WINDOW)
      : 0,
    source: `Approximate prices compared with ${homeCity}, last updated ${updated}.`,
    savingPct: category.savingPct,
    annualSavingEur,
    products: products.map((product) => ({
      name: product.name,
      area: product.description,
      priceEur: product.localPrice.amount,
      // The visa always prints a forint line; outside Hungary it is the
      // converted figure at the seeded rate.
      priceHuf: product.localPrice.local?.amount ?? Math.round(product.localPrice.amount * hufPerEur),
      mapsQuery: `${product.name} ${countryName(country)}`,
      // Catalog prices are typical local prices, so each one is the local average.
      vsLocalAvgPct: 0,
    })),
  };
}

export type LiveRecommendations =
  | { ok: true; response: RecommendationsResponse; categories: Category[] }
  | { ok: false; reason: "no-trip" | "not-eligible" | "bad-country" };

/**
 * The comparison for a destination, as the frontend's Category[]. Mirrors the
 * checks in GET /api/recommendations so the page and the API agree.
 */
export async function getLiveRecommendations(
  session: LiveSession,
  countryParam?: string,
): Promise<LiveRecommendations> {
  const requested = countryParam?.trim().toUpperCase();
  if (requested && !COUNTRIES[requested]) return { ok: false, reason: "bad-country" };

  const country = requested || session.tripCountry;
  if (!country) return { ok: false, reason: "no-trip" };
  if (!isEligiblePair(session.profile.homeCountry, country)) {
    return { ok: false, reason: "not-eligible" };
  }

  const response = await buildRecommendations(session.profile, country);
  return {
    ok: true,
    response,
    categories: response.categories.map((category) =>
      toCategory(category, country, session.profile.homeCity),
    ),
  };
}
