"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import type { Category } from "@/lib/types";
import { Visa } from "./Visa";
import styles from "./VisaSpread.module.css";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  categories: Category[];
  city: string;
  homeCity: string;
  /** Destination country code, passed down for the product_tapped event. */
  countryCode: string;
};

export function VisaSpread({ categories, city, homeCity, countryCode }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const turningSelector = `.${styles.turningPage}`;

    const ctx = gsap.context(() => {
      const turning = turningSelector;
      const sweep = `.${styles.sweep}`;
      const visas = gsap.utils.toArray<HTMLElement>(`.${styles.visa}`);

      if (reduced) {
        // Cross-fade instead of turning, and let the stamps simply be there.
        gsap.to(turning, { autoAlpha: 0, duration: 0.3 });
        gsap.set(visas, { opacity: 1, y: 0, rotate: 0 });
        return;
      }

      // Where a stamp lands from. Set up front, so nothing is ever briefly
      // visible before its own tween takes hold.
      gsap.set(visas, {
        opacity: 0,
        y: 24,
        rotate: (index: number) => (index % 2 === 0 ? -2 : 2),
      });

      const START = "top 94%";
      const land = { opacity: 1, y: 0, rotate: 0, duration: 0.45, ease: "power2.out" };

      /*
       * Two groups, because a stamp must never overtake the one above it.
       * Everything on screen when the page turns is sequenced inside the
       * timeline; everything below waits for the scroll, and those triggers
       * are only created once the sequence has finished. Previously each card
       * carried both a delay and a trigger, so card two sat out its 0.87s
       * while card three, with no delay at all, landed the moment it was
       * scrolled into view — and arrived first.
       */
      const fold = window.innerHeight * 0.94;
      const onScreen = visas.filter((visa) => visa.getBoundingClientRect().top < fold);
      const below = visas.slice(onScreen.length);

      const timeline = gsap
        .timeline()
        // The page swings away on its spine, revealing the spread beneath.
        .to(turning, {
          rotateY: -168,
          duration: 0.9,
          ease: "power3.inOut",
          onComplete: () => gsap.set(turning, { autoAlpha: 0 }),
        })
        // Light travelling across the page face as it lifts.
        .fromTo(sweep, { opacity: 0 }, { opacity: 0.55, duration: 0.45 }, 0)
        .to(sweep, { opacity: 0, duration: 0.45 }, 0.45);

      // Stamped by hand, one after another, as the page comes off them.
      onScreen.forEach((visa, index) => {
        timeline.to(visa, land, 0.55 + index * 0.12);
      });

      timeline.call(() => {
        below.forEach((visa) => {
          gsap.to(visa, {
            ...land,
            scrollTrigger: { trigger: visa, start: START, once: true },
          });
        });
        // Positions are stale after a client navigation.
        ScrollTrigger.refresh();
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  // The turning page is server-rendered so it already covers the spread on the
  // first paint. If the animation cannot run it would cover it forever, so an
  // uncaught failure uncovers the content instead of hiding the whole screen.
  useLayoutEffect(() => {
    const safety = window.setTimeout(() => {
      const page = rootRef.current?.querySelector<HTMLElement>(
        `.${styles.turningPage}`,
      );

      if (page && page.style.visibility !== "hidden") {
        page.style.display = "none";
      }
    }, 2500);

    return () => window.clearTimeout(safety);
  }, []);

  if (categories.length === 0) {
    return (
      <p className={styles.empty}>
        No endorsements for this country yet. Nothing here beats {homeCity} by enough to
        be worth the trip.
      </p>
    );
  }

  return (
    <div className={styles.spread} ref={rootRef}>
      {/*
        Shown only when <html> carries `anim`, which the pre-paint script sets
        and clears again if hydration fails. No scripts means no cover, so the
        spread is never hidden behind a page that cannot turn.
      */}
      <div className={styles.turningPage} aria-hidden="true">
        <div className={styles.turningFace}>
          <p className={styles.turningCity}>{city}</p>
        </div>
        <div className={styles.sweep} />
      </div>


      <div className={styles.visas}>
        {categories.map((category, index) => (
          <div key={category.slug} className={styles.visa}>
            <Visa
              category={category}
              city={city}
              homeCity={homeCity}
              countryCode={countryCode}
              index={index}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
