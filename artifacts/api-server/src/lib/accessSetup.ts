import { db, clubUsersTable, permissionsTable, rolePermissionsTable, rolesTable, systemSettingsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { permissionCatalog } from "./permissions";

type AccessTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function initializeAccessModel() {
  await db.transaction(initializeAccessModelInTransaction);
}

// Publish owns schema changes. Initialization only seeds application data.
export async function initializeAccessModelInTransaction(trx: AccessTransaction) {
    await trx.execute(sql`SELECT pg_advisory_xact_lock(71926341)`);
    await trx.insert(permissionsTable).values(permissionCatalog.map(p => ({ name: p.name, label: p.label }))).onConflictDoNothing();
    const defaults = [
      { name: "admin", label: "المدير الإداري", permissions: ["dashboard.view", "members.view", "members.create", "members.edit", "subscriptions.view", "subscriptions.create", "subscriptions.edit", "payments.view", "payments.create", "finance.view", "employees.view", "payroll.view", "reports.view"] },
      { name: "accountant", label: "المحاسب", permissions: ["dashboard.view"] },
      { name: "staff", label: "موظف الاستقبال", permissions: ["dashboard.view", "members.view", "members.create", "members.edit", "subscriptions.view", "subscriptions.create", "subscriptions.edit", "whatsapp.create"] },
      { name: "coach", label: "مدرب", permissions: ["dashboard.view", "members.view"] },
    ];
    for (const role of defaults) {
      const inserted = await trx.insert(rolesTable).values({ name: role.name, label: role.label, builtIn: true }).onConflictDoNothing().returning();
      if (inserted.length && role.permissions.length) await trx.insert(rolePermissionsTable).values(role.permissions.map(permissionName => ({ roleName: role.name, permissionName }))).onConflictDoNothing();
    }
    const [dashboardRoleGrantsReady] = await trx.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "role.admin_dashboard.v1"));
    if (!dashboardRoleGrantsReady) {
      await trx.insert(rolePermissionsTable).values([
        "payments.view", "payments.create", "finance.view", "employees.view", "payroll.view", "reports.view",
      ].map(permissionName => ({ roleName: "admin", permissionName }))).onConflictDoNothing();
      await trx.insert(systemSettingsTable).values({ key: "role.admin_dashboard.v1", value: "initialized" }).onConflictDoNothing();
    }
    const [completed] = await trx.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "access_model.v1"));
    if (!completed) {
      // Publish adds the pending default to legacy rows too. Before the first
      // server starts accepting requests, preserve those existing accounts.
      // The marker makes this one-time: future pending users stay pending.
      await trx.update(clubUsersTable).set({status:"active"}).where(eq(clubUsersTable.status,"pending"));
      // Preserve privileges of pre-existing admins, never apply this to new signups.
      await trx.update(clubUsersTable).set({ permissionOverrides: Object.fromEntries(permissionCatalog.map(p => [p.name, true])) }).where(eq(clubUsersTable.role, "admin"));
      await trx.execute(sql`UPDATE club_users u SET is_owner=true
        WHERE role='admin' AND status='active' AND EXISTS
        (SELECT 1 FROM audit_log a WHERE a.actor_id=u.clerk_user_id AND a.action='auth.owner_initialized')`);
      await trx.insert(systemSettingsTable).values({ key: "access_model.v1", value: "initialized" }).onConflictDoNothing();
    }
}
