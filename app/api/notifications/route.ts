import { requireUser } from "@/lib/server/session";
import { listNotifications } from "@/lib/server/store";

/** The signed-in user's notifications, newest first. Stands in for the push outbox. */
export async function GET() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  return Response.json({ notifications: [...(await listNotifications(profile.userId))].reverse() });
}
