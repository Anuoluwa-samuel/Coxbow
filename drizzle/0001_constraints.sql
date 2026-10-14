-- Constraints Drizzle cannot express declaratively.

CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint

-- A staff member cannot hold two overlapping active assignments, even under concurrent requests.
ALTER TABLE "booking_assignments"
  ADD CONSTRAINT "assignments_no_staff_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" = 'active');--> statement-breakpoint

-- Booking audit trail is append-only.
CREATE FUNCTION prevent_history_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'booking_status_history and audit_logs are append-only';
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER booking_status_history_immutable
  BEFORE UPDATE OR DELETE ON "booking_status_history"
  FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();--> statement-breakpoint

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION prevent_history_mutation();
