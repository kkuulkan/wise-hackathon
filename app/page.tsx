import Link from "next/link";

import { ArrivalSheet } from "@/components/ArrivalSheet";
import { BalanceCard } from "@/components/BalanceCard";
import { TransactionList } from "@/components/TransactionList";
import {
  getAccount,
  getCategories,
  getTotalAnnualSaving,
  getTransactions,
} from "@/lib/data";
import { formatEur } from "@/lib/format";
import styles from "./page.module.css";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export default function Home() {
  const account = getAccount();
  const transactions = getTransactions();
  const categories = getCategories();
  const savingLabel = formatEur(getTotalAnnualSaving(categories), true);

  const away = account.currentCountryCode !== account.homeCountryCode;

  return (
    <>
      <main className={`page ${styles.main}`}>
        <header className={styles.bar}>
          <span className={styles.avatar} aria-hidden="true">
            {initials(account.holder)}
          </span>
          <span className={styles.holder}>{account.holder}</span>
        </header>

        <BalanceCard account={account} />

        {away && (
          <Link href="/cheaper" className={styles.banner}>
            <span className={styles.bannerMark} aria-hidden="true" />
            <span className={styles.bannerText}>
              <strong>{categories.length} things are cheaper in {account.currentCity}</strong>
              <span className={styles.bannerSub}>
                Compared with what you pay in {account.homeCity}
              </span>
            </span>
            <span className={styles.bannerArrow} aria-hidden="true">
              &rarr;
            </span>
          </Link>
        )}

        <TransactionList
          transactions={transactions}
          homeCountryCode={account.homeCountryCode}
        />
      </main>

      {away && (
        <ArrivalSheet
          city={account.currentCity}
          homeCity={account.homeCity}
          count={categories.length}
          savingLabel={savingLabel}
        />
      )}
    </>
  );
}
