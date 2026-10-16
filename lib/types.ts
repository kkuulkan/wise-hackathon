export type CurrencyCode = "EUR" | "HUF";

export type Money = {
  value: number;
  currency: CurrencyCode;
};

export type Balance = Money & { primary: boolean };

export type Account = {
  holder: string;
  homeCity: string;
  homeCountry: string;
  homeCountryCode: string;
  currentCity: string;
  currentCountry: string;
  currentCountryCode: string;
  arrivedOn: string;
  balances: Balance[];
};

export type Transaction = {
  id: string;
  date: string;
  merchant: string;
  category: string;
  city: string;
  countryCode: string;
  amount: Money;
  amountEur: number;
};

export type FxRate = {
  pair: string;
  rate: number;
  asOf: string;
};

/** A specific place to go, as it sits in the seed data. */
export type RawProduct = {
  name: string;
  area: string;
  priceEur: number;
  priceHuf: number;
  mapsQuery: string;
  /** True when the account already has a transaction here. */
  visited?: boolean;
};

/** A spending category, as it sits in the seed data. */
export type RawCategory = {
  slug: string;
  label: string;
  unit: string;
  homeAvgEur: number;
  localAvgEur: number;
  purchasesPerYear: number;
  source: string;
  products: RawProduct[];
};

export type RecommendationData = {
  city: string;
  countryCode: string;
  comparedTo: { city: string; countryCode: string };
  fxRate: FxRate;
  categories: RawCategory[];
};

/** A product with its comparison against the local average computed. */
export type Product = RawProduct & {
  /** Percent below the local average. Negative means above it. */
  vsLocalAvgPct: number;
};

/** A category with its savings and ranking weight computed. */
export type Category = Omit<RawCategory, "products"> & {
  products: Product[];
  /** Percent cheaper here than at home. */
  savingPct: number;
  /** Money not spent over a year at the user's own purchase frequency. */
  annualSavingEur: number;
};
