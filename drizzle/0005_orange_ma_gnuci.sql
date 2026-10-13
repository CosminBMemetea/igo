CREATE TABLE "fx_rates" (
	"date" text NOT NULL,
	"cur" text NOT NULL,
	"per_eur" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "amount_ron" real;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "fx_rate" double precision;--> statement-breakpoint
ALTER TABLE "fuel_transactions" ADD COLUMN "fx_date" text;--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_date_cur_uq" ON "fx_rates" USING btree ("date","cur");