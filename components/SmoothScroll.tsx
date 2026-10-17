"use client";

import { useEffect } from "react";
import gsap from "gsap";
import Lenis from "lenis";

import { scroller } from "@/lib/scroller";

/** Inertial scrolling, wired to GSAP's ticker so both share one loop. */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.1 });
    scroller.current = lenis;

    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      scroller.current = null;
    };
  }, []);

  return null;
}
