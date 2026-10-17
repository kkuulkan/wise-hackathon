/**
 * Which ink a spending category is drawn in.
 *
 * Keyed by the label the bank's taxonomy gives each category (the labels in
 * data/seed/categories.json), because that is what reaches the UI once a
 * transaction's slug has been resolved for display.
 *
 * The ink belongs to the category, not to its rank in whatever list is being
 * drawn: Groceries is the same amber on Aoife's account, on Jonas's, and on a
 * visa card. There are five inks and more categories than that — see the note
 * in globals.css for why four — so each ink covers a family of related
 * spending, and the tail shares one neutral. Two categories from the same
 * family can therefore appear in one chart sharing an ink; the legend names
 * every slice, which is what actually carries identity.
 */
const INKS: Record<string, string> = {
  // Food and drink brought home.
  "Groceries to take home": "--ink-shopping",
  "Coffee to take home": "--ink-shopping",
  // Eating and drinking out, kept apart: a café is not a restaurant.
  "Dining out": "--ink-eating",
  Cafés: "--ink-cafe",
  // Getting about and staying connected.
  "Local transport": "--ink-getting-around",
  "Mobile data": "--ink-getting-around",
  // Things worn, used and carried.
  "Sneakers & clothing": "--ink-wearing",
  Electronics: "--ink-wearing",
  "Skincare & beauty": "--ink-wearing",
  "Hair & personal care": "--ink-wearing",
};

/** A CSS colour for `category`, ready to drop into a style or a fill. */
export function categoryInk(category: string): string {
  return `var(${INKS[category] ?? "--ink-other"})`;
}

/*
 * Which colour an account is drawn in. Set per traveller rather than derived
 * from the name: a hash gives nobody the colour you wanted, and there are
 * three of them. Anyone not listed falls back to a hash of their name, so a
 * new traveller still gets a colour of their own.
 */
const ACCOUNT_INKS: Record<string, string> = {
  "Aoife Brennan": "--ink-account-crimson",
  "Jonas Keller": "--ink-account-violet",
  "Saoirse Nolan": "--ink-account-teal",
};

const FALLBACK_INKS = [
  "--ink-account-crimson",
  "--ink-account-violet",
  "--ink-account-teal",
];

/** A CSS colour for the account holder `name`. */
export function accountInk(name: string): string {
  const named = ACCOUNT_INKS[name];
  if (named) return `var(${named})`;

  // djb2, so two unlisted names are unlikely to land on the same colour.
  let hash = 5381;
  for (const letter of name) {
    hash = (hash * 33 + letter.charCodeAt(0)) >>> 0;
  }
  return `var(${FALLBACK_INKS[hash % FALLBACK_INKS.length]})`;
}
