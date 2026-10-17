"use client";

import { useLayoutEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import type { Transaction } from "@/lib/types";
import { categoryLabel } from "@/lib/data";
import { formatDayGroup, formatMoney } from "@/lib/format";
import styles from "./Payments.module.css";

gsap.registerPlugin(ScrollTrigger);

/** How many entries show before the list has to be asked to open. */
const COLLAPSED = 5;

type Props = {
  transactions: Transaction[];
  homeCountryCode: string;
};

export function Payments({ transactions, homeCountryCode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Anchored to the newest entry rather than the clock, so "Today" stays put.
  const reference = transactions[0]?.date ?? "";
  const visible = expanded ? transactions : transactions.slice(0, COLLAPSED);
  const hidden = transactions.length - COLLAPSED;

  // The section rises into place as it enters, once.
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        `.${styles.panel}`,
        { y: 56, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: rootRef.current, start: "top 85%", once: true },
        },
      );

      // Positions are stale after a client navigation.
      ScrollTrigger.refresh();
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <section className={styles.section} ref={rootRef}>
      <div className={styles.panel}>
        <header className={styles.head}>
          <h2 className={styles.title}>Recent payments</h2>
          <p className={styles.sub}>
            What you spend sets the baseline for every comparison.
          </p>
        </header>

        {transactions.length === 0 ? (
          <p className={styles.empty}>
            Nothing here yet. Payments appear as they happen.
          </p>
        ) : (
          <>
            <ul className={styles.rows}>
              {visible.map((transaction) => (
                <li key={transaction.id} className={styles.row}>
                  <span className={styles.day}>
                    {formatDayGroup(transaction.date, reference)}
                  </span>

                  <span className={styles.merchant}>{transaction.merchant}</span>

                  <span className={styles.category}>
                    {categoryLabel(transaction.category)}
                    {transaction.countryCode !== homeCountryCode && (
                      <span className={styles.city}> · {transaction.city}</span>
                    )}
                  </span>

                  <span className={`${styles.amount} tabular`}>
                    {formatMoney(transaction.amount.value, transaction.amount.currency)}
                  </span>
                </li>
              ))}
            </ul>

            {hidden > 0 && (
              <button
                type="button"
                className={styles.more}
                onClick={() => setExpanded((open) => !open)}
                aria-expanded={expanded}
              >
                {expanded ? "Show fewer" : `View ${hidden} more`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}
