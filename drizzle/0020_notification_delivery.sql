ALTER TABLE users ADD COLUMN email_alerts boolean NOT NULL DEFAULT true;
ALTER TABLE email_outbox ADD COLUMN channel text NOT NULL DEFAULT 'email';
ALTER TABLE email_outbox ADD COLUMN context jsonb;
ALTER TABLE email_outbox ADD COLUMN subscription_id text;
ALTER TABLE email_outbox ADD COLUMN attempts integer NOT NULL DEFAULT 0;
ALTER TABLE email_outbox ADD COLUMN next_attempt_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE email_outbox ADD COLUMN lease_token text;
ALTER TABLE email_outbox ADD COLUMN lease_until timestamptz;
ALTER TABLE email_outbox ADD COLUMN first_attempt_at timestamptz;
ALTER TABLE email_outbox ADD COLUMN expires_at timestamptz NOT NULL DEFAULT now() + interval '48 hours';
-- Old rows lack recipient/context/expiry guarantees. Never replay old password links or old fleet alerts.
UPDATE email_outbox SET key = key || ':legacy:' || id, status = 'cancelled', error = 'legacy-no-replay' WHERE status IN ('queued', 'failed');
CREATE INDEX email_outbox_due_ix ON email_outbox(status, next_attempt_at);
CREATE TABLE push_devices (
 transport text NOT NULL DEFAULT 'web', valid_until timestamptz,
 id text PRIMARY KEY, firm_id text NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 endpoint text NOT NULL, p256dh text NOT NULL, auth text NOT NULL,
 session_version integer NOT NULL, binding text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX push_devices_endpoint_uq ON push_devices(endpoint);
CREATE INDEX push_devices_user_ix ON push_devices(firm_id, user_id);
CREATE INDEX push_devices_binding_ix ON push_devices(binding);

CREATE TABLE notification_jobs (
 name text PRIMARY KEY, run_id text NOT NULL, started_at timestamptz NOT NULL,
 finished_at timestamptz, error text, summary jsonb
);
