import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/lib/db/schema";

/**
 * node-postgres over Neon's pooled connection string, the Neon-recommended
 * setup for Vercel Fluid compute: warm functions reuse TCP connections, and
 * attachDatabasePool closes idle ones before Vercel suspends the function.
 * Created on first use so `next build` does not need a database.
 */
let client: NodePgDatabase<typeof schema> | undefined;

export function db(): NodePgDatabase<typeof schema> {
  if (!client) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Run `neon env pull` (or add it to the Vercel project).");
    }
    // Neon URLs say sslmode=require; ask for full certificate verification
    // explicitly, which pg will stop implying in its next major version.
    const pool = new Pool({ connectionString: connectionString.replace("sslmode=require", "sslmode=verify-full") });
    attachDatabasePool(pool);
    client = drizzle({ client: pool, schema });
  }
  return client;
}

export { schema };
