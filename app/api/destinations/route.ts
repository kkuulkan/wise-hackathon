import { COUNTRIES } from "@/lib/server/config";
import { isEligiblePair } from "@/lib/server/trips";
import { getProfile } from "@/lib/server/seed";

/** Feeds the "Arrive in…" picker in the demo. Ineligible ones show the US-1.4 path. */
export async function GET() {
  const home = getProfile().homeCountry;

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
