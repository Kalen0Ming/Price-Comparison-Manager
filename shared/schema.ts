import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("annotator"),
  email: text("email").notNull(),
});

export const experiments = pgTable("experiments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  deadline: timestamp("deadline"),
  enableReview: boolean("enable_review").default(false).notNull(),
  reviewRatio: integer("review_ratio").default(0).notNull(),
  status: text("status").notNull().default("draft"),
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").notNull(),
  originalData: json("original_data").notNull(),
  // status: pending → assigned → annotated → needs_review → completed
  status: text("status").notNull().default("pending"),
  assignedTo: integer("assigned_to"),      // annotator user id
  assignedAt: timestamp("assigned_at"),
  reviewedBy: integer("reviewed_by"),       // reviewer user id
  finalResult: json("final_result"),        // adjudicated final result
  createdAt: timestamp("created_at").defaultNow(),
});

export const annotations = pgTable("annotations", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  result: json("result").notNull(),
  type: text("type").notNull().default("initial"), // initial, review, draft
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  type: text("type").notNull().default("info"), // info, warning, urgent
  isRead: boolean("is_read").notNull().default(false),
  experimentId: integer("experiment_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const apiConnectors = pgTable("api_connectors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  authType: text("auth_type").notNull().default("api_key"),
  authValue: text("auth_value"),
  fetchFrequency: text("fetch_frequency").notNull().default("manual"),
  experimentId: integer("experiment_id"),
  fieldMapping: json("field_mapping"),
  lastFetchedAt: timestamp("last_fetched_at"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertExperimentSchema = createInsertSchema(experiments).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertAnnotationSchema = createInsertSchema(annotations).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, createdAt: true });
export const insertApiConnectorSchema = createInsertSchema(apiConnectors).omit({ id: true, createdAt: true, lastFetchedAt: true });
export const insertSystemSettingSchema = createInsertSchema(systemSettings).omit({ updatedAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

export type ApiConnector = typeof apiConnectors.$inferSelect;
export type InsertApiConnector = z.infer<typeof insertApiConnectorSchema>;

export type SystemSetting = typeof systemSettings.$inferSelect;

export type UpdateUserRequest = Partial<InsertUser>;
export type UpdateExperimentRequest = Partial<InsertExperiment>;
export type UpdateTaskRequest = Partial<InsertTask>;
export type UpdateApiConnectorRequest = Partial<InsertApiConnector>;

export interface ExperimentStats {
  totalTasks: number;
  pendingTasks: number;
  assignedTasks: number;
  annotatedTasks: number;
  needsReviewTasks: number;
  completedTasks: number;
  sampleTasks: Task[];
  fieldDistributions: Record<string, Record<string, number>>;
}

// Enriched task for review workflow
export interface TaskWithAnnotations extends Task {
  experiment?: Experiment | null;
  initialAnnotation?: Annotation | null;
  reviewAnnotation?: Annotation | null;
  allAnnotations?: Annotation[];
}
