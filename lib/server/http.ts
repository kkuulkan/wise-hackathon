import "server-only";

import { unstable_rethrow } from "next/navigation";

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

/** Postgres and network error codes that mean "the database can't be reached right now". */
const UNAVAILABLE_CODES = new Set([
  "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT", "ENOTFOUND", "EAI_AGAIN",
  "08000", "08001", "08003", "08004", "08006", "57P01", "57P02", "57P03",
]);

function isDatabaseUnavailable(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 5; depth++) {
    const { code, message, cause } = current as { code?: string; message?: string; cause?: unknown };
    if (code && UNAVAILABLE_CODES.has(code)) return true;
    if (message?.includes("DATABASE_URL is not set") || message?.includes("Connection terminated")) return true;
    current = cause;
  }
  return false;
}

/**
 * Wraps a route handler so failures come back in the API's error shape:
 * 503 when the database is unreachable, 500 otherwise. Details go to the
 * server log only; the client never sees a stack or a query.
 */
export function handle<A extends unknown[]>(handler: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      // Next.js signals request-time APIs (cookies(), searchParams) and
      // redirects by throwing; those must reach Next, not become a 500.
      unstable_rethrow(error);
      if (isDatabaseUnavailable(error)) {
        console.error(`[api] database unavailable: ${(error as Error).message.split("\n")[0]}`);
        return fail(503, "unavailable", "Our data service is temporarily unavailable. Please try again in a moment.");
      }
      console.error("[api] unexpected error:", error);
      return fail(500, "internal", "Something went wrong on our side. Please try again.");
    }
  };
}
