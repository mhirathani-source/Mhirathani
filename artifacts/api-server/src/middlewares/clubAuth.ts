import { getAuth } from "@clerk/express";
import { and, eq } from "drizzle-orm";
import type { NextFunction, Request, Response } from "express";
import { db, clubUsersTable } from "@workspace/db";

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

  let [clubUser] = await db
    .select()
    .from(clubUsersTable)
    .where(eq(clubUsersTable.clerkUserId, userId))
    .limit(1);

  if (!clubUser && process.env.CLUB_ADMIN_EMAIL) {
    const { clerkClient } = await import("@clerk/express");
    const identity = await clerkClient.users.getUser(userId);
    const email = identity.emailAddresses.find(
      (item) => item.id === identity.primaryEmailAddressId,
    )?.emailAddress;
    if (email?.trim().toLowerCase() === process.env.CLUB_ADMIN_EMAIL.trim().toLowerCase()) {
      [clubUser] = await db
        .insert(clubUsersTable)
        .values({ clerkUserId: userId, email, role: "admin" })
        .onConflictDoNothing()
        .returning();
      if (!clubUser) {
        [clubUser] = await db
          .select()
          .from(clubUsersTable)
          .where(and(eq(clubUsersTable.clerkUserId, userId), eq(clubUsersTable.role, "admin")))
          .limit(1);
      }
    }
  }

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
