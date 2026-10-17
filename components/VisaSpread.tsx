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
};

export function VisaSpread({ categories, city, homeCity }: Props) {
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

      gsap
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

      // Stamps land one after another, as if applied by hand.
      visas.forEach((visa, index) => {
        gsap.fromTo(
          visa,
          { opacity: 0, y: 24, rotate: index % 2 === 0 ? -2 : 2 },
          {
            opacity: 1,
            y: 0,
            rotate: 0,
            duration: 0.45,
            delay: index < 2 ? 0.75 + index * 0.12 : 0,
            ease: "power2.out",
            scrollTrigger: { trigger: visa, start: "top 94%", once: true },
          },
        );
      });

      // Positions are stale after a client navigation.
      ScrollTrigger.refresh();
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
          <p className="fieldLabel">Visas / Endorsements</p>
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
              index={index}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
