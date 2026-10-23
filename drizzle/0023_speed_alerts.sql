CREATE TABLE IF NOT EXISTS speed_settings (
  firm_id text PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  limit_kmh integer NOT NULL DEFAULT 90,
  truck_limits jsonb NOT NULL DEFAULT '{}'::jsonb,
  owner_over_kmh integer NOT NULL DEFAULT 10,
  owner_after_s integer NOT NULL DEFAULT 60,
  owner_alerts boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS speed_events (
  id text PRIMARY KEY,
  firm_id text NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  truck_id text NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
  user_id text,
  start_at text NOT NULL,
  end_at text NOT NULL,
  last_at text NOT NULL,
  limit_kmh integer NOT NULL,
  max_kmh real NOT NULL,
  duration_s integer NOT NULL DEFAULT 0,
  samples integer NOT NULL DEFAULT 1,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  high_since text,
  high_s integer NOT NULL DEFAULT 0,
  open boolean NOT NULL DEFAULT true,
  owner_notified boolean NOT NULL DEFAULT false
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS speed_events_firm_start_ix ON speed_events (firm_id, start_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS speed_events_firm_truck_open_ix ON speed_events (firm_id, truck_id, open);
