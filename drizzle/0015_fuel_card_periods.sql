CREATE TABLE "fuel_card_periods" (
	"firm_id" text NOT NULL,
	"card" text NOT NULL,
	"valid_from" text NOT NULL,
	"truck_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_card_periods_firm_id_card_valid_from_pk" PRIMARY KEY("firm_id","card","valid_from")
);
--> statement-breakpoint
ALTER TABLE "fuel_card_periods" ADD CONSTRAINT "fuel_card_periods_firm_id_firms_id_fk" FOREIGN KEY ("firm_id") REFERENCES "public"."firms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fuel_card_periods" ADD CONSTRAINT "fuel_card_periods_truck_id_trucks_id_fk" FOREIGN KEY ("truck_id") REFERENCES "public"."trucks"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
-- Preserve legacy mappings as a baseline, without rewriting any existing transaction.
INSERT INTO fuel_card_periods (firm_id, card, valid_from, truck_id, created_at)
SELECT firm_id, regexp_replace(regexp_replace(card, '[[:space:]-]', '', 'g'), '^''', ''), '0001-01-01T00:00',
  CASE WHEN count(DISTINCT coalesce(truck_id, '')) = 1 THEN min(truck_id) ELSE NULL END, min(updated_at)
FROM fuel_cards GROUP BY firm_id, regexp_replace(regexp_replace(card, '[[:space:]-]', '', 'g'), '^''', '');
--> statement-breakpoint
CREATE FUNCTION qf_set_fuel_card(p_firm text, p_card text, p_truck text, p_from text)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE existing_truck text; next_from text; changed integer;
BEGIN
  IF p_card IS NULL OR length(p_card) NOT BETWEEN 1 AND 40 OR p_card <> btrim(p_card)
     OR p_card ~ '[[:cntrl:]]' OR p_from IS NULL
     OR p_from !~ '^[2-9][0-9]{3}-[0-9]{2}-[0-9]{2}T([01][0-9]|2[0-3]):[0-5][0-9]$'
     OR to_char(p_from::timestamp, 'YYYY-MM-DD"T"HH24:MI') <> p_from THEN
    RAISE EXCEPTION 'card-input';
  END IF;
  -- Shared with inserts, so imports and period changes serialize within one firm.
  PERFORM pg_advisory_xact_lock(hashtextextended('fuel:' || p_firm, 0));
  PERFORM 1 FROM trucks WHERE id = p_truck AND firm_id = p_firm AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'truck'; END IF;
  SELECT truck_id INTO existing_truck FROM fuel_card_periods WHERE firm_id = p_firm AND card = p_card AND valid_from = p_from;
  IF FOUND THEN
    IF existing_truck IS DISTINCT FROM p_truck THEN RAISE EXCEPTION 'card-boundary-conflict'; END IF;
    RETURN 0;
  END IF;
  SELECT min(valid_from) INTO next_from FROM fuel_card_periods WHERE firm_id = p_firm AND card = p_card AND valid_from > p_from;
  IF EXISTS (
    SELECT 1 FROM fuel_transactions x JOIN trucks t ON t.firm_id = p_firm
      AND upper(regexp_replace(t.plate, '\s', '', 'g')) = upper(regexp_replace(x.plate, '\s', '', 'g'))
    WHERE x.firm_id = p_firm AND x.card = p_card AND x.at >= p_from
      AND (next_from IS NULL OR x.at < next_from) AND t.id <> p_truck
  ) THEN RAISE EXCEPTION 'card-plate-conflict'; END IF;
  INSERT INTO fuel_card_periods (firm_id, card, truck_id, valid_from) VALUES (p_firm, p_card, p_truck, p_from);
  UPDATE fuel_transactions SET truck_id = p_truck WHERE firm_id = p_firm AND card = p_card
    AND at >= p_from AND (next_from IS NULL OR at < next_from) AND truck_id IS DISTINCT FROM p_truck;
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION qf_check_fuel_card() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mapped_truck text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('fuel:' || NEW.firm_id, 0));
  IF NEW.truck_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM trucks WHERE id = NEW.truck_id AND firm_id = NEW.firm_id) THEN
    RAISE EXCEPTION 'truck';
  END IF;
  -- An identical retry must stay a no-op even if a period was corrected in the meantime.
  IF EXISTS (SELECT 1 FROM fuel_transactions WHERE firm_id = NEW.firm_id AND hash = NEW.hash) THEN RETURN NEW; END IF;
  SELECT truck_id INTO mapped_truck FROM fuel_card_periods
    WHERE firm_id = NEW.firm_id AND card = NEW.card AND valid_from <= NEW.at ORDER BY valid_from DESC LIMIT 1;
  IF mapped_truck IS NOT NULL THEN
    IF NEW.truck_id IS NOT NULL AND NEW.truck_id <> mapped_truck THEN RAISE EXCEPTION 'card-mapping-changed'; END IF;
    IF NEW.plate IS NOT NULL AND EXISTS (SELECT 1 FROM trucks WHERE firm_id = NEW.firm_id AND id <> mapped_truck
        AND upper(regexp_replace(plate, '\s', '', 'g')) = upper(regexp_replace(NEW.plate, '\s', '', 'g'))) THEN
      RAISE EXCEPTION 'card-mapping-changed';
    END IF;
    NEW.truck_id := mapped_truck;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER fuel_card_period_check BEFORE INSERT ON fuel_transactions FOR EACH ROW EXECUTE FUNCTION qf_check_fuel_card();
