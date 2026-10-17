import { connection } from "next/server";

import { COUNTRIES } from "@/lib/server/config";
import { getProfile } from "@/lib/server/seed";
import { getActiveTrip } from "@/lib/server/store";

/** Profile, balances and the active trip, which drives the home banner (FR-7). */
export async function GET() {
  await connection();
  const profile = getProfile();
  const trip = getActiveTrip() ?? null;

  return Response.json({
    holder: profile.holder,
    firstName: profile.firstName,
    home: { code: profile.homeCountry, name: COUNTRIES[profile.homeCountry]?.name ?? profile.homeCountry },
    balances: profile.balances,
    activeTrip: trip && {
      id: trip.id,
      startedAt: trip.startedAt,
      country: { code: trip.currentCountry, name: COUNTRIES[trip.currentCountry]?.name ?? trip.currentCountry },
      countriesVisited: Object.keys(trip.countries),
    },
  });
}
