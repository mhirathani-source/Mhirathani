import { pool } from "@workspace/db";

if (!process.env.IRAQ_ALAMEER_DATABASE_URL) {
  throw new Error("IRAQ_ALAMEER_DATABASE_URL must be set before running this migration.");
}
if (process.env.DATABASE_URL && process.env.DATABASE_URL !== process.env.IRAQ_ALAMEER_DATABASE_URL) {
  throw new Error("Run this migration with DATABASE_URL pointed at the Iraq Alameer database.");
}

try {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS iraq_attendance (
      id serial PRIMARY KEY,
      member_id integer NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
      attendance_date date NOT NULL,
      status text NOT NULL CHECK (status IN ('present', 'absent', 'late')),
      note text,
      recorded_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CONSTRAINT iraq_attendance_member_date_unique UNIQUE (member_id, attendance_date)
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS iraq_attendance_date_idx
    ON iraq_attendance (attendance_date, member_id)
  `);
  process.stdout.write("Iraq Alameer attendance schema is ready.\n");
} finally {
  await pool.end();
}
