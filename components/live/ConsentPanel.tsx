"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconInfoCircle } from "@tabler/icons-react";

import styles from "./ConsentPanel.module.css";

type Consent = {
  personalisation: boolean;
  notifications: boolean;
  confirmation?: string;
};

const SWITCHES = [
  {
    key: "personalisation",
    label: "Use my payments to choose categories",
    hint: "Off means general suggestions for everyone, and none of your transaction data is read.",
  },
  {
    key: "notifications",
    label: "Tell me when I arrive somewhere cheaper",
    hint: "Off means no arrival notifications. You can still open this screen yourself.",
  },
] as const;

/**
 * The disclosure and the two switches behind it (US-6.3): how recommendations
 * are generated, and the controls to turn either half off.
 *
 * The backend applies a change immediately, well inside the 24 h US-6.4
 * allows, so the panel refreshes the page afterwards: switching
 * personalisation off visibly drops the screen back to the general set.
 */
export function ConsentPanel() {
  const router = useRouter();
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [consent, setConsent] = useState<Consent | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggleOpen = async () => {
    const next = !open;
    setOpen(next);
    // Read it when the panel is first opened, so a closed panel costs nothing.
    if (next && !consent) {
      try {
        const response = await fetch("/api/consent");
        if (!response.ok) throw new Error();
        setConsent(await response.json());
      } catch {
        setStatus("Your settings could not be loaded. Try again.");
      }
    }
  };

  const set = async (key: (typeof SWITCHES)[number]["key"], value: boolean) => {
    setBusy(true);
    setStatus(null);

    try {
      const response = await fetch("/api/consent", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        // Only the key that changed, so the other is left exactly as it was.
        body: JSON.stringify({ [key]: value }),
      });

      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error?.message);

      setConsent(body);
      setStatus(body.confirmation ?? "Your choice is saved.");
      // Recommendations are built per request, so the server re-renders them
      // under the new consent.
      router.refresh();
    } catch (error) {
      setStatus((error as Error).message || "That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.panel}>
      <button
        type="button"
        className={styles.trigger}
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls={panelId}
      >
        <IconInfoCircle size={16} stroke={2} aria-hidden="true" />
        How these are chosen, and how to turn them off
        <IconChevronDown
          size={16}
          stroke={2}
          className={open ? styles.chevronOpen : styles.chevron}
          aria-hidden="true"
        />
      </button>

      <div id={panelId} hidden={!open} className={styles.body}>
        <p className={styles.explainer}>
          OtherWise reads the categories of your card payments from the last 90 days — how
          much and how often, never the merchants or the amounts — and ranks them. It then
          asks a price catalogue which products in those categories cost less here than at
          home. The catalogue is only ever told a category and a pair of countries: nothing
          that identifies you, your account or where you shop leaves the bank.
        </p>

        {consent ? (
          <ul className={styles.switches}>
            {SWITCHES.map((item) => (
              <li key={item.key} className={styles.switch}>
                <label className={styles.switchLabel}>
                  <input
                    type="checkbox"
                    checked={consent[item.key]}
                    disabled={busy}
                    onChange={(event) => void set(item.key, event.target.checked)}
                  />
                  <span>
                    <b>{item.label}</b>
                    <span className={styles.hint}>{item.hint}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.hint}>Loading your settings…</p>
        )}

        <p className={styles.status} role="status">
          {status ?? ""}
        </p>
      </div>
    </section>
  );
}
