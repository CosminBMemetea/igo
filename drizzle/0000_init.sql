CREATE TABLE "documents" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"truck_id" text NOT NULL,
	"type" text NOT NULL,
	"expires" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "firms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cui" text,
	"currency" text DEFAULT 'RON' NOT NULL,
	"trial_start" date NOT NULL,
	"demo_mode" boolean DEFAULT false NOT NULL,
	"details_done" boolean DEFAULT false NOT NULL,
	"csv_skipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"used_at" timestamp with time zone,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "support_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text,
	"email" text,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"slot" text,
	"message" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"truck_id" text NOT NULL,
	"client" text NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"km" real NOT NULL,
	"revenue" real NOT NULL,
	"litres" real NOT NULL,
	"fuel_price" real NOT NULL,
	"tolls" real DEFAULT 0 NOT NULL,
	"driver_cost" real DEFAULT 0 NOT NULL,
	"other" real DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trucks" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"plate" text NOT NULL,
	"vin" text,
	"model" text,
	"tank_l" integer,
	"normal_l100" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"role" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text,
	"phone" text,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trips" ADD CONSTRAINT "trips_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trucks" ADD CONSTRAINT "trucks_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_firm_ix" ON "documents" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "invites_firm_ix" ON "invites" USING btree ("firm_id");--> statement-breakpoint
CREATE INDEX "trips_firm_ix" ON "trips" USING btree ("firm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trucks_firm_plate_uq" ON "trucks" USING btree ("firm_id","plate");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_uq" ON "users" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "users_firm_ix" ON "users" USING btree ("firm_id");