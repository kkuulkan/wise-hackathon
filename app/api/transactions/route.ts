import { getTransactions } from "@/lib/server/seed";
import { requireUser } from "@/lib/server/session";
import { handle } from "@/lib/server/http";

/** The signed-in user's statement, newest first (ordered by the database). */
async function get() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  return Response.json({ transactions: await getTransactions(profile.userId) });
}

export const GET = handle(get);
