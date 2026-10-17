"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import styles from "./Benefits.module.css";

gsap.registerPlugin(ScrollTrigger);

type Tile = {
  figure: string;
  caption: string;
  title: string;
  body: string;
};

type Props = {
  tiles: Tile[];
};

export function Benefits({ tiles }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        `.${styles.tile}`,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          stagger: 0.1,
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
      <h2 className={styles.heading}>Why the comparison holds up</h2>

      <div className={styles.tiles}>
        {tiles.map((tile) => (
          <article key={tile.title} className={styles.tile}>
            <p className={`${styles.figure} tabular`}>{tile.figure}</p>
            <p className={styles.caption}>{tile.caption}</p>

            <h3 className={styles.title}>{tile.title}</h3>
            <p className={styles.body}>{tile.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
