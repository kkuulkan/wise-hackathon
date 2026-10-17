"use client";

import type { SyntheticEvent } from "react";
import { createPortal } from "react-dom";

import { FlightSpinner } from "./FlightSpinner";
import styles from "./FlightScrim.module.css";

/**
 * Covers the page while the next one is being fetched: the page behind it
 * blurs, nothing on it can be clicked, and a plane circles a dashed flight
 * path until the work finishes.
 *
 * Portaled to the body on purpose. The arrival ticket this is launched from
 * carries GSAP transforms, and a fixed overlay inside a transformed ancestor
 * is positioned against that ancestor rather than the viewport.
 */
export function FlightScrim({ show }: { show: boolean }) {
  // `show` only turns true after a click, so this never renders during SSR
  // and there is no hydration mismatch to guard against.
  if (!show || typeof document === "undefined") return null;

  /* See the stylesheet: the portal bubbles into the declaring tree, so these
     have to stop here rather than reaching whatever opened the scrim. */
  const swallow = (event: SyntheticEvent) => event.stopPropagation();

  return createPortal(
    <div
      className={styles.scrim}
      onClick={swallow}
      onPointerDown={swallow}
      onMouseDown={swallow}
    >
      <FlightSpinner />
    </div>,
    document.body,
  );
}
