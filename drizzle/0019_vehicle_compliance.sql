ALTER TABLE trucks ADD COLUMN compliance jsonb;
--> statement-breakpoint
ALTER TABLE documents ADD COLUMN valid_from date;
--> statement-breakpoint
ALTER TABLE documents ADD CONSTRAINT documents_valid_period CHECK (valid_from IS NULL OR valid_from <= expires);
--> statement-breakpoint
CREATE TABLE compliance_tasks (
 id text PRIMARY KEY, firm_id text NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
 truck_id text NOT NULL REFERENCES trucks(id) ON DELETE CASCADE,
 driver_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type text NOT NULL, due date NOT NULL,
 status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','done','cancelled')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX compliance_tasks_firm_ix ON compliance_tasks(firm_id);
--> statement-breakpoint
CREATE UNIQUE INDEX compliance_tasks_active_uq ON compliance_tasks(firm_id, truck_id, type) WHERE status IN ('open','acknowledged');
