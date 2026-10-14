ALTER TABLE "trip_events" ADD COLUMN "request_key" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "loaded_at" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "delivered_at" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "wait_since" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "last_event_at" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "cancelled_at" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "trip_events_request_uq" ON "trip_events" USING btree ("firm_id","request_key");--> statement-breakpoint
UPDATE trips t SET
  loaded_at = e.loaded_at,
  delivered_at = e.delivered_at,
  last_event_at = e.last_at,
  wait_since = CASE WHEN e.delivered_at IS NULL AND e.wait_start > COALESCE(e.wait_end, '') THEN e.wait_start ELSE NULL END
FROM (
  SELECT trip_id, firm_id,
    to_char(min(at) FILTER (WHERE kind = 'loaded') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS loaded_at,
    to_char(max(at) FILTER (WHERE kind = 'unloaded') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS delivered_at,
    to_char(max(at) AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_at,
    to_char(max(at) FILTER (WHERE kind = 'wait_start') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS wait_start,
    to_char(max(at) FILTER (WHERE kind = 'wait_end') AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS wait_end
  FROM trip_events GROUP BY trip_id, firm_id
) e WHERE t.id = e.trip_id AND t.firm_id = e.firm_id;
