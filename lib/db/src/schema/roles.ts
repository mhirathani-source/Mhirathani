import { boolean, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const rolesTable = pgTable("club_roles", {
  name: text("name").primaryKey(),
  label: text("label").notNull(),
  builtIn: boolean("built_in").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissionsTable = pgTable("club_permissions", {
  name: text("name").primaryKey(),
  label: text("label").notNull(),
});

export const rolePermissionsTable = pgTable(
  "club_role_permissions",
  {
    roleName: text("role_name").notNull().references(() => rolesTable.name),
    permissionName: text("permission_name").notNull().references(() => permissionsTable.name),
  },
  (table) => [primaryKey({ columns: [table.roleName, table.permissionName] })],
);
