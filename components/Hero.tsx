"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { IconMapPin, IconTicket } from "@tabler/icons-react";

import type { Account, Category, Transaction } from "@/lib/types";
import { balanceSeries, recentSpend } from "@/lib/balance";
import { formatDayGroup, formatEur, formatMoney } from "@/lib/format";
import { CountryPicker } from "./live/CountryPicker";
import { ArrivalTicket } from "./ArrivalTicket";
import { CountUp } from "./CountUp";
import { Sparkline } from "./Sparkline";
import styles from "./Hero.module.css";

/** How many payments sit under the weekly summary. */
const RECENT = 3;

/*
 * Tonal ramp for the weekly split, so the bar needs no second colour. Spread
 * across however many slices there are: a fixed step of 0.22 faded the fifth
 * slice to 0.12 and anything past it to nothing, which is what made a week
 * with six categories unreadable.
 */
function shade(index: number, count: number): number {
  const span = 0.72;
  const step = count < 2 ? 0 : (index / (count - 1)) * span;
  // Rounded, so the inline style is 0.568 rather than 0.5680000000000001.
  return Math.round((1 - step) * 1000) / 1000;
}

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
  const [dismissed, setDismissed] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  /** Width before the layout switched, so the regrowth can be animated. */
  const fromWidth = useRef<number | null>(null);


  const showTicket = away && !dismissed;

  const handleDismiss = useCallback(() => {
    fromWidth.current = accountRef.current?.getBoundingClientRect().width ?? null;
    setDismissed(true);
  }, []);

  /* Put away, not thrown away: the tab on the edge brings it back. */
  const handleReopen = useCallback(() => setDismissed(false), []);

  /*
   * The account grows back. Grid tracks cannot tween between one column and
   * two, so the old width is measured before the switch and the new one after,
   * then animated between the two and released.
   */
  useLayoutEffect(() => {
    const element = accountRef.current;
    const from = fromWidth.current;
    fromWidth.current = null;

    if (!element || from === null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const to = element.getBoundingClientRect().width;
    if (Math.abs(to - from) < 2) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        element,
        { width: from },
        { width: to, duration: 0.55, ease: "power3.inOut", clearProps: "width" },
      );
      // The column that comes back slides in rather than appearing.
      gsap.fromTo(
        `.${styles.week}`,
        { opacity: 0, x: 28 },
        { opacity: 1, x: 0, duration: 0.45, delay: 0.12, ease: "power2.out" },
      );
    }, accountRef);

    return () => ctx.revert();
  }, [dismissed]);

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
        src="/Image.jpeg"
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
        <div className={showTicket ? styles.gridAway : styles.gridHome}>
          <div className={styles.account} ref={accountRef}>
            <div className={styles.who}>
              <span className={styles.avatar} aria-hidden="true">
                {initials(account.holder)}
              </span>

              {/* Name first and large, with where they are right now beside
                  it. One place, not a journey described in prose. */}
              <span className={styles.whoText}>
                <b>{account.holder}</b>

                <span className={styles.place}>
                  <IconMapPin size={15} stroke={2.2} aria-hidden="true" />
                  {account.currentCity}
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

                {/*
                  Always here, trip or no trip: the comparison can be asked
                  for, which also leaves a standing entry point once the
                  arrival ticket has been dismissed (FR-7).
                */}
                <div className={styles.tail}>
                  <CountryPicker
                    tripCountry={away ? account.currentCountryCode : null}
                    homeCity={account.homeCity}
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
              </div>

              {!showTicket && (
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
                            opacity: shade(index, week.slices.length),
                          }}
                        />
                      ))}
                    </div>

                    <ul className={styles.legend}>
                      {week.slices.map((slice, index) => (
                        <li key={slice.category}>
                          <i style={{ opacity: shade(index, week.slices.length) }} />
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

          {/*
            Set aside rather than gone: a tab on the edge of the page for the
            rest of the trip, so "see later" can actually mean later.
          */}
          {away && dismissed && (
            <button
              type="button"
              className={styles.ticketTab}
              onClick={handleReopen}
              aria-label={`See cheap prices in ${account.currentCountry}`}
            >
              <IconTicket size={16} stroke={2} aria-hidden="true" />
              <span>See cheap prices in {account.currentCountry}</span>
            </button>
          )}

          {showTicket && (
            <ArrivalTicket
              country={account.currentCountry}
              homeCity={account.homeCity}
              categories={categories}
              onDismiss={handleDismiss}
            />
          )}
        </div>
      </div>
    </section>
  );
}
