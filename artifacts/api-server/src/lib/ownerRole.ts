import { clerkClient } from "@clerk/express";
import { db, auditLogTable, clubUsersTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const action = "auth.owner_initialized";
type Identity = Awaited<ReturnType<typeof clerkClient.users.getUser>>;

export async function grantConfiguredOwner(identity: Identity) {
  const configured = process.env.CLUB_ADMIN_EMAIL?.trim().toLowerCase();
  const primary = identity.emailAddresses.find(e => e.id === identity.primaryEmailAddressId);
  if (!configured || primary?.emailAddress.trim().toLowerCase() !== configured || primary.verification?.status !== "verified") return undefined;
  return db.transaction(async trx => {
    const [existing] = await trx.select().from(clubUsersTable).where(eq(clubUsersTable.clerkUserId, identity.id));
    const [previousGrant] = await trx.select({ id: auditLogTable.id }).from(auditLogTable)
      .where(and(eq(auditLogTable.actorId, identity.id), eq(auditLogTable.action, action))).limit(1);
    // A completed bootstrap never restores a subsequently revoked role.
    if (previousGrant) {
      if (existing?.role === "admin" && existing.status === "active" && !existing.isOwner) {
        const [owner] = await trx.update(clubUsersTable).set({ isOwner: true, updatedAt: new Date() }).where(eq(clubUsersTable.id, existing.id)).returning();
        return owner;
      }
      return existing;
    }
    await trx.insert(clubUsersTable).values({ clerkUserId: identity.id, email: primary.emailAddress, role: "staff" }).onConflictDoNothing();
    let [user] = await trx.select().from(clubUsersTable).where(eq(clubUsersTable.clerkUserId, identity.id)).for("update");
    const [racedGrant] = await trx.select({ id: auditLogTable.id }).from(auditLogTable)
      .where(and(eq(auditLogTable.actorId, identity.id), eq(auditLogTable.action, action))).limit(1);
    if (!racedGrant) {
      [user] = await trx.update(clubUsersTable).set({ role: "admin", status: "active", isOwner: true, updatedAt: new Date() }).where(eq(clubUsersTable.id, user.id)).returning();
      await trx.insert(auditLogTable).values({ actorId: identity.id, action, entityType: "club_user", entityId: user.id, details: { source: "configured_verified_owner", previousRole: existing?.role ?? null } });
    }
    return user;
  });
}

export async function initializeConfiguredOwner() {
  const email = process.env.CLUB_ADMIN_EMAIL?.trim();
  if (!email) return { status: "not_configured" };
  const identities = await clerkClient.users.getUserList({ emailAddress: [email], limit: 10 });
  for (const identity of identities.data) {
    const user = await grantConfiguredOwner(identity);
    if (user) return { status: "verified", role: user.role };
  }
  return { status: "awaiting_verified_owner_sign_in" };
}
