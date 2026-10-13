CREATE TABLE "leads" (
	"id" text PRIMARY KEY NOT NULL,
	"firm" text NOT NULL,
	"person" text NOT NULL,
	"phone" text NOT NULL,
	"email" text NOT NULL,
	"trucks" integer,
	"fuel_card" text,
	"gps" boolean,
	"gps_provider" text,
	"locale" text,
	"source" text,
	"referral_code" text,
	"utm" text,
	"ip_hash" text,
	"consent_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "firms" ADD COLUMN "referred_by" text;--> statement-breakpoint
CREATE INDEX "leads_created_ix" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "leads_ip_ix" ON "leads" USING btree ("ip_hash");