import "server-only";

import type {
  AnalyticsEvent,
  CatalogResponse,
  Consent,
  FeedbackItem,
  Notification,
  Trip,
} from "./types";

/**
 * In-memory state for the single demo user. It resets when the server
 * restarts, which is what a demo wants. Kept on globalThis so dev-mode hot
 * reloads do not wipe it between requests.
 *
 * Swapping this for a database means reimplementing these few accessors; no
 * caller touches the State object directly.
 */
type State = {
  trips: Trip[];
  notifications: Notification[];
  consent: Consent;
  feedback: FeedbackItem[];
  events: AnalyticsEvent[];
  catalogCache: Map<string, { value: CatalogResponse; expiresAt: number }>;
  sequence: number;
};

function initialState(): State {
  return {
    trips: [],
    notifications: [],
    // PRD open question 5: consent is covered by existing T&Cs, so the demo
    // user starts opted in. PUT /api/consent withdraws it.
    consent: { personalisation: true, notifications: true, updatedAt: new Date(0).toISOString() },
    feedback: [],
    events: [],
    catalogCache: new Map(),
    sequence: 0,
  };
}

const globalStore = globalThis as typeof globalThis & { __otherwiseState?: State };

function state(): State {
  globalStore.__otherwiseState ??= initialState();
  return globalStore.__otherwiseState;
}

export function nextId(prefix: string): string {
  const s = state();
  s.sequence += 1;
  return `${prefix}-${s.sequence}`;
}

export function resetState(): void {
  globalStore.__otherwiseState = initialState();
}

// Trips

export function getActiveTrip(): Trip | undefined {
  return state().trips.find((trip) => !trip.endedAt);
}

export function saveTrip(trip: Trip): void {
  const trips = state().trips;
  const index = trips.findIndex((existing) => existing.id === trip.id);
  if (index === -1) trips.push(trip);
  else trips[index] = trip;
}

export function listTrips(): Trip[] {
  return state().trips;
}

// Notifications

export function pushNotification(notification: Notification): void {
  state().notifications.push(notification);
}

export function listNotifications(): Notification[] {
  return state().notifications;
}

// Consent

export function getConsent(): Consent {
  return state().consent;
}

export function setConsent(consent: Consent): void {
  state().consent = consent;
}

// Feedback

export function addFeedback(item: FeedbackItem): void {
  const list = state().feedback;
  const duplicate = list.some(
    (existing) =>
      existing.tripId === item.tripId && existing.kind === item.kind && existing.id === item.id,
  );
  if (!duplicate) list.push(item);
}

export function listFeedback(): FeedbackItem[] {
  return state().feedback;
}

/** US-8.1: hidden for the rest of the trip, so scoped by trip id. */
export function hiddenIds(tripId: string | null, kind: FeedbackItem["kind"]): Set<string> {
  if (!tripId) return new Set();
  return new Set(
    state()
      .feedback.filter((item) => item.tripId === tripId && item.kind === kind)
      .map((item) => item.id),
  );
}

// Analytics

export function recordEvent(event: AnalyticsEvent): void {
  state().events.push(event);
}

export function listEvents(): AnalyticsEvent[] {
  return state().events;
}

// Catalog cache (FR-16)

export function readCatalogCache(key: string, now: number): CatalogResponse | undefined {
  const entry = state().catalogCache.get(key);
  if (!entry || entry.expiresAt <= now) return undefined;
  return entry.value;
}

/** An expired entry is still better than nothing when the catalog is down. */
export function readStaleCatalogCache(key: string): CatalogResponse | undefined {
  return state().catalogCache.get(key)?.value;
}

export function writeCatalogCache(key: string, value: CatalogResponse, expiresAt: number): void {
  state().catalogCache.set(key, { value, expiresAt });
}
