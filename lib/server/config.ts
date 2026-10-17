/**
 * Every tunable the backend uses, in one place, so the demo and the PRD can be
 * checked against each other without reading the logic.
 */

/**
 * The demo's "today". Pinned so the 90-day window and price ages give the same
 * answer whenever the demo runs. Override with OTHERWISE_TODAY=YYYY-MM-DD.
 */
export const DEMO_TODAY = process.env.OTHERWISE_TODAY ?? "2026-10-17";

/** FR-8: personalisation looks at this much history. */
export const HISTORY_WINDOW_DAYS = 90;

/** FR-8 / US-3.1: at most this many categories on the screen. */
export const MAX_CATEGORIES = 5;

/** US-4.1: products per category. A category with none is hidden (US-3.3). */
export const MAX_PRODUCTS_PER_CATEGORY = 5;

/** Edge case 17: prices older than this are treated as unknown and dropped. */
export const MAX_PRICE_AGE_DAYS = 90;

/** Edge case 21: age-restricted goods are not recommended at all. */
export const INCLUDE_AGE_RESTRICTED = false;

/** NFR performance: fall back after this long (PRD says 3 s). */
export const CATALOG_TIMEOUT_MS = 3000;

/** FR-16: how long a catalog answer per (from, to, category) is reused. */
export const CATALOG_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Set to "fail" or "slow" to demonstrate the FR-17 fallback without touching
 * code: `OTHERWISE_CATALOG_MODE=fail npm run dev`.
 */
export const CATALOG_MODE = process.env.OTHERWISE_CATALOG_MODE ?? "normal";

/** FR-9: how much spend and how much frequency each count towards rank. */
export const RANK_WEIGHTS = { spend: 0.5, frequency: 0.5 } as const;

export type Country = {
  code: string;
  name: string;
  currency: string;
  /** FR-4: OtherWise only runs between E.U. member states. */
  eu: boolean;
};

/**
 * Countries the backend knows about. Non-E.U. entries exist so the demo can
 * show the ineligible path (US-1.4), matching the HTML prototype's Japan and
 * Mexico options.
 */
export const COUNTRIES: Record<string, Country> = {
  IE: { code: "IE", name: "Ireland", currency: "EUR", eu: true },
  PT: { code: "PT", name: "Portugal", currency: "EUR", eu: true },
  ES: { code: "ES", name: "Spain", currency: "EUR", eu: true },
  HU: { code: "HU", name: "Hungary", currency: "HUF", eu: true },
  DE: { code: "DE", name: "Germany", currency: "EUR", eu: true },
  JP: { code: "JP", name: "Japan", currency: "JPY", eu: false },
  MX: { code: "MX", name: "Mexico", currency: "MXN", eu: false },
};

/** Units of each currency per 1 EUR. Seeded snapshot, not live. */
export const FX_PER_EUR: Record<string, number> = {
  EUR: 1,
  HUF: 395,
};
export const FX_AS_OF = "2026-10-17";

/** FR-22: shown on every recommendations response. */
export const DISCLOSURE =
  "Prices are approximate and may vary by city and store. Suggestions are not financial advice.";
