import { COUNTRIES } from "@/lib/server/config";
import { requireUser } from "@/lib/server/session";
import { getActiveTrip } from "@/lib/server/store";
import { handle } from "@/lib/server/http";

/** The signed-in user's profile, balances and active trip (drives the home banner, FR-7). */
async function get() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  const trip = (await getActiveTrip(profile.userId)) ?? null;
  const name = (code: string) => COUNTRIES[code]?.name ?? code;

  return Response.json({
    id: profile.userId,
    holder: profile.holder,
    firstName: profile.firstName,
    homeCity: profile.homeCity,
    home: { code: profile.homeCountry, name: name(profile.homeCountry) },
    balances: profile.balances,
    activeTrip: trip && {
      id: trip.id,
      startedAt: trip.startedAt,
      country: { code: trip.currentCountry, name: name(trip.currentCountry) },
      countriesVisited: Object.keys(trip.countries),
    },
  });
}

export const GET = handle(get);
