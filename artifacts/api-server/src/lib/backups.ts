import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db, clubBackupsTable, auditLogTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { MembershipError } from "./membership";

// Explicitly exclude identity, roles, grants, bootstrap ledger and existing audit
// from restoration: a data restore must never revoke the current owner's access.
const businessTables = [
  "members", "membership_plans", "finance_categories", "employees", "whatsapp_templates",
  "subscriptions", "subscription_payments", "financial_transactions", "payroll_entries",
  "cash_movements", "whatsapp_reminder_logs", "system_settings",
] as const;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Snapshot = { format: 1; scope: "club-business"; data: Record<string, Record<string, unknown>[]> };
type Envelope = { format: 1; algorithm: "AES-256-GCM"; iv: string; tag: string; ciphertext: string };
const backupColumns = { id: clubBackupsTable.id, label: clubBackupsTable.label, createdAt: clubBackupsTable.createdAt, createdBy: clubBackupsTable.createdBy, bytes: clubBackupsTable.bytes, counts: clubBackupsTable.counts };

function key() {
  if (!process.env.SESSION_SECRET) throw new MembershipError(503, "النسخ المشفرة غير متاح قبل إعداد SESSION_SECRET في أسرار الخادم");
  return createHash("sha256").update("prime-academy/backup/v1\0").update(process.env.SESSION_SECRET).digest();
}
export function encryptSnapshot(snapshot: Snapshot): string {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from("prime-academy/club-business/v1"));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(snapshot), "utf8"), cipher.final()]);
  return JSON.stringify({ format: 1, algorithm: "AES-256-GCM", iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), ciphertext: ciphertext.toString("base64") } satisfies Envelope);
}
export function decryptSnapshot(encrypted: string): Snapshot {
  try {
    const envelope = JSON.parse(encrypted) as Envelope;
    if (envelope.format !== 1 || envelope.algorithm !== "AES-256-GCM") throw new Error("format");
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(Buffer.from("prime-academy/club-business/v1"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
    const data = JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]).toString("utf8")) as Snapshot;
    if (data.format !== 1 || data.scope !== "club-business" || !data.data) throw new Error("scope");
    if (Object.keys(data.data).sort().join(",") !== [...businessTables].sort().join(",")) throw new Error("tables");
    for (const table of businessTables) {
      if (!Array.isArray(data.data[table]) || data.data[table].some(row => !row || typeof row !== "object" || Array.isArray(row))) throw new Error("rows");
    }
    return data;
  } catch (error) {
    if (error instanceof MembershipError) throw error;
    throw new MembershipError(400, "النسخة غير صالحة أو عُدّلت أو شُفّرت بمفتاح مختلف؛ لم تتغير البيانات");
  }
}
const isBusinessSetting = (row: Record<string, unknown>) => row.key === "club.general" || /^whatsapp[._]/.test(String(row.key));
export async function snapshot(trx: Tx): Promise<Snapshot> {
  const data: Snapshot["data"] = {};
  for (const table of businessTables) {
    const rows = (await trx.execute(sql.raw(`SELECT * FROM "${table}" ORDER BY "${table === "system_settings" ? "key" : "id"}"`))).rows as Record<string, unknown>[];
    data[table] = table === "system_settings" ? rows.filter(isBusinessSetting) : rows;
  }
  return { format: 1, scope: "club-business", data };
}
function countsOf(data: Snapshot) { return Object.fromEntries(businessTables.map(table => [table, data.data[table].length])); }
export async function saveSnapshot(trx: Tx, value: Snapshot, actor: string, label: string) {
  const encrypted = encryptSnapshot(value);
  const [entry] = await trx.insert(clubBackupsTable).values({ label, createdBy: actor, encrypted, bytes: Buffer.byteLength(encrypted), counts: countsOf(value) }).returning(backupColumns);
  await trx.insert(auditLogTable).values({ actorId: actor, action: "backup.created", entityType: "backup", entityId: entry.id, details: { label, counts: entry.counts } });
  return entry;
}
export async function createBackup(actor: string, label = "نسخة يدوية") {
  return db.transaction(async trx => saveSnapshot(trx, await snapshot(trx), actor, label), { isolationLevel: "repeatable read" });
}
export async function importBackup(actor: string, file: string) {
  const data = decryptSnapshot(file);
  return db.transaction(async trx => saveSnapshot(trx, data, actor, "نسخة مستوردة ومتحقق منها"));
}
export async function listBackups() {
  return db.select(backupColumns).from(clubBackupsTable).orderBy(sql`${clubBackupsTable.id} DESC`).limit(100);
}
export async function getBackup(id: number, trx: Tx | typeof db = db) {
  const [row] = await trx.select().from(clubBackupsTable).where(eq(clubBackupsTable.id, id));
  if (!row) throw new MembershipError(404, "النسخة الاحتياطية غير موجودة");
  return row;
}
async function revision(trx: Tx) {
  const result = await trx.execute(sql`SELECT coalesce(max(id),0)::text AS revision FROM audit_log`);
  return String(result.rows[0].revision);
}
function previewToken(encrypted: string, version: string, current: Snapshot) {
  return createHash("sha256").update(key()).update(encrypted).update(version).update(JSON.stringify(current)).digest("hex");
}
export async function previewRestoreInTransaction(trx: Tx, id: number) {
    const row = await getBackup(id, trx), value = decryptSnapshot(row.encrypted), current = await snapshot(trx);
    return {
      counts: countsOf(value),
      changes: Object.fromEntries(businessTables.map(table => [table, { current: current.data[table].length, backup: value.data[table].length }])),
      token: previewToken(row.encrypted, await revision(trx), current),
      warning: "ستُستبدل بيانات الأعمال الحالية بمحتوى النسخة. ستُحفظ نسخة قبل الاستعادة تلقائيًا. لن تتغير حسابات الدخول أو الأدوار والصلاحيات أو المدير الرئيسي أو سجل التدقيق. يُمنع الاعتماد على نسخة داخل قاعدة البيانات وحدها كحماية من فقدان القاعدة.",
    };
}
export async function previewRestore(id: number) {
  return db.transaction(trx => previewRestoreInTransaction(trx, id), { isolationLevel: "repeatable read" });
}
export async function restoreBackup(id: number, actor: string, token: string, confirmation: string) {
  if (confirmation !== `استعادة ${id}`) throw new MembershipError(400, "اكتب عبارة تأكيد الاستعادة كما هي");
  return db.transaction(trx => restoreInTransaction(trx,id,actor,token));
}
export async function restoreInTransaction(trx:Tx,id:number,actor:string,token:string) {
    await trx.execute(sql`SELECT pg_advisory_xact_lock(71926342)`);
    await trx.execute(sql.raw(`LOCK TABLE ${[...businessTables, "audit_log"].map(t => `"${t}"`).join(",")} IN ACCESS EXCLUSIVE MODE`));
    const row = await getBackup(id, trx);
    const current = await snapshot(trx);
    const expected = previewToken(row.encrypted, await revision(trx), current);
    if (!/^[a-f0-9]{64}$/.test(token) || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) throw new MembershipError(409, "تغيرت البيانات بعد المعاينة؛ اعرض المعاينة مجددًا قبل الاستعادة");
    const value = decryptSnapshot(row.encrypted);
    const before = await saveSnapshot(trx, current, actor, "نسخة أمان تلقائية قبل الاستعادة");
    for (const table of [...businessTables].reverse()) {
      if (table === "system_settings") await trx.execute(sql`DELETE FROM system_settings WHERE key='club.general' OR key LIKE 'whatsapp.%' OR left(key,9)='whatsapp_'`);
      else await trx.execute(sql.raw(`DELETE FROM "${table}"`));
    }
    for (const table of businessTables) {
      const columnRows = await trx.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=${table}`);
      const allowed = new Set(columnRows.rows.map(r => String(r.column_name)));
      for (const rowValue of value.data[table]) {
        if (table === "system_settings" && !isBusinessSetting(rowValue)) continue;
        const columns = Object.keys(rowValue);
        if (!columns.length || columns.some(column => !allowed.has(column))) throw new MembershipError(409, "بنية النسخة لا تطابق إصدار قاعدة البيانات؛ أُلغيت الاستعادة بالكامل");
        const identifiers = columns.map(column => sql.raw(`"${column}"`));
        const values = columns.map(column => sql`${rowValue[column] instanceof Date ? (rowValue[column] as Date).toISOString() : rowValue[column]}`);
        await trx.execute(sql`INSERT INTO ${sql.raw(`"${table}"`)} (${sql.join(identifiers, sql`,`)}) VALUES (${sql.join(values, sql`,`)})`);
      }
      if (table !== "system_settings") {
        // Never move a sequence backwards; financial/audit identifiers cannot be reused.
        await trx.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('${table}','id'), greatest(coalesce((SELECT max(id) FROM "${table}"),1),(SELECT last_value FROM "${table}_id_seq")),true)`));
      }
    }
    await trx.insert(auditLogTable).values({ actorId: actor, action: "backup.restored", entityType: "backup", entityId: id, details: { preRestoreBackupId: before.id, counts: countsOf(value), protectedIdentityAndAudit: true } });
    return { ok: true, preRestoreBackupId: before.id };
}
