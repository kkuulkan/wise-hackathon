// End-to-end check of the backend against a running server.
//
//   npm run dev            (or: npm run build && npm start)
//   npm run smoke          (BASE_URL defaults to http://localhost:3000)
//
// Each step prints PASS or FAIL. Exits non-zero on any failure. It resets
// server state first, so it is safe to run repeatedly, but it will reset a
// demo in progress.

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;

function check(name, condition, detail = "") {
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${!condition && detail ? `  -> ${detail}` : ""}`);
  if (!condition) failures += 1;
}

async function call(method, path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, json: await response.json() };
}

const arrive = (countryCode, signal) => call("POST", "/api/location", { countryCode, ...(signal && { signal }) });

await call("POST", "/api/dev/reset");

// Before any trip
let r = await call("GET", "/api/recommendations");
check("no trip -> 409 no_active_trip", r.status === 409 && r.json.error?.code === "no_active_trip");

r = await call("GET", "/api/destinations");
check("destinations lists PT as eligible, JP as not",
  r.json.destinations.find((d) => d.code === "PT")?.eligible === true &&
  r.json.destinations.find((d) => d.code === "JP")?.eligible === false);

// US-1: arrival
r = await arrive("PT");
check("arrive PT -> arrived + notification", r.json.status === "arrived" && r.json.notification !== null);
check("notification deep link carries only the country", r.json.notification?.deepLink === "/cheaper?country=PT");
const tripId = r.json.trip?.id;

r = await arrive("PT");
check("PT again -> no second notification (FR-3)", r.json.status === "already-seen" && r.json.notification === null);

r = await call("GET", "/api/account");
check("account shows active trip in PT (FR-7)", r.json.activeTrip?.country.code === "PT");

// US-3 / US-4: recommendations
r = await call("GET", "/api/recommendations");
const recs = r.json;
check("recommendations 200", r.status === 200, JSON.stringify(r.json).slice(0, 200));
check("at most 5 categories", recs.categories.length > 0 && recs.categories.length <= 5);
check("personalised", recs.personalised === true);
const slugs = recs.categories.map((c) => c.slug);
check("groceries ranks first (highest spend)", slugs[0] === "groceries", slugs.join(","));
check("rent/insurance/pharmacy never shown", !slugs.some((s) => ["rent", "insurance", "pharmacy"].includes(s)));
check("electronics not shown (only purchase is older than 90 days)", !slugs.includes("electronics"));
const allProducts = recs.categories.flatMap((c) => c.products);
check("every product cheaper than home (FR-14)", allProducts.every((p) => p.localPrice.amount < p.homePrice.amount));
check("every product labelled approximate with a date (US-4.2)", allProducts.every((p) => p.approximate && p.priceUpdatedAt));
check("age-restricted wine excluded", !allProducts.some((p) => p.id === "g-wine"));
check("stale-priced jeans excluded", !allProducts.some((p) => p.id === "f-levis"));
check("products sorted by saving within a category",
  recs.categories.every((c) => c.products.every((p, i, a) => i === 0 || a[i - 1].savingPct >= p.savingPct)));
check("links carry no personal data (US-5.3)",
  allProducts.every((p) => !/aoife|brennan|demo-user/i.test(p.url)));
check("exclusives present and labelled", recs.exclusives.length > 0 && recs.exclusives.every((e) => e.label === "Exclusive"));
check("disclosure present (FR-22)", typeof recs.disclosure === "string" && recs.disclosure.length > 0);

// FR-15: catalog API boundary
r = await call("GET", "/api/catalog?category=groceries&from=IE&to=PT");
check("catalog answers with category + pair", r.status === 200 && r.json.products.length > 0);
r = await call("GET", "/api/catalog?category=groceries&from=IE&to=PT&userId=demo-user");
check("catalog refuses extra params", r.status === 400);
r = await call("GET", "/api/catalog?category=pharmacy&from=IE&to=PT");
check("catalog refuses sensitive category", r.status === 400);
r = await call("GET", "/api/catalog?category=electronics&from=IE&to=PT");
check("electronics in PT: all dearer -> empty (category would hide, US-3.3)", r.json.products?.length === 0);
r = await call("GET", "/api/catalog?category=groceries&from=IE&to=PT");
check("second call served from cache (FR-16)", r.json.source === "cache");

// US-8: feedback
r = await call("POST", "/api/feedback", { kind: "category", id: "coffee", country: "PT" });
check("thumbs-down coffee", r.status === 200 && r.json.tripId === tripId);
r = await call("GET", "/api/recommendations");
check("coffee hidden for the trip", !r.json.categories.some((c) => c.slug === "coffee"));

// Multi-country trip, then home
r = await arrive("HU", "card");
check("move to HU -> new notification, same trip (edge case 3)", r.json.status === "arrived" && r.json.trip.id === tripId);
r = await call("GET", "/api/recommendations");
check("HU response has HUF local prices", r.json.fx?.pair === "EUR/HUF" && r.json.categories[0].products[0].localPrice.local?.currency === "HUF");
r = await arrive("PT");
check("back to PT on same trip -> no notification", r.json.notification === null);
r = await arrive("JP");
check("JP -> ineligible (FR-4)", r.json.status === "ineligible" && r.json.notification === null);
r = await arrive("IE");
check("home -> trip ends (US-1.3)", r.json.status === "home");
r = await arrive("PT");
check("new trip -> notifies again", r.json.status === "arrived" && r.json.notification !== null && r.json.trip.id !== tripId);
r = await call("GET", "/api/recommendations");
check("feedback from previous trip no longer hides coffee", r.json.categories.some((c) => c.slug === "coffee"));

// US-6: consent
r = await call("PUT", "/api/consent", { personalisation: false, notifications: false });
check("withdraw consent", r.status === 200 && r.json.personalisation === false);
r = await call("GET", "/api/recommendations");
check("no consent -> general suggestions only (US-6.2, US-7.2)",
  r.json.personalised === false && r.json.categories.every((c) => !c.personalised && c.reason === null));
await arrive("IE");
r = await arrive("ES");
check("no consent -> arrival recorded, notification suppressed",
  r.json.status === "arrived" && r.json.notification === null && r.json.suppressedBecause === "notifications-off");

// FR-23: events
r = await call("POST", "/api/events", { type: "product_tapped", country: "PT", productId: "g-olive-oil" });
check("event accepted", r.status === 201);
r = await call("POST", "/api/events", { type: "product_tapped", amountEur: 12 });
check("event with extra field refused", r.status === 400);
r = await call("GET", "/api/events");
const types = new Set(r.json.events.map((e) => e.type));
check("server logged notification_sent, opt_out, feedback",
  types.has("notification_sent") && types.has("opt_out") && types.has("feedback"));

// Input validation
r = await call("POST", "/api/location", { countryCode: "XX" });
check("unknown country -> 400", r.status === 400 && r.json.error?.code === "bad_request");
r = await fetch(`${BASE}/api/location`, { method: "POST", body: "not json" });
check("malformed JSON -> 400", r.status === 400);

await call("POST", "/api/dev/reset");
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
