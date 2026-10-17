import { resetState } from "@/lib/server/store";

/**
 * POST: wipe trips, notifications, consent, feedback, events and the catalog
 * cache, so the demo can be run again from "just landed".
 */
export async function POST() {
  resetState();
  return Response.json({ ok: true });
}
