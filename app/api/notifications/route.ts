import { connection } from "next/server";

import { listNotifications } from "@/lib/server/store";

/** Notifications sent so far, newest first. Stands in for the push outbox. */
export async function GET() {
  await connection();
  return Response.json({ notifications: [...listNotifications()].reverse() });
}
