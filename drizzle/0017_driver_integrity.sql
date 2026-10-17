-- Serialize archiving with starting shifts and assigning unfinished trips.
CREATE FUNCTION qf_guard_archive() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.archived_at IS NULL AND NEW.archived_at IS NOT NULL AND (
    EXISTS (SELECT 1 FROM shifts WHERE firm_id = NEW.firm_id AND truck_id = NEW.id AND "end" IS NULL)
    OR EXISTS (SELECT 1 FROM trips WHERE firm_id = NEW.firm_id AND truck_id = NEW.id
      AND planned AND cancelled_at IS NULL AND delivered_at IS NULL)
  ) THEN RAISE EXCEPTION 'truck-busy'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER qf_guard_archive BEFORE UPDATE OF archived_at ON trucks
FOR EACH ROW EXECUTE FUNCTION qf_guard_archive();
--> statement-breakpoint
CREATE FUNCTION qf_guard_operational_truck() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE archived timestamptz;
BEGIN
  IF TG_TABLE_NAME = 'shifts' THEN
    IF NEW."end" IS NOT NULL THEN RETURN NEW; END IF;
  ELSE
    IF NOT NEW.planned OR NEW.cancelled_at IS NOT NULL OR NEW.delivered_at IS NOT NULL THEN RETURN NEW; END IF;
  END IF;
  SELECT archived_at INTO archived FROM trucks WHERE id = NEW.truck_id AND firm_id = NEW.firm_id FOR UPDATE;
  IF NOT FOUND OR archived IS NOT NULL THEN RAISE EXCEPTION 'truck-busy'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER qf_guard_shift_truck BEFORE INSERT OR UPDATE ON shifts
FOR EACH ROW EXECUTE FUNCTION qf_guard_operational_truck();
--> statement-breakpoint
CREATE TRIGGER qf_guard_trip_truck BEFORE INSERT OR UPDATE ON trips
FOR EACH ROW EXECUTE FUNCTION qf_guard_operational_truck();
--> statement-breakpoint
-- The trip row lock also serializes uploads with cancellation. Both the file
-- and POD flag belong to the INSERT transaction, including ON CONFLICT retries.
CREATE FUNCTION qf_guard_trip_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cancelled text;
BEGIN
  IF NEW.trip_id IS NULL THEN RETURN NEW; END IF;
  SELECT cancelled_at INTO cancelled FROM trips WHERE id = NEW.trip_id AND firm_id = NEW.firm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'trip'; END IF;
  IF cancelled IS NOT NULL THEN RAISE EXCEPTION 'trip-closed'; END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER qf_guard_trip_file BEFORE INSERT OR UPDATE ON files
FOR EACH ROW EXECUTE FUNCTION qf_guard_trip_file();
--> statement-breakpoint
CREATE FUNCTION qf_receive_pod() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.kind = 'pod' AND NEW.trip_id IS NOT NULL THEN
    UPDATE trips SET pod_received = true WHERE id = NEW.trip_id AND firm_id = NEW.firm_id;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER qf_receive_pod AFTER INSERT OR UPDATE ON files
FOR EACH ROW EXECUTE FUNCTION qf_receive_pod();
--> statement-breakpoint
-- Separate from imported telematics: phone GPS requires a current, public shift.
CREATE FUNCTION qf_driver_position(p_id text, p_firm text, p_truck text, p_user text, p_at text, p_lat double precision, p_lng double precision)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE sh shifts%ROWTYPE;
BEGIN
  SELECT * INTO sh FROM shifts WHERE firm_id = p_firm AND truck_id = p_truck FOR UPDATE;
  IF NOT FOUND OR sh."end" IS NOT NULL OR sh.private_since IS NOT NULL THEN RETURN false; END IF;
  IF NOT EXISTS (SELECT 1 FROM users u JOIN trucks t ON t.id = u.truck_id AND t.firm_id = u.firm_id
    WHERE u.id = p_user AND u.firm_id = p_firm AND u.truck_id = p_truck AND u.role = 'driver'
      AND u.disabled_at IS NULL AND u.password_hash <> '' AND t.archived_at IS NULL) THEN RETURN false; END IF;
  INSERT INTO positions (id, firm_id, truck_id, at, lat, lng) VALUES (p_id, p_firm, p_truck, p_at, p_lat, p_lng);
  RETURN true;
END $$;
