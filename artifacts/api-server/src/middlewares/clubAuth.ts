import { getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, clubUsersTable } from "@workspace/db";
import { grantConfiguredOwner } from "../lib/ownerRole";

export async function resolveClubUser(userId: string) {
  const [existing] = await db.select().from(clubUsersTable).where(eq(clubUsersTable.clerkUserId, userId)).limit(1);
  if (existing || !process.env.CLUB_ADMIN_EMAIL) return existing;
  const { clerkClient } = await import("@clerk/express");
  return grantConfiguredOwner(await clerkClient.users.getUser(userId));
}

declare global {
  namespace Express {
    interface Request {
      clubUser?: typeof clubUsersTable.$inferSelect;
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

  if (!clubUser || !["admin", "staff"].includes(clubUser.role)) {
    res.status(403).json({ error: "هذا الحساب غير مخوّل لإدارة النادي", setupRequired: !process.env.CLUB_ADMIN_EMAIL });
    return;
  }

  req.clubUser = clubUser;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.clubUser?.role !== "admin") {
    res.status(403).json({ error: "تتطلب هذه العملية صلاحية المدير" });
    return;
  }
  next();
}
