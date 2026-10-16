"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import gsap from "gsap";
import styles from "./ArrivalSheet.module.css";

type Props = {
  city: string;
  homeCity: string;
  count: number;
  savingLabel: string;
};

/** How long the account sits undisturbed before the sheet lands. */
const DELAY_MS = 1200;

export function ArrivalSheet({ city, homeCity, count, savingLabel }: Props) {
  const [visible, setVisible] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  // The stamp: the panel lands, then the text arrives struck onto it.
  useEffect(() => {
    if (!visible) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      if (reduced) {
        gsap.set([`.${styles.panel}`, `.${styles.struck}`], { opacity: 1 });
        return;
      }

      gsap
        .timeline()
        .fromTo(
          `.${styles.panel}`,
          { opacity: 0, scale: 1.04, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 0.18, ease: "power3.out" },
        )
        .fromTo(
          `.${styles.struck}`,
          { opacity: 0, y: 6 },
          { opacity: 1, y: 0, duration: 0.24, stagger: 0.05, ease: "power2.out" },
          0.06,
        );
    }, rootRef);

    return () => ctx.revert();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setVisible(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className={styles.root} ref={rootRef}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="false"
        aria-labelledby="arrival-title"
      >
        <p className={`${styles.struck} ${styles.eyebrow}`}>
          <span className={styles.stampMark} aria-hidden="true" />
          Arrived {city}
        </p>

        <h2 className={`${styles.struck} ${styles.title}`} id="arrival-title">
          Welcome to {city}
        </h2>

        <p className={`${styles.struck} ${styles.body}`}>
          {count} things you already buy cost less here than in {homeCity}. Switching
          to the cheapest nearby would keep about{" "}
          <strong className="tabular">{savingLabel}</strong> a year.
        </p>

        <div className={`${styles.struck} ${styles.actions}`}>
          <Link href="/cheaper" className={styles.primary}>
            See what&rsquo;s cheaper
          </Link>

          <button
            type="button"
            className={styles.dismiss}
            onClick={() => setVisible(false)}
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
