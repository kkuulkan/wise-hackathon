import { badRequest, parseCountry, readObject } from "@/lib/server/http";
import { handleLocation } from "@/lib/server/trips";
import type { LocationSignal } from "@/lib/server/types";

/**
 * POST { countryCode: "PT", signal?: "gps" | "card" }
 *
 * The device (or the card processor) reports where the user is. Returns the
 * trip status and, the first time in a country on this trip, the notification
 * to show. The demo's "Simulate arrival" button calls this.
 */
export async function POST(request: Request) {
  const body = await readObject(request);
  if (body instanceof Response) return body;

  const country = parseCountry(body.countryCode);
  if (!country) return badRequest("countryCode must be a known two-letter country code.");

  const signal = body.signal ?? "gps";
  if (signal !== "gps" && signal !== "card") return badRequest('signal must be "gps" or "card".');

  return Response.json(handleLocation(country, signal as LocationSignal));
}
