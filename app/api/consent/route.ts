import { badRequest, readObject, unknownKeys } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { getConsent, recordEvent, setConsent } from "@/lib/server/store";

/** GET the signed-in user's consent (US-6.3). */
export async function GET() {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;
  return Response.json(getConsent(profile.userId));
}

/**
 * PUT { personalisation?: boolean, notifications?: boolean }
 *
 * Takes effect immediately, well inside the 24 h the PRD allows (US-6.4).
 * Withdrawing personalisation means the next recommendations response uses
 * no transaction data at all (US-6.2).
 */
export async function PUT(request: Request) {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  const body = await readObject(request);
  if (body instanceof Response) return body;

  const extra = unknownKeys(body, ["personalisation", "notifications"]);
  if (extra.length > 0) return badRequest(`Unexpected field(s): ${extra.join(", ")}.`);

  for (const key of ["personalisation", "notifications"] as const) {
    if (key in body && typeof body[key] !== "boolean") return badRequest(`${key} must be true or false.`);
  }

  const before = getConsent(profile.userId);
  const after = {
    personalisation: (body.personalisation as boolean | undefined) ?? before.personalisation,
    notifications: (body.notifications as boolean | undefined) ?? before.notifications,
    // Writing here at all means they have answered, whichever way (US-6.1).
    decided: true,
    updatedAt: new Date().toISOString(),
  };
  setConsent(profile.userId, after);

  const wasOn = before.personalisation && before.notifications;
  const isOn = after.personalisation && after.notifications;
  // The first answer is always worth logging, even when it grants exactly what
  // the defaults already allowed and so changes no value (FR-23).
  if (!before.decided || wasOn !== isOn) {
    recordEvent({ type: isOn ? "opt_in" : "opt_out", at: after.updatedAt });
  }

  return Response.json({ ...after, confirmation: "Your choice is saved and applies right away." });
}
