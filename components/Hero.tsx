import Image from "next/image";

import type { Account, Category, Transaction } from "@/lib/types";
import { balanceSeries, recentSpend } from "@/lib/balance";
import { formatDayGroup, formatEur, formatMoney } from "@/lib/format";
import { ArrivalTicket } from "./ArrivalTicket";
import { CountUp } from "./CountUp";
import { Sparkline } from "./Sparkline";
import styles from "./Hero.module.css";

/** How many payments sit under the weekly summary. */
const RECENT = 3;

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

type Props = {
  account: Account;
  categories: Category[];
  transactions: Transaction[];
  away: boolean;
};

export function Hero({ account, categories, transactions, away }: Props) {
  const primary = account.balances.find((balance) => balance.primary);
  const secondary = account.balances.filter((balance) => !balance.primary);

  const series = balanceSeries(transactions, primary?.value ?? 0);
  const week = recentSpend(transactions);

  // Anchored to the newest payment rather than the clock, so "Today" stays put.
  const reference = transactions[0]?.date ?? account.arrivedOn;
  const recent = transactions.slice(0, RECENT);

  return (
    <section className={styles.hero}>
      {/*
        The backdrop photograph. `fill` with object-fit cover keeps it filling
        the block at any viewport without distorting, and Next serves a sized,
        optimised file rather than the full-size original.
      */}
      <Image
        src="/Background.jpeg"
        alt=""
        aria-hidden="true"
        fill
        priority
        sizes="100vw"
        className={styles.backdrop}
      />

      <div className={`page ${styles.inner}`}>
        {/*
          Before arrival the account has the width to itself and lays out in two
          columns. Once the ticket arrives it shrinks to one narrow column. The
          glass is on the account only; the ticket is paper.
        */}
        <div className={away ? styles.gridAway : styles.gridHome}>
          <div className={styles.account}>
            <div className={styles.who}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(account.holder)}
              </span>

              <span className={styles.whoText}>
                <b>{account.holder}</b>
                <span>
                  {account.homeCity}
                  {away ? `, now in ${account.currentCity}` : ""}
                </span>
              </span>

              {away && (
                <span className={styles.route} aria-hidden="true">
                  {account.homeCountryCode}
                  <i />
                  {account.currentCountryCode}
                </span>
              )}
            </div>

            <div className={styles.cols}>
              <div className={styles.main}>
                <p className="fieldLabel">Balance</p>
                <p className={`${styles.balance} tabular`}>
                  {primary ? (
                    <CountUp value={primary.value} currency={primary.currency} />
                  ) : (
                    "—"
                  )}
                </p>

                <div className={styles.fx}>
                  {secondary.map((balance) => (
                    <span key={balance.currency} className={`${styles.sub} tabular`}>
                      {formatMoney(balance.value, balance.currency)}
                    </span>
                  ))}
                  <span className={styles.pill}>{account.homeCity} account</span>
                </div>

                <Sparkline
                  series={series}
                  label={`Balance across the last ${series.length} payments, ending at ${formatEur(primary?.value ?? 0)}`}
                />

                <div className={styles.actions}>
                  <button type="button" className={styles.primaryAction}>
                    Send money
                  </button>
                  <button type="button" className={styles.ghostAction}>
                    Add money
                  </button>
                  <button type="button" className={styles.ghostAction}>
                    Convert
                  </button>
                </div>
              </div>

              {!away && (
                <div className={styles.week}>
                {week.slices.length > 0 && (
                  <>
                    <p className="fieldLabel">Spent this week</p>
                    <p className={`${styles.weekTotal} tabular`}>
                      {formatEur(week.totalEur)}
                    </p>

                    <div
                      className={styles.split}
                      role="img"
                      aria-label={week.slices
                        .map(
                          (slice) =>
                            `${slice.category} ${Math.round(slice.share * 100)} percent`,
                        )
                        .join(", ")}
                    >
                      {week.slices.map((slice, index) => (
                        <i
                          key={slice.category}
                          style={{
                            flexGrow: slice.share * 100,
                            // Tonal ramp, so the bar needs no second colour.
                            opacity: 1 - index * 0.22,
                          }}
                        />
                      ))}
                    </div>

                    <ul className={styles.legend}>
                      {week.slices.map((slice, index) => (
                        <li key={slice.category}>
                          <i style={{ opacity: 1 - index * 0.22 }} />
                          {slice.category}
                          <b className="tabular">{formatEur(slice.totalEur)}</b>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                {recent.length > 0 && (
                  <div className={styles.recent}>
                    <p className="fieldLabel">Recent payments</p>

                    <ul className={styles.recentList}>
                      {recent.map((transaction) => (
                        <li key={transaction.id} className={styles.recentRow}>
                          <span className={styles.recentMerchant}>
                            {transaction.merchant}
                            <span className={styles.recentMeta}>
                              {formatDayGroup(transaction.date, reference)} ·{" "}
                              {transaction.category}
                            </span>
                          </span>

                          <span className={`${styles.recentAmount} tabular`}>
                            {formatMoney(
                              transaction.amount.value,
                              transaction.amount.currency,
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                </div>
              )}
            </div>
          </div>

          {away && (
            <ArrivalTicket
              city={account.currentCity}
              homeCity={account.homeCity}
              categories={categories}
            />
          )}
        </div>
      </div>
    </section>
  );
}
