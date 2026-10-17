import "server-only";

import {
  COUNTRIES,
  DEMO_TODAY,
  DISCLOSURE,
  FX_AS_OF,
  FX_PER_EUR,
  HISTORY_WINDOW_DAYS,
  MAX_CATEGORIES,
} from "./config";
import { queryCatalog } from "./catalog";
import { rankCategories } from "./personalize";
import { getCategoryDef, getCategoryDefs, getSeedTransactions, type Profile } from "./seed";
import { getActiveTrip, getConsent, hiddenIds } from "./store";
import type {
  CatalogSource,
  RankedCategory,
  RecommendationCategory,
  RecommendationsResponse,
} from "./types";

type Candidate = { slug: string; ranked: RankedCategory | null };

/** The least reassuring source wins, so the UI never overstates freshness. */
function overallSource(sources: CatalogSource[]): CatalogSource {
  if (sources.includes("fallback")) return "fallback";
  if (sources.includes("live")) return "live";
  return "cache";
}

/**
 * Builds the comparison screen for one user in one destination.
 *
 *   1. Rank this user's own categories (only if they consented, FR-20).
 *   2. Append the default everyday set behind them, no duplicates (US-7.3).
 *   3. Ask the catalog about each, by category and country pair only (FR-15).
 *      The pair is this user's home country and the destination, so two
 *      users in the same city can see different comparisons.
 *   4. Keep the first five that have at least one cheaper product (US-3.3).
 *
 * Anything the user thumbed down on this trip is removed (US-8).
 */
export async function buildRecommendations(
  profile: Profile,
  country: string,
): Promise<RecommendationsResponse> {
  const { userId, homeCountry: home } = profile;
  const trip = getActiveTrip(userId);
  // Feedback is per trip. Browsing another country outside a trip has none.
  const tripId = trip && trip.countries[country] ? trip.id : null;
  const consent = getConsent(userId);

  const ranked = consent.personalisation
    ? rankCategories(getSeedTransactions(userId), getCategoryDefs(), DEMO_TODAY)
    : [];

  const hiddenCategories = hiddenIds(userId, tripId, "category");
  const hiddenProducts = hiddenIds(userId, tripId, "product");

  const candidates: Candidate[] = ranked.map((entry) => ({ slug: entry.slug, ranked: entry }));
  for (const category of getCategoryDefs()) {
    if (category.isDefault && !candidates.some((candidate) => candidate.slug === category.slug)) {
      candidates.push({ slug: category.slug, ranked: null });
    }
  }
  const visible = candidates.filter((candidate) => !hiddenCategories.has(candidate.slug));

  // Every lookup is cheap and cached, so ask about all of them at once rather
  // than paying the latency one by one.
  const answers = await Promise.all(
    visible.map((candidate) => queryCatalog({ category: candidate.slug, from: home, to: country })),
  );

  const categories: RecommendationCategory[] = [];
  const sources: CatalogSource[] = [];

  visible.forEach((candidate, index) => {
    if (categories.length >= MAX_CATEGORIES) return;

    const answer = answers[index];
    const products = answer.products.filter((product) => !hiddenProducts.has(product.id));
    if (products.length === 0) return;

    const def = getCategoryDef(candidate.slug);
    sources.push(answer.source);
    categories.push({
      slug: candidate.slug,
      label: def?.label ?? candidate.slug,
      icon: def?.icon ?? "dots",
      personalised: candidate.ranked !== null,
      reason: candidate.ranked
        ? {
            spentEur: candidate.ranked.spentEur,
            transactionCount: candidate.ranked.transactionCount,
            windowDays: HISTORY_WINDOW_DAYS,
          }
        : null,
      savingPct: Math.round(
        products.reduce((total, product) => total + product.savingPct, 0) / products.length,
      ),
      products,
    });
  });

  const localCurrency = COUNTRIES[country].currency;
  const rate = FX_PER_EUR[localCurrency];

  return {
    country: { code: country, name: COUNTRIES[country].name },
    home: { code: home, name: COUNTRIES[home]?.name ?? home, currency: "EUR" },
    tripId,
    personalised: categories.some((category) => category.personalised),
    categories,
    disclosure: DISCLOSURE,
    fx: localCurrency !== "EUR" && rate ? { pair: `EUR/${localCurrency}`, rate, asOf: FX_AS_OF } : null,
    source: sources.length > 0 ? overallSource(sources) : "live",
    generatedAt: new Date().toISOString(),
  };
}
