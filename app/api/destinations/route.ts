import { COUNTRIES } from "@/lib/server/config";
import { requireUser } from "@/lib/server/session";
import { isEligiblePair } from "@/lib/server/trips";

/**
 * Feeds the "Arrive in…" picker. Eligibility depends on the signed-in user's
 * home country, so it is per user. Ineligible ones show the US-1.4 path.
 */
export async function GET() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;
  const home = profile.homeCountry;

  return Response.json({
    home,
    destinations: Object.values(COUNTRIES)
      .filter((country) => country.code !== home)
      .map((country) => ({
        code: country.code,
        name: country.name,
        eligible: isEligiblePair(home, country.code),
      })),
  });
}
