"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import { formatMoney } from "@/lib/format";
import { cover, OPEN_EVENT } from "@/lib/scroller";
import type { CurrencyCode } from "@/lib/types";

type Props = {
  value: number;
  currency: CurrencyCode;
};

/**
 * Counts the balance up once, when the cover opens.
 *
 * Rendered with the real figure so the server output and the no-script case are
 * both correct; the zero is only set on the client, behind the closed cover.
 */
export function CountUp({ value, currency }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No cover means no reveal to time this against, so leave the figure be.
    if (!document.documentElement.classList.contains("anim")) return;

    /*
     * Already revealed, which happens whenever the hero remounts after
     * navigating back from the full list. The count-up runs once per load, so
     * keep the real figure rather than zeroing it to wait for an event that
     * has already fired.
     */
    if (cover.opened) return;

    node.textContent = formatMoney(0, currency);

    const run = () => {
      const counter = { value: 0 };

      gsap.to(counter, {
        value,
        duration: 1.4,
        delay: 0.35,
        ease: "power2.out",
        onUpdate: () => {
          node.textContent = formatMoney(counter.value, currency);
        },
        // Always lands on the exact amount, never a rounding artefact.
        onComplete: () => {
          node.textContent = formatMoney(value, currency);
        },
      });
    };

    window.addEventListener(OPEN_EVENT, run, { once: true });
    return () => window.removeEventListener(OPEN_EVENT, run);
  }, [value, currency]);

  return <span ref={ref}>{formatMoney(value, currency)}</span>;
}
