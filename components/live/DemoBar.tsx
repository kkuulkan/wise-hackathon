"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import styles from "./DemoBar.module.css";

type DemoUser = { id: string; holder: string; homeCity: string };
type Destination = { code: string; name: string; eligible: boolean };
type Notification = { title: string; body: string; deepLink: string; country: string };

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
 * The demo's control strip: pick a traveller, simulate where they are, and
 * see the arrival notification the backend sends. Everything here goes
 * through the HTTP API; the page re-renders from the server afterwards.
 */
export function DemoBar({ userId, homeCountryCode, tripCountry }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [users, setUsers] = useState<DemoUser[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destination, setDestination] = useState(tripCountry ?? "PT");
  const [notification, setNotification] = useState<Notification | null>(null);
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
      setNotification(null);
      if (id) await call("POST", "/api/session", { userId: id });
      else await call("DELETE", "/api/session");
    });

  const moveTo = (countryCode: string) =>
    run(async () => {
      const result = await call<{ status: string; notification: Notification | null }>(
        "POST",
        "/api/location",
        { countryCode },
      );
      setNotification(result.notification);
      if (result.status === "ineligible") {
        setMessage("OtherWise only compares prices between E.U. countries, so nothing was sent.");
      } else if (result.status === "already-seen") {
        setMessage("Already notified for this country on this trip.");
      } else if (result.status === "arrived" && !result.notification) {
        setMessage("Arrival recorded. Notifications are switched off for this traveller.");
      }
    });

  const open = (note: Notification) => {
    // Fire and forget: analytics must never block the user.
    call("POST", "/api/events", { type: "notification_opened", country: note.country }).catch(() => {});
    setNotification(null);
  };

  return (
    <section className={styles.bar} aria-label="Demo controls">
      <p className="fieldLabel">Demo / Démonstration</p>

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
                onClick={() => moveTo(homeCountryCode)}
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

      {notification && (
        <div className={styles.notification} role="alert">
          <p className="fieldLabel">OtherWise · now</p>
          <p className={styles.notificationTitle}>{notification.title}</p>
          <p className={styles.notificationBody}>{notification.body}</p>
          <Link
            href={notification.deepLink}
            className={styles.primary}
            onClick={() => open(notification)}
          >
            See what&rsquo;s cheaper
          </Link>
        </div>
      )}
    </section>
  );
}
