import { Suspense } from "react";

import { Hero } from "@/components/Hero";
import { ConsentGate } from "@/components/live/ConsentGate";
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
        <DemoBar
          userId={null}
          holder={null}
          homeCity={null}
          homeCountryCode={null}
          tripCountry={null}
          notificationsAllowed={false}
        />
        <p className="fieldLabel" style={{ margin: "var(--space-6) var(--page-gutter)" }}>
          Choose a traveller above to open their account.
        </p>
      </>
    );
  }

  const { account, consent, profile, tripCountry } = session;
  const transactions = await getLiveTransactions(profile);
  const recommendations = tripCountry ? await getLiveRecommendations(session) : null;
  const categories = recommendations?.ok ? recommendations.categories : [];
  const away = categories.length > 0;

  return (
    <>
      {/*
        US-6.1: asked once, before any of their own data is on screen. The
        answer is stored server-side, and it is the backend that then decides
        what may be computed, so there is nothing to enforce out here.
      */}
      {!consent.decided && <ConsentGate />}

      <DemoBar
        userId={profile.userId}
        holder={account.holder}
        homeCity={account.homeCity}
        homeCountryCode={profile.homeCountry}
        tripCountry={tripCountry}
        notificationsAllowed={consent.notifications}
      />

      <Hero
        /* Keyed to the trip: a new arrival remounts the hero, so a dismissed
           ticket comes back and its entrance plays again. */
        key={`${account.currentCountryCode}-${away}`}
        account={account}
        categories={categories}
        transactions={transactions}
        away={away}
      />
    </>
  );
}
