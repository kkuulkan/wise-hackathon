import { connection } from "next/server";

import { badRequest, readObject, unknownKeys } from "@/lib/server/http";
import { getConsent, recordEvent, setConsent } from "@/lib/server/store";

/** GET current consent (US-6.3). */
export async function GET() {
  await connection();
  return Response.json(getConsent());
}

/**
 * PUT { personalisation?: boolean, notifications?: boolean }
 *
 * Takes effect immediately, well inside the 24 h the PRD allows (US-6.4).
 * Withdrawing personalisation means the next recommendations response uses
 * no transaction data at all (US-6.2).
 */
export async function PUT(request: Request) {
  const body = await readObject(request);
  if (body instanceof Response) return body;

  const extra = unknownKeys(body, ["personalisation", "notifications"]);
  if (extra.length > 0) return badRequest(`Unexpected field(s): ${extra.join(", ")}.`);

  for (const key of ["personalisation", "notifications"] as const) {
    if (key in body && typeof body[key] !== "boolean") return badRequest(`${key} must be true or false.`);
  }

  const before = getConsent();
  const after = {
    personalisation: (body.personalisation as boolean | undefined) ?? before.personalisation,
    notifications: (body.notifications as boolean | undefined) ?? before.notifications,
    updatedAt: new Date().toISOString(),
  };
  setConsent(after);

  const wasOn = before.personalisation && before.notifications;
  const isOn = after.personalisation && after.notifications;
  if (wasOn !== isOn) recordEvent({ type: isOn ? "opt_in" : "opt_out", at: after.updatedAt });

  return Response.json({ ...after, confirmation: "Your choice is saved and applies right away." });
}
