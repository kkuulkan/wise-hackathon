import "server-only";

import { COUNTRIES } from "./config";

/**
 * Every error the API returns has the same shape, so the frontend can show a
 * friendly message from `error.message` and branch on `error.code`.
 */
export type ApiError = { error: { code: string; message: string } };

export function fail(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } } satisfies ApiError, { status });
}

export function badRequest(message: string): Response {
  return fail(400, "bad_request", message);
}

/** Parses a JSON object body. Returns a Response to send back on failure. */
export async function readObject(request: Request): Promise<Record<string, unknown> | Response> {
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return badRequest("Body must be a JSON object.");
    }
    return body as Record<string, unknown>;
  } catch {
    return badRequest("Body must be valid JSON.");
  }
}

/** Upper-cases and checks a country code against the known list. */
export function parseCountry(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return COUNTRIES[code] ? code : null;
}

/** Rejects fields the endpoint does not know, so nothing extra slips into storage. */
export function unknownKeys(body: Record<string, unknown>, allowed: readonly string[]): string[] {
  return Object.keys(body).filter((key) => !allowed.includes(key));
}
