import { getTransactions } from "@/lib/server/seed";
import { requireUser } from "@/lib/server/session";

/** The signed-in user's statement, newest first (ordered by the database). */
export async function GET() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  return Response.json({ transactions: await getTransactions(profile.userId) });
}
