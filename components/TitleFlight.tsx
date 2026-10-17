"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { IconPlane } from "@tabler/icons-react";

import { flagEmoji } from "@/lib/flag";
import styles from "./TitleFlight.module.css";

type Props = {
  /** The country or city the page is about. */
  city: string;
  /** Its two-letter code, for the flag beside the name. */
  countryCode: string;
};

/**
 * The country name, with a plane that crosses straight through it and then
 * parks above the end of the word.
 *
 * Mounts at the same moment as the spread below, so the flight and the page
 * turn read as one movement without the two components having to coordinate.
 */
export function TitleFlight({ city, countryCode }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const plane = `.${styles.plane}`;
    const trail = `.${styles.trail}`;

    /*
     * Where it comes to rest: its own place in the layout, above the end of
     * the word. Ending the flight on x/y 0 rather than on measured pixels
     * means the parked plane is positioned by CSS alone, so it stays put if
     * the heading rewraps or the window is resized.
     */
    const REST = { x: 0, y: 0, rotation: -8, opacity: 1 };

    const ctx = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // No flight, but the plane is still parked where it belongs.
        gsap.set(plane, REST);
        gsap.set(trail, { autoAlpha: 0 });
        return;
      }

      const root = rootRef.current;
      const title = root?.querySelector<HTMLElement>(`.${styles.title}`);
      // The wrapper hugs the word, so its width is the distance to cross.
      const run = (root?.offsetWidth ?? 320) + 90;
      const drop = (title?.offsetHeight ?? 88) * 0.62;

      gsap
        .timeline()
        // Comes in low and off to the left, climbing across the letters.
        .set(plane, { x: -run, y: drop, rotation: -16, opacity: 0 })
        .to(plane, { opacity: 1, duration: 0.28 }, 0.15)
        .to(plane, { ...REST, duration: 1.35, ease: "power1.inOut" }, 0.15)
        // The contrail draws in behind it, then fades, leaving the plane.
        .fromTo(
          trail,
          { scaleX: 0, opacity: 0.85 },
          { scaleX: 1, duration: 1.05, ease: "power1.inOut" },
          0.15,
        )
        .to(trail, { opacity: 0, duration: 0.4 }, 1.1);
    }, rootRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className={styles.wrap} ref={rootRef}>
      <h1 className={styles.title}>
        {city}
        {/* Decorative: the name is right there beside it. */}
        <span className={styles.flag} aria-hidden="true">
          {flagEmoji(countryCode)}
        </span>
      </h1>

      {/* The trail passes behind the letters, the plane in front of them. */}
      <span className={styles.trail} aria-hidden="true" />
      <span className={styles.plane} aria-hidden="true">
        <IconPlane size={38} stroke={1.75} />
      </span>
    </div>
  );
}
