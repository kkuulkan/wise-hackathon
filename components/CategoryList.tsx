"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

import type { Category } from "@/lib/types";
import { CategoryCard } from "./CategoryCard";
import styles from "./CategoryList.module.css";

gsap.registerPlugin(ScrollTrigger);

type Props = {
  categories: Category[];
  city: string;
  homeCity: string;
};

export function CategoryList({ categories, city, homeCity }: Props) {
  const rootRef = useRef<HTMLUListElement>(null);

  // Cards turn up like pages: a short rotation out of the stack, once each.
  useLayoutEffect(() => {
    // Cards are visible in CSS, so skipping the tween leaves them readable.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>(`.${styles.item}`);

      items.forEach((item, index) => {
        gsap.fromTo(
          item,
          { opacity: 0, y: 18, rotate: -1.5 },
          {
            opacity: 1,
            y: 0,
            rotate: 0,
            duration: 0.5,
            // Only the first screenful needs staggering; the rest reveal on scroll.
            delay: index < 3 ? index * 0.07 : 0,
            ease: "power2.out",
            scrollTrigger: { trigger: item, start: "top 92%", once: true },
          },
        );
      });
    }, rootRef);

    return () => ctx.revert();
  }, []);

  if (categories.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing is meaningfully cheaper here right now. We will let you know if that
        changes.
      </p>
    );
  }

  return (
    <ul className={styles.list} ref={rootRef}>
      {categories.map((category) => (
        <li key={category.slug} className={styles.item}>
          <CategoryCard category={category} city={city} homeCity={homeCity} />
        </li>
      ))}
    </ul>
  );
}
