import Link from "next/link";
import { IconPlaneArrival } from "@tabler/icons-react";

import type { Account, Category } from "@/lib/types";
import { buildMrz } from "@/lib/mrz";
import { formatMoney, formatPct } from "@/lib/format";
import { CountUp } from "./CountUp";
import styles from "./Hero.module.css";

/** How many categories the arrival notice previews before the full list. */
const PREVIEW = 3;

type Props = {
  account: Account;
  categories: Category[];
  away: boolean;
};

export function Hero({ account, categories, away }: Props) {
  const primary = account.balances.find((balance) => balance.primary);
  const secondary = account.balances.filter((balance) => !balance.primary);
  // One line only: a nod to the document, not a reproduction of one.
  const [mrz] = buildMrz(account);

  return (
    <section className={styles.hero}>
      <div className={styles.grid}>
        <div className={styles.identity}>
          <p className={styles.logo}>OtherWise</p>

          <p className={styles.holder}>{account.holder}</p>

          <p className="fieldLabel">Total balance</p>
          <p className={`${styles.balance} tabular`}>
            {primary ? (
              <CountUp value={primary.value} currency={primary.currency} />
            ) : (
              "—"
            )}
          </p>

          {secondary.length > 0 && (
            <ul className={styles.secondary}>
              {secondary.map((balance) => (
                <li key={balance.currency} className="tabular">
                  {formatMoney(balance.value, balance.currency)}
                </li>
              ))}
            </ul>
          )}
        </div>

        {away && (
          <aside className={styles.notice} aria-labelledby="arrival-title">
            <p className={styles.noticeEyebrow}>
              <IconPlaneArrival size={15} stroke={2} aria-hidden="true" />
              Arrival &middot; {account.currentCity}
            </p>

            <h1 className={styles.noticeTitle} id="arrival-title">
              Welcome to {account.currentCity}
            </h1>

            <p className={`fieldLabel ${styles.previewLabel}`}>
              Cheaper than {account.homeCity}
            </p>

            <ul className={styles.preview}>
              {categories.slice(0, PREVIEW).map((category) => (
                <li key={category.slug} className={styles.previewRow}>
                  <span className={styles.previewName}>{category.label}</span>
                  <span className={`${styles.previewSaving} tabular`}>
                    {formatPct(category.savingPct)}
                    <span className={styles.previewUnit}>cheaper</span>
                  </span>
                </li>
              ))}
            </ul>

            <Link href="/cheaper" className={styles.cta}>
              See full list
            </Link>
          </aside>
        )}
      </div>

      <p className={`mrz ${styles.strip}`} aria-hidden="true">
        {mrz}
      </p>
    </section>
  );
}
