import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";

import { db, schema } from "./db";
import { clearPriceDataCache } from "./pricedata";
import type {
  AnalyticsEvent,
  CatalogResponse,
  Consent,
  FeedbackItem,
  LocationSignal,
  Notification,
  Trip,
} from "./types";

/**
 * Mutable state, in Neon Postgres: trips, notifications, consent, feedback
 * and analytics events. Survives restarts and is shared by every server
 * instance. Callers only use these accessors; none touches tables directly.
 *
 * The catalog cache stays in memory: it is a per-instance speed-up holding no
 * user data, so losing it costs one recomputation.
 */

export function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Demo reset: clears app state. Users, transactions and price snapshots stay. */
export async function resetState(): Promise<void> {
  const { events, feedback, notifications, tripCountries, trips, consent } = schema;
  await db().transaction(async (tx) => {
    await tx.delete(events);
    await tx.delete(feedback);
    await tx.delete(notifications);
    await tx.delete(tripCountries);
    await tx.delete(trips);
    await tx.delete(consent);
  });
  catalogCache().clear();
  clearPriceDataCache();
}

// Trips

export async function getActiveTrip(userId: string): Promise<Trip | undefined> {
  const [trip] = await db()
    .select()
    .from(schema.trips)
    .where(and(eq(schema.trips.userId, userId), isNull(schema.trips.endedAt)))
    .limit(1);
  if (!trip) return undefined;

  const countries = await db().select().from(schema.tripCountries).where(eq(schema.tripCountries.tripId, trip.id));
  return {
    id: trip.id,
    startedAt: trip.startedAt.toISOString(),
    endedAt: trip.endedAt?.toISOString(),
    currentCountry: trip.currentCountry,
    countries: Object.fromEntries(
      countries.map((row) => [
        row.country,
        {
          arrivedAt: row.arrivedAt.toISOString(),
          signal: row.signal as LocationSignal,
          ...(row.notifiedAt ? { notifiedAt: row.notifiedAt.toISOString() } : {}),
        },
      ]),
    ),
  };
}

/** Upserts the trip and every country on it, atomically. */
export async function saveTrip(userId: string, trip: Trip): Promise<void> {
  const tripRow = {
    id: trip.id,
    userId,
    startedAt: new Date(trip.startedAt),
    endedAt: trip.endedAt ? new Date(trip.endedAt) : null,
    currentCountry: trip.currentCountry,
  };
  const countryRows = Object.entries(trip.countries).map(([country, entry]) => ({
    tripId: trip.id,
    country,
    arrivedAt: new Date(entry.arrivedAt),
    signal: entry.signal,
    notifiedAt: entry.notifiedAt ? new Date(entry.notifiedAt) : null,
  }));

  await db().transaction(async (tx) => {
    await tx
      .insert(schema.trips)
      .values(tripRow)
      .onConflictDoUpdate({
        target: schema.trips.id,
        set: { endedAt: tripRow.endedAt, currentCountry: tripRow.currentCountry },
      });
    if (countryRows.length === 0) return;
    await tx
      .insert(schema.tripCountries)
      .values(countryRows)
      .onConflictDoUpdate({
        target: [schema.tripCountries.tripId, schema.tripCountries.country],
        set: { notifiedAt: sql`excluded.notified_at` },
      });
  });
}

// Notifications

export async function pushNotification(userId: string, notification: Notification): Promise<void> {
  await db()
    .insert(schema.notifications)
    .values({ ...notification, userId, createdAt: new Date(notification.createdAt) });
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const rows = await db()
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, userId))
    .orderBy(asc(schema.notifications.createdAt));
  return rows.map((row) => ({
    id: row.id,
    tripId: row.tripId,
    country: row.country,
    title: row.title,
    body: row.body,
    deepLink: row.deepLink,
    createdAt: row.createdAt.toISOString(),
  }));
}

// Consent

/** PRD open question 5: covered by existing T&Cs, so no row means opted in. */
const DEFAULT_CONSENT: Consent = { personalisation: true, notifications: true, updatedAt: new Date(0).toISOString() };

export async function getConsent(userId: string): Promise<Consent> {
  const [row] = await db().select().from(schema.consent).where(eq(schema.consent.userId, userId)).limit(1);
  if (!row) return DEFAULT_CONSENT;
  return { personalisation: row.personalisation, notifications: row.notifications, updatedAt: row.updatedAt.toISOString() };
}

export async function setConsent(userId: string, consent: Consent): Promise<void> {
  const values = {
    userId,
    personalisation: consent.personalisation,
    notifications: consent.notifications,
    updatedAt: new Date(consent.updatedAt),
  };
  await db()
    .insert(schema.consent)
    .values(values)
    .onConflictDoUpdate({ target: schema.consent.userId, set: values });
}

// Feedback

export async function addFeedback(userId: string, item: FeedbackItem): Promise<void> {
  // The unique index makes a repeated thumbs-down a no-op.
  await db()
    .insert(schema.feedback)
    .values({
      userId,
      tripId: item.tripId,
      kind: item.kind,
      itemId: item.id,
      country: item.country,
      createdAt: new Date(item.createdAt),
    })
    .onConflictDoNothing();
}

/** For the team (US-8.3): every user's feedback, without saying whose. */
export async function listAllFeedback(): Promise<FeedbackItem[]> {
  const rows = await db()
    .select({
      tripId: schema.feedback.tripId,
      kind: schema.feedback.kind,
      id: schema.feedback.itemId,
      country: schema.feedback.country,
      createdAt: schema.feedback.createdAt,
    })
    .from(schema.feedback)
    .orderBy(asc(schema.feedback.id));
  return rows.map((row) => ({ ...row, kind: row.kind as FeedbackItem["kind"], createdAt: row.createdAt.toISOString() }));
}

/** US-8.1: hidden for the rest of the trip, so scoped by trip id. */
export async function hiddenIds(
  userId: string,
  tripId: string | null,
  kind: FeedbackItem["kind"],
): Promise<Set<string>> {
  if (!tripId) return new Set();
  const rows = await db()
    .select({ id: schema.feedback.itemId })
    .from(schema.feedback)
    .where(and(eq(schema.feedback.userId, userId), eq(schema.feedback.tripId, tripId), eq(schema.feedback.kind, kind)));
  return new Set(rows.map((row) => row.id));
}

// Analytics

export async function recordEvent(event: AnalyticsEvent): Promise<void> {
  await db()
    .insert(schema.events)
    .values({ ...event, at: new Date(event.at) });
}

export async function listEvents(): Promise<AnalyticsEvent[]> {
  const rows = await db().select().from(schema.events).orderBy(asc(schema.events.id));
  return rows.map((row) => ({
    type: row.type as AnalyticsEvent["type"],
    at: row.at.toISOString(),
    ...(row.country ? { country: row.country } : {}),
    ...(row.category ? { category: row.category } : {}),
    ...(row.productId ? { productId: row.productId } : {}),
  }));
}

// Catalog cache (FR-16), in memory

type CacheEntry = { value: CatalogResponse; expiresAt: number };
const globalStore = globalThis as typeof globalThis & { __otherwiseCatalogCache?: Map<string, CacheEntry> };

function catalogCache(): Map<string, CacheEntry> {
  globalStore.__otherwiseCatalogCache ??= new Map();
  return globalStore.__otherwiseCatalogCache;
}

export function readCatalogCache(key: string, now: number): CatalogResponse | undefined {
  const entry = catalogCache().get(key);
  if (!entry || entry.expiresAt <= now) return undefined;
  return entry.value;
}

/** An expired entry is still better than nothing when the catalog is down. */
export function readStaleCatalogCache(key: string): CatalogResponse | undefined {
  return catalogCache().get(key)?.value;
}

export function writeCatalogCache(key: string, value: CatalogResponse, expiresAt: number): void {
  catalogCache().set(key, { value, expiresAt });
}
