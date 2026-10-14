CREATE TABLE "driver_events" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"truck_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "driver_events" ADD CONSTRAINT "driver_events_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_events" ADD CONSTRAINT "driver_events_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "driver_events_firm_at_ix" ON "driver_events" USING btree ("firm_id","at");