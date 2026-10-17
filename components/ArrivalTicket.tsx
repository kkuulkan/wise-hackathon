"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";

import type { Category } from "@/lib/types";
import { formatPct } from "@/lib/format";
import styles from "./ArrivalTicket.module.css";

/** How many categories the ticket previews before the full list. */
const PREVIEW = 3;

type Props = {
  city: string;
  homeCity: string;
  categories: Category[];
};

export function ArrivalTicket({ city, homeCity, categories }: Props) {
  const rootRef = useRef<HTMLElement>(null);

  // Flies in from the top right corner, then settles level.
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        rootRef.current,
        { xPercent: 26, yPercent: -34, rotate: 7, opacity: 0 },
        {
          xPercent: 0,
          yPercent: 0,
          rotate: 0,
          opacity: 1,
          duration: 0.9,
          ease: "power3.out",
        },
      );
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <aside
      className={styles.ticket}
      aria-labelledby="arrival-title"
      ref={rootRef}
    >
      <div className={styles.body}>
        <p className={`fieldLabel ${styles.eyebrow}`}>Arrival &middot; {city}</p>

        <h1 className={styles.title} id="arrival-title">
          Welcome to {city}
        </h1>

        <p className={`fieldLabel ${styles.listLabel}`}>Cheaper than {homeCity}</p>

        <ul className={styles.list}>
          {categories.slice(0, PREVIEW).map((category) => (
            <li key={category.slug} className={styles.row}>
              <span className={styles.name}>{category.label}</span>
              <span className={`${styles.saving} tabular`}>
                {formatPct(category.savingPct)}
                <span className={styles.unit}>cheaper</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* The stub, below the perforation. */}
      <div className={styles.stub}>
        <Link href="/cheaper" className={styles.cta}>
          See full list
        </Link>
      </div>
    </aside>
  );
}
