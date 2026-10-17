import { Suspense } from "react";

import { Benefits } from "@/components/Benefits";
import { Hero } from "@/components/Hero";
import { Payments } from "@/components/Payments";
import { DemoBar } from "@/components/live/DemoBar";
import { getTotalAnnualSaving } from "@/lib/data";
import { formatEur, formatPct } from "@/lib/format";
import { getLiveRecommendations, getLiveSession, getLiveTransactions } from "@/lib/live";

export default function Home() {
  return (
    <main className="page">
      <Suspense fallback={<p className="fieldLabel">Opening your account…</p>}>
        <HomeContent />
      </Suspense>
    </main>
  );
}

/** Reads the signed-in traveller, so it renders per request behind Suspense. */
async function HomeContent() {
  const session = await getLiveSession();

  if (!session) {
    return (
      <>
        <DemoBar userId={null} homeCountryCode={null} tripCountry={null} />
        <p className="fieldLabel" style={{ margin: "var(--space-6) var(--page-gutter)" }}>
          Choose a traveller above to open their account.
        </p>
      </>
    );
  }

  const { account, profile, tripCountry } = session;
  const transactions = getLiveTransactions(profile);
  const recommendations = tripCountry ? await getLiveRecommendations(session) : null;
  const categories = recommendations?.ok ? recommendations.categories : [];
  const total = getTotalAnnualSaving(categories);

  const away = categories.length > 0;
  const top = categories[0];

  // Every figure here is read off the backend's answer, so none of it can drift.
  const tiles = [
    {
      figure: formatEur(total, true),
      caption: "Could keep per year",
      title: "Priced against your home prices",
      body: `Each item is priced in ${account.homeCountry} and here, and the yearly figure scales what you actually spent in the last 90 days.`,
    },
    {
      figure: String(categories.length),
      caption: "Categories you buy",
      title: "Picked from your own payments",
      body: "Ranked by how much and how often you spend. Rent, insurance and sensitive spending such as pharmacy or gambling never count.",
    },
    {
      figure: top ? formatPct(top.savingPct) : "—",
      caption: top ? `On ${top.label.toLowerCase()}` : "Not travelling",
      title: "Only real savings",
      body: "Every item shown costs less here than at home. A category where nothing is cheaper is left out, however much you spend on it.",
    },
  ];

  return (
    <>
      <DemoBar
        userId={profile.userId}
        homeCountryCode={profile.homeCountry}
        tripCountry={tripCountry}
      />

      <Hero account={account} categories={categories} away={away} />

      <Payments transactions={transactions} homeCountryCode={account.homeCountryCode} />

      <Benefits tiles={tiles} />
    </>
  );
}
