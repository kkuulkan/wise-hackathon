import { cookies } from "next/headers";

import { badRequest, fail, readObject, handle } from "@/lib/server/http";
import { getProfile } from "@/lib/server/seed";
import { currentUser, SESSION_COOKIE } from "@/lib/server/session";

function summary(profile: { userId: string; holder: string; firstName: string }) {
  return { user: { id: profile.userId, holder: profile.holder, firstName: profile.firstName } };
}

/** Who is signed in. `{ user: null }` when nobody is. */
async function get() {
  const profile = await currentUser();
  return Response.json(profile ? summary(profile) : { user: null });
}

/** POST { userId: "aoife" | "jonas" } signs that demo user in. */
async function post(request: Request) {
  const body = await readObject(request);
  if (body instanceof Response) return body;
  if (typeof body.userId !== "string") return badRequest("userId is required.");

  const profile = await getProfile(body.userId);
  if (!profile) return fail(404, "not_found", `No demo user "${body.userId}".`);

  (await cookies()).set(SESSION_COOKIE, profile.userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return Response.json(summary(profile));
}

/** Sign out. */
async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ user: null });
}

export const GET = handle(get);
export const POST = handle(post);
export const DELETE = handle(signOut);
