import { fail } from "@/lib/server/http";
import { resetState } from "@/lib/server/store";

/**
 * POST: wipe every user's trips, notifications, consent and feedback, plus
 * events and the caches, so the demo can be run again from "just landed".
 * Users, transactions and price snapshots stay. Does not sign anyone out.
 *
 * The data now lives in a shared database, so on a public deployment this is
 * off unless OTHERWISE_ALLOW_RESET=true is set deliberately.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production" && process.env.OTHERWISE_ALLOW_RESET !== "true") {
    return fail(403, "forbidden", "Reset is disabled on this deployment.");
  }
  await resetState();
  return Response.json({ ok: true });
}
