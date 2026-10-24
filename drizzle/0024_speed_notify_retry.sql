ALTER TABLE speed_events ADD COLUMN IF NOT EXISTS high_at text;
--> statement-breakpoint
ALTER TABLE speed_events ADD COLUMN IF NOT EXISTS notify_due boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE speed_events ADD COLUMN IF NOT EXISTS notify_attempts integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE speed_events ADD COLUMN IF NOT EXISTS notify_next_at text;
--> statement-breakpoint
ALTER TABLE speed_events ADD COLUMN IF NOT EXISTS notify_done jsonb NOT NULL DEFAULT '[]'::jsonb;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS speed_events_notify_ix ON speed_events (notify_due, owner_notified, notify_next_at);
