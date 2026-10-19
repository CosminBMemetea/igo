-- Recheck assignment while holding the same trip lock used by reassignment and
-- cancellation. The HTTP authorization check can precede a slow image upload.
CREATE OR REPLACE FUNCTION qf_guard_trip_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target trips%ROWTYPE; actor users%ROWTYPE;
BEGIN
  IF NEW.trip_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO target FROM trips WHERE id = NEW.trip_id AND firm_id = NEW.firm_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'trip'; END IF;
  IF target.cancelled_at IS NOT NULL THEN RAISE EXCEPTION 'trip-closed'; END IF;
  SELECT * INTO actor FROM users WHERE id = NEW.user_id;
  IF FOUND AND actor.role = 'driver' AND (
    actor.firm_id <> NEW.firm_id OR actor.disabled_at IS NOT NULL
    OR target.driver_id IS DISTINCT FROM actor.id
  ) THEN RAISE EXCEPTION 'assignment'; END IF;
  RETURN NEW;
END $$;
