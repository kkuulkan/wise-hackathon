import { Benefits } from "@/components/Benefits";
import { Hero } from "@/components/Hero";
import { Payments } from "@/components/Payments";
import {
  getAccount,
  getCategories,
  getTotalAnnualSaving,
  getTransactions,
  MIN_SAVING_PCT,
} from "@/lib/data";
import { formatEur, formatPct } from "@/lib/format";

export default function Home() {
  const account = getAccount();
  const transactions = getTransactions();
  const categories = getCategories();
  const total = getTotalAnnualSaving(categories);

  const away = account.currentCountryCode !== account.homeCountryCode;
  const top = categories[0];

  // Every figure here is read off the real data, so none of it can drift.
  const tiles = [
    {
      figure: formatEur(total, true),
      caption: "Kept per year",
      title: "Priced against what you actually pay",
      body: `Your own payments set the baseline, not a national average. You paid what you paid in ${account.homeCity}, and that is the number we compare against.`,
    },
    {
      figure: String(categories.length),
      caption: "Narrow categories",
      title: "Specific enough to act on",
      body: "Not groceries or leisure. A haircut, a dental cleaning, a month of gym. Broad categories make comparisons nobody can do anything with.",
    },
    {
      figure: top ? formatPct(top.savingPct) : "—",
      caption: top ? `On ${top.label.toLowerCase()}` : "No match",
      title: "Ranked by money, not percentage",
      body: `Ordered by what you would actually keep. ${top ? `${top.label} tops the list at ${formatEur(top.annualSavingEur, true)} a year` : "Nothing qualifies yet"}, and anything under ${MIN_SAVING_PCT}% cheaper never appears at all.`,
    },
  ];

  return (
    <main className="page">
      <Hero account={account} categories={categories} away={away} />

      <Payments
        transactions={transactions}
        homeCountryCode={account.homeCountryCode}
      />

      <Benefits tiles={tiles} />
    </main>
  );
}
