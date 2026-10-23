import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, clubUsersTable } from "@workspace/db";
import { grantConfiguredOwner } from "../lib/ownerRole";
import { effectivePermissions, hasPermission, routePermissions } from "../lib/permissions";

export async function resolveClubUser(userId: string, identity?: Awaited<ReturnType<typeof import("@clerk/express").clerkClient.users.getUser>>) {
  const [existing] = await db.select().from(clubUsersTable).where(eq(clubUsersTable.clerkUserId, userId)).limit(1);
  if (existing && !identity) return existing;
  const { clerkClient } = await import("@clerk/express");
  const verifiedIdentity = identity ?? await clerkClient.users.getUser(userId);
  const owner = await grantConfiguredOwner(verifiedIdentity);
  if (owner) return owner;
  if (existing) return existing;
  const primary = verifiedIdentity.emailAddresses.find(item => item.id === verifiedIdentity.primaryEmailAddressId);
  await db.insert(clubUsersTable).values({
    clerkUserId: userId, email: primary?.emailAddress ?? "", role: "staff", status: "pending",
    displayName: [verifiedIdentity.firstName, verifiedIdentity.lastName].filter(Boolean).join(" ") || verifiedIdentity.username || null,
  }).onConflictDoNothing();
  const [created] = await db.select().from(clubUsersTable).where(eq(clubUsersTable.clerkUserId, userId));
  return created;
}

declare global {
  namespace Express {
    interface Request {
      clubUser?: typeof clubUsersTable.$inferSelect;
      clubPermissions?: string[];
    }
  }
}

export async function requireClubUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "يلزم تسجيل الدخول" });
    return;
  }

  const clubUser = await resolveClubUser(userId);

  if (!clubUser || clubUser.status !== "active") {
    res.status(403).json({ error: "الحساب غير فعال؛ تحقق من حالة موافقة المدير", status: clubUser?.status ?? "pending", setupRequired: !process.env.CLUB_ADMIN_EMAIL });
    return;
  }

  req.clubUser = clubUser;
  req.clubPermissions = await effectivePermissions(clubUser);
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const needed = routePermissions(req.method, req.path);
  if (!req.clubUser?.isOwner && (needed === "owner" || needed === null || !needed.length || !needed.every(name => hasPermission(req, name)))) {
    res.status(403).json({ error: "تتطلب هذه العملية صلاحية المدير" });
    return;
  }
  next();
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.clubUser?.isOwner || req.clubUser.status !== "active") {
    res.status(403).json({ error: "هذه العملية للمدير الرئيسي فقط" }); return;
  }
  next();
}
