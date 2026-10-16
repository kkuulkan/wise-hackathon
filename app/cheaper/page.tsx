import Link from "next/link";

import { CategoryList } from "@/components/CategoryList";
import {
  getAccount,
  getCategories,
  getRecommendationMeta,
  getTotalAnnualSaving,
  MIN_SAVING_PCT,
} from "@/lib/data";
import { formatEur } from "@/lib/format";
import styles from "./page.module.css";

export default function Cheaper() {
  const account = getAccount();
  const categories = getCategories();
  const meta = getRecommendationMeta();
  const total = getTotalAnnualSaving(categories);

  return (
    <main className={`page ${styles.main}`}>
      <Link href="/" className={styles.back}>
        <span aria-hidden="true">&larr;</span> Account
      </Link>

      <header className={styles.head}>
        <p className={styles.eyebrow}>
          <span className={styles.stampMark} aria-hidden="true" />
          {meta.city}
        </p>

        <h1 className={styles.title}>Cheaper here</h1>

        <p className={styles.lede}>
          Set against what you actually pay in {account.homeCity}. Switching every one
          of these would keep about{" "}
          <strong className="tabular">{formatEur(total, true)}</strong> a year.
        </p>
      </header>

      <CategoryList
        categories={categories}
        city={meta.city}
        homeCity={account.homeCity}
      />

      <footer className={styles.foot}>
        <p>
          Your side of every comparison comes from your own transactions. Local prices
          are a seeded snapshot for {meta.city}, not live data, and places are
          illustrative &mdash; each map link searches that category in the district
          named. Categories appear once they beat {account.homeCity} by at least{" "}
          {MIN_SAVING_PCT}%, ranked by money at stake rather than headline percentage.
        </p>
        <p className={styles.rate}>
          Converted at {meta.fxRate.rate} {meta.fxRate.pair}, {meta.fxRate.asOf}.
        </p>
      </footer>
    </main>
  );
}
