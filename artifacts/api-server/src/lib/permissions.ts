import { db, rolePermissionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";

export const sections = {
  dashboard: "لوحة التحكم", members: "المشتركون", subscriptions: "الاشتراكات",
  plans: "الباقات والأسعار", payments: "الديون والمدفوعات", finance: "الإيرادات والمصاريف والصندوق",
  employees: "بيانات الموظفين والرواتب الأساسية", payroll: "الرواتب والاستحقاقات", reports: "التقارير المالية",
  whatsapp: "واتساب والتنبيهات", settings: "إعدادات النظام", users: "المستخدمون",
  roles: "الأدوار والصلاحيات", backups: "النسخ الاحتياطي", audit: "سجل العمليات", security: "الأمان",
} as const;
export const actions = { view: "عرض", create: "إضافة", edit: "تعديل", delete: "حذف / إلغاء", export: "تصدير", approve: "اعتماد" } as const;
export const permissionCatalog = Object.entries(sections).flatMap(([section, sectionLabel]) =>
  Object.entries(actions).map(([action, actionLabel]) => ({ name: `${section}.${action}`, label: `${sectionLabel}: ${actionLabel}`, section, sectionLabel, action, actionLabel })));
export const validPermissionNames = new Set(permissionCatalog.map(p => p.name));

export async function effectivePermissions(user: NonNullable<Request["clubUser"]>): Promise<string[]> {
  if (user.isOwner) return [...validPermissionNames];
  const inherited = await db.select().from(rolePermissionsTable).where(eq(rolePermissionsTable.roleName, user.role));
  const permissions = new Set(inherited.map(row => row.permissionName).filter(name => validPermissionNames.has(name)));
  for (const [name, allowed] of Object.entries(user.permissionOverrides ?? {})) {
    if (!validPermissionNames.has(name)) continue;
    if (allowed === true) permissions.add(name); else permissions.delete(name);
  }
  return [...permissions].sort();
}

export function hasPermission(req: Request, permission: string): boolean {
  return !!req.clubUser?.isOwner || !!req.clubPermissions?.includes(permission);
}

// Explicit allowlist. An unreviewed new API route is denied even to a delegated role.
export function routePermissions(method: string, rawPath: string): string[] | "owner" | null {
  const path = rawPath.replace(/\/$/, "");
  const read = method === "GET" || method === "HEAD";
  if (path === "/club/session" && read) return [];
  if (/^\/club\/admin(?:\/|$)/.test(path)) return "owner";
  if (path === "/club/overview" && read) return ["dashboard.view"];
  if (path === "/club/dashboard" && read) return ["dashboard.view", "payments.view", "members.view", "reports.view"];
  if (path === "/club/operations/settings" && read) return [];
  if (path === "/members") return [read ? "members.view" : method === "POST" ? "members.create" : "unsupported"];
  if (/^\/members\/\d+\/profile$/.test(path) && read) return ["members.view"];
  if (/^\/members\/\d+$/.test(path)) return read ? ["members.view", "subscriptions.view", "payments.view"] : [method === "PATCH" ? "members.edit" : method === "DELETE" ? "members.delete" : "unsupported"];
  if (/^\/club\/operations\/plans$/.test(path) && read) return ["subscriptions.view"];
  if (/^\/club\/operations\/subscriptions$/.test(path)) return [read ? "subscriptions.view" : method === "POST" ? "subscriptions.create" : "unsupported"];
  if (/^\/club\/operations\/subscriptions\/\d+$/.test(path) && method === "PATCH") return ["subscriptions.edit"];
  if (/^\/club\/operations\/subscriptions\/\d+\/action$/.test(path) && method === "POST") return ["subscriptions.edit"];
  if (/^\/plans(?:\/\d+)?$/.test(path)) return [`plans.${read ? "view" : method === "POST" ? "create" : method === "PATCH" ? "edit" : method === "DELETE" ? "delete" : "unsupported"}`];
  if (/^\/subscriptions\/\d+\/payments$/.test(path)) return [read ? "payments.view" : method === "POST" ? "payments.create" : "unsupported"];
  if (/^\/payments\/\d+\/(?:receipt|reverse)$/.test(path)) return [read ? "payments.view" : method === "POST" ? "payments.edit" : "unsupported"];
  if (/^\/subscriptions(?:\/\d+(?:\/action)?)?$/.test(path)) return ["payments.view", `subscriptions.${read ? "view" : method === "PATCH" ? "edit" : method === "POST" ? (path.endsWith("/action") ? "edit" : "create") : "unsupported"}`];
  if (/^\/(?:finance|club\/finance)\/(?:categories|transactions)(?:\/\d+(?:\/reverse)?)?$/.test(path)) return [`finance.${read ? "view" : method === "POST" ? (path.endsWith("/reverse") ? "delete" : "create") : method === "PATCH" ? "edit" : "unsupported"}`];
  if (/^\/(?:finance\/employees|club\/employees)(?:\/\d+)?$/.test(path)) return [`employees.${read ? "view" : method === "POST" ? "create" : method === "PATCH" ? "edit" : method === "DELETE" ? "delete" : "unsupported"}`];
  if (/^\/(?:finance\/payroll|club\/payroll)(?:\/\d+(?:\/(?:payments|pay))?)?$/.test(path)) return [`payroll.${read ? "view" : method === "PATCH" ? "edit" : method === "DELETE" ? "delete" : method === "POST" ? (/\/(?:payments|pay)$/.test(path) ? "approve" : "create") : "unsupported"}`];
  if (/^\/(?:finance\/reports|club\/finance\/report)$/.test(path) && read) return ["reports.view"];
  if (/^\/(?:finance\/cash|club\/cash-movements)$/.test(path)) return [`finance.${read ? "view" : method === "POST" ? "create" : "unsupported"}`];
  if (/^\/club\/whatsapp(?:\/|$)/.test(path)) return [`whatsapp.${read ? "view" : "edit"}`];
  if (/^\/members\/\d+\/whatsapp-reminders?$/.test(path)) return ["members.view", read ? "whatsapp.view" : "whatsapp.create"];
  if (/^\/club\/exports\/(members|subscriptions|finance|reports|payroll)$/.test(path) && read) return [`${path.split("/").pop()}.view`, `${path.split("/").pop()}.export`];
  return null;
}
