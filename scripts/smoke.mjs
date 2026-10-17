// End-to-end check of the OtherWise backend against a running server.
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

/** A browser-like client with its own cookie jar, so two users can be signed in at once. */
function client() {
  let cookie = "";
  const call = async (method, path, body) => {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (cookie) headers.cookie = cookie;
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const set = response.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0].endsWith("=") ? "" : set.split(";")[0];
    return { status: response.status, json: await response.json() };
  };
  return {
    call,
    signIn: (userId) => call("POST", "/api/session", { userId }),
    arrive: (countryCode, signal) => call("POST", "/api/location", { countryCode, ...(signal && { signal }) }),
  };
}

const anon = client();
const saoirse = client();
const aoife = client();
const jonas = client();

await anon.call("POST", "/api/dev/reset");

// Sessions
let r = await anon.call("GET", "/api/users");
check("three demo users listed", r.json.users?.length === 3 && r.json.users.map((u) => u.id).join() === "aoife,jonas,saoirse");
r = await anon.call("GET", "/api/recommendations?country=PT");
check("signed out -> 401 not_signed_in", r.status === 401 && r.json.error?.code === "not_signed_in");
r = await anon.call("GET", "/api/session");
check("session is null when signed out", r.json.user === null);
r = await anon.signIn("nobody");
check("unknown user -> 404", r.status === 404);
r = await aoife.signIn("aoife");
check("sign in as Aoife", r.status === 200 && r.json.user?.id === "aoife");
r = await jonas.signIn("jonas");
check("sign in as Jonas", r.status === 200 && r.json.user?.id === "jonas");
r = await aoife.call("GET", "/api/account");
check("Aoife's account is home IE", r.json.home?.code === "IE");
r = await jonas.call("GET", "/api/account");
check("Jonas's account is home DE", r.json.home?.code === "DE");
r = await jonas.call("GET", "/api/transactions");
check("Jonas sees only his own transactions", r.json.transactions.length > 0 && r.json.transactions.every((t) => t.id.startsWith("jk-")));

// Before any trip
r = await aoife.call("GET", "/api/recommendations");
check("no trip -> 409 no_active_trip", r.status === 409 && r.json.error?.code === "no_active_trip");
r = await aoife.call("GET", "/api/destinations");
check("destinations: PT eligible, JP not",
  r.json.destinations.find((d) => d.code === "PT")?.eligible === true &&
  r.json.destinations.find((d) => d.code === "JP")?.eligible === false);

// US-1: arrival
r = await aoife.arrive("PT");
check("Aoife arrives PT -> notification", r.json.status === "arrived" && r.json.notification !== null);
check("deep link carries only the country", r.json.notification?.deepLink === "/cheaper?country=PT");
const tripId = r.json.trip?.id;
r = await aoife.arrive("PT");
check("PT again -> no second notification (FR-3)", r.json.status === "already-seen" && r.json.notification === null);
r = await jonas.call("GET", "/api/account");
check("Aoife's trip is not on Jonas's account", r.json.activeTrip === null);

// US-3 / US-4: Aoife's comparison
r = await aoife.call("GET", "/api/recommendations");
const recA = r.json;
check("Aoife recommendations 200", r.status === 200, JSON.stringify(r.json).slice(0, 200));
check("no exclusives in the response", !("exclusives" in recA));
check("compared against Ireland", recA.home?.code === "IE");
check("at most 5 categories, personalised ones first",
  recA.categories.length > 0 && recA.categories.length <= 5 &&
  recA.categories.every((c, i, a) => i === 0 || a[i - 1].personalised || !c.personalised));
const slugsA = recA.categories.map((c) => c.slug);
check("Aoife: groceries first", slugsA[0] === "groceries", slugsA.join(","));
check("rent/insurance/pharmacy never shown", !slugsA.some((s) => ["rent", "insurance", "pharmacy"].includes(s)));
const LOCAL_ONLY = ["cafe", "dining-out", "transport", "telecom"];
check("local-only categories never recommended (cafés, dining, transport, mobile)", !slugsA.some((s) => LOCAL_ONLY.includes(s)));
check("electronics not shown for Aoife (only purchase is older than 90 days)", !slugsA.includes("electronics"));
const productsA = recA.categories.flatMap((c) => c.products);
check("every product cheaper than home (FR-14)", productsA.every((p) => p.localPrice.amount < p.homePrice.amount));
check("every product approximate with a date (US-4.2)", productsA.every((p) => p.approximate && p.priceUpdatedAt));
check("real products present for Aoife in PT", productsA.length > 0);
check("every category is >=5% cheaper by Eurostat price levels",
  recA.categories.every((c) => c.comparison?.source === "Eurostat prc_ppp_ind" && c.savingPct >= 5 &&
    c.savingPct === Math.round((1 - c.comparison.localIndex / c.comparison.homeIndex) * 100)));
check("personalised categories carry the user's own typical purchase",
  recA.categories.filter((c) => c.personalised).every((c) => c.typicalPurchase && c.typicalPurchase.local.amount < c.typicalPurchase.home.amount));
check("general suggestions are labelled and always have products",
  recA.categories.filter((c) => !c.personalised).every((c) => c.reason === null && c.typicalPurchase === null && c.products.length > 0));
check("every product is a verified shelf price or an official average",
  productsA.every((p) => p.evidence.source === "Open Prices"
    ? p.url.startsWith("https://prices.openfoodfacts.org/products/") && p.evidence.observations >= 1 &&
      p.evidence.proofs.every((x) => ["RECEIPT", "PRICE_TAG"].includes(x))
    : p.evidence.source === "National statistics" && p.homePriceBasis === "observed"));
check("local comparison is national-average, a sized similar-products median, or null",
  productsA.every((p) => p.localComparison === null ||
    (p.localComparison.basis === "national-average" && p.localComparison.pct === 0 && p.evidence.source === "National statistics") ||
    (p.localComparison.basis === "similar-products" && p.localComparison.sampleSize >= 5 && Number.isInteger(p.localComparison.pct))));
check("some shelf products in PT have a similar-products comparison",
  productsA.some((p) => p.localComparison?.basis === "similar-products"));
check("no near-duplicate products within a category",
  recA.categories.every((c) => new Set(c.products.map((p) => p.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim())).size === c.products.length));
check("home prices are marked observed or estimated", productsA.every((p) => ["observed", "estimated"].includes(p.homePriceBasis)));
check("no price older than 365 days", productsA.every((p) => (Date.parse("2026-10-17") - Date.parse(p.priceUpdatedAt)) / 864e5 <= 365));
check("products sorted by saving",
  recA.categories.every((c) => c.products.every((p, i, a) => i === 0 || a[i - 1].savingPct >= p.savingPct)));
check("links carry no personal data (US-5.3)", productsA.every((p) => !/aoife|brennan|jonas|keller/i.test(p.url)));
check("disclosure present (FR-22)", typeof recA.disclosure === "string" && recA.disclosure.length > 0);

// Jonas in the same place sees his own comparison
r = await jonas.arrive("PT");
check("Jonas arrives PT -> his own notification", r.json.status === "arrived" && r.json.notification?.title.includes("Jonas"));
r = await jonas.call("GET", "/api/recommendations");
const recJ = r.json;
const slugsJ = recJ.categories.map((c) => c.slug);
check("Jonas compared against Germany", recJ.home?.code === "DE");
check("Jonas's categories differ from Aoife's", slugsJ.join() !== slugsA.join(), `${slugsJ} vs ${slugsA}`);
check("Jonas: gambling and rent never shown", !slugsJ.some((s) => ["gambling", "rent"].includes(s)));
check("Jonas: his transport, mobile and dining spend is not recommended", !slugsJ.some((s) => LOCAL_ONLY.includes(s)));
check("Jonas: electronics hidden in PT (Eurostat: dearer than Germany)", !slugsJ.includes("electronics"));
const firstJ = recJ.categories[0];
r = await anon.call("GET", `/api/catalog?category=${firstJ.slug}&from=DE&to=PT`);
check("Jonas is compared against German price levels",
  JSON.stringify(r.json.comparison) === JSON.stringify(firstJ.comparison));
r = await jonas.arrive("ES");
r = await jonas.call("GET", "/api/recommendations");
check("Jonas in ES: electronics still hidden (under 5% cheaper)", !r.json.categories.some((c) => c.slug === "electronics"),
  r.json.categories.map((c) => c.slug).join());

// Saoirse: gamer from Dublin. Electronics is her top spend.
await saoirse.signIn("saoirse");
r = await saoirse.arrive("ES");
r = await saoirse.call("GET", "/api/recommendations");
const elec = r.json.categories?.find((c) => c.slug === "electronics");
check("Saoirse in ES: electronics first, from Eurostat (>=5% cheaper)", r.json.categories?.[0]?.slug === "electronics" && elec.savingPct >= 5);
check("Saoirse: digital games never recommended", !r.json.categories.some((c) => c.slug === "digital-games"));
check("Saoirse: Microsoft list-price check present with identical SKUs",
  elec?.listPriceCheck?.brand === "Microsoft" && elec.listPriceCheck.itemsCompared > 0 && Number.isFinite(elec.listPriceCheck.medianPct));
check("any brand product shown is >=5% cheaper by official list price",
  r.json.categories.flatMap((c) => c.products).filter((p) => p.evidence.source === "Manufacturer list price")
    .every((p) => p.savingPct >= 5 && p.homePriceBasis === "observed" && p.url.startsWith("https://www.microsoft.com/")));
r = await anon.call("GET", "/api/catalog?category=electronics&from=IE&to=DE");
check("catalog exposes the list-price check", r.status === 200 && r.json.listPriceCheck?.itemsCompared > 0);
r = await saoirse.call("GET", "/api/recommendations?country=HU");
check("Saoirse in HU: electronics hidden (under 5% cheaper)", !r.json.categories.some((c) => c.slug === "electronics"));
r = await aoife.call("GET", "/api/account");
check("Saoirse's trip is not on Aoife's account", r.json.activeTrip?.country.code !== "ES");

// FR-15: catalog API boundary
r = await anon.call("GET", "/api/catalog?category=groceries&from=IE&to=PT");
check("catalog answers with comparison + products, no sign-in needed",
  r.status === 200 && r.json.comparison?.savingPct > 0 && r.json.products.length > 0);
r = await anon.call("GET", "/api/catalog?category=groceries&from=IE&to=PT&userId=aoife");
check("catalog refuses extra params", r.status === 400);
r = await anon.call("GET", "/api/catalog?category=pharmacy&from=IE&to=PT");
check("catalog refuses sensitive category", r.status === 400);
r = await anon.call("GET", "/api/catalog?category=groceries&from=IE&to=PT");
check("repeat call served from cache (FR-16)", r.json.source === "cache");

// US-8: feedback is per user and per trip
r = await aoife.call("POST", "/api/feedback", { kind: "category", id: "coffee", country: "PT" });
check("Aoife thumbs-down coffee", r.status === 200 && r.json.tripId === tripId);
r = await aoife.call("GET", "/api/recommendations");
check("coffee hidden for Aoife", !r.json.categories.some((c) => c.slug === "coffee"));

// Multi-country trip, then home
r = await aoife.arrive("HU", "card");
check("Aoife to HU -> new notification, same trip (edge case 3)", r.json.status === "arrived" && r.json.trip.id === tripId);
r = await aoife.call("GET", "/api/recommendations");
const haircut = r.json.categories.find((c) => c.slug === "personal-care")?.products.find((p) => p.id === "ref-mens-haircut");
check("Aoife in HU: men's haircut from official statistics on both sides",
  haircut?.homePriceBasis === "observed" && haircut.evidence.source === "National statistics" &&
  haircut.homePrice.amount > haircut.localPrice.amount && haircut.localPrice.local?.currency === "HUF");
check("official items compare as the national average", haircut?.localComparison?.basis === "national-average");
check("Aoife in HU: butter left out (dearer in Hungary by official averages)",
  !r.json.categories.some((c) => c.products.some((p) => p.id === "ref-butter")));
check("HU has HUF local prices at the verified ECB rate",
  r.json.fx?.pair === "EUR/HUF" && r.json.fx.rate > 300 && r.json.categories[0].typicalPurchase.local.local?.currency === "HUF");
r = await aoife.arrive("JP");
check("JP -> ineligible (FR-4)", r.json.status === "ineligible" && r.json.notification === null);
r = await aoife.arrive("IE");
check("home -> trip ends (US-1.3)", r.json.status === "home");
r = await aoife.arrive("PT");
check("new trip -> notifies again", r.json.notification !== null && r.json.trip.id !== tripId);
r = await aoife.call("GET", "/api/recommendations");
check("previous trip's feedback no longer hides coffee", r.json.categories.some((c) => c.slug === "coffee"));

// US-6: consent is per user
r = await aoife.call("PUT", "/api/consent", { personalisation: false, notifications: false });
check("Aoife withdraws consent", r.status === 200 && r.json.personalisation === false);
r = await aoife.call("GET", "/api/recommendations");
check("no consent -> general suggestions only (US-6.2, US-7.2)",
  r.json.personalised === false && r.json.categories.length > 0 &&
  r.json.categories.every((c) => !c.personalised && c.reason === null && c.typicalPurchase === null && c.products.length > 0));
r = await jonas.call("GET", "/api/recommendations");
check("Jonas still personalised", r.json.personalised === true);
await aoife.arrive("IE");
r = await aoife.arrive("ES");
check("no consent -> notification suppressed",
  r.json.status === "arrived" && r.json.notification === null && r.json.suppressedBecause === "notifications-off");

// FR-23: events
r = await aoife.call("POST", "/api/events", { type: "product_tapped", country: "PT", productId: productsA[0].id });
check("event accepted", r.status === 201);
r = await aoife.call("POST", "/api/events", { type: "product_tapped", amountEur: 12 });
check("event with extra field refused", r.status === 400);
r = await anon.call("GET", "/api/events");
const types = new Set(r.json.events.map((e) => e.type));
check("server logged notification_sent, opt_out, feedback",
  types.has("notification_sent") && types.has("opt_out") && types.has("feedback"));

// Input validation and sign-out
r = await aoife.call("POST", "/api/location", { countryCode: "XX" });
check("unknown country -> 400", r.status === 400 && r.json.error?.code === "bad_request");
r = await aoife.call("POST", "/api/location", "not json");
check("malformed JSON -> 400", r.status === 400);
await aoife.call("DELETE", "/api/session");
r = await aoife.call("GET", "/api/account");
check("signed out -> 401", r.status === 401);

await anon.call("POST", "/api/dev/reset");
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
