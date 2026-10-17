import type { NextRequest } from "next/server";

import { fail, parseCountry } from "@/lib/server/http";
import { buildRecommendations } from "@/lib/server/recommendations";
import { getProfile } from "@/lib/server/seed";
import { getActiveTrip } from "@/lib/server/store";
import { isEligiblePair } from "@/lib/server/trips";

/**
 * GET /api/recommendations?country=PT
 *
 * `country` defaults to the active trip's current country. Passing it
 * explicitly is what the notification deep link does, so an old notification
 * still opens the country it was about (edge case 10).
 */
export async function GET(request: NextRequest) {
  const param = request.nextUrl.searchParams.get("country");
  const country = param ? parseCountry(param) : (getActiveTrip()?.currentCountry ?? null);

  if (param && !country) {
    return fail(400, "bad_request", "country must be a known two-letter country code.");
  }
  if (!country) {
    return fail(409, "no_active_trip", "You are not on a trip right now. Pass ?country= to browse one.");
  }
  if (!isEligiblePair(getProfile().homeCountry, country)) {
    return fail(422, "not_eligible", "Recommendations are only available for other E.U. countries.");
  }

  return Response.json(await buildRecommendations(country));
}
