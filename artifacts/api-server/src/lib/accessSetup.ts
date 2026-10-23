import { db, clubUsersTable, permissionsTable, rolePermissionsTable, rolesTable, systemSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { permissionCatalog } from "./permissions";

export async function initializeAccessModel() {
  await db.transaction(async trx => {
    await trx.execute(sql`SELECT pg_advisory_xact_lock(71926341)`);
    // Safe on an existing deployment too: only old records are backfilled active.
    await trx.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='club_users' AND column_name='status') THEN
          ALTER TABLE club_users ADD COLUMN status text NOT NULL DEFAULT 'active';
          ALTER TABLE club_users ALTER COLUMN status SET DEFAULT 'pending';
        END IF;
      END $$;
      ALTER TABLE club_users ADD COLUMN IF NOT EXISTS display_name text;
      ALTER TABLE club_users ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
      ALTER TABLE club_users ADD COLUMN IF NOT EXISTS permission_overrides jsonb NOT NULL DEFAULT '{}';
      ALTER TABLE club_users ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
      CREATE TABLE IF NOT EXISTS club_backups (
        id serial PRIMARY KEY, label text NOT NULL, created_by text NOT NULL,
        encrypted text NOT NULL, bytes integer NOT NULL, counts jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS reversed boolean NOT NULL DEFAULT false;
      ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS reversal_of_id integer;
      CREATE UNIQUE INDEX IF NOT EXISTS finance_reversal_once_idx ON financial_transactions(reversal_of_id);
      CREATE UNIQUE INDEX IF NOT EXISTS payment_reversal_once_idx ON audit_log(entity_id) WHERE action='payment.reversed';
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='club_users_status_check') THEN
          ALTER TABLE club_users ADD CONSTRAINT club_users_status_check CHECK (status IN ('pending','active','rejected','suspended'));
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='club_users_owner_check') THEN
          ALTER TABLE club_users ADD CONSTRAINT club_users_owner_check CHECK (NOT is_owner OR (role='admin' AND status='active'));
        END IF;
      END $$;
    `);
    await trx.insert(permissionsTable).values(permissionCatalog.map(p => ({ name: p.name, label: p.label }))).onConflictDoNothing();
    const defaults = [
      { name: "admin", label: "المدير الإداري", permissions: ["dashboard.view", "members.view", "members.create", "members.edit", "subscriptions.view", "subscriptions.create", "subscriptions.edit"] },
      { name: "accountant", label: "المحاسب", permissions: ["dashboard.view"] },
      { name: "staff", label: "موظف الاستقبال", permissions: ["dashboard.view", "members.view", "members.create", "members.edit", "subscriptions.view", "subscriptions.create", "subscriptions.edit", "whatsapp.create"] },
      { name: "coach", label: "مدرب", permissions: ["dashboard.view", "members.view"] },
    ];
    for (const role of defaults) {
      const inserted = await trx.insert(rolesTable).values({ name: role.name, label: role.label, builtIn: true }).onConflictDoNothing().returning();
      if (inserted.length && role.permissions.length) await trx.insert(rolePermissionsTable).values(role.permissions.map(permissionName => ({ roleName: role.name, permissionName }))).onConflictDoNothing();
    }
    await trx.execute(sql`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='club_users_role_fk') THEN
          ALTER TABLE club_users ADD CONSTRAINT club_users_role_fk FOREIGN KEY(role) REFERENCES club_roles(name) NOT VALID;
        END IF;
      END $$;
    `);
    const [completed] = await trx.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "access_model.v1"));
    if (!completed) {
      // Preserve privileges of pre-existing admins, never apply this to new signups.
      await trx.update(clubUsersTable).set({ permissionOverrides: Object.fromEntries(permissionCatalog.map(p => [p.name, true])) }).where(eq(clubUsersTable.role, "admin"));
      await trx.execute(sql`UPDATE club_users u SET is_owner=true
        WHERE role='admin' AND status='active' AND EXISTS
        (SELECT 1 FROM audit_log a WHERE a.actor_id=u.clerk_user_id AND a.action='auth.owner_initialized')`);
      await trx.insert(systemSettingsTable).values({ key: "access_model.v1", value: "initialized" }).onConflictDoNothing();
    }
    await trx.execute(sql`
      CREATE OR REPLACE FUNCTION protect_club_owner() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.is_owner AND (TG_OP='DELETE' OR NOT NEW.is_owner OR NEW.role <> 'admin' OR NEW.status <> 'active') THEN
          RAISE EXCEPTION 'Protected club owner';
        END IF;
        IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS protect_club_owner_trigger ON club_users;
      CREATE TRIGGER protect_club_owner_trigger BEFORE UPDATE OR DELETE ON club_users FOR EACH ROW EXECUTE FUNCTION protect_club_owner();
    `);
  });
}
