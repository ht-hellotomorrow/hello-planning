import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  propicUrl: text("propic_url"),
  capacityDaysPerWeek: real("capacity_days_per_week").notNull().default(5),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`),
});

export const projects = sqliteTable(
  "projects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    airtableRecordId: text("airtable_record_id").unique(),
    source: text("source", { enum: ["airtable", "local"] }).notNull(),
    category: text("category", {
      enum: ["ht_internal", "ht_client", "personal", "ferie"],
    }).notNull(),
    code: text("code"),
    name: text("name").notNull(),
    status: text("status"),
    visibility: text("visibility", {
      enum: ["active", "archived", "hidden"],
    })
      .notNull()
      .default("active"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [index("projects_visibility_idx").on(table.visibility)],
);

export const personProjectOrder = sqliteTable(
  "person_project_order",
  {
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [primaryKey({ columns: [table.personId, table.projectId] })],
);

export const allocationSegments = sqliteTable(
  "allocation_segments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    startWeek: text("start_week").notNull(),
    endWeek: text("end_week").notNull(),
    daysPerWeek: real("days_per_week").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(current_timestamp)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(current_timestamp)`),
  },
  (table) => [
    index("alloc_person_idx").on(table.personId, table.startWeek),
    index("alloc_project_idx").on(table.projectId),
  ],
);

// Rate limiting del login: un contatore a finestra fissa per IP.
export const loginAttempts = sqliteTable("login_attempts", {
  ip: text("ip").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("window_start").notNull(),
});

export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type AllocationSegment = typeof allocationSegments.$inferSelect;
export type NewAllocationSegment = typeof allocationSegments.$inferInsert;
