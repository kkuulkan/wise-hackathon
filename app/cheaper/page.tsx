import { Suspense } from "react";
import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import { VisaSpread } from "@/components/VisaSpread";
import { TrackView } from "@/components/live/TrackView";
import { getTotalAnnualSaving } from "@/lib/data";
import { formatEur } from "@/lib/format";
import { getLiveRecommendations, getLiveSession } from "@/lib/live";
import styles from "./page.module.css";

export default function Cheaper({ searchParams }: PageProps<"/cheaper">) {
  return (
    <main className={`page ${styles.main}`}>
      <Link href="/" className={styles.back}>
        <IconArrowLeft size={14} stroke={2} aria-hidden="true" />
        Data page
      </Link>

      <div className={styles.booklet}>
        <div className={styles.sheet}>
          <Suspense fallback={<p className="fieldLabel">Checking prices…</p>}>
            <CheaperContent searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}

const PROBLEMS = {
  "signed-out": "Choose a traveller on the data page first.",
  "no-trip": "You are at home right now. Simulate an arrival on the data page to see what is cheaper.",
  "not-eligible": "OtherWise compares prices between your home country and another E.U. country.",
  "bad-country": "We do not know that country yet.",
} as const;

function Problem({ reason }: { reason: keyof typeof PROBLEMS }) {
  return (
    <header className={styles.head}>
      <p className="fieldLabel">Visas / Endorsements</p>
      <p className={styles.lede}>{PROBLEMS[reason]}</p>
    </header>
  );
}

/**
 * `?country=PT` comes from the notification's deep link. Without it, the
 * active trip's country is used.
 */
async function CheaperContent({ searchParams }: Pick<PageProps<"/cheaper">, "searchParams">) {
  const session = await getLiveSession();
  if (!session) return <Problem reason="signed-out" />;

  const { country } = await searchParams;
  const result = await getLiveRecommendations(
    session,
    typeof country === "string" ? country : undefined,
  );
  if (!result.ok) return <Problem reason={result.reason} />;

  const { account } = session;
  const { response, categories } = result;
  const city = response.country.name;
  const total = getTotalAnnualSaving(categories);

  return (
    <>
      <TrackView type="recommendations_viewed" country={response.country.code} />

      <header className={styles.head}>
        <p className="fieldLabel">Visas / Endorsements</p>
        <h1 className={styles.title}>{city}</h1>
        <p className={styles.lede}>
          Set against prices in {account.homeCity}.{" "}
          {total > 0 ? (
            <>
              At your own rate of spending, switching would keep about{" "}
              <strong className="tabular">{formatEur(total, true)}</strong> a year.
            </>
          ) : (
            <>These are general suggestions, not based on your payments.</>
          )}
        </p>
      </header>

      <VisaSpread categories={categories} city={city} homeCity={account.homeCity} />

      <footer className={styles.foot}>
        <p>
          Categories come from your own payments over the last 90 days, ranked by how much
          and how often you spend. Only items that cost less here than at home are shown.{" "}
          {response.disclosure}
        </p>
        <p className={styles.rate}>
          {response.fx
            ? `Converted at ${response.fx.rate} ${response.fx.pair}, ${response.fx.asOf}. `
            : ""}
          {response.source === "fallback" ? "Showing saved prices; live prices are unavailable. " : ""}
          This is a prototype, not a travel document.
        </p>
      </footer>
    </>
  );
}
