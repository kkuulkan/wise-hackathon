"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { dismissTicket } from "@/lib/ticket";
import { flagEmoji } from "@/lib/flag";
import { Dropdown } from "./Dropdown";
import { FlightScrim } from "./FlightScrim";
import styles from "./DemoBar.module.css";

type DemoUser = { id: string; holder: string; homeCity: string };
type Destination = { code: string; name: string; eligible: boolean };

type Props = {
  /** Who the server rendered the page for, or null when signed out. */
  userId: string | null;
  /** Their name and city, so the picker reads correctly before the list loads. */
  holder: string | null;
  homeCity: string | null;
  homeCountryCode: string | null;
  /** Country of the active trip, so the picker starts there. */
  tripCountry: string | null;
  /**
   * False when this traveller declined. Arrival is something the bank does to
   * them on the strength of their consent, so without it there is nothing to
   * simulate and the control goes away.
   */
  notificationsAllowed: boolean;
};

/** Every API error has `{ error: { message } }`; anything else gets a generic line. */
async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) throw new Error(json?.error?.message ?? "Something went wrong. Try again.");
  return json as T;
}

/**
 * The demo's control strip: pick a traveller and simulate where they are.
 *
 * Everything here goes through the HTTP API and the page re-renders from the
 * server afterwards. The arrival notification the backend returns is not shown:
 * the ticket beside the balance already carries that message.
 */
export function DemoBar({
  userId,
  holder,
  homeCity,
  homeCountryCode,
  tripCountry,
  notificationsAllowed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /*
   * Seeded with whoever the server rendered for. /api/users only answers once
   * the page is interactive, and without this the control would say "None"
   * about an account that is plainly open on the screen behind it.
   */
  const [users, setUsers] = useState<DemoUser[]>(
    userId && holder ? [{ id: userId, holder, homeCity: homeCity ?? "" }] : [],
  );
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState(tripCountry ?? "PT");
  const [flying, setFlying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    call<{ users: DemoUser[] }>("GET", "/api/users")
      .then((data) => setUsers(data.users))
      .catch((error: Error) => setMessage(error.message));
  }, []);

  /*
   * The notices here are asides — "already notified", "nothing was sent" —
   * and none of them needs acting on, so they clear themselves rather than
   * sitting over the page until the next action.
   */
  useEffect(() => {
    if (message === null) return;
    const timer = window.setTimeout(() => setMessage(null), 2000);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!userId) return;
    call<{ destinations: Destination[] }>("GET", "/api/destinations")
      .then((data) => setDestinations(data.destinations))
      .catch((error: Error) => setMessage(error.message));
  }, [userId]);

  /*
   * `flying` rather than `pending` alone: every control here runs through
   * this, and a plane crossing the screen belongs to arriving somewhere, not
   * to picking a traveller or resetting the demo.
   */
  const run = (action: () => Promise<void>, flight = false) => {
    setMessage(null);
    setFlying(flight);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        setMessage((error as Error).message);
      }
    });
  };

  /*
   * Consent is remembered per customer, as it should be, so signing out and
   * back in does not ask again. This wipes the server's demo state — trips,
   * notifications, consent, feedback — and signs out, which is what makes the
   * opt-in appear again on the next pick.
   */
  const resetDemo = () =>
    run(async () => {
      await call("POST", "/api/dev/reset");
      await call("DELETE", "/api/session");
      setMessage("Demo reset. Pick a traveller to be asked for consent again.");
    });

  const signIn = (id: string) =>
    run(async () => {
      if (id) await call("POST", "/api/session", { userId: id });
      else await call("DELETE", "/api/session");
    });

  const moveTo = (countryCode: string) =>
    run(async () => {
      const result = await call<{ status: string; notification: unknown | null }>(
        "POST",
        "/api/location",
        { countryCode },
      );
      if (result.status === "ineligible") {
        setMessage("OtherWise only compares prices between E.U. countries, so nothing was sent.");
      } else if (result.status === "already-seen") {
        setMessage("Already notified for this country on this trip.");
      } else if (result.status === "arrived" && !result.notification) {
        setMessage("Arrival recorded. Notifications are switched off for this traveller.");
      }
    }, true);


  return (
    <section className={styles.bar} aria-label="Demo controls">
      <p className={`fieldLabel ${styles.label}`}>For demo purpose:</p>

      <div className={styles.controls}>
        <div className={styles.field}>
          <span className={styles.fieldName}>Traveller</span>
          <Dropdown
            srLabel="Traveller"
            className={styles.control}
            value={userId ?? ""}
            onChange={signIn}
            disabled={pending}
            options={[
              { value: "", label: "Signed out" },
              ...users.map((user) => ({
                value: user.id,
                label: user.holder,
                note: user.homeCity,
              })),
            ]}
          />
        </div>

        {userId && !notificationsAllowed && (
          <p className={styles.declined}>
            Consent declined, so OtherWise does not watch for arrivals. Reset the demo.
          </p>
        )}

        {userId && notificationsAllowed && (
          <>
            <div className={styles.field}>
              <span className={styles.fieldName}>Arrive in</span>
              <Dropdown
                srLabel="Arrive in"
                className={styles.control}
                value={destination}
                onChange={setDestination}
                disabled={pending}
                placeholder="Loading…"
                options={destinations.map((country) => ({
                  value: country.code,
                  label: country.name,
                  glyph: flagEmoji(country.code),
                  note: country.eligible ? undefined : "outside the E.U.",
                }))}
              />
            </div>

            <button
              type="button"
              className={styles.primary}
              onClick={() => moveTo(destination)}
              disabled={pending}
            >
              Simulate arrival
            </button>

            {tripCountry && homeCountryCode && (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void dismissTicket().then(() => moveTo(homeCountryCode))}
                disabled={pending}
              >
                Fly home
              </button>
            )}
          </>
        )}

        <button
          type="button"
          className={styles.reset}
          onClick={resetDemo}
          disabled={pending}
        >
          Reset demo
        </button>
      </div>

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      <FlightScrim show={pending && flying} />

    </section>
  );
}
