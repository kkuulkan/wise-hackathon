import { getSeedTransactions } from "@/lib/server/seed";

/** The statement, newest first. Static seed, so it can be prerendered. */
export async function GET() {
  const transactions = [...getSeedTransactions()].sort((a, b) => b.date.localeCompare(a.date));
  return Response.json({ transactions });
}
