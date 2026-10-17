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

/** One recommended product, as the catalog compared it for this country pair. */
export type Product = {
  /** Catalog id. Needed to report the product back, as feedback does. */
  id: string;
  name: string;
  area: string;
  priceEur: number;
  /** The same price in the destination's own currency, or null in the euro area. */
  priceLocal: { amount: number; currency: CurrencyCode } | null;
  /** Percent cheaper here than at home. Always positive: dearer items are dropped. */
  savingPct: number;
  /** Where tapping it goes. Built by the catalog and free of personal data. */
  url: string;
  /** True when the account already has a transaction here. */
  visited?: boolean;
};

/** A spending category with its products and savings. */
export type Category = {
  slug: string;
  label: string;
  /** Icon name from the bank's taxonomy, mapped to a glyph at render time. */
  icon: string;
  unit: string;
  homeAvgEur: number;
  localAvgEur: number;
  purchasesPerYear: number;
  source: string;
  products: Product[];
  /** Percent cheaper here than at home. */
  savingPct: number;
};
