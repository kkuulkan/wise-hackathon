import type { Transaction } from "@/lib/types";
import { categoryLabel } from "@/lib/data";
import { formatMoney, groupByDay } from "@/lib/format";
import styles from "./TransactionList.module.css";

type Props = {
  transactions: Transaction[];
  /** Home country, so foreign spending can be marked. */
  homeCountryCode: string;
};

export function TransactionList({ transactions, homeCountryCode }: Props) {
  if (transactions.length === 0) {
    return (
      <section className={styles.section}>
        <h2 className={styles.heading}>Recent activity</h2>
        <p className={styles.empty}>
          Nothing here yet. Spending will show up as it happens.
        </p>
      </section>
    );
  }

  // Anchored to the newest entry rather than the clock, so "Today" stays put.
  const reference = transactions[0].date;
  const groups = groupByDay(transactions, reference);

  return (
    <section className={styles.section}>
      <h2 className={styles.heading}>Recent activity</h2>

      {groups.map((group) => (
        <div key={group.label} className={styles.group}>
          <h3 className={styles.day}>{group.label}</h3>

          <ul className={styles.rows}>
            {group.items.map((transaction) => (
              <li key={transaction.id} className={styles.row}>
                <div className={styles.details}>
                  <span className={styles.merchant}>{transaction.merchant}</span>
                  <span className={styles.meta}>
                    <span className={styles.chip}>
                      {categoryLabel(transaction.category)}
                    </span>
                    {transaction.countryCode !== homeCountryCode && (
                      <span className={styles.city}>{transaction.city}</span>
                    )}
                  </span>
                </div>

                <span className={`${styles.amount} tabular`}>
                  &minus;{formatMoney(transaction.amount.value, transaction.amount.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
