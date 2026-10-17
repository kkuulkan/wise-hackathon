/**
 * Backend types. Kept apart from lib/types.ts, which describes the current
 * frontend's seed shapes, so the two can evolve without breaking each other.
 * Every type named *Response is part of the HTTP contract in BACKEND_PROGRESS.md.
 */

export type CategoryKind = "everyday" | "sensitive" | "non-actionable";

/**
 * take-home   goods a traveller can buy here instead of at home
 * timeable    services needed anyway that can be done while here
 * local-only  bought here either way (transport, mobile, cafés, restaurants),
 *             so a lower price changes nothing and it is never recommended
 */
export type BuyWhere = "take-home" | "timeable" | "local-only";

export type CategoryDef = {
  slug: string;
  label: string;
  icon: string;
  kind: CategoryKind;
  isDefault: boolean;
  /** Eurostat prc_ppp_ind category that prices it; null means never compared. */
  priceLevel: string | null;
  /** Null for categories that are never recommended anyway (sensitive, non-actionable). */
  buyWhere: BuyWhere | null;
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

/** A verified Open Prices product, as written by scripts/fetch-real-data.mjs. */
export type RealProduct = {
  id: string;
  code: string;
  country: string;
  category: string;
  /** Eurostat sub-index used to estimate its price elsewhere. */
  priceLevel: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  /** Median of the verified observations, in the country's currency. */
  price: number;
  currency: string;
  priceEur: number;
  /** Most specific Open Food Facts type tag, e.g. "en:canned-tunas". */
  type: string | null;
  unit: "kg" | "L" | null;
  /** EUR per kg or per litre, when the pack size is known. */
  unitPriceEur: number | null;
  observations: number;
  firstSeen: string;
  lastSeen: string;
  shops: string[];
  proofs: string[];
  url: string;
};

/** An item both countries' statistics offices price, matched by hand. */
export type ReferenceItem = {
  id: string;
  category: string;
  name: string;
  /** What the price is for, e.g. "per kg", "per cut". */
  unit: string;
  /** Any difference between the two countries' definitions. */
  note: string | null;
  prices: Record<
    string,
    { price: number; currency: string; priceEur: number; period: string; source: string; url: string }
  >;
};

/** One manufacturer SKU's official list price (MSRP, incl. VAT) per market. */
export type BrandListItem = {
  id: string;
  category: string;
  brand: string;
  name: string;
  prices: Record<string, { price: number; currency: string; priceEur: number; url: string }>;
};

/**
 * Category-level check of a brand's official prices for the same SKUs in
 * both countries. Usually shows they are about the same: brands set one
 * euro-area price and differ mainly by VAT.
 */
export type ListPriceCheck = {
  brand: string;
  itemsCompared: number;
  /** Median of (home − here) / home × 100. Positive = cheaper here. */
  medianPct: number;
  /** Items at least MIN_LIST_PRICE_SAVING_PCT cheaper here; these are shown as products. */
  itemsCheaper: number;
  source: string;
};

/** Median unit price of a product type in one country, from ≥5 verified products. */
export type LocalTypeStat = {
  label: string;
  unit: "kg" | "L";
  medianUnitPriceEur: number;
  sampleSize: number;
};

/**
 * How a product's price sits within its own country.
 * national-average  it is the official national average (always 0%)
 * similar-products  per kg/L against the median of ≥5 verified products of
 *                   the same type seen in that country
 * Null when neither exists: the UI must not claim anything about the local
 * average then.
 */
export type LocalComparison =
  | { basis: "national-average"; pct: 0 }
  | { basis: "similar-products"; pct: number; typeLabel: string; sampleSize: number; unit: "kg" | "L" };

export type PriceLevels = {
  year: string;
  updated: string;
  levels: Record<string, { label: string; values: Record<string, number> }>;
};

/** Money in the user's home currency, with the local equivalent when it differs. */
export type Price = {
  amount: number;
  currency: string;
  local?: { amount: number; currency: string };
};

/**
 * How much cheaper a whole spending category is, from official price levels.
 * savingPct = (1 − local index / home index) × 100.
 */
export type CategoryComparison = {
  savingPct: number;
  homeIndex: number;
  localIndex: number;
  /** Eurostat prc_ppp_ind category code and label. */
  index: string;
  indexLabel: string;
  year: string;
  source: "Eurostat prc_ppp_ind";
};

/** One real product as the catalog API returns it for a country pair. */
export type ComparedProduct = {
  id: string;
  name: string;
  /** Quantity and where it was seen, e.g. "250 g · Lidl, Porto". */
  description: string;
  homePrice: Price;
  /**
   * observed   the same barcode has verified prices in the home country
   * estimated  local shelf price scaled by the Eurostat price-level ratio
   */
  homePriceBasis: "observed" | "estimated";
  /** A real shelf price: median of verified observations. */
  localPrice: Price;
  /** Percent cheaper than home. Always positive: dearer items are dropped. */
  savingPct: number;
  /** Positive pct = below the local comparison point. */
  localComparison: LocalComparison | null;
  approximate: true;
  /** Date of the most recent verified observation. */
  priceUpdatedAt: string;
  /**
   * Open Prices          shelf price seen in the destination (receipt or price-tag photo)
   * National statistics  official national averages on both sides (CSO, KSH)
   */
  evidence:
    | { source: "Open Prices"; observations: number; shops: string[]; proofs: string[] }
    | { source: "National statistics"; home: string; local: string; note: string | null }
    | { source: "Manufacturer list price"; brand: string };
  /** The product's public Open Prices page, or the destination's statistics table. */
  url: string;
};

export type CatalogSource = "live" | "cache" | "fallback";

/** GET /api/catalog. Note what is absent: nothing about the user. */
export type CatalogResponse = {
  category: string;
  from: string;
  to: string;
  /** Null when either country has no price level for this category. */
  comparison: CategoryComparison | null;
  /** Null when no brand list prices exist for this category and pair. */
  listPriceCheck: ListPriceCheck | null;
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
  /** From official price levels (comparison.savingPct). */
  savingPct: number;
  comparison: CategoryComparison;
  /**
   * The user's own average purchase in this category at home, and what the
   * same spend costs here at the official price ratio. Null for general
   * suggestions, which have no spending behind them.
   */
  typicalPurchase: { home: Price; local: Price } | null;
  listPriceCheck: ListPriceCheck | null;
  /** Real shelf products. May be empty: services have no product data. */
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
