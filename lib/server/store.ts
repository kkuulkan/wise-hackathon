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
 * In-memory state. It resets when the server restarts, which is what a demo
 * wants. Kept on globalThis so dev-mode hot reloads do not wipe it between
 * requests.
 *
 * Trips, notifications, consent and feedback belong to one user and are kept
 * apart per user id. Analytics events and the catalog cache hold no personal
 * data (FR-15, FR-23), so they are shared.
 *
 * Swapping this for a database means reimplementing these accessors; no
 * caller touches the State object directly.
 */
type UserState = {
  trips: Trip[];
  notifications: Notification[];
  consent: Consent;
  feedback: FeedbackItem[];
};

type State = {
  users: Map<string, UserState>;
  events: AnalyticsEvent[];
  catalogCache: Map<string, { value: CatalogResponse; expiresAt: number }>;
  sequence: number;
};

function initialUserState(): UserState {
  return {
    trips: [],
    notifications: [],
    /*
     * PRD open question 5: consent is covered by existing T&Cs, so the
     * permissions themselves start granted and an API-only caller behaves as
     * before. `decided` is what the UI goes by: nobody has answered yet, so
     * the app asks before it shows anything (US-6.1).
     */
    consent: {
      personalisation: true,
      notifications: true,
      decided: false,
      updatedAt: new Date(0).toISOString(),
    },
    feedback: [],
  };
}

function initialState(): State {
  return { users: new Map(), events: [], catalogCache: new Map(), sequence: 0 };
}

const globalStore = globalThis as typeof globalThis & { __otherwiseState?: State };

function state(): State {
  globalStore.__otherwiseState ??= initialState();
  return globalStore.__otherwiseState;
}

function user(userId: string): UserState {
  const users = state().users;
  let entry = users.get(userId);
  if (!entry) {
    entry = initialUserState();
    users.set(userId, entry);
  }
  return entry;
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

export function getActiveTrip(userId: string): Trip | undefined {
  return user(userId).trips.find((trip) => !trip.endedAt);
}

export function saveTrip(userId: string, trip: Trip): void {
  const trips = user(userId).trips;
  const index = trips.findIndex((existing) => existing.id === trip.id);
  if (index === -1) trips.push(trip);
  else trips[index] = trip;
}

// Notifications

export function pushNotification(userId: string, notification: Notification): void {
  user(userId).notifications.push(notification);
}

export function listNotifications(userId: string): Notification[] {
  return user(userId).notifications;
}

// Consent

export function getConsent(userId: string): Consent {
  return user(userId).consent;
}

export function setConsent(userId: string, consent: Consent): void {
  user(userId).consent = consent;
}

// Feedback

export function addFeedback(userId: string, item: FeedbackItem): void {
  const list = user(userId).feedback;
  const duplicate = list.some(
    (existing) =>
      existing.tripId === item.tripId && existing.kind === item.kind && existing.id === item.id,
  );
  if (!duplicate) list.push(item);
}

/** For the team (US-8.3): every user's feedback, without saying whose. */
export function listAllFeedback(): FeedbackItem[] {
  return [...state().users.values()].flatMap((entry) => entry.feedback);
}

/** US-8.1: hidden for the rest of the trip, so scoped by trip id. */
export function hiddenIds(
  userId: string,
  tripId: string | null,
  kind: FeedbackItem["kind"],
): Set<string> {
  if (!tripId) return new Set();
  return new Set(
    user(userId)
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
