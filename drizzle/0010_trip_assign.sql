CREATE TABLE "truck_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text NOT NULL,
	"truck_id" text NOT NULL,
	"from_truck_id" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "driver_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "tonnes" real;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "planned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "truck_assignments" ADD CONSTRAINT "truck_assignments_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "truck_assignments" ADD CONSTRAINT "truck_assignments_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "truck_assignments_firm_ix" ON "truck_assignments" USING btree ("firm_id","at");