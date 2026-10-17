import { COUNTRIES } from "@/lib/server/config";
import { getProfiles } from "@/lib/server/seed";

/** The demo users, for the sign-in picker. Static seed, so prerendered. */
export async function GET() {
  return Response.json({
    users: getProfiles().map((profile) => ({
      id: profile.userId,
      holder: profile.holder,
      homeCity: profile.homeCity,
      home: { code: profile.homeCountry, name: COUNTRIES[profile.homeCountry]?.name ?? profile.homeCountry },
    })),
  });
}
