import { connection } from "next/server";

import { badRequest, parseCountry, readObject, unknownKeys } from "@/lib/server/http";
import { getCategoryDef } from "@/lib/server/seed";
import { listEvents, recordEvent } from "@/lib/server/store";
import { EVENT_TYPES, type AnalyticsEvent, type EventType } from "@/lib/server/types";

/**
 * POST { type, country?, category?, productId? }
 *
 * FR-23 analytics. The allowed fields are the whole schema; anything else is
 * refused, so amounts, merchants or names cannot be logged by mistake.
 *
 * The server already records notification_sent, opt_in, opt_out and feedback
 * itself. The client sends notification_opened, recommendations_viewed,
 * category_viewed and product_tapped.
 */
export async function POST(request: Request) {
  const body = await readObject(request);
  if (body instanceof Response) return body;

  const extra = unknownKeys(body, ["type", "country", "category", "productId"]);
  if (extra.length > 0) return badRequest(`Unexpected field(s): ${extra.join(", ")}.`);

  if (!EVENT_TYPES.includes(body.type as EventType)) {
    return badRequest(`type must be one of: ${EVENT_TYPES.join(", ")}.`);
  }

  const event: AnalyticsEvent = { type: body.type as EventType, at: new Date().toISOString() };

  if (body.country !== undefined) {
    const country = parseCountry(body.country);
    if (!country) return badRequest("country must be a known two-letter country code.");
    event.country = country;
  }
  if (body.category !== undefined) {
    if (typeof body.category !== "string" || !getCategoryDef(body.category)) {
      return badRequest("category must be a known category slug.");
    }
    event.category = body.category;
  }
  if (body.productId !== undefined) {
    if (typeof body.productId !== "string" || !/^[a-z0-9-]{1,64}$/.test(body.productId)) {
      return badRequest("productId must be a catalog id.");
    }
    event.productId = body.productId;
  }

  await recordEvent(event);
  return Response.json({ ok: true }, { status: 201 });
}

/** For the team dashboard. Contains no personal financial data by construction. */
export async function GET() {
  await connection();
  return Response.json({ events: await listEvents() });
}
