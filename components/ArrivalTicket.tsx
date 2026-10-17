"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import gsap from "gsap";

import type { Category } from "@/lib/types";
import { formatPct } from "@/lib/format";
import { DISMISS_TICKET } from "@/lib/ticket";
import styles from "./ArrivalTicket.module.css";

/** How many categories the ticket previews before the full list. */
const PREVIEW = 3;

type Props = {
  /** Destination country name: the backend knows the country, not the city. */
  country: string;
  homeCity: string;
  categories: Category[];
  /** Called once the ticket has finished sliding off to the right. */
  onDismiss: () => void;
};

export function ArrivalTicket({ country, homeCity, categories, onDismiss }: Props) {
  const rootRef = useRef<HTMLElement>(null);
  const leaving = useRef(false);

  // Slides off to the right, then hands back so the account can grow again.
  const dismiss = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      onDismiss();
      return;
    }

    gsap.to(rootRef.current, {
      xPercent: 118,
      yPercent: 10,
      rotate: 5,
      opacity: 0,
      duration: 0.6,
      ease: "power3.in",
      onComplete: onDismiss,
    });
  }, [onDismiss]);

  // "Fly home" and anything else that ends the trip plays the same exit.
  useEffect(() => {
    const onRequest = (event: Event) => {
      // Claim it only when there is an animation to wait for, so reduced
      // motion is not held up by a timer for something that never plays.
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        event.preventDefault();
      }
      dismiss();
    };

    window.addEventListener(DISMISS_TICKET, onRequest);
    return () => window.removeEventListener(DISMISS_TICKET, onRequest);
  }, [dismiss]);

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
        <p className={`fieldLabel ${styles.eyebrow}`}>Arrival &middot; {country}</p>

        <h1 className={styles.title} id="arrival-title">
          Welcome to {country}
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

        <button type="button" className={styles.later} onClick={dismiss}>
          See later
        </button>
      </div>
    </aside>
  );
}
