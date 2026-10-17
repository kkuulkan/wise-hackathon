"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cover, OPEN_EVENT, scroller } from "@/lib/scroller";
import styles from "./Cover.module.css";

/** How long the doors take to clear the viewport, matching the CSS transition. */
const DOOR_MS = 1300;

/** Keys that count as asking for the booklet to open. */
const OPEN_KEYS = ["Enter", " ", "ArrowDown", "PageDown", "Escape"];

export function Cover() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const openedRef = useRef(false);

  const lock = useCallback(() => {
    document.documentElement.classList.add("locked");
    scroller.current?.stop();
  }, []);

  const unlock = useCallback(() => {
    document.documentElement.classList.remove("locked");
    scroller.current?.start();
  }, []);

  const handleOpen = useCallback(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    cover.opened = true;

    setOpen(true);
    unlock();
    window.dispatchEvent(new CustomEvent(OPEN_EVENT));
    window.setTimeout(() => setDone(true), DOOR_MS);
  }, [unlock]);

  // The cover only exists when motion is allowed; `anim` is set on <html>
  // before paint, so reduced-motion users never see it at all.
  useEffect(() => {
    if (!document.documentElement.classList.contains("anim")) {
      cover.opened = true;
      unlock();
      window.dispatchEvent(new CustomEvent(OPEN_EVENT));
      return;
    }

    // Tells the pre-paint safety timer that the cover is alive and in control.
    document.documentElement.setAttribute("data-cover-ready", "");

    lock();
    buttonRef.current?.focus({ preventScroll: true });

    const onIntent = (event: Event) => {
      if (event instanceof KeyboardEvent && !OPEN_KEYS.includes(event.key)) return;
      handleOpen();
    };

    const events = ["wheel", "touchstart", "keydown"] as const;
    events.forEach((name) =>
      window.addEventListener(name, onIntent, { passive: true }),
    );

    return () => {
      events.forEach((name) => window.removeEventListener(name, onIntent));
      document.documentElement.classList.remove("locked");
      document.documentElement.removeAttribute("data-cover-ready");
    };
  }, [handleOpen, lock, unlock]);

  const className = [styles.cover, open && styles.open, done && styles.done]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={className}
      role="dialog"
      aria-modal="true"
      aria-label="Open your account"
      aria-hidden={done || undefined}
    >
      <div className={`${styles.door} ${styles.left}`} />
      <div className={`${styles.door} ${styles.right}`} />
      <div className={styles.seam} aria-hidden="true" />

      <div className={styles.center}>
        <span className={styles.crest} aria-hidden="true">
          O
        </span>

        <p className={styles.label}>
          <b>Travel account</b>
          <i>Compte de voyage</i>
        </p>

        <p className={styles.title}>OtherWise</p>

        <button
          type="button"
          className={styles.button}
          onClick={handleOpen}
          ref={buttonRef}
        >
          Open account
        </button>

        <p className={styles.hint}>or just scroll</p>
      </div>
    </div>
  );
}
