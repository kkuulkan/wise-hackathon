import { fail, handle } from "@/lib/server/http";
import { resetState } from "@/lib/server/store";

/**
 * POST: wipe every user's trips, notifications, consent and feedback, plus
 * events and the caches, so the demo can be run again from "just landed".
 * Users, transactions and price snapshots stay. Does not sign anyone out.
 *
 * The data now lives in a shared database, so on a public deployment this is
 * off unless OTHERWISE_ALLOW_RESET=true is set deliberately. And it never
 * runs against the Neon `production` branch: tests reset a dev branch
 * (`neon checkout dev`), so the live demo's data can't be wiped by mistake.
 */
const PROTECTED_BRANCHES = new Set(["production", "main"]);

async function post() {
  if (process.env.NODE_ENV === "production" && process.env.OTHERWISE_ALLOW_RESET !== "true") {
    return fail(403, "forbidden", "Reset is disabled on this deployment.");
  }
  const branch = process.env.NEON_BRANCH;
  if (branch && PROTECTED_BRANCHES.has(branch)) {
    return fail(403, "forbidden", `Refusing to reset the Neon "${branch}" branch. Run tests on a dev branch: neon checkout dev.`);
  }
  await resetState();
  return Response.json({ ok: true });
}

export const POST = handle(post);
