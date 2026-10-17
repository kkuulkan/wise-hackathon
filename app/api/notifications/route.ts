import { requireUser } from "@/lib/server/session";
import { listNotifications } from "@/lib/server/store";
import { handle } from "@/lib/server/http";

/** The signed-in user's notifications, newest first. Stands in for the push outbox. */
async function get() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  return Response.json({ notifications: [...(await listNotifications(profile.userId))].reverse() });
}

export const GET = handle(get);
