import { Suspense } from "react";

import { Hero } from "@/components/Hero";
import { DemoBar } from "@/components/live/DemoBar";
import { getLiveRecommendations, getLiveSession, getLiveTransactions } from "@/lib/live";

export default function Home() {
  return (
    /* No container here: each block below spans the full width and holds its
       own inner container, so backgrounds reach the viewport edges. */
    <main>
      <Suspense
        fallback={
          <p className="page fieldLabel" style={{ paddingTop: "var(--space-8)" }}>
            Opening your account…
          </p>
        }
      >
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
  const away = categories.length > 0;

  return (
    <>
      <DemoBar
        userId={profile.userId}
        homeCountryCode={profile.homeCountry}
        tripCountry={tripCountry}
      />

      <Hero
        account={account}
        categories={categories}
        transactions={transactions}
        away={away}
      />
    </>
  );
}
