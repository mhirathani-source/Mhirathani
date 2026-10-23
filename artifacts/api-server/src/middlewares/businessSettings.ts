import type { RequestHandler } from "express";
import { MembershipError, validCalendarDate } from "../lib/membership";
import { readClubSettings } from "../lib/clubSettings";
import { hasPermission } from "../lib/permissions";

export const enforceBusinessSettings: RequestHandler = async (req, _res, next) => {
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(req.method)) { next(); return; }
  const body = req.body ?? {};
  const path = req.path.replace(/\/$/, "");
  for (const field of ["transactionDate","dueDate","hiredAt","startDate","endDate","birthDate"]) {
    if (body[field] && !validCalendarDate(body[field])) throw new MembershipError(400, `أدخل تاريخًا تقويميًا صحيحًا بصيغة سنة-شهر-يوم (${field})`);
  }
  if (body.method !== undefined || body.paymentMethod !== undefined || Number(body.initialPaymentFils) > 0) {
    const settings = await readClubSettings();
    const method = body.method ?? body.paymentMethod ?? "cash";
    if (!settings.paymentMethods.includes(method)) throw new MembershipError(400, "طريقة الدفع غير مفعّلة في إعدادات النادي");
  }
  if (path === "/subscriptions" && req.method === "POST") {
    if (Number(body.initialPaymentFils) > 0 && !hasPermission(req, "payments.create")) throw new MembershipError(403, "تسجيل دفعة أولى يحتاج صلاحية إضافة دفعات");
    if (Number(body.discountFils) > 0 && !hasPermission(req, "payments.approve")) throw new MembershipError(403, "تسجيل خصم يحتاج صلاحية اعتماد المدفوعات والتسويات");
  }
  if (/^\/subscriptions\/\d+\/action$/.test(path)) {
    if (body.action === "renew" && !hasPermission(req, "subscriptions.create")) throw new MembershipError(403, "التجديد يحتاج صلاحية إضافة اشتراك");
    if (body.action === "cancel" && !hasPermission(req, "subscriptions.delete")) throw new MembershipError(403, "الإلغاء يحتاج صلاحية حذف / إلغاء الاشتراك");
  }
  next();
};
