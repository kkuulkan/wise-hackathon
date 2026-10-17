"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import styles from "./ConsentGate.module.css";

/**
 * The opt-in, asked once per traveller before anything personal is on screen
 * (US-6.1). Declining is a first-class answer, not a dismissal: both buttons
 * write to /api/consent, and the backend then decides what it is allowed to
 * compute. There is deliberately no close control — an unanswered question is
 * not an answer.
 *
 * It only mounts when `consent.decided` is false, so answering it is the end
 * of it. Afterwards the switches in ConsentPanel are the way to change it.
 */
export function ConsentGate() {
  const router = useRouter();
  const acceptRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hold the page still behind the card, the way the cover does on arrival.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("locked");
    acceptRef.current?.focus();
    return () => root.classList.remove("locked");
  }, []);

  const answer = async (granted: boolean) => {
    setBusy(granted ? "accept" : "decline");
    setError(null);

    try {
      const response = await fetch("/api/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ personalisation: granted, notifications: granted }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message);

      // The answer is stored, so the server re-renders without this card and,
      // if they declined, without anything drawn from their payments.
      router.refresh();
    } catch (caught) {
      setError((caught as Error).message || "That did not save. Try again.");
      setBusy(null);
    }
  };

  return (
    <div className={styles.scrim} role="dialog" aria-modal="true" aria-labelledby="consent-title">
      <div className={styles.card}>
        <p className="fieldLabel">OtherWise &middot; Permissions</p>

        <h2 className={styles.title} id="consent-title">
          Want to know what&rsquo;s cheaper during abroad?
        </h2>

        <p className={styles.copy}>
          Pay less while you travel. We&rsquo;ll compare your usual spending categories with
          prices in different countries and tell you where you&rsquo;d save. You can switch it
          off any time.
        </p>

        <p className={`fieldLabel ${styles.choose}`}>Choose one to continue</p>

        <div className={styles.actions}>
          <button
            type="button"
            ref={acceptRef}
            className={styles.accept}
            onClick={() => void answer(true)}
            disabled={busy !== null}
          >
            {busy === "accept" ? "Saving…" : "Yes, help me save money"}
          </button>

          <button
            type="button"
            className={styles.decline}
            onClick={() => void answer(false)}
            disabled={busy !== null}
          >
            {busy === "decline" ? "Saving…" : "No, thanks"}
          </button>
        </div>

        <p className={styles.foot} role="status">
          {error ?? ""}
        </p>
      </div>
    </div>
  );
}
