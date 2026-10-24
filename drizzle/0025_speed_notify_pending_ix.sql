-- per-reading retry check: only undelivered alerts, by firm (Testing r22 e)
CREATE INDEX IF NOT EXISTS speed_events_firm_pending_ix ON speed_events (firm_id, notify_next_at) WHERE notify_due AND NOT owner_notified;
