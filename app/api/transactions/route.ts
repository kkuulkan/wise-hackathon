import { getSeedTransactions } from "@/lib/server/seed";
import { requireUser } from "@/lib/server/session";

/** The signed-in user's statement, newest first. */
export async function GET() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  const transactions = [...getSeedTransactions(profile.userId)].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
  return Response.json({ transactions });
}
