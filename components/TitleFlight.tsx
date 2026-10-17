"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { IconPlane } from "@tabler/icons-react";

import styles from "./TitleFlight.module.css";

type Props = {
  /** The country or city the page is about. */
  city: string;
};

/**
 * The country name, with a plane crossing straight through it.
 *
 * Mounts at the same moment as the spread below, so the flight and the page
 * turn read as one movement without the two components having to coordinate.
 */
export function TitleFlight({ city }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const plane = `.${styles.plane}`;
    const trail = `.${styles.trail}`;

    const ctx = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set([plane, trail], { autoAlpha: 0 });
        return;
      }

      gsap
        .timeline()
        // Climbing left to right, straight across the letters.
        .fromTo(
          plane,
          { xPercent: -130, yPercent: 46, opacity: 0 },
          {
            xPercent: 900,
            yPercent: -46,
            opacity: 1,
            duration: 1.25,
            ease: "power1.inOut",
          },
          0.15,
        )
        .to(plane, { opacity: 0, duration: 0.3 }, 1.1)
        // The contrail draws in behind it, then fades.
        .fromTo(
          trail,
          { scaleX: 0, opacity: 0.85 },
          { scaleX: 1, duration: 1.05, ease: "power1.inOut" },
          0.15,
        )
        .to(trail, { opacity: 0, duration: 0.4 }, 1.0);
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.wrap} ref={rootRef}>
      <h1 className={styles.title}>{city}</h1>

      {/* The trail passes behind the letters, the plane in front of them. */}
      <span className={styles.trail} aria-hidden="true" />
      <span className={styles.plane} aria-hidden="true">
        <IconPlane size={38} stroke={1.75} />
      </span>
    </div>
  );
}
