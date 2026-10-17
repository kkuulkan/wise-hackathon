import { connection } from "next/server";

import { COUNTRIES } from "@/lib/server/config";
import { getProfiles } from "@/lib/server/seed";
import { handle } from "@/lib/server/http";

/** The demo users, for the sign-in picker. Read from the database per request. */
async function get() {
  await connection();
  return Response.json({
    users: (await getProfiles()).map((profile) => ({
      id: profile.userId,
      holder: profile.holder,
      homeCity: profile.homeCity,
      home: { code: profile.homeCountry, name: COUNTRIES[profile.homeCountry]?.name ?? profile.homeCountry },
    })),
  });
}

export const GET = handle(get);
