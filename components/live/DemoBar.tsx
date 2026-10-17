"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { dismissTicket } from "@/lib/ticket";
import styles from "./DemoBar.module.css";

type DemoUser = { id: string; holder: string; homeCity: string };
type Destination = { code: string; name: string; eligible: boolean };

type Props = {
  /** Who the server rendered the page for, or null when signed out. */
  userId: string | null;
  homeCountryCode: string | null;
  /** Country of the active trip, so the picker starts there. */
  tripCountry: string | null;
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
export function DemoBar({ userId, homeCountryCode, tripCountry }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState(tripCountry ?? "PT");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    call<{ users: DemoUser[] }>("GET", "/api/users")
      .then((data) => setUsers(data.users))
      .catch((error: Error) => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!userId) return;
    call<{ destinations: Destination[] }>("GET", "/api/destinations")
      .then((data) => setDestinations(data.destinations))
      .catch((error: Error) => setMessage(error.message));
  }, [userId]);

  const run = (action: () => Promise<void>) => {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        setMessage((error as Error).message);
      }
    });
  };

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
    });


  return (
    <section className={styles.bar} aria-label="Demo controls">
      <p className={`fieldLabel ${styles.label}`}>For demo purpose:</p>

      <div className={styles.controls}>
        <label className={styles.field}>
          <span className={styles.fieldName}>Traveller</span>
          <select
            value={userId ?? ""}
            onChange={(event) => signIn(event.target.value)}
            disabled={pending}
          >
            <option value="">Signed out</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.holder} · {user.homeCity}
              </option>
            ))}
          </select>
        </label>

        {userId && (
          <>
            <label className={styles.field}>
              <span className={styles.fieldName}>Arrive in</span>
              <select
                value={destination}
                onChange={(event) => setDestination(event.target.value)}
                disabled={pending}
              >
                {destinations.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                    {country.eligible ? "" : " (outside the E.U.)"}
                  </option>
                ))}
              </select>
            </label>

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
      </div>

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

    </section>
  );
}
