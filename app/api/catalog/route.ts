import type { NextRequest } from "next/server";

import { queryCatalog } from "@/lib/server/catalog";
import { badRequest, parseCountry } from "@/lib/server/http";
import { getCategoryDef } from "@/lib/server/seed";

/**
 * GET /api/catalog?category=groceries&from=IE&to=PT
 *
 * The product and price API on its own (FR-11). It accepts exactly three
 * parameters and nothing about the user (FR-15); any other parameter is
 * refused rather than ignored, so a caller cannot leak data into logs.
 */
const ALLOWED = ["category", "from", "to"];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const extra = [...params.keys()].filter((key) => !ALLOWED.includes(key));
  if (extra.length > 0) return badRequest(`Unexpected parameter(s): ${extra.join(", ")}.`);

  const category = params.get("category") ?? "";
  const def = getCategoryDef(category);
  if (!def || def.kind !== "everyday") return badRequest("category must be an everyday category slug.");

  const from = parseCountry(params.get("from"));
  const to = parseCountry(params.get("to"));
  if (!from || !to) return badRequest("from and to must be known two-letter country codes.");
  if (from === to) return badRequest("from and to must differ.");

  return Response.json(await queryCatalog({ category, from, to }));
}
