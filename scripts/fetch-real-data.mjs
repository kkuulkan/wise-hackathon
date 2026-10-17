// Builds OtherWise's verified price snapshot from real, public sources.
//
//   npm run fetch-data            (takes a few minutes; Germany has thousands of prices)
//
// Sources
//   Eurostat prc_ppp_ind   official price level indices per spending category and country (EU27 = 100)
//   Open Prices (OFF)      crowdsourced shelf prices, each backed by a receipt or price-tag photo
//   ECB via Frankfurter    EUR exchange rates, cross-checked against Eurostat ert_bil_eur_d
//   CSO Ireland CPM12      official national average prices of named items, monthly
//   KSH Hungary ara0004    official national average prices of named items, annual
//   Microsoft Store        manufacturer list prices (MSRP) per market, from the public
//                          catalogue the store itself uses (undocumented; soft source)
//
// Every record passes through verification gates. Anything that fails is
// dropped and counted in data/real/verification-report.json. If a source
// the app cannot work without fails its gates (missing index values, FX
// sources disagreeing), the script exits non-zero and writes nothing, so the
// app keeps the last good snapshot.

import { mkdir, rename, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = path.join(ROOT, "data", "real");
const USER_AGENT = "OtherWise-hackathon/0.1 (BME x Wise prototype; contact namiatariq@gmail.com)";

const TODAY = process.env.OTHERWISE_TODAY ?? new Date().toISOString().slice(0, 10);
const COUNTRIES = {
  IE: { osmName: "Ireland", currency: "EUR" },
  DE: { osmName: "Deutschland", currency: "EUR" },
  PT: { osmName: "Portugal", currency: "EUR" },
  HU: { osmName: "Magyarország", currency: "HUF" },
  ES: { osmName: "España", currency: "EUR" },
};

/** Eurostat analytical categories the app needs. Keys are COICOP-based ppp_cat codes. */
const PRICE_LEVEL_CODES = [
  "A010101", "A01010101", "A01010102", "A01010103", "A01010104", "A01010105", "A01010106", "A01010199",
  "A010102", "A0103", "A010703", "A0108", "A010901", "A0111", "A0112",
];

/**
 * Open Food Facts category tags → our taxonomy and the Eurostat index that
 * prices them. First match wins, so specific groups sit above broad ones.
 *
 * Only things a traveller can buy here and take home: shelf-stable food,
 * coffee to brew, toiletries. Fresh produce, meat, milk and bread are bought
 * and eaten locally either way, so recommending them saves nothing.
 */
const PRODUCT_GROUPS = [
  // Beans, ground, capsules and instant: sold by weight, which also rules out ready-to-drink coffee.
  { category: "coffee", index: "A010102", tags: ["en:coffees"], unit: "g" },
  { category: "groceries", index: "A01010105", tags: ["en:olive-oils", "en:vegetable-oils"] },
  { category: "groceries", index: "A01010103", tags: ["en:canned-fishes"] },
  { category: "groceries", index: "A01010199", tags: ["en:chocolates", "en:honeys", "en:jams"] },
  { category: "groceries", index: "A01010104", tags: ["en:cheeses"] },
  { category: "groceries", index: "A01010101", tags: ["en:pastas", "en:rices", "en:breakfast-cereals", "en:biscuits"] },
  { category: "skincare-beauty", index: "A0112", tags: ["en:shampoos", "en:shower-gels", "en:deodorants", "en:body-milks", "en:toothpastes"] },
];

/**
 * Named items that both national statistics offices price. Only pairs that
 * are the same thing, or whose difference is stated in `note`. Rejected on
 * review: jam (KSH specifies ≥50% fruit, CSO does not), spaghetti (egg pasta
 * vs plain), cheese (trappist vs cheddar), flour (plain vs self-raising). Prices are
 * normalised to `unit` by dividing by `per` (the quantity the source quotes).
 */
const REFERENCE_ITEMS = [
  {
    id: "ref-mens-haircut", category: "personal-care", name: "Men's haircut", unit: "per cut",
    note: "Ireland's figure is a dry cut; Hungary's includes washing and drying, so the gap is if anything larger.",
    sources: { IE: { label: "Gent's dry cut fee", per: 1 }, HU: { code: "63003", per: 1 } },
  },
  {
    id: "ref-womens-haircut", category: "personal-care", name: "Women's wash, cut and blow-dry", unit: "per visit",
    note: null,
    sources: { IE: { label: "Ladies' wash, cut and blow dry fee", per: 1 }, HU: { code: "63005", per: 1 } },
  },
  {
    id: "ref-butter", category: "groceries", name: "Butter", unit: "per kg",
    note: null,
    sources: { IE: { label: "Butter per lb", per: 0.4536 }, HU: { code: "12001", per: 0.1 } },
  },
  {
    id: "ref-sugar", category: "groceries", name: "Granulated sugar", unit: "per kg",
    note: null,
    sources: { IE: { label: "White granulated sugar per 1 kg", per: 1 }, HU: { code: "13501", per: 1 } },
  },
];
const CSO_URL = "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/CPM12/JSON-stat/2.0/en";
const KSH_URL = "https://www.ksh.hu/stadat_files/ara/en/ara0004.csv";
const MAX_REFERENCE_AGE_DAYS = 550; // KSH publishes annual averages, so last year's figure must still pass
const MAX_REFERENCE_RATIO = 5; // a home/local price ratio beyond 5x (either way) means a unit or matching error

/**
 * Narrow product types, most specific first, for "how does this compare with
 * similar products in this country?". Comparisons are per kg or per litre,
 * and only made when MIN_TYPE_SAMPLE distinct products of the type exist.
 */
const PRODUCT_TYPES = [
  ["en:extra-virgin-olive-oils", "extra virgin olive oil"], ["en:olive-oils", "olive oil"], ["en:vegetable-oils", "vegetable oil"],
  ["en:canned-tunas", "canned tuna"], ["en:canned-sardines", "canned sardines"], ["en:canned-fishes", "canned fish"],
  ["en:dark-chocolates", "dark chocolate"], ["en:milk-chocolates", "milk chocolate"], ["en:chocolates", "chocolate"],
  ["en:honeys", "honey"], ["en:jams", "jam"], ["en:pastas", "pasta"], ["en:rices", "rice"],
  ["en:breakfast-cereals", "breakfast cereal"], ["en:biscuits", "biscuits"], ["en:cheeses", "cheese"],
  ["en:coffee-capsules", "coffee capsules"], ["en:ground-coffees", "ground coffee"], ["en:instant-coffees", "instant coffee"],
  ["en:coffee-beans", "coffee beans"], ["en:coffees", "coffee"],
  ["en:shampoos", "shampoo"], ["en:shower-gels", "shower gel"], ["en:toothpastes", "toothpaste"],
  ["en:deodorants", "deodorant"], ["en:body-milks", "body lotion"],
];
const MIN_TYPE_SAMPLE = 5;

/** Quantity → kg or litres, so prices of different pack sizes compare. */
function unitAmount(quantity, unit) {
  const value = Number(quantity);
  if (!(value > 0)) return null;
  const factor = { g: [0.001, "kg"], kg: [1, "kg"], ml: [0.001, "L"], cl: [0.01, "L"], l: [1, "L"] }[String(unit).toLowerCase()];
  return factor ? { amount: value * factor[0], unit: factor[1] } : null;
}

/** Never recommended (PRD edge case 21 and sensitive goods). */
const EXCLUDED_TAGS = [
  "en:alcoholic-beverages", "en:wines", "en:beers", "en:spirits", "en:baby-milks", "en:dietary-supplements",
  "en:coffee-substitutes", "en:coffee-drinks", "en:dairy-drinks",
];

const MAX_AGE_DAYS = 365;
const PRICE_BOUNDS_EUR = [0.05, 200];
const OUTLIER_FACTOR = 2; // keep observations within ½× and 2× of the product's median
const PRODUCTS_PER_GROUP = 10;
const FX_AGREEMENT_PCT = 1;
const MAX_INDEX_CHANGE_PCT = 30;

// HTTP

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await sleep(1500 * attempt);
    }
  }
  throw new Error(`${url} failed: ${lastError.message}`);
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const round2 = (value) => Math.round(value * 100) / 100;
const daysBetween = (from, to) => (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;

// 1. FX

async function fetchFx() {
  const ecb = await getJson("https://api.frankfurter.dev/v1/latest?base=EUR&symbols=HUF");
  const eurostat = await getJson(
    "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/ert_bil_eur_d?format=JSON&currency=HUF&statinfo=AVG&lastTimePeriod=1",
  );
  const eurostatRate = Object.values(eurostat.value)[0];
  const eurostatDate = Object.keys(eurostat.dimension.time.category.index)[0];
  const ecbRate = ecb.rates?.HUF;

  const gap = Math.abs(ecbRate - eurostatRate) / ecbRate * 100;
  const report = { ecb: { rate: ecbRate, date: ecb.date }, eurostat: { rate: eurostatRate, date: eurostatDate }, gapPct: round2(gap) };
  if (!(ecbRate > 0 && eurostatRate > 0) || gap > FX_AGREEMENT_PCT) {
    throw new Error(`FX gate failed: sources disagree by ${gap.toFixed(2)}% (limit ${FX_AGREEMENT_PCT}%)`);
  }

  return {
    fx: {
      _source: "ECB reference rate via api.frankfurter.dev, cross-checked against Eurostat ert_bil_eur_d.",
      base: "EUR",
      perEur: { EUR: 1, HUF: ecbRate },
      asOf: ecb.date,
    },
    report,
  };
}

// 2. Eurostat price levels

async function fetchPriceLevels() {
  const geos = Object.keys(COUNTRIES).map((code) => `geo=${code}`).join("&");
  const cats = PRICE_LEVEL_CODES.map((code) => `ppp_cat=${code}`).join("&");
  const url = `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_ppp_ind?format=JSON&lang=EN&na_item=PLI_EU27_2020&${geos}&${cats}&lastTimePeriod=2`;
  const data = await getJson(url);

  const index = Object.fromEntries(data.id.map((dim) => [dim, data.dimension[dim].category.index]));
  const years = Object.keys(index.time).sort();
  const [previousYear, year] = years.slice(-2);
  const at = (cat, geo, time) => {
    const pos = data.id.map((dim) => ({ ppp_cat: index.ppp_cat[cat], geo: index.geo[geo], time: index.time[time] })[dim] ?? 0);
    const flat = pos.reduce((acc, p, i) => acc * data.size[i] + p, 0);
    return data.value[String(flat)];
  };

  const failures = [];
  const flagged = [];
  const levels = {};
  for (const cat of PRICE_LEVEL_CODES) {
    const values = {};
    for (const geo of Object.keys(COUNTRIES)) {
      const value = at(cat, geo, year);
      const before = at(cat, geo, previousYear);
      if (typeof value !== "number") failures.push(`${cat}/${geo}: missing for ${year}`);
      else if (value < 20 || value > 300) failures.push(`${cat}/${geo}: ${value} outside 20–300`);
      else {
        values[geo] = value;
        if (typeof before === "number" && Math.abs(value - before) / before * 100 > MAX_INDEX_CHANGE_PCT) {
          flagged.push(`${cat}/${geo}: ${before} → ${value}`);
        }
      }
    }
    levels[cat] = { label: data.dimension.ppp_cat.category.label[cat], values };
  }

  if (failures.length > 0) throw new Error(`Eurostat gate failed:\n  ${failures.join("\n  ")}`);
  // A big jump is not proof of an error, but a silent one would be.
  if (flagged.length > 0) throw new Error(`Eurostat gate failed, year-on-year change above ${MAX_INDEX_CHANGE_PCT}%:\n  ${flagged.join("\n  ")}`);

  return {
    levels: {
      _source: `Eurostat prc_ppp_ind, price level indices (EU27_2020 = 100), ${year}. Dataset updated ${data.updated}.`,
      dataset: "prc_ppp_ind",
      measure: "PLI_EU27_2020",
      year,
      updated: data.updated,
      url,
      levels,
    },
    report: { year, previousYear, codes: PRICE_LEVEL_CODES.length, countries: Object.keys(COUNTRIES).length, checkedValues: PRICE_LEVEL_CODES.length * Object.keys(COUNTRIES).length },
  };
}

// 3. Open Prices products

function groupFor(tags) {
  if (!Array.isArray(tags) || tags.some((tag) => EXCLUDED_TAGS.includes(tag))) return null;
  return PRODUCT_GROUPS.find((group) => group.tags.some((tag) => tags.includes(tag))) ?? null;
}

async function fetchCountryPrices(country, { currency, osmName }) {
  const locations = [];
  for (let page = 1; ; page++) {
    const data = await getJson(
      `https://prices.openfoodfacts.org/api/v1/locations?osm_address_country__like=${encodeURIComponent(osmName)}&price_count__gte=1&size=100&page=${page}`,
    );
    locations.push(...data.items.filter((location) => location.osm_address_country_code === country));
    if (page >= data.pages) break;
    await sleep(300);
  }

  const since = new Date(Date.parse(`${TODAY}T00:00:00Z`) - MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10);
  const tags = PRODUCT_GROUPS.flatMap((group) => group.tags).join(",");
  const prices = [];
  for (let i = 0; i < locations.length; i += 40) {
    const ids = locations.slice(i, i + 40).map((location) => location.id).join(",");
    for (let page = 1; ; page++) {
      const data = await getJson(
        `https://prices.openfoodfacts.org/api/v1/prices?location_id__in=${ids}&product__categories_tags__overlap=${encodeURIComponent(tags)}&type=PRODUCT&duplicate_of__isnull=true&date__gte=${since}&size=100&page=${page}`,
      );
      prices.push(...data.items);
      if (page >= data.pages) break;
      await sleep(300);
    }
  }
  process.stdout.write(`  ${country}: ${locations.length} shops, ${prices.length} candidate prices\n`);
  return { prices, currency };
}

function verifyPrices(country, { prices, currency }, fx) {
  const gates = {
    "has barcode and name": 0,
    "shop is in this country": 0,
    "currency matches country": 0,
    "observed in the last 365 days": 0,
    "not a discounted price": 0,
    "backed by receipt or price-tag photo": 0,
    "maps to an OtherWise category": 0,
    "sold in the unit its type needs": 0,
    "price within plausible bounds": 0,
    "within 2x of the product's median": 0,
  };
  const rejectedExamples = [];
  const reject = (gate, price) => {
    gates[gate]++;
    if (rejectedExamples.length < 8) {
      rejectedExamples.push({ gate, product: price.product?.product_name ?? price.product_code, price: price.price, currency: price.currency, date: price.date });
    }
    return false;
  };

  const passed = prices.filter((price) => {
    const product = price.product ?? {};
    const name = (product.product_name ?? "").trim();
    if (!price.product_code || !name || name.length > 100) return reject("has barcode and name", price);
    if (price.location?.osm_address_country_code !== country) return reject("shop is in this country", price);
    if (price.currency !== currency) return reject("currency matches country", price);
    const age = daysBetween(price.date, TODAY);
    if (!(age >= 0 && age <= MAX_AGE_DAYS)) return reject("observed in the last 365 days", price);
    if (price.price_is_discounted) return reject("not a discounted price", price);
    if (!["RECEIPT", "PRICE_TAG"].includes(price.proof?.type)) return reject("backed by receipt or price-tag photo", price);
    const group = groupFor(product.categories_tags);
    if (!group) return reject("maps to an OtherWise category", price);
    // Crowd tags can be wrong (a milk carton tagged as coffee capsules); the unit catches it.
    if (group.unit && product.product_quantity_unit !== group.unit) return reject("sold in the unit its type needs", price);
    const eur = price.price / fx.perEur[currency];
    if (!(eur >= PRICE_BOUNDS_EUR[0] && eur <= PRICE_BOUNDS_EUR[1])) return reject("price within plausible bounds", price);
    return true;
  });

  const byCode = new Map();
  for (const price of passed) {
    if (!byCode.has(price.product_code)) byCode.set(price.product_code, []);
    byCode.get(price.product_code).push(price);
  }

  const products = [];
  for (const [code, observations] of byCode) {
    const mid = median(observations.map((price) => price.price));
    const kept = observations.filter((price) => {
      const ok = price.price >= mid / OUTLIER_FACTOR && price.price <= mid * OUTLIER_FACTOR;
      if (!ok) reject("within 2x of the product's median", price);
      return ok;
    });
    if (kept.length === 0) continue;

    const product = kept[0].product;
    const group = groupFor(product.categories_tags);
    const price = round2(median(kept.map((p) => p.price)));
    const dates = kept.map((p) => p.date).sort();
    const quantity = product.product_quantity && product.product_quantity_unit
      ? `${product.product_quantity} ${product.product_quantity_unit}` : null;
    const type = PRODUCT_TYPES.find(([tag]) => product.categories_tags.includes(tag)) ?? null;
    const amount = unitAmount(product.product_quantity, product.product_quantity_unit);
    const priceEur = round2(price / fx.perEur[currency]);

    products.push({
      id: `op-${country.toLowerCase()}-${code}`,
      code,
      country,
      category: group.category,
      priceLevel: group.index,
      name: product.product_name.trim(),
      brand: product.brands ?? null,
      quantity,
      price,
      currency,
      priceEur,
      type: type?.[0] ?? null,
      unit: amount?.unit ?? null,
      unitPriceEur: amount ? round2(priceEur / amount.amount) : null,
      observations: kept.length,
      firstSeen: dates[0],
      lastSeen: dates.at(-1),
      shops: [...new Set(kept.map((p) => [p.location?.osm_name, p.location?.osm_address_city].filter(Boolean).join(", ")))].slice(0, 3),
      proofs: [...new Set(kept.map((p) => p.proof.type))].sort(),
      url: `https://prices.openfoodfacts.org/products/${code}`,
    });
  }

  // Keep the best-evidenced products per group: most observations, then most recent.
  const selected = [];
  for (const group of PRODUCT_GROUPS) {
    selected.push(
      ...products
        .filter((product) => product.category === group.category && product.priceLevel === group.index)
        .sort((a, b) => b.observations - a.observations || b.lastSeen.localeCompare(a.lastSeen) || a.code.localeCompare(b.code))
        .slice(0, PRODUCTS_PER_GROUP),
    );
  }

  // Per-type median unit price over every verified product, before the cap,
  // so the comparison uses all the evidence rather than the ten shown.
  const typeStats = {};
  for (const [tag, label] of PRODUCT_TYPES) {
    for (const unit of ["kg", "L"]) {
      const unitPrices = products.filter((p) => p.type === tag && p.unit === unit).map((p) => p.unitPriceEur);
      if (unitPrices.length >= MIN_TYPE_SAMPLE) {
        typeStats[tag] = { label, unit, medianUnitPriceEur: round2(median(unitPrices)), sampleSize: unitPrices.length };
      }
    }
  }

  return {
    products: selected,
    typeStats,
    report: {
      candidates: prices.length,
      passedRecordGates: passed.length,
      rejectedBy: gates,
      distinctProducts: products.length,
      keptProducts: selected.length,
      typesWithLocalComparison: Object.keys(typeStats).length,
      rejectedExamples,
    },
  };
}

// 4. Official reference items (CSO Ireland, KSH Hungary)

async function fetchCso() {
  const data = await getJson(CSO_URL);
  const itemDim = data.id.find((dim) => dim.startsWith("C0"));
  const timeDim = "TLIST(M1)";
  const asMap = (index) => (Array.isArray(index) ? Object.fromEntries(index.map((k, i) => [k, i])) : index);
  const items = asMap(data.dimension[itemDim].category.index);
  const times = asMap(data.dimension[timeDim].category.index);
  const latest = Object.keys(times).sort((a, b) => times[a] - times[b]).at(-1);
  // Period codes look like "202609" (older tables use "2026M09").
  const match = /^(\d{4})M?(\d{2})$/.exec(latest);
  if (!match) throw new Error(`CSO period "${latest}" not understood`);
  const period = `${match[1]}-${match[2]}-28`;

  const byLabel = {};
  for (const [code, position] of Object.entries(items)) {
    const pos = { STATISTIC: 0, [timeDim]: times[latest], [itemDim]: position };
    const flat = data.id.reduce((acc, dim, i) => acc * data.size[i] + (pos[dim] ?? 0), 0);
    byLabel[data.dimension[itemDim].category.label[code]] = data.value[flat];
  }
  return { byLabel, period, label: data.dimension[timeDim].category.label[latest] };
}

async function fetchKsh() {
  const response = await fetch(KSH_URL, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) throw new Error(`KSH ${response.status}`);
  const text = new TextDecoder("iso-8859-2").decode(await response.arrayBuffer());
  const rows = text.split(/\r?\n/).map((line) => line.split(";"));
  const header = rows.find((row) => row[0] === "Code");
  const year = header.filter((cell) => /^\d{4}$/.test(cell)).at(-1);
  const column = header.indexOf(year);
  const byCode = {};
  for (const row of rows) {
    if (!/^\d+$/.test(row[0] ?? "")) continue;
    // Thousands are space-grouped ("4 010"); ".." means not published.
    const value = Number((row[column] ?? "").replace(/[\s\u00a0]/g, ""));
    byCode[row[0]] = { name: row[1], value: Number.isFinite(value) && value > 0 ? value : null };
  }
  return { byCode, year, period: `${year}-12-31` };
}

async function fetchReferenceItems(fx) {
  const [cso, ksh] = await Promise.all([fetchCso(), fetchKsh()]);
  const kept = [];
  const rejected = [];

  for (const item of REFERENCE_ITEMS) {
    const ie = cso.byLabel[item.sources.IE.label];
    const hu = ksh.byCode[item.sources.HU.code]?.value;
    const prices = {
      IE: typeof ie === "number" ? { price: ie / item.sources.IE.per, currency: "EUR", period: cso.period, source: `CSO Ireland CPM12, ${cso.label}`, url: "https://data.cso.ie/table/CPM12" } : null,
      HU: typeof hu === "number" ? { price: hu / item.sources.HU.per, currency: "HUF", period: ksh.period, source: `KSH Hungary ara0004, ${ksh.year} average`, url: "https://www.ksh.hu/stadat_files/ara/en/ara0004.html" } : null,
    };

    const problems = [];
    for (const [country, entry] of Object.entries(prices)) {
      if (!entry) { problems.push(`${country}: no published value`); continue; }
      const age = daysBetween(entry.period, TODAY);
      if (!(age >= -31 && age <= MAX_REFERENCE_AGE_DAYS)) problems.push(`${country}: ${entry.period} is too old`);
      entry.price = round2(entry.price);
      entry.priceEur = round2(entry.price / fx.perEur[entry.currency]);
    }
    if (prices.IE && prices.HU) {
      const ratio = prices.IE.priceEur / prices.HU.priceEur;
      if (ratio > MAX_REFERENCE_RATIO || ratio < 1 / MAX_REFERENCE_RATIO) problems.push(`implausible IE/HU ratio ${ratio.toFixed(2)}`);
    }

    if (problems.length > 0) rejected.push({ id: item.id, problems });
    else kept.push({ id: item.id, category: item.category, name: item.name, unit: item.unit, note: item.note, prices });
  }

  // One bad match is a data problem; all of them failing is a parsing problem.
  if (kept.length === 0) throw new Error(`Reference gate failed: every item rejected (${JSON.stringify(rejected)})`);

  return { items: kept, report: { cso: cso.label, ksh: ksh.year, candidates: REFERENCE_ITEMS.length, kept: kept.length, rejected } };
}

// 5. Manufacturer list prices (Microsoft Store catalogue)

const MS_CATALOG = "https://displaycatalog.mp.microsoft.com/v7.0";
const MS_MARKETS = { IE: "en-ie", DE: "de-de", PT: "pt-pt", ES: "es-es", HU: "hu-hu" };
/** Standard VAT rates (European Commission, "VAT rates applied in the Member States"). */
const VAT = { IE: 0.23, DE: 0.19, PT: 0.23, ES: 0.21, HU: 0.27 };
/**
 * Brands mostly set one pre-VAT price for the euro area, so a market whose
 * pre-VAT price sits more than this far from the others' median is a stale or
 * special listing (seen: Xbox consoles 25–33% "cheaper" on old 2020 SKUs).
 */
const MAX_NET_DEVIATION = 0.1;
const REFURBISHED = /refurbish|generalüberholt|reacondicionad|recondicionad/i;

async function fetchMicrosoftListPrices(fx) {
  const ids = new Set();
  for (const market of Object.keys(MS_MARKETS)) {
    // Pages hold fewer items than `count` asks for, so advance by what came back.
    for (let skip = 0; ; ) {
      const data = await getJson(`${MS_CATALOG}/productFamilies/Devices/products?market=${market}&languages=en-US&count=25&%24skip=${skip}`);
      const products = data.Products ?? [];
      products.forEach((product) => ids.add(product.ProductId));
      skip += products.length;
      if (products.length === 0 || skip >= (data.TotalResultCount ?? 0)) break;
      await sleep(200);
    }
  }

  const bySku = new Map();
  const gates = { "new, not refurbished": 0, "has an official list price (MSRP)": 0, "currency matches market": 0 };
  for (const [country, locale] of Object.entries(MS_MARKETS)) {
    const list = [...ids];
    for (let i = 0; i < list.length; i += 20) {
      const data = await getJson(`${MS_CATALOG}/products?bigIds=${list.slice(i, i + 20).join(",")}&market=${country}&languages=en-US`);
      for (const product of data.Products ?? []) {
        for (const entry of product.DisplaySkuAvailabilities ?? []) {
          const title = entry.Sku?.LocalizedProperties?.[0]?.SkuTitle || product.LocalizedProperties?.[0]?.ProductTitle || "";
          const buy = (entry.Availabilities ?? []).find((a) => a.Actions?.includes("Purchase") && a.OrderManagementData?.Price);
          if (!buy) continue;
          const price = buy.OrderManagementData.Price;
          if (REFURBISHED.test(title) || REFURBISHED.test(product.LocalizedProperties?.[0]?.ProductTitle ?? "")) { gates["new, not refurbished"]++; continue; }
          // MSRP, never ListPrice: ListPrice carries temporary sales.
          if (!(price.MSRP > 0)) { gates["has an official list price (MSRP)"]++; continue; }
          if (price.CurrencyCode !== COUNTRIES[country].currency) { gates["currency matches market"]++; continue; }

          const key = `${product.ProductId}:${entry.Sku.SkuId}`;
          if (!bySku.has(key)) bySku.set(key, { productId: product.ProductId, skuId: entry.Sku.SkuId, name: product.LocalizedProperties?.[0]?.ProductTitle ?? title, prices: {} });
          bySku.get(key).prices[country] = {
            price: price.MSRP,
            currency: price.CurrencyCode,
            priceEur: round2(price.MSRP / fx.perEur[price.CurrencyCode]),
            url: `https://www.microsoft.com/${locale}/d/_/${product.ProductId.toLowerCase()}`,
          };
        }
      }
      await sleep(200);
    }
  }

  const kept = [];
  const rejected = { "sold in fewer than two of our markets": 0, "pre-VAT price inconsistent across markets": 0 };
  const examples = [];
  for (const sku of bySku.values()) {
    if (Object.keys(sku.prices).length < 2) { rejected["sold in fewer than two of our markets"]++; continue; }
    const net = Object.fromEntries(Object.entries(sku.prices).map(([c, p]) => [c, p.priceEur / (1 + VAT[c])]));
    const mid = median(Object.values(net));
    for (const [country, value] of Object.entries(net)) {
      if (Math.abs(value / mid - 1) > MAX_NET_DEVIATION) {
        if (examples.length < 8) examples.push({ name: sku.name, country, priceEur: sku.prices[country].priceEur, others: Object.fromEntries(Object.entries(sku.prices).map(([c, p]) => [c, p.priceEur])) });
        delete sku.prices[country];
      }
    }
    // With two markets that disagree, there is no telling which is right.
    if (Object.keys(sku.prices).length < 2) { rejected["pre-VAT price inconsistent across markets"]++; continue; }
    kept.push({
      id: `ms-${sku.productId}-${sku.skuId}`.toLowerCase(),
      category: "electronics",
      brand: "Microsoft",
      name: sku.name.trim(),
      prices: sku.prices,
    });
  }

  if (kept.length === 0) throw new Error("Microsoft gate failed: no list price survived");
  return {
    items: kept.sort((a, b) => a.id.localeCompare(b.id)),
    report: { devices: ids.size, skus: bySku.size, kept: kept.length, skippedBy: gates, rejectedBy: rejected, inconsistentExamples: examples },
  };
}

// Main

async function writeJson(name, value) {
  const file = path.join(OUT_DIR, name);
  await writeFile(`${file}.tmp`, JSON.stringify(value, null, 2) + "\n");
  return file;
}

async function main() {
  console.log(`OtherWise data fetch for ${TODAY}`);

  console.log("FX …");
  const { fx, report: fxReport } = await fetchFx();
  console.log(`  1 EUR = ${fx.perEur.HUF} HUF (ECB ${fxReport.ecb.rate}, Eurostat ${fxReport.eurostat.rate}, gap ${fxReport.gapPct}%)`);

  console.log("Eurostat price levels …");
  const { levels, report: levelReport } = await fetchPriceLevels();
  console.log(`  ${levelReport.checkedValues} values for ${levelReport.year}, all gates passed`);

  console.log("Open Prices …");
  const products = [];
  const localStats = {};
  const productReport = {};
  for (const [country, info] of Object.entries(COUNTRIES)) {
    const raw = await fetchCountryPrices(country, info);
    const { products: kept, typeStats, report } = verifyPrices(country, raw, fx);
    products.push(...kept);
    localStats[country] = typeStats;
    productReport[country] = report;
    console.log(`  ${country}: ${report.passedRecordGates}/${report.candidates} prices passed, ${report.keptProducts} products kept, ${report.typesWithLocalComparison} types with a local comparison`);
  }

  console.log("Official reference items …");
  const { items: referenceItems, report: referenceReport } = await fetchReferenceItems(fx);
  console.log(`  ${referenceReport.kept}/${referenceReport.candidates} items passed (CSO ${referenceReport.cso}, KSH ${referenceReport.ksh})`);
  for (const miss of referenceReport.rejected) console.log(`  rejected ${miss.id}: ${miss.problems.join("; ")}`);

  // Soft source: the catalogue is undocumented, so if it fails the last good
  // brand-prices.json is kept and the rest of the snapshot still refreshes.
  console.log("Microsoft Store list prices …");
  let brand = null;
  try {
    brand = await fetchMicrosoftListPrices(fx);
    console.log(`  ${brand.report.kept}/${brand.report.skus} SKUs kept from ${brand.report.devices} devices`);
  } catch (error) {
    console.warn(`  skipped, keeping the previous file: ${error.message}`);
  }

  await mkdir(OUT_DIR, { recursive: true });
  const fetchedAt = new Date().toISOString();
  const files = [
    await writeJson("fx.json", { ...fx, fetchedAt }),
    await writeJson("price-levels.json", { ...levels, fetchedAt }),
    await writeJson("products.json", {
      _source: "Open Prices (prices.openfoodfacts.org), crowdsourced shelf prices with receipt or price-tag proof. Only records that passed every gate in verification-report.json. ODbL licence.",
      fetchedAt,
      window: { from: new Date(Date.parse(`${TODAY}T00:00:00Z`) - MAX_AGE_DAYS * 86_400_000).toISOString().slice(0, 10), to: TODAY },
      products,
      // Median price per kg or litre of each product type, by country, from at least
      // MIN_TYPE_SAMPLE distinct verified products. Backs "vs similar products here".
      localStats,
    }),
    await writeJson("reference-items.json", {
      _source: "Official national average prices: CSO Ireland table CPM12 (CC BY 4.0) and KSH Hungary STADAT ara0004. Matched by hand to the same item; prices normalised to `unit`.",
      fetchedAt,
      items: referenceItems,
    }),
    ...(brand
      ? [
          await writeJson("brand-prices.json", {
            _source: "Microsoft Store catalogue (displaycatalog.mp.microsoft.com), official list prices (MSRP) incl. VAT, new items only. Undocumented public endpoint used by the store itself.",
            fetchedAt,
            vatRates: VAT,
            items: brand.items,
          }),
        ]
      : []),
    await writeJson("verification-report.json", { fetchedAt, today: TODAY, fx: fxReport, priceLevels: levelReport, openPrices: productReport, referenceItems: referenceReport, microsoft: brand?.report ?? "skipped" }),
  ];
  // Swap all files in only once everything succeeded.
  for (const file of files) await rename(`${file}.tmp`, file);
  console.log(`Wrote ${files.length} files to data/real/ (${products.length} verified products).`);
}

main().catch((error) => {
  console.error(`\nFetch aborted, nothing written: ${error.message}`);
  process.exit(1);
});
