import { db, systemSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";

export const clubSettingsSchema = z.object({
  clubName: z.string().trim().min(2).max(120),
  currency: z.literal("JOD"),
  timezone: z.literal("Asia/Amman"),
  memberRequiredFields: z.array(z.enum(["name", "phone", "email", "birthDate"])).min(2).refine(fields => fields.includes("name") && fields.includes("phone"), "الاسم ورقم الهاتف مطلوبان دائمًا"),
  paymentMethods: z.array(z.enum(["cash", "card", "bank_transfer", "wallet"])).min(1).max(4),
  maxDiscountPercent: z.number().min(0).max(100),
  financialYearStartMonth: z.number().int().min(1).max(12),
  reminderDays: z.array(z.number().int().min(0).max(30)).max(31),
  renewalPolicy: z.enum(["after_end","after_expiry_only"]),
}).strict();
export type ClubSettings = z.infer<typeof clubSettingsSchema>;
export const defaultClubSettings: ClubSettings = {
  clubName: "Prime Boxing Academy", currency: "JOD", timezone: "Asia/Amman",
  memberRequiredFields: ["name", "phone"], paymentMethods: ["cash", "card", "bank_transfer", "wallet"],
  maxDiscountPercent: 100, financialYearStartMonth: 1, reminderDays: [2, 0], renewalPolicy: "after_end",
};
export async function readClubSettings(): Promise<ClubSettings> {
  const [row] = await db.select().from(systemSettingsTable).where(eq(systemSettingsTable.key, "club.general"));
  if (!row) return defaultClubSettings;
  return clubSettingsSchema.parse(JSON.parse(row.value));
}
