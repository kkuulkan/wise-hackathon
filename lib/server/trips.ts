import "server-only";

import { COUNTRIES } from "./config";
import { getProfile } from "./seed";
import {
  getActiveTrip,
  getConsent,
  nextId,
  pushNotification,
  recordEvent,
  saveTrip,
} from "./store";
import type { LocationSignal, Notification, Trip } from "./types";

/** Where tapping the notification lands (FR-6). The frontend owns this route. */
export const RECOMMENDATIONS_PATH = "/cheaper";

export type LocationResult = {
  /**
   * home            back in the home country; any active trip is closed (US-1.3)
   * ineligible      home or destination is outside the E.U. (FR-4, US-1.4)
   * arrived         first time in this country on this trip (FR-2)
   * already-seen    still in, or back in, a country this trip already covered (FR-3)
   */
  status: "home" | "ineligible" | "arrived" | "already-seen";
  country: string;
  trip: Trip | null;
  /** Present only when a notification was actually sent. */
  notification: Notification | null;
  /** Why no notification went out, when one might have been expected. */
  suppressedBecause?: "notifications-off";
};

export function isEligiblePair(home: string, destination: string): boolean {
  return home !== destination && Boolean(COUNTRIES[home]?.eu) && Boolean(COUNTRIES[destination]?.eu);
}

/**
 * FR-1 to FR-5. A trip runs from leaving home until coming back. Inside one
 * trip each country notifies once (edge case 3), however often the user moves
 * around or crosses back. Day trips and layovers count (edge cases 1 and 2).
 *
 * `signal` records whether GPS or a card payment abroad told us (PRD open
 * question 1); both are treated the same.
 */
export function handleLocation(country: string, signal: LocationSignal): LocationResult {
  const profile = getProfile();
  const now = new Date().toISOString();
  const active = getActiveTrip();

  if (country === profile.homeCountry) {
    if (active) {
      active.endedAt = now;
      active.currentCountry = country;
      saveTrip(active);
    }
    return { status: "home", country, trip: null, notification: null };
  }

  if (!isEligiblePair(profile.homeCountry, country)) {
    return { status: "ineligible", country, trip: active ?? null, notification: null };
  }

  const trip: Trip = active ?? {
    id: nextId("trip"),
    startedAt: now,
    countries: {},
    currentCountry: country,
  };
  trip.currentCountry = country;

  if (trip.countries[country]) {
    saveTrip(trip);
    return { status: "already-seen", country, trip, notification: null };
  }

  trip.countries[country] = { arrivedAt: now, signal };

  // US-6.2: no notification without consent. The trip is still recorded so
  // the in-app entry point (FR-7) works if they open the app themselves.
  if (!getConsent().notifications) {
    saveTrip(trip);
    return {
      status: "arrived",
      country,
      trip,
      notification: null,
      suppressedBecause: "notifications-off",
    };
  }

  const countryName = COUNTRIES[country].name;
  const notification: Notification = {
    id: nextId("notif"),
    tripId: trip.id,
    country,
    title: `Welcome to ${countryName}, ${profile.firstName}`,
    body: `Here are a few things you already buy that are cheaper or only available in ${countryName}.`,
    deepLink: `${RECOMMENDATIONS_PATH}?country=${country}`,
    createdAt: now,
  };

  trip.countries[country].notifiedAt = now;
  saveTrip(trip);
  pushNotification(notification);
  recordEvent({ type: "notification_sent", country, at: now });

  return { status: "arrived", country, trip, notification };
}
