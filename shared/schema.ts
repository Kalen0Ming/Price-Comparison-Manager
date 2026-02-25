import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("annotator"), // admin, annotator, reviewer
  email: text("email").notNull(),
});

export const experiments = pgTable("experiments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  deadline: timestamp("deadline"),
  enableReview: boolean("enable_review").default(false).notNull(),
  reviewRatio: integer("review_ratio").default(0).notNull(), // e.g. 30 for 30%
  status: text("status").notNull().default("draft"), // draft, in_progress, archived
});

export const tasks = pgTable("tasks", {
  id: serial("id").primaryKey(),
  experimentId: integer("experiment_id").notNull(),
  originalData: json("original_data").notNull(), // stores product A and B info
  status: text("status").notNull().default("pending"), // pending, annotated, needs_review
  createdAt: timestamp("created_at").defaultNow(),
});

export const annotations = pgTable("annotations", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  userId: integer("user_id").notNull(),
  result: json("result").notNull(), // e.g. {'is_same_product': true, 'price_comparison': 'A>B'}
  type: text("type").notNull().default("initial"), // initial, review
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

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertExperimentSchema = createInsertSchema(experiments).omit({ id: true, createdAt: true });
export const insertTaskSchema = createInsertSchema(tasks).omit({ id: true, createdAt: true });
export const insertAnnotationSchema = createInsertSchema(annotations).omit({ id: true, createdAt: true });
export const insertLogSchema = createInsertSchema(logs).omit({ id: true, createdAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Experiment = typeof experiments.$inferSelect;
export type InsertExperiment = z.infer<typeof insertExperimentSchema>;

export type Task = typeof tasks.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;

export type Annotation = typeof annotations.$inferSelect;
export type InsertAnnotation = z.infer<typeof insertAnnotationSchema>;

export type Log = typeof logs.$inferSelect;
export type InsertLog = z.infer<typeof insertLogSchema>;

// Request types
export type UpdateUserRequest = Partial<InsertUser>;
export type UpdateExperimentRequest = Partial<InsertExperiment>;
export type UpdateTaskRequest = Partial<InsertTask>;
