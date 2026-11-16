import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { Router, type IRouter } from "express";
import { pool } from "@workspace/db";
import { requireClubUser } from "../middlewares/clubAuth";

const router: IRouter = Router();
const attendanceInput = z.object({
  memberId: z.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["present", "absent", "late"]),
  note: z.string().max(500).nullable().optional(),
});

function jordanToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Amman",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function requireAttendancePermission(permission: "members.view" | "members.edit") {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.clubUser?.isOwner || req.clubPermissions?.includes(permission)) {
      next();
      return;
    }
    res.status(403).json({ error: "ليس لديك صلاحية لإدارة الحضور" });
  };
}

router.get(
  "/",
  requireClubUser,
  requireAttendancePermission("members.view"),
  async (req, res): Promise<void> => {
    const rawDate = req.query.date;
    const date = typeof rawDate === "string" ? rawDate : jordanToday();
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 120) : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: "تاريخ الحضور غير صالح" });
      return;
    }
    const result = await pool.query(
      `SELECT m.id AS "memberId", m.name AS "memberName", m.phone,
              a.id, $1::date AS "attendanceDate", a.status, a.note,
              a.recorded_by AS "recordedBy", a.updated_at AS "updatedAt"
       FROM members m
       LEFT JOIN iraq_attendance a
         ON a.member_id = m.id AND a.attendance_date = $1::date
       WHERE m.active = true
         AND ($2::text = '' OR m.name ILIKE '%' || $2 || '%' OR m.phone ILIKE '%' || $2 || '%')
       ORDER BY m.name
       LIMIT 200`,
      [date, search],
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.json(result.rows);
  },
);

router.post(
  "/",
  requireClubUser,
  requireAttendancePermission("members.edit"),
  async (req, res): Promise<void> => {
    const parsed = attendanceInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "بيانات الحضور غير مكتملة أو غير صحيحة" });
      return;
    }
    const input = parsed.data;
    const actorId = req.clubUser!.clerkUserId;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const member = await client.query(
        "SELECT id FROM members WHERE id = $1 AND active = true FOR UPDATE",
        [input.memberId],
      );
      if (!member.rowCount) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "اللاعب غير موجود أو غير نشط" });
        return;
      }
      const saved = await client.query(
        `INSERT INTO iraq_attendance (member_id, attendance_date, status, note, recorded_by)
         VALUES ($1, $2::date, $3, $4, $5)
         ON CONFLICT (member_id, attendance_date)
         DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note,
                       recorded_by = EXCLUDED.recorded_by, updated_at = now()
         RETURNING id, member_id AS "memberId", attendance_date AS "attendanceDate",
                   status, note, recorded_by AS "recordedBy", updated_at AS "updatedAt"`,
        [input.memberId, input.date, input.status, input.note ?? null, actorId],
      );
      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details)
         VALUES ($1, 'attendance.recorded', 'attendance', $2, $3::jsonb)`,
        [actorId, saved.rows[0].id, JSON.stringify({ memberId: input.memberId, date: input.date, status: input.status })],
      );
      await client.query("COMMIT");
      res.status(200).json(saved.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);

router.delete(
  "/:id",
  requireClubUser,
  requireAttendancePermission("members.edit"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) {
      res.status(400).json({ error: "معرّف سجل الحضور غير صالح" });
      return;
    }
    const actorId = req.clubUser!.clerkUserId;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const removed = await client.query(
        "DELETE FROM iraq_attendance WHERE id = $1 RETURNING id, member_id AS \"memberId\", attendance_date AS date",
        [id],
      );
      if (!removed.rowCount) {
        await client.query("ROLLBACK");
        res.status(404).json({ error: "سجل الحضور غير موجود" });
        return;
      }
      await client.query(
        `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details)
         VALUES ($1, 'attendance.deleted', 'attendance', $2, $3::jsonb)`,
        [actorId, id, JSON.stringify(removed.rows[0])],
      );
      await client.query("COMMIT");
      res.sendStatus(204);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
);

export default router;
