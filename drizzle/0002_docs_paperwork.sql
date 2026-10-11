CREATE TABLE "email_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text,
	"key" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" text NOT NULL,
	"error" text,
	"provider_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"kind" text NOT NULL,
	"trip_id" text,
	"doc_id" text,
	"name" text DEFAULT '' NOT NULL,
	"mime" text NOT NULL,
	"size" integer NOT NULL,
	"storage" text NOT NULL,
	"url" text,
	"data" "bytea",
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"user_id" text,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"doc_id" text,
	"params" text DEFAULT '{}' NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trip_events" (
	"id" text PRIMARY KEY NOT NULL,
	"firm_id" text NOT NULL,
	"trip_id" text NOT NULL,
	"kind" text NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"lat" double precision,
	"lng" double precision,
	"user_id" text
);
--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "truck_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "scope" text DEFAULT 'vehicle' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "due_km" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "note" text;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "file_id" text;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "pod_received" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "truck_id" text;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_outbox_key_uq" ON "email_outbox" USING btree ("key");--> statement-breakpoint
CREATE INDEX "files_firm_trip_ix" ON "files" USING btree ("firm_id","trip_id");--> statement-breakpoint
CREATE INDEX "files_firm_doc_ix" ON "files" USING btree ("firm_id","doc_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_firm_key_uq" ON "notifications" USING btree ("firm_id","key");--> statement-breakpoint
CREATE INDEX "notifications_firm_user_ix" ON "notifications" USING btree ("firm_id","user_id");--> statement-breakpoint
CREATE INDEX "trip_events_firm_trip_ix" ON "trip_events" USING btree ("firm_id","trip_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;