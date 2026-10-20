ALTER TABLE push_devices ADD COLUMN native_session_id text;
--> statement-breakpoint
CREATE TABLE mobile_session_revocations (
  id text PRIMARY KEY,
  expires_at timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX mobile_session_revocations_expiry_ix ON mobile_session_revocations (expires_at);
