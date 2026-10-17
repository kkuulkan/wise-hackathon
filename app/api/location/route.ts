import { badRequest, parseCountry, readObject } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { handleLocation } from "@/lib/server/trips";
import type { LocationSignal } from "@/lib/server/types";

/**
 * POST { countryCode: "PT", signal?: "gps" | "card" }
 *
 * The signed-in user's device (or the card processor) reports where they are.
 * Returns the trip status and, the first time in a country on this trip, the
 * notification to show. The demo's "Simulate arrival" button calls this.
 */
export async function POST(request: Request) {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  const body = await readObject(request);
  if (body instanceof Response) return body;

  const country = parseCountry(body.countryCode);
  if (!country) return badRequest("countryCode must be a known two-letter country code.");

  const signal = body.signal ?? "gps";
  if (signal !== "gps" && signal !== "card") return badRequest('signal must be "gps" or "card".');

  return Response.json(await handleLocation(profile, country, signal as LocationSignal));
}
