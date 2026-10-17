/**
 * Backend types. Kept apart from lib/types.ts, which describes the current
 * frontend's seed shapes, so the two can evolve without breaking each other.
 * Every type named *Response is part of the HTTP contract in BACKEND_PROGRESS.md.
 */

export type CategoryKind = "everyday" | "sensitive" | "non-actionable";

export type CategoryDef = {
  slug: string;
  label: string;
  icon: string;
  kind: CategoryKind;
  isDefault: boolean;
};

export type SeedTransaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  city: string;
  countryCode: string;
  amount: { value: number; currency: string };
  amountEur: number;
};

export type LinkSpec = { type: "shop" | "maps" | "web"; query: string };

export type CatalogProduct = {
  id: string;
  category: string;
  name: string;
  description: string;
  /** Approximate EUR price per country code. */
  prices: Record<string, number>;
  priceUpdatedAt: string;
  ageRestricted?: boolean;
  link: LinkSpec;
};

/** Money in the user's home currency, with the local equivalent when it differs. */
export type Price = {
  amount: number;
  currency: string;
  local?: { amount: number; currency: string };
};

/** One product as the catalog API returns it for a country pair. */
export type ComparedProduct = {
  id: string;
  name: string;
  description: string;
  homePrice: Price;
  localPrice: Price;
  /** Percent cheaper than home. Always positive: dearer items are dropped. */
  savingPct: number;
  approximate: true;
  priceUpdatedAt: string;
  url: string;
};

export type CatalogSource = "live" | "cache" | "fallback";

/** GET /api/catalog. Note what is absent: nothing about the user. */
export type CatalogResponse = {
  category: string;
  from: string;
  to: string;
  products: ComparedProduct[];
  source: CatalogSource;
  fetchedAt: string;
};

export type RankedCategory = {
  slug: string;
  /** Spend inside the window, home currency. */
  spentEur: number;
  transactionCount: number;
  score: number;
};

/** PRD open question 1: GPS, or the first card payment abroad when location is off. */
export type LocationSignal = "gps" | "card";

export type Trip = {
  id: string;
  startedAt: string;
  endedAt?: string;
  /** Country code to the moment we first saw the user there on this trip. */
  countries: Record<string, { arrivedAt: string; signal: LocationSignal; notifiedAt?: string }>;
  currentCountry: string;
};

export type Notification = {
  id: string;
  tripId: string;
  country: string;
  title: string;
  body: string;
  /** FR-6: where tapping it lands. Contains no personal data. */
  deepLink: string;
  createdAt: string;
};

export type Consent = {
  /** FR-20: may transaction data be used to personalise? */
  personalisation: boolean;
  /** FR-21: may we send arrival notifications? */
  notifications: boolean;
  /**
   * US-6.1: has this user actually answered yet? False means they have never
   * been asked, which is what makes the app ask them. Any write to
   * /api/consent is an answer, so it sets this true.
   */
  decided: boolean;
  updatedAt: string;
};

export type FeedbackItem = {
  tripId: string;
  kind: "category" | "product";
  id: string;
  country: string;
  createdAt: string;
};

export const EVENT_TYPES = [
  "notification_sent",
  "notification_opened",
  "recommendations_viewed",
  "category_viewed",
  "product_tapped",
  "opt_in",
  "opt_out",
  "feedback",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/** FR-23: deliberately narrow. No amounts, merchants or names fit in here. */
export type AnalyticsEvent = {
  type: EventType;
  country?: string;
  category?: string;
  productId?: string;
  at: string;
};

export type RecommendationCategory = {
  slug: string;
  label: string;
  icon: string;
  /** False when the slot was filled from the default set (US-7.2). */
  personalised: boolean;
  /** Why it is shown. Null for default-set categories. */
  reason: { spentEur: number; transactionCount: number; windowDays: number } | null;
  /** Mean saving across the products shown. */
  savingPct: number;
  products: ComparedProduct[];
};

/** GET /api/recommendations. */
export type RecommendationsResponse = {
  country: { code: string; name: string };
  home: { code: string; name: string; currency: string };
  tripId: string | null;
  /** False when consent is off or history is empty: everything is general. */
  personalised: boolean;
  categories: RecommendationCategory[];
  disclosure: string;
  fx: { pair: string; rate: number; asOf: string } | null;
  source: CatalogSource;
  generatedAt: string;
};
