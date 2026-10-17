import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Next.js reads .env.local itself; drizzle-kit runs outside Next, so load it here.
if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  // Migrations need a direct (non-pooled) connection; neon env pull writes it as DATABASE_URL_UNPOOLED.
  // Full certificate verification, stated explicitly (pg will stop implying it for sslmode=require).
  dbCredentials: {
    url: (process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "").replace("sslmode=require", "sslmode=verify-full"),
  },
  strict: true,
});
