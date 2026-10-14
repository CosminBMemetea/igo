ALTER TABLE "trips" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "request_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX "trips_firm_request_uq" ON "trips" USING btree ("firm_id","request_key");