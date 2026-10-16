import type { Account } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import styles from "./BalanceCard.module.css";

export function BalanceCard({ account }: { account: Account }) {
  const primary = account.balances.find((balance) => balance.primary);
  const others = account.balances.filter((balance) => !balance.primary);

  if (!primary) {
    return (
      <section className={styles.card}>
        <p className={styles.empty}>No balances on this account yet.</p>
      </section>
    );
  }

  return (
    <section className={styles.card} aria-labelledby="balance-label">
      <p className={styles.label} id="balance-label">
        Total balance
      </p>

      <p className={`${styles.amount} tabular`}>
        {formatMoney(primary.value, primary.currency)}
      </p>

      {others.length > 0 && (
        <ul className={styles.others}>
          {others.map((balance) => (
            <li key={balance.currency} className={`${styles.other} tabular`}>
              {formatMoney(balance.value, balance.currency)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
