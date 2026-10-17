import { resetState } from "@/lib/server/store";

/**
 * POST: wipe every user's trips, notifications, consent and feedback, plus
 * events and the catalog cache, so the demo can be run again from "just
 * landed". Does not sign anyone out.
 */
export async function POST() {
  resetState();
  return Response.json({ ok: true });
}
