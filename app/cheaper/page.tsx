import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";

import { VisaSpread } from "@/components/VisaSpread";
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
        <IconArrowLeft size={14} stroke={2} aria-hidden="true" />
        Data page
      </Link>

      <div className={styles.booklet}>
        <div className={styles.sheet}>
        <header className={styles.head}>
          <p className="fieldLabel">Visas / Endorsements</p>
          <h1 className={styles.title}>{meta.city}</h1>
          <p className={styles.lede}>
            Set against what you pay in {account.homeCity}. All of them together keep
            about <strong className="tabular">{formatEur(total, true)}</strong> a year.
          </p>
        </header>

        <VisaSpread
          categories={categories}
          city={meta.city}
          homeCity={account.homeCity}
        />

        <footer className={styles.foot}>
          <p>
            Your side of every comparison comes from your own entries. Local prices are
            a seeded snapshot for {meta.city}, not live data. Places are illustrative,
            and each map link searches that category in the district named. Endorsements
            are issued once a category beats {account.homeCity} by at least{" "}
            {MIN_SAVING_PCT}%, ordered by money at stake rather than headline
            percentage.
          </p>
          <p className={styles.rate}>
            Converted at {meta.fxRate.rate} {meta.fxRate.pair}, {meta.fxRate.asOf}. This
            is a prototype, not a travel document.
          </p>
        </footer>
        </div>
      </div>
    </main>
  );
}
