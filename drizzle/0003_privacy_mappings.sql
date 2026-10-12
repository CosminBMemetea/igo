CREATE TABLE "import_mappings" (
	"firm_id" text NOT NULL,
	"sig" text NOT NULL,
	"mapping" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_mappings_firm_id_sig_pk" PRIMARY KEY("firm_id","sig")
);
--> statement-breakpoint
ALTER TABLE "shifts" ADD COLUMN "private_since" text;--> statement-breakpoint
ALTER TABLE "import_mappings" ADD CONSTRAINT "import_mappings_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;