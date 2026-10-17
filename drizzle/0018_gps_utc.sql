-- Preserve legacy wall-clock values; their original UTC offset cannot be recovered reliably.
ALTER TABLE positions ADD COLUMN captured_at text;
--> statement-breakpoint
ALTER TABLE positions ADD COLUMN received_at text;
--> statement-breakpoint
ALTER TABLE positions ADD COLUMN accuracy double precision;
--> statement-breakpoint
DROP FUNCTION qf_driver_position(text, text, text, text, text, double precision, double precision);
--> statement-breakpoint
CREATE FUNCTION qf_driver_position(p_id text, p_firm text, p_truck text, p_user text, p_at text, p_lat double precision, p_lng double precision, p_captured text DEFAULT NULL, p_accuracy double precision DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE sh shifts%ROWTYPE;
BEGIN
  SELECT * INTO sh FROM shifts WHERE firm_id = p_firm AND truck_id = p_truck FOR UPDATE;
  IF NOT FOUND OR sh."end" IS NOT NULL OR sh.private_since IS NOT NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM users u JOIN trucks t ON t.id = u.truck_id AND t.firm_id = u.firm_id
    WHERE u.id = p_user AND u.firm_id = p_firm AND u.truck_id = p_truck AND u.role = 'driver'
      AND u.disabled_at IS NULL AND u.password_hash <> '' AND t.archived_at IS NULL) THEN RETURN false; END IF;
  IF p_captured IS NOT NULL AND (p_captured::timestamptz < sh.start::timestamptz
    OR p_captured::timestamptz < clock_timestamp() - interval '30 seconds'
    OR p_captured::timestamptz > clock_timestamp() + interval '5 seconds') THEN RETURN false; END IF;
  INSERT INTO positions (id, firm_id, truck_id, at, lat, lng, captured_at, received_at, accuracy)
  VALUES (p_id, p_firm, p_truck, p_at, p_lat, p_lng, p_captured,
    to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), p_accuracy);
  RETURN true;
END $$;
