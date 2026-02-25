import { db } from "./db";
import { 
  users, experiments, tasks, annotations, logs,
  type User, type InsertUser, type UpdateUserRequest,
  type Experiment, type InsertExperiment, type UpdateExperimentRequest,
  type Task, type InsertTask,
  type Annotation, type InsertAnnotation,
  type Log, type InsertLog
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Experiments
  getExperiments(): Promise<Experiment[]>;
  getExperiment(id: number): Promise<Experiment | undefined>;
  createExperiment(exp: InsertExperiment): Promise<Experiment>;
  updateExperiment(id: number, updates: UpdateExperimentRequest): Promise<Experiment>;
  
  // Tasks
  getTasks(experimentId?: number): Promise<Task[]>;
  
  // Annotations
  getAnnotations(): Promise<Annotation[]>;
  
  // Logs
  getLogs(): Promise<Log[]>;
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
  
  async getTasks(experimentId?: number): Promise<Task[]> {
    if (experimentId) {
      return await db.select().from(tasks).where(eq(tasks.experimentId, experimentId));
    }
    return await db.select().from(tasks);
  }
  
  async getAnnotations(): Promise<Annotation[]> {
    return await db.select().from(annotations);
  }
  
  async getLogs(): Promise<Log[]> {
    return await db.select().from(logs);
  }
}

export const storage = new DatabaseStorage();
