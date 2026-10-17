// Loads OtherWise data into Neon Postgres. Run the migration first (npm run db:migrate).
//
//   npm run db:seed          demo users + their transactions (data/seed/), idempotent
//   npm run db:load-prices   the verified snapshot in data/real/ as a new current snapshot
//
// Uses the direct (non-pooled) connection, as Neon recommends for bulk and
// admin work. Every value is a query parameter. Each command is one
// transaction: it either fully applies or rolls back and changes nothing.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (!process.env.DATABASE_URL && existsSync(path.join(ROOT, ".env.local"))) {
  process.loadEnvFile(path.join(ROOT, ".env.local"));
}
// Full certificate verification, stated explicitly (pg will stop implying it for sslmode=require).
const connectionString = (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL)?.replace("sslmode=require", "sslmode=verify-full");
if (!connectionString) {
  console.error("DATABASE_URL is not set. Run `neon env pull` first.");
  process.exit(1);
}

const readJson = (file) => JSON.parse(readFileSync(path.join(ROOT, file), "utf8"));

/** INSERT … VALUES ($1,$2,…),(…) in chunks, well under Postgres' parameter limit. */
async function insertMany(client, table, columns, rows, suffix = "") {
  const perChunk = Math.max(1, Math.floor(5000 / columns.length));
  for (let start = 0; start < rows.length; start += perChunk) {
    const params = [];
    const tuples = rows.slice(start, start + perChunk).map((row) => {
      const slots = row.map((value) => {
        params.push(value);
        return `$${params.length}`;
      });
      return `(${slots.join(",")})`;
    });
    await client.query(`insert into ${table} (${columns.join(",")}) values ${tuples.join(",")} ${suffix}`, params);
  }
}

async function inTransaction(work) {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

async function seedUsers() {
  const users = readJson("data/seed/users.json").users;
  const byUser = readJson("data/seed/transactions.json").transactions;

  const count = await inTransaction(async (client) => {
    await insertMany(
      client,
      "users",
      ["id", "holder", "home_city", "home_country", "balances"],
      users.map((u) => [u.id, u.holder, u.homeCity, u.homeCountry, JSON.stringify(u.balances)]),
      "on conflict (id) do update set holder = excluded.holder, home_city = excluded.home_city, home_country = excluded.home_country, balances = excluded.balances",
    );
    // Transactions are demo seed, replaced wholesale; trips, consent and feedback are left alone.
    await client.query("delete from transactions where user_id = any($1)", [users.map((u) => u.id)]);
    await insertMany(
      client,
      "transactions",
      ["id", "user_id", "date", "merchant", "category", "city", "country_code", "amount", "currency", "amount_eur"],
      Object.entries(byUser).flatMap(([userId, rows]) =>
        rows.map((t) => [t.id, userId, t.date, t.merchant, t.category, t.city, t.countryCode, t.amount.value, t.amount.currency, t.amountEur]),
      ),
    );
    const { rows } = await client.query("select count(*)::int as count from transactions");
    return rows[0].count;
  });
  console.log(`Seeded ${users.length} users and ${count} transactions.`);
}

async function loadPrices() {
  const fx = readJson("data/real/fx.json");
  const levels = readJson("data/real/price-levels.json");
  const products = readJson("data/real/products.json");
  const reference = readJson("data/real/reference-items.json");
  const brand = existsSync(path.join(ROOT, "data/real/brand-prices.json")) ? readJson("data/real/brand-prices.json") : { items: [] };
  const report = readJson("data/real/verification-report.json");

  const summary = await inTransaction(async (client) => {
    const { rows } = await client.query(
      "insert into snapshots (fetched_at, is_current, fx, price_level_year, local_stats, verification_report) values ($1,false,$2,$3,$4,$5) returning id",
      [products.fetchedAt, JSON.stringify({ perEur: fx.perEur, asOf: fx.asOf }), levels.year, JSON.stringify(products.localStats ?? {}), JSON.stringify(report)],
    );
    const id = rows[0].id;

    await insertMany(client, "price_levels", ["snapshot_id", "code", "label", "country", "value"],
      Object.entries(levels.levels).flatMap(([code, level]) =>
        Object.entries(level.values).map(([country, value]) => [id, code, level.label, country, value])));
    await insertMany(client, "products",
      ["snapshot_id", "id", "code", "country", "category", "price_level", "name", "brand", "quantity", "price", "currency",
        "price_eur", "type", "unit", "unit_price_eur", "observations", "first_seen", "last_seen", "shops", "proofs", "url"],
      products.products.map((p) => [id, p.id, p.code, p.country, p.category, p.priceLevel, p.name, p.brand, p.quantity, p.price,
        p.currency, p.priceEur, p.type, p.unit, p.unitPriceEur, p.observations, p.firstSeen, p.lastSeen,
        JSON.stringify(p.shops), JSON.stringify(p.proofs), p.url]));
    await insertMany(client, "reference_items", ["snapshot_id", "id", "category", "name", "unit", "note", "prices"],
      reference.items.map((r) => [id, r.id, r.category, r.name, r.unit, r.note, JSON.stringify(r.prices)]));
    await insertMany(client, "brand_prices", ["snapshot_id", "id", "category", "brand", "name", "prices"],
      brand.items.map((b) => [id, b.id, b.category, b.brand, b.name, JSON.stringify(b.prices)]));

    // Go live only now, inside the same transaction as the rows above.
    await client.query("update snapshots set is_current = false where is_current and id <> $1", [id]);
    await client.query("update snapshots set is_current = true where id = $1", [id]);

    const counts = await client.query(
      `select (select count(*) from price_levels where snapshot_id = $1)::int as levels,
              (select count(*) from products where snapshot_id = $1)::int as products,
              (select count(*) from reference_items where snapshot_id = $1)::int as reference,
              (select count(*) from brand_prices where snapshot_id = $1)::int as brand`,
      [id],
    );
    return { id, ...counts.rows[0] };
  });
  console.log(`Snapshot ${summary.id} is now current: ${summary.levels} price levels, ${summary.products} products, ${summary.reference} official items, ${summary.brand} brand list prices.`);
}

const command = process.argv[2];
const run = { users: seedUsers, prices: loadPrices }[command];
if (!run) {
  console.error("Usage: node scripts/db-seed.mjs users|prices");
  process.exit(1);
}
run().catch((error) => {
  console.error(`Failed, rolled back, nothing changed: ${error.message}`);
  process.exit(1);
});
