import { Router } from "express";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod/v4";
import { db, auditLogTable, clubUsersTable, rolesTable, rolePermissionsTable, systemSettingsTable } from "@workspace/db";
import { requireOwner } from "../middlewares/clubAuth";
import { effectivePermissions, permissionCatalog, validPermissionNames } from "../lib/permissions";
import { clubSettingsSchema, readClubSettings } from "../lib/clubSettings";
import { createBackup, getBackup, importBackup, listBackups, previewRestore, restoreBackup } from "../lib/backups";
import { MembershipError } from "../lib/membership";
import {readWhatsAppSettings, writeWhatsAppSettings} from "../lib/whatsapp";

const router = Router();
router.use("/club/admin", requireOwner);
const permissionList = z.array(z.string().refine(name => validPermissionNames.has(name))).max(permissionCatalog.length);
const roleName = z.string().regex(/^[a-z][a-z0-9_]{1,39}$/);
const positiveId = (value: unknown) => {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new MembershipError(400, "المعرّف غير صالح");
  return id;
};
async function audit(trx: Parameters<Parameters<typeof db.transaction>[0]>[0], actorId: string, action: string, entityType: string, entityId: number | null, details: Record<string, unknown>) {
  await trx.insert(auditLogTable).values({ actorId, action, entityType, entityId, details });
}
router.get("/club/admin/overview", async (_req, res) => {
  const users = await db.select({ status: clubUsersTable.status }).from(clubUsersTable);
  res.json({ pendingCount: users.filter(u => u.status === "pending").length, userCount: users.length });
});
router.get("/club/admin/users", async (req, res) => {
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
  if (status && !["pending", "active", "rejected", "suspended"].includes(status)) throw new MembershipError(400, "حالة الحساب غير صالحة");
  const users = await db.select().from(clubUsersTable).where(and(status ? eq(clubUsersTable.status, status) : undefined, search ? or(ilike(clubUsersTable.email, `%${search}%`), ilike(clubUsersTable.displayName, `%${search}%`)) : undefined)).orderBy(desc(clubUsersTable.createdAt)).limit(500);
  res.json(await Promise.all(users.map(async user => ({ ...user, permissions: await effectivePermissions(user) }))));
});
router.patch("/club/admin/users/:id", async (req, res) => {
  const parsed = z.object({
    status: z.enum(["pending", "active", "rejected", "suspended"]).optional(),
    role: roleName.optional(),
    permissionOverrides: z.record(z.string().refine(name => validPermissionNames.has(name)), z.boolean()).optional(),
  }).strict().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) throw new MembershipError(400, "بيانات الحساب أو الصلاحيات غير صحيحة");
  const id = positiveId(req.params.id);
  const user = await db.transaction(async trx => {
    // Serialize assignments and deletion, including when no database role FK
    // exists during the legacy-to-role-catalog deployment.
    await trx.execute(sql`SELECT pg_advisory_xact_lock(71926341)`);
    const [current] = await trx.select().from(clubUsersTable).where(eq(clubUsersTable.id, id)).for("update");
    if (!current) throw new MembershipError(404, "الحساب غير موجود");
    if (current.isOwner) throw new MembershipError(409, "حساب المدير الرئيسي محمي؛ لا يمكن تعطيله أو خفض صلاحياته");
    const [role] = await trx.select().from(rolesTable).where(eq(rolesTable.name, parsed.data.role ?? current.role)).for("share");
    if (!role) throw new MembershipError(400, "الدور المحدد غير موجود");
    const [updated] = await trx.update(clubUsersTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(clubUsersTable.id, id)).returning();
    await audit(trx, req.clubUser!.clerkUserId, "access.user_updated", "club_user", id, {
      before: { role: current.role, status: current.status, permissionOverrides: current.permissionOverrides },
      after: { role: updated.role, status: updated.status, permissionOverrides: updated.permissionOverrides },
    });
    return updated;
  });
  res.json({ ...user, permissions: await effectivePermissions(user) });
});
router.get("/club/admin/roles", async (_req, res) => {
  const [roles, grants, users] = await Promise.all([db.select().from(rolesTable), db.select().from(rolePermissionsTable), db.select({ role: clubUsersTable.role }).from(clubUsersTable)]);
  res.json({ roles: roles.map(role => ({ ...role, permissions: grants.filter(g => g.roleName === role.name).map(g => g.permissionName), assignedCount: users.filter(u => u.role === role.name).length })), catalog: permissionCatalog });
});
const roleSchema = z.object({ name: roleName, label: z.string().trim().min(2).max(80), permissions: permissionList }).strict();
router.post("/club/admin/roles", async (req, res) => {
  const parsed = roleSchema.safeParse(req.body);
  if (!parsed.success) throw new MembershipError(400, "أدخل اسم دور فريدًا بالأحرف الإنجليزية واسم عرض وصلاحيات صحيحة");
  const role = await db.transaction(async trx => {
    const [created] = await trx.insert(rolesTable).values({ name: parsed.data.name, label: parsed.data.label }).onConflictDoNothing().returning();
    if (!created) throw new MembershipError(409, "اسم الدور مستخدم");
    if (parsed.data.permissions.length) await trx.insert(rolePermissionsTable).values([...new Set(parsed.data.permissions)].map(permissionName => ({ roleName: created.name, permissionName })));
    await audit(trx, req.clubUser!.clerkUserId, "access.role_created", "role", null, { after: parsed.data });
    return created;
  });
  res.status(201).json(role);
});
router.patch("/club/admin/roles/:name", async (req, res) => {
  const parsed = roleSchema.omit({ name: true }).partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) throw new MembershipError(400, "بيانات الدور غير صحيحة");
  const role = await db.transaction(async trx => {
    const [before] = await trx.select().from(rolesTable).where(eq(rolesTable.name, String(req.params.name))).for("update");
    if (!before) throw new MembershipError(404, "الدور غير موجود");
    const previous = await trx.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleName, before.name));
    if (parsed.data.permissions) {
      await trx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleName, before.name));
      if (parsed.data.permissions.length) await trx.insert(rolePermissionsTable).values([...new Set(parsed.data.permissions)].map(permissionName => ({ roleName: before.name, permissionName })));
    }
    const [updated] = await trx.update(rolesTable).set({ label: parsed.data.label ?? before.label }).where(eq(rolesTable.name, before.name)).returning();
    await audit(trx, req.clubUser!.clerkUserId, "access.role_updated", "role", null, { name: before.name, before: { ...before, permissions: previous.map(p => p.permissionName) }, after: parsed.data });
    return updated;
  });
  res.json(role);
});
router.delete("/club/admin/roles/:name", async (req, res) => {
  await db.transaction(async trx => {
    await trx.execute(sql`SELECT pg_advisory_xact_lock(71926341)`);
    const [role] = await trx.select().from(rolesTable).where(eq(rolesTable.name, String(req.params.name))).for("update");
    if (!role) throw new MembershipError(404, "الدور غير موجود");
    if (role.builtIn) throw new MembershipError(409, "لا يمكن حذف دور أساسي؛ يمكن تعديل صلاحياته");
    const [assigned] = await trx.select({ id: clubUsersTable.id }).from(clubUsersTable).where(eq(clubUsersTable.role, role.name)).limit(1);
    if (assigned) throw new MembershipError(409, "الدور مرتبط بحسابات؛ انقلها إلى دور آخر قبل الحذف");
    await trx.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleName, role.name));
    await trx.delete(rolesTable).where(eq(rolesTable.name, role.name));
    await audit(trx, req.clubUser!.clerkUserId, "access.role_deleted", "role", null, { before: role });
  });
  res.sendStatus(204);
});
router.get("/club/admin/settings", async (_req, res) => { res.json(await readClubSettings()); });
router.put("/club/admin/settings", async (req, res) => {
  const parsed = clubSettingsSchema.safeParse(req.body);
  if (!parsed.success) throw new MembershipError(400, "تحقق من إعدادات النظام؛ يلزم الاسم والهاتف وطريقة دفع واحدة على الأقل");
  await db.transaction(async trx => {
    const [previous] = await trx.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "club.general")).for("update");
    await trx.insert(systemSettingsTable).values({ key: "club.general", value: JSON.stringify(parsed.data) }).onConflictDoUpdate({ target: systemSettingsTable.key, set: { value: JSON.stringify(parsed.data), updatedAt: new Date() } });
    await audit(trx, req.clubUser!.clerkUserId, "settings.updated", "system_setting", null, { before: previous ? JSON.parse(previous.value) : null, after: parsed.data });
  });
  res.json(await readClubSettings());
});
export function csv(rows: Record<string, unknown>[]) {
  const keys = rows.length ? Object.keys(rows[0]) : ["نتيجة"];
  const quote = (value: unknown) => {
    let text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text; // Spreadsheet formula injection.
    return `"${text.replaceAll('"', '""')}"`;
  };
  return "\uFEFF" + [keys.map(quote).join(","), ...rows.map(row => keys.map(key => quote(row[key])).join(","))].join("\r\n");
}
router.get("/club/admin/audit", async (req, res) => {
  const search = String(req.query.search ?? "").slice(0, 100);
  const page = Math.max(1, Math.min(100000, Number(req.query.page) || 1));
  const where = search ? or(ilike(auditLogTable.action, `%${search}%`), ilike(auditLogTable.actorId, `%${search}%`), ilike(auditLogTable.entityType, `%${search}%`)) : undefined;
  const exportCsv = req.query.format === "csv";
  const rows = await db.select({ audit: auditLogTable, actorName: clubUsersTable.displayName }).from(auditLogTable).leftJoin(clubUsersTable, eq(auditLogTable.actorId, clubUsersTable.clerkUserId)).where(where).orderBy(desc(auditLogTable.id)).limit(exportCsv ? 10000 : 20).offset(exportCsv ? 0 : (Math.floor(page) - 1) * 20);
  const items = rows.map(({ audit, actorName }) => ({ ...audit, actorName }));
  if (exportCsv) { res.attachment("audit.csv").type("text/csv").send(csv(items)); return; }
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(auditLogTable).where(where);
  res.json({ items, total, page: Math.floor(page) });
});
router.get("/club/admin/security", (_req, res) => {
  res.json({ authProvider: "Clerk", requiresApproval: true, financialDefault: "deny", ownerProtected: true, backupEncryption: "AES-256-GCM", backupAvailable: !!process.env.SESSION_SECRET, sessionPolicySource: "Clerk" });
});
router.get("/club/admin/whatsapp-reminders", async (_req,res) => {
  const {enabled,configured}=await readWhatsAppSettings();
  res.json({enabled,configured});
});
router.put("/club/admin/whatsapp-reminders", async (req,res) => {
  const input=z.object({enabled:z.boolean()}).strict().safeParse(req.body);
  if(!input.success)throw new MembershipError(400,"حالة التذكيرات غير صحيحة");
  const settings=await readWhatsAppSettings();
  if(input.data.enabled&&!settings.configured)throw new MembershipError(400,"التذكيرات معطلة حتى تضيف إعدادات Meta إلى Secrets وتجهز القوالب المعتمدة");
  await writeWhatsAppSettings({...settings,enabled:input.data.enabled});
  await db.insert(auditLogTable).values({actorId:req.clubUser!.clerkUserId,action:"whatsapp.settings_updated",entityType:"system_setting",details:{before:{enabled:settings.enabled},after:input.data}});
  res.json({enabled:input.data.enabled,configured:settings.configured});
});
router.get("/club/admin/backups", async (_req, res) => { res.json(await listBackups()); });
router.post("/club/admin/backups", async (req, res) => {
  const input = z.object({ label: z.string().trim().min(1).max(120).optional() }).strict().safeParse(req.body ?? {});
  if (!input.success) throw new MembershipError(400, "اسم النسخة غير صالح");
  res.status(201).json(await createBackup(req.clubUser!.clerkUserId, input.data.label));
});
router.post("/club/admin/backups/import", async (req, res) => {
  const input = z.object({ file: z.string().min(20).max(12 * 1024 * 1024) }).strict().safeParse(req.body);
  if (!input.success) throw new MembershipError(400, "اختر ملف نسخة مشفّرة صالحًا لا يتجاوز 12 ميغابايت");
  res.status(201).json(await importBackup(req.clubUser!.clerkUserId, input.data.file));
});
router.get("/club/admin/backups/:id/file", async (req, res) => {
  const row = await getBackup(positiveId(req.params.id));
  res.attachment(`prime-backup-${row.id}.json`).type("application/json").send(row.encrypted);
});
router.post("/club/admin/backups/:id/preview", async (req, res) => { res.json(await previewRestore(positiveId(req.params.id))); });
router.post("/club/admin/backups/:id/restore", async (req, res) => {
  const input = z.object({ token: z.string().length(64), confirmation: z.string() }).strict().safeParse(req.body);
  if (!input.success) throw new MembershipError(400, "اعرض المعاينة وأكمل تأكيد الاستعادة");
  res.json(await restoreBackup(positiveId(req.params.id), req.clubUser!.clerkUserId, input.data.token, input.data.confirmation));
});
export default router;
