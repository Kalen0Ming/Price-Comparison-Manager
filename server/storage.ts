import { db } from "./db";
import {
  users, experiments, tasks, annotations, logs, apiConnectors,
  type User, type InsertUser, type UpdateUserRequest,
  type Experiment, type InsertExperiment, type UpdateExperimentRequest,
  type Task, type InsertTask,
  type Annotation, type InsertAnnotation,
  type Log, type InsertLog,
  type ApiConnector, type InsertApiConnector, type UpdateApiConnectorRequest,
  type ExperimentStats,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface IStorage {
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getExperiments(): Promise<Experiment[]>;
  getExperiment(id: number): Promise<Experiment | undefined>;
  createExperiment(exp: InsertExperiment): Promise<Experiment>;
  updateExperiment(id: number, updates: UpdateExperimentRequest): Promise<Experiment>;
  getExperimentStats(id: number): Promise<ExperimentStats>;

  getTasks(experimentId?: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  bulkCreateTasks(tasks: InsertTask[]): Promise<number>;

  getAnnotations(): Promise<Annotation[]>;

  getLogs(): Promise<Log[]>;

  getConnectors(): Promise<ApiConnector[]>;
  getConnector(id: number): Promise<ApiConnector | undefined>;
  createConnector(conn: InsertApiConnector): Promise<ApiConnector>;
  updateConnector(id: number, updates: UpdateApiConnectorRequest): Promise<ApiConnector>;
  deleteConnector(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getExperiments(): Promise<Experiment[]> {
    return await db.select().from(experiments);
  }

  async getExperiment(id: number): Promise<Experiment | undefined> {
    const [exp] = await db.select().from(experiments).where(eq(experiments.id, id));
    return exp;
  }

  async createExperiment(exp: InsertExperiment): Promise<Experiment> {
    const [newExp] = await db.insert(experiments).values(exp).returning();
    return newExp;
  }

  async updateExperiment(id: number, updates: UpdateExperimentRequest): Promise<Experiment> {
    const [updated] = await db.update(experiments)
      .set(updates)
      .where(eq(experiments.id, id))
      .returning();
    return updated;
  }

  async getExperimentStats(id: number): Promise<ExperimentStats> {
    const allTasks = await db.select().from(tasks).where(eq(tasks.experimentId, id));
    const totalTasks = allTasks.length;
    const pendingTasks = allTasks.filter(t => t.status === "pending").length;
    const annotatedTasks = allTasks.filter(t => t.status === "annotated").length;
    const needsReviewTasks = allTasks.filter(t => t.status === "needs_review").length;
    const sampleTasks = allTasks.slice(0, 10);

    // Compute field distributions across originalData
    const fieldDistributions: Record<string, Record<string, number>> = {};
    for (const task of allTasks) {
      const data = task.originalData as Record<string, unknown>;
      for (const [key, val] of Object.entries(data)) {
        if (typeof val === "string" || typeof val === "number") {
          const strVal = String(val);
          if (!fieldDistributions[key]) fieldDistributions[key] = {};
          fieldDistributions[key][strVal] = (fieldDistributions[key][strVal] || 0) + 1;
        }
      }
    }

    // Only keep fields with ≤15 unique values (categorical)
    const categoricalDistributions: Record<string, Record<string, number>> = {};
    for (const [key, dist] of Object.entries(fieldDistributions)) {
      if (Object.keys(dist).length <= 15) {
        categoricalDistributions[key] = dist;
      }
    }

    return { totalTasks, pendingTasks, annotatedTasks, needsReviewTasks, sampleTasks, fieldDistributions: categoricalDistributions };
  }

  async getTasks(experimentId?: number): Promise<Task[]> {
    if (experimentId) {
      return await db.select().from(tasks).where(eq(tasks.experimentId, experimentId));
    }
    return await db.select().from(tasks);
  }

  async createTask(task: InsertTask): Promise<Task> {
    const [newTask] = await db.insert(tasks).values(task).returning();
    return newTask;
  }

  async bulkCreateTasks(taskList: InsertTask[]): Promise<number> {
    if (taskList.length === 0) return 0;
    const chunkSize = 100;
    let total = 0;
    for (let i = 0; i < taskList.length; i += chunkSize) {
      const chunk = taskList.slice(i, i + chunkSize);
      await db.insert(tasks).values(chunk);
      total += chunk.length;
    }
    return total;
  }

  async getAnnotations(): Promise<Annotation[]> {
    return await db.select().from(annotations);
  }

  async getLogs(): Promise<Log[]> {
    return await db.select().from(logs);
  }

  async getConnectors(): Promise<ApiConnector[]> {
    return await db.select().from(apiConnectors);
  }

  async getConnector(id: number): Promise<ApiConnector | undefined> {
    const [conn] = await db.select().from(apiConnectors).where(eq(apiConnectors.id, id));
    return conn;
  }

  async createConnector(conn: InsertApiConnector): Promise<ApiConnector> {
    const [newConn] = await db.insert(apiConnectors).values(conn).returning();
    return newConn;
  }

  async updateConnector(id: number, updates: UpdateApiConnectorRequest): Promise<ApiConnector> {
    const [updated] = await db.update(apiConnectors)
      .set(updates)
      .where(eq(apiConnectors.id, id))
      .returning();
    return updated;
  }

  async deleteConnector(id: number): Promise<void> {
    await db.delete(apiConnectors).where(eq(apiConnectors.id, id));
  }
}

export const storage = new DatabaseStorage();
