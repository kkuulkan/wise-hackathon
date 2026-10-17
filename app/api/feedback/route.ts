import { connection } from "next/server";

import { badRequest, fail, parseCountry, readObject, unknownKeys } from "@/lib/server/http";
import { getPriceData } from "@/lib/server/pricedata";
import { getCategoryDef } from "@/lib/server/seed";
import { requireUser } from "@/lib/server/session";
import { addFeedback, getActiveTrip, listAllFeedback, recordEvent } from "@/lib/server/store";

/** Any product the catalog can show: shelf, official reference or brand list item. */
async function isKnownProduct(id: string): Promise<boolean> {
  const data = await getPriceData();
  return [data.products, data.referenceItems, data.brandItems].some((items) => items.some((item) => item.id === id));
}

/**
 * POST { kind: "category" | "product", id: string, country: "PT" }
 *
 * Thumbs-down (US-8). Hides the item for the rest of the signed-in user's
 * current trip.
 */
export async function POST(request: Request) {
  const profile = await requireUser();
  if (profile instanceof Response) return profile;

  const body = await readObject(request);
  if (body instanceof Response) return body;

  const extra = unknownKeys(body, ["kind", "id", "country"]);
  if (extra.length > 0) return badRequest(`Unexpected field(s): ${extra.join(", ")}.`);

  const { kind, id } = body;
  const country = parseCountry(body.country);
  if (kind !== "category" && kind !== "product") return badRequest('kind must be "category" or "product".');
  if (typeof id !== "string") return badRequest("id is required.");
  if (!country) return badRequest("country must be a known two-letter country code.");

  const known =
    kind === "category"
      ? Boolean(getCategoryDef(id))
      : await isKnownProduct(id);
  if (!known) return fail(404, "not_found", `No ${kind} with id "${id}".`);

  const trip = await getActiveTrip(profile.userId);
  if (!trip || !trip.countries[country]) {
    return fail(409, "no_active_trip", "Feedback is saved per trip, and there is no trip to that country.");
  }

  const createdAt = new Date().toISOString();
  await addFeedback(profile.userId, { tripId: trip.id, kind, id, country, createdAt });
  await recordEvent({
    type: "feedback",
    country,
    ...(kind === "category" ? { category: id } : { productId: id }),
    at: createdAt,
  });

  return Response.json({ ok: true, hiddenFor: "trip", tripId: trip.id });
}

/** For the team: every thumbs-down, analysable by kind, country and id (US-8.3). No user ids. */
export async function GET() {
  await connection();
  return Response.json({ feedback: await listAllFeedback() });
}
