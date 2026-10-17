CREATE TABLE "brand_prices" (
	"snapshot_id" integer NOT NULL,
	"id" text NOT NULL,
	"category" text NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"prices" jsonb NOT NULL,
	CONSTRAINT "brand_prices_snapshot_id_id_pk" PRIMARY KEY("snapshot_id","id")
);
--> statement-breakpoint
CREATE TABLE "consent" (
	"user_id" text PRIMARY KEY NOT NULL,
	"personalisation" boolean NOT NULL,
	"notifications" boolean NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"country" text,
	"category" text,
	"product_id" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"trip_id" text NOT NULL,
	"kind" text NOT NULL,
	"item_id" text NOT NULL,
	"country" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"trip_id" text NOT NULL,
	"country" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"deep_link" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_levels" (
	"snapshot_id" integer NOT NULL,
	"code" text NOT NULL,
	"label" text NOT NULL,
	"country" text NOT NULL,
	"value" double precision NOT NULL,
	CONSTRAINT "price_levels_snapshot_id_code_country_pk" PRIMARY KEY("snapshot_id","code","country")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"snapshot_id" integer NOT NULL,
	"id" text NOT NULL,
	"code" text NOT NULL,
	"country" text NOT NULL,
	"category" text NOT NULL,
	"price_level" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"quantity" text,
	"price" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"price_eur" numeric(14, 2) NOT NULL,
	"type" text,
	"unit" text,
	"unit_price_eur" numeric(14, 2),
	"observations" integer NOT NULL,
	"first_seen" date NOT NULL,
	"last_seen" date NOT NULL,
	"shops" jsonb NOT NULL,
	"proofs" jsonb NOT NULL,
	"url" text NOT NULL,
	CONSTRAINT "products_snapshot_id_id_pk" PRIMARY KEY("snapshot_id","id")
);
--> statement-breakpoint
CREATE TABLE "reference_items" (
	"snapshot_id" integer NOT NULL,
	"id" text NOT NULL,
	"category" text NOT NULL,
	"name" text NOT NULL,
	"unit" text NOT NULL,
	"note" text,
	"prices" jsonb NOT NULL,
	CONSTRAINT "reference_items_snapshot_id_id_pk" PRIMARY KEY("snapshot_id","id")
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"fx" jsonb NOT NULL,
	"price_level_year" text NOT NULL,
	"local_stats" jsonb NOT NULL,
	"verification_report" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"merchant" text NOT NULL,
	"category" text NOT NULL,
	"city" text NOT NULL,
	"country_code" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" text NOT NULL,
	"amount_eur" numeric(14, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_countries" (
	"trip_id" text NOT NULL,
	"country" text NOT NULL,
	"arrived_at" timestamp with time zone NOT NULL,
	"signal" text NOT NULL,
	"notified_at" timestamp with time zone,
	CONSTRAINT "trip_countries_trip_id_country_pk" PRIMARY KEY("trip_id","country")
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"current_country" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"holder" text NOT NULL,
	"home_city" text NOT NULL,
	"home_country" text NOT NULL,
	"balances" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_prices" ADD CONSTRAINT "brand_prices_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consent" ADD CONSTRAINT "consent_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_levels" ADD CONSTRAINT "price_levels_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_items" ADD CONSTRAINT "reference_items_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_countries" ADD CONSTRAINT "trip_countries_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feedback_once_per_trip" ON "feedback" USING btree ("user_id","trip_id","kind","item_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "products_lookup_idx" ON "products" USING btree ("snapshot_id","country","category");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshots_one_current" ON "snapshots" USING btree ("is_current") WHERE "snapshots"."is_current";--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "trips_one_active_per_user" ON "trips" USING btree ("user_id") WHERE "trips"."ended_at" is null;