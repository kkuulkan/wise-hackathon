import "server-only";

import { cookies } from "next/headers";

import { fail } from "./http";
import { getProfile, type Profile } from "./seed";

/**
 * Demo login. Picking a user sets a cookie holding their id; every
 * user-specific endpoint reads it back. There is no password because both
 * users are fictional — this stands in for the banking app's real session,
 * which the PRD assumes already exists (US-2.2).
 */
export const SESSION_COOKIE = "otherwise_user";

export async function currentUser(): Promise<Profile | undefined> {
  const id = (await cookies()).get(SESSION_COOKIE)?.value;
  return id ? getProfile(id) : undefined;
}

/** The signed-in profile, or a 401 Response to return as-is. */
export async function requireUser(): Promise<Profile | Response> {
  const profile = await currentUser();
  return profile ?? fail(401, "not_signed_in", "Please sign in to see this.");
}
