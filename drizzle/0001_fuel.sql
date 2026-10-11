CREATE TABLE "fuel_cards" (
	"firm_id" text NOT NULL,
	"card" text NOT NULL,
	"truck_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_cards_firm_id_card_pk" PRIMARY KEY("firm_id","card")
);
--> statement-breakpoint
CREATE TABLE "fuel_imports" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"source" text NOT NULL,
	"filename" text DEFAULT '' NOT NULL,
	"rows" integer NOT NULL,
	"added" integer NOT NULL,
	"dupes" integer NOT NULL,
	"skipped" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fuel_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"truck_id" text,
	"source" text NOT NULL,
	"import_id" text,
	"hash" text NOT NULL,
	"card" text,
	"plate" text,
	"at" text NOT NULL,
	"station" text DEFAULT '' NOT NULL,
	"country" text,
	"product" text,
	"litres" real NOT NULL,
	"amount" real,
	"currency" text,
	"odometer" integer,
	"lat" double precision,
	"lng" double precision,
	"user_id" text,
	"photo_name" text,
	"photo_size" integer,
	"ai_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"truck_id" text NOT NULL,
	"at" text NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"firm_id" text NOT NULL,
	"truck_id" text NOT NULL,
	"start" text NOT NULL,
	"end" text,
	"checklist" text DEFAULT '[]' NOT NULL,
	CONSTRAINT "shifts_firm_id_truck_id_pk" PRIMARY KEY("firm_id","truck_id")
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "litres_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_cards" ADD CONSTRAINT "fuel_cards_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_imports" ADD CONSTRAINT "fuel_imports_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD CONSTRAINT "fuel_transactions_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fuel_imports_firm_ix" ON "fuel_imports" USING btree ("firm_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fuel_tx_firm_hash_uq" ON "fuel_transactions" USING btree ("firm_id","hash");--> statement-breakpoint
CREATE INDEX "fuel_tx_firm_truck_at_ix" ON "fuel_transactions" USING btree ("firm_id","truck_id","at");--> statement-breakpoint
CREATE INDEX "positions_firm_truck_at_ix" ON "positions" USING btree ("firm_id","truck_id","at");