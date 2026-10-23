DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='club_users_role_fk') THEN
    ALTER TABLE club_users ADD CONSTRAINT club_users_role_fk FOREIGN KEY(role) REFERENCES club_roles(name) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='club_users_status_check') THEN
    ALTER TABLE club_users ADD CONSTRAINT club_users_status_check CHECK(status in ('pending','active','rejected','suspended'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='club_users_owner_check') THEN
    ALTER TABLE club_users ADD CONSTRAINT club_users_owner_check CHECK(NOT is_owner OR(role='admin' AND status='active'));
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS payment_reversal_once_idx ON audit_log(entity_id) WHERE action='payment.reversed';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS finance_reversal_once_idx ON financial_transactions(reversal_of_id);