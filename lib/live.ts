import "server-only";

import { connection } from "next/server";

import { COUNTRIES, DEMO_TODAY, HISTORY_WINDOW_DAYS } from "@/lib/server/config";
import { buildRecommendations } from "@/lib/server/recommendations";
import { getCategoryDef, getTransactions, type Profile } from "@/lib/server/seed";
import { currentUser } from "@/lib/server/session";
import { getActiveTrip, getConsent } from "@/lib/server/store";
import { isEligiblePair } from "@/lib/server/trips";
import type {
  Consent,
  RecommendationCategory,
  RecommendationsResponse,
} from "@/lib/server/types";

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
  /** Their answer to the consent question, and whether they have given one. */
  consent: Consent;
};

/** The signed-in user as the frontend's Account, or null when signed out. */
export async function getLiveSession(): Promise<LiveSession | null> {
  // The backend stamps responses with the clock and keeps state in memory, so
  // everything after this point must run per request, never at prerender.
  await connection();
  const profile = await currentUser();
  if (!profile) return null;

  const trip = await getActiveTrip(profile.userId);
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

  return {
    profile,
    account,
    tripCountry: away ? here : null,
    consent: await getConsent(profile.userId),
  };
}

/**
 * The statement, newest first. Category slugs are swapped for their labels so
 * the existing payments list, which looks labels up in the old seed, shows
 * "Skincare & beauty" rather than "skincare-beauty".
 */
export async function getLiveTransactions(profile: Profile): Promise<Transaction[]> {
  return (await getTransactions(profile.userId)).map((transaction) => ({
      ...transaction,
      category: getCategoryDef(transaction.category)?.label ?? transaction.category,
      amount: { ...transaction.amount, currency: transaction.amount.currency as CurrencyCode },
    }));
}

function toCategory(category: RecommendationCategory, homeCity: string): Category {
  const { products, comparison, typicalPurchase } = category;
  const mean = (values: number[]) =>
    values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

  return {
    slug: category.slug,
    label: category.label,
    icon: category.icon,
    unit: typicalPurchase ? "Your average purchase" : "Typical shelf prices",
    // The visa's two rates: the user's own average purchase when there is one
    // (categories such as haircuts have no shelf products), otherwise the mean
    // of the real products shown.
    homeAvgEur: round2(typicalPurchase?.home.amount ?? mean(products.map((p) => p.homePrice.amount))),
    localAvgEur: round2(typicalPurchase?.local.amount ?? mean(products.map((p) => p.localPrice.amount))),
    purchasesPerYear: category.reason
      ? Math.round(category.reason.transactionCount * YEAR_OVER_WINDOW)
      : 0,
    source:
      `${comparison.indexLabel}: price level ${comparison.localIndex} here vs ${comparison.homeIndex} in ${homeCity} (Eurostat ${comparison.year}, EU = 100).` +
      (products.some((p) => p.evidence.source === "National statistics")
        ? " Named items are official national averages in both countries."
        : "") +
      (category.listPriceCheck
        ? ` ${category.listPriceCheck.brand}'s official prices for ${category.listPriceCheck.itemsCompared} identical items: median ${Math.abs(category.listPriceCheck.medianPct)}% ${category.listPriceCheck.medianPct > 0 ? "lower" : category.listPriceCheck.medianPct < 0 ? "higher" : "difference"} here${category.listPriceCheck.itemsCheaper ? `, ${category.listPriceCheck.itemsCheaper} at least 5% cheaper` : ", so the brand itself charges about the same"}.`
        : "") +
      (products.some((p) => p.evidence.source === "Open Prices")
        ? " Shelf products are real Open Prices sightings; their home prices are estimates."
        : ""),
    savingPct: category.savingPct,
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      area: product.description,
      priceEur: product.localPrice.amount,
      // Present only where the destination does not use the euro, so a
      // Portuguese price is one figure and a Hungarian one is two.
      priceLocal: product.localPrice.local
        ? {
            amount: product.localPrice.local.amount,
            currency: product.localPrice.local.currency as CurrencyCode,
          }
        : null,
      savingPct: product.savingPct,
      url: product.url,
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
      toCategory(category, session.profile.homeCity),
    ),
  };
}
