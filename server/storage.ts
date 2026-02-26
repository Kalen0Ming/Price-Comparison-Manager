import { db } from "./db";
import {
  users, annotationTemplates, experiments, taskBatches, tasks, annotations, notifications, logs, apiConnectors, systemSettings, userGroups, roleRequests,
  type User, type InsertUser, type UpdateUserRequest,
  type AnnotationTemplate, type InsertTemplate,
  type Experiment, type ExperimentWithPublisher, type InsertExperiment, type UpdateExperimentRequest,
  type TaskBatch, type InsertTaskBatch,
  type Task, type InsertTask,
  type Annotation, type InsertAnnotation,
  type Notification, type InsertNotification,
  type Log, type InsertLog,
  type ApiConnector, type InsertApiConnector, type UpdateApiConnectorRequest,
  type SystemSetting,
  type ExperimentStats,
  type UserGroup, type InsertUserGroup,
  type RoleRequest, type InsertRoleRequest,
} from "@shared/schema";
import { eq, isNull, and, inArray, or, gte, lte, like } from "drizzle-orm";

export interface IStorage {
  // Templates
  getTemplates(): Promise<AnnotationTemplate[]>;
  getTemplate(id: number): Promise<AnnotationTemplate | undefined>;
  createTemplate(t: InsertTemplate): Promise<AnnotationTemplate>;
  updateTemplate(id: number, updates: Partial<InsertTemplate>): Promise<AnnotationTemplate>;
  deleteTemplate(id: number): Promise<void>;

  // Users
  getUsers(): Promise<User[]>;
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: number): Promise<void>;

  // Experiments
  getExperiments(): Promise<ExperimentWithPublisher[]>;
  getExperiment(id: number): Promise<ExperimentWithPublisher | undefined>;
  createExperiment(exp: InsertExperiment): Promise<Experiment>;
  updateExperiment(id: number, updates: UpdateExperimentRequest): Promise<Experiment>;
  softDeleteExperiment(id: number, deletedByUserId: number): Promise<void>;
  getExperimentStats(id: number): Promise<ExperimentStats>;

  // Tasks
  getTasks(experimentId?: number): Promise<Task[]>;
  getTask(id: number): Promise<Task | undefined>;
  getMyTasks(userId: number): Promise<Task[]>;
  getMyReviewTasks(userId: number): Promise<Task[]>;
  getTasksNeedingAdjudication(experimentId: number): Promise<Task[]>;
  createTask(task: InsertTask): Promise<Task>;
  bulkCreateTasks(tasks: InsertTask[]): Promise<number>;
  updateTask(id: number, updates: Partial<InsertTask>): Promise<Task>;
  assignTasksToUser(taskIds: number[], userId: number): Promise<number>;
  assignTasksRandom(experimentId: number, userIds: number[], count?: number): Promise<Record<number, number>>;
  adjudicateTask(taskId: number, finalResult: Record<string, unknown>): Promise<Task>;
  getMyExperiments(userId: number): Promise<{ experiment: Experiment; totalTasks: number; annotatedTasks: number }[]>;
  getExperimentTasksForUser(experimentId: number, userId: number | null): Promise<(Task & { annotation: Annotation | null })[]>;
  resetExperimentAssignments(experimentId: number): Promise<number>;

  // Task Batches
  createTaskBatch(batch: InsertTaskBatch): Promise<TaskBatch>;
  getTaskBatches(filters?: { search?: string; startDate?: Date; endDate?: Date; experimentId?: number }): Promise<TaskBatch[]>;
  getTaskBatch(id: number): Promise<TaskBatch | undefined>;
  getTaskBatchResults(batchId: number): Promise<(Task & { annotation: Annotation | null; annotatorName: string | null })[]>;

  // Annotations
  getAnnotations(): Promise<Annotation[]>;
  getAnnotationByTask(taskId: number): Promise<Annotation | undefined>;
  getAnnotationsByTask(taskId: number): Promise<Annotation[]>;
  createAnnotation(annotation: InsertAnnotation): Promise<Annotation>;
  upsertAnnotation(annotation: InsertAnnotation): Promise<Annotation>;

  // Notifications
  getNotifications(userId: number): Promise<Notification[]>;
  getUnreadCount(userId: number): Promise<number>;
  createNotification(n: InsertNotification): Promise<Notification>;
  markNotificationRead(id: number): Promise<void>;
  markAllNotificationsRead(userId: number): Promise<void>;

  // Logs
  getLogs(): Promise<Log[]>;

  // User Groups
  getUserGroups(): Promise<UserGroup[]>;
  getUserGroup(id: number): Promise<UserGroup | undefined>;
  createUserGroup(group: InsertUserGroup): Promise<UserGroup>;
  updateUserGroup(id: number, data: Partial<InsertUserGroup>): Promise<UserGroup>;
  deleteUserGroup(id: number): Promise<void>;

  // Role Requests
  getRoleRequests(): Promise<RoleRequest[]>;
  getRoleRequestsByUser(userId: number): Promise<RoleRequest[]>;
  createRoleRequest(req: InsertRoleRequest): Promise<RoleRequest>;
  updateRoleRequest(id: number, data: Partial<RoleRequest>): Promise<RoleRequest>;

  // Connectors
  getConnectors(): Promise<ApiConnector[]>;
  getConnector(id: number): Promise<ApiConnector | undefined>;
  createConnector(conn: InsertApiConnector): Promise<ApiConnector>;
  updateConnector(id: number, updates: UpdateApiConnectorRequest): Promise<ApiConnector>;
  deleteConnector(id: number): Promise<void>;

  // System Settings
  getSettings(): Promise<SystemSetting[]>;
  getSetting(key: string): Promise<string | undefined>;
  setSetting(key: string, value: string): Promise<SystemSetting>;
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

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getExperiments(): Promise<ExperimentWithPublisher[]> {
    const rows = await db
      .select({ exp: experiments, publisherName: users.username })
      .from(experiments)
      .leftJoin(users, eq(experiments.createdBy, users.id))
      .where(isNull(experiments.deletedAt));
    return rows.map(r => ({ ...r.exp, publisherName: r.publisherName ?? null }));
  }

  async getExperiment(id: number): Promise<ExperimentWithPublisher | undefined> {
    const [row] = await db
      .select({ exp: experiments, publisherName: users.username })
      .from(experiments)
      .leftJoin(users, eq(experiments.createdBy, users.id))
      .where(and(eq(experiments.id, id), isNull(experiments.deletedAt)));
    if (!row) return undefined;
    return { ...row.exp, publisherName: row.publisherName ?? null };
  }

  async createExperiment(exp: InsertExperiment): Promise<Experiment> {
    const [newExp] = await db.insert(experiments).values(exp).returning();
    return newExp;
  }

  async updateExperiment(id: number, updates: UpdateExperimentRequest): Promise<Experiment> {
    const [updated] = await db.update(experiments).set(updates).where(eq(experiments.id, id)).returning();
    return updated;
  }

  async softDeleteExperiment(id: number, deletedByUserId: number): Promise<void> {
    await db.update(experiments).set({ deletedAt: new Date() }).where(eq(experiments.id, id));
    await db.insert(logs).values({
      userId: deletedByUserId,
      action: "experiment_deleted",
      details: `Soft-deleted experiment #${id}`,
    });
  }

  async getExperimentStats(id: number): Promise<ExperimentStats> {
    const allTasks = await db.select().from(tasks).where(eq(tasks.experimentId, id));
    const totalTasks = allTasks.length;
    const pendingTasks = allTasks.filter(t => t.status === "pending").length;
    const assignedTasks = allTasks.filter(t => t.status === "assigned").length;
    const annotatedTasks = allTasks.filter(t => t.status === "annotated").length;
    const needsReviewTasks = allTasks.filter(t => t.status === "needs_review").length;
    const completedTasks = allTasks.filter(t => t.status === "completed").length;
    const sampleTasks = allTasks.slice(0, 10);

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

    const categoricalDistributions: Record<string, Record<string, number>> = {};
    for (const [key, dist] of Object.entries(fieldDistributions)) {
      if (Object.keys(dist).length <= 15) categoricalDistributions[key] = dist;
    }

    return { totalTasks, pendingTasks, assignedTasks, annotatedTasks, needsReviewTasks, completedTasks, sampleTasks, fieldDistributions: categoricalDistributions };
  }

  async getTasks(experimentId?: number): Promise<Task[]> {
    if (experimentId) return await db.select().from(tasks).where(eq(tasks.experimentId, experimentId));
    return await db.select().from(tasks);
  }

  async getTask(id: number): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  async getMyTasks(userId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(eq(tasks.assignedTo, userId), inArray(tasks.status, ["assigned", "pending", "annotated"]))
    );
  }

  // Tasks assigned for review to this user
  async getMyReviewTasks(userId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(eq(tasks.reviewedBy, userId), eq(tasks.status, "needs_review"))
    );
  }

  // Tasks that are in needs_review for a given experiment (to show in admin view)
  async getTasksNeedingAdjudication(experimentId: number): Promise<Task[]> {
    return await db.select().from(tasks).where(
      and(
        eq(tasks.experimentId, experimentId),
        inArray(tasks.status, ["needs_review", "completed"])
      )
    );
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

  async updateTask(id: number, updates: Partial<InsertTask>): Promise<Task> {
    const [updated] = await db.update(tasks).set(updates as any).where(eq(tasks.id, id)).returning();
    return updated;
  }

  async assignTasksToUser(taskIds: number[], userId: number): Promise<number> {
    if (taskIds.length === 0) return 0;
    await db.update(tasks)
      .set({ assignedTo: userId, assignedAt: new Date(), status: "assigned" } as any)
      .where(inArray(tasks.id, taskIds));
    return taskIds.length;
  }

  async assignTasksRandom(experimentId: number, userIds: number[], count?: number): Promise<Record<number, number>> {
    const unassigned = await db.select().from(tasks).where(
      and(eq(tasks.experimentId, experimentId), isNull(tasks.assignedTo))
    );
    const toAssign = count ? unassigned.slice(0, count) : unassigned;
    const assignedCounts: Record<number, number> = {};
    userIds.forEach(id => (assignedCounts[id] = 0));

    for (let i = 0; i < toAssign.length; i++) {
      const userId = userIds[i % userIds.length];
      await db.update(tasks)
        .set({ assignedTo: userId, assignedAt: new Date(), status: "assigned" } as any)
        .where(eq(tasks.id, toAssign[i].id));
      assignedCounts[userId] = (assignedCounts[userId] || 0) + 1;
    }
    return assignedCounts;
  }

  async adjudicateTask(taskId: number, finalResult: Record<string, unknown>): Promise<Task> {
    const [updated] = await db.update(tasks)
      .set({ finalResult, status: "completed" } as any)
      .where(eq(tasks.id, taskId))
      .returning();
    return updated;
  }

  async getMyExperiments(userId: number): Promise<{ experiment: Experiment; totalTasks: number; annotatedTasks: number }[]> {
    const myTasks = await db.select().from(tasks).where(eq(tasks.assignedTo, userId));
    const expIdSet = new Set(myTasks.map(t => t.experimentId));
    const result = [];
    for (const eid of expIdSet) {
      const exp = await this.getExperiment(eid);
      if (!exp) continue;
      const expTasks = myTasks.filter(t => t.experimentId === eid);
      const annotated = expTasks.filter(t => t.status === "annotated" || t.status === "needs_review" || t.status === "completed").length;
      result.push({ experiment: exp, totalTasks: expTasks.length, annotatedTasks: annotated });
    }
    return result;
  }

  async getExperimentTasksForUser(experimentId: number, userId: number | null): Promise<(Task & { annotation: Annotation | null })[]> {
    const expTasks = userId
      ? await db.select().from(tasks).where(and(eq(tasks.experimentId, experimentId), eq(tasks.assignedTo, userId)))
      : await db.select().from(tasks).where(eq(tasks.experimentId, experimentId));
    const result: (Task & { annotation: Annotation | null })[] = [];
    for (const task of expTasks) {
      const [ann] = await db.select().from(annotations).where(
        and(eq(annotations.taskId, task.id), ...(userId ? [eq(annotations.userId, userId)] : []))
      );
      result.push({ ...task, annotation: ann || null });
    }
    return result;
  }

  async resetExperimentAssignments(experimentId: number): Promise<number> {
    const assignedTasks = await db.select().from(tasks).where(
      and(eq(tasks.experimentId, experimentId), eq(tasks.status, "assigned"))
    );
    if (assignedTasks.length === 0) return 0;
    const ids = assignedTasks.map(t => t.id);
    await db.update(tasks)
      .set({ status: "pending", assignedTo: null, assignedAt: null, batchId: null } as any)
      .where(inArray(tasks.id, ids));
    return ids.length;
  }

  async createTaskBatch(batch: InsertTaskBatch): Promise<TaskBatch> {
    const [created] = await db.insert(taskBatches).values(batch).returning();
    return created;
  }

  async getTaskBatches(filters?: { search?: string; startDate?: Date; endDate?: Date; experimentId?: number }): Promise<TaskBatch[]> {
    let allBatches = await db.select().from(taskBatches).orderBy(taskBatches.createdAt);
    if (filters?.experimentId) {
      allBatches = allBatches.filter(b => b.experimentId === filters.experimentId);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      allBatches = allBatches.filter(b => b.code.toLowerCase().includes(q));
    }
    if (filters?.startDate) {
      allBatches = allBatches.filter(b => b.createdAt && new Date(b.createdAt) >= filters.startDate!);
    }
    if (filters?.endDate) {
      const endOfDay = new Date(filters.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      allBatches = allBatches.filter(b => b.createdAt && new Date(b.createdAt) <= endOfDay);
    }
    return allBatches.reverse();
  }

  async getTaskBatch(id: number): Promise<TaskBatch | undefined> {
    const [batch] = await db.select().from(taskBatches).where(eq(taskBatches.id, id));
    return batch;
  }

  async getTaskBatchResults(batchId: number): Promise<(Task & { annotation: Annotation | null; annotatorName: string | null })[]> {
    const batch = await this.getTaskBatch(batchId);
    if (!batch) return [];
    const taskIdList = batch.taskIds as number[] | null;
    if (!taskIdList || taskIdList.length === 0) return [];
    const batchTasks = await db.select().from(tasks).where(inArray(tasks.id, taskIdList));
    const allUsers = await this.getUsers();
    const result: (Task & { annotation: Annotation | null; annotatorName: string | null })[] = [];
    for (const task of batchTasks) {
      const [ann] = await db.select().from(annotations).where(
        and(eq(annotations.taskId, task.id), eq(annotations.type, "initial"))
      );
      const annotator = task.assignedTo ? allUsers.find(u => u.id === task.assignedTo) : null;
      result.push({ ...task, annotation: ann || null, annotatorName: annotator?.username ?? null });
    }
    return result;
  }

  async getAnnotations(): Promise<Annotation[]> {
    return await db.select().from(annotations);
  }

  async getAnnotationByTask(taskId: number): Promise<Annotation | undefined> {
    // Returns first annotation (initial) for backwards compatibility
    const [ann] = await db.select().from(annotations).where(eq(annotations.taskId, taskId));
    return ann;
  }

  async getAnnotationsByTask(taskId: number): Promise<Annotation[]> {
    return await db.select().from(annotations).where(eq(annotations.taskId, taskId));
  }

  async createAnnotation(annotation: InsertAnnotation): Promise<Annotation> {
    const [newAnn] = await db.insert(annotations).values(annotation).returning();
    return newAnn;
  }

  async upsertAnnotation(annotation: InsertAnnotation): Promise<Annotation> {
    const [existing] = await db.select().from(annotations).where(
      and(eq(annotations.taskId, annotation.taskId), eq(annotations.userId, annotation.userId))
    );
    if (existing) {
      const [updated] = await db.update(annotations)
        .set({ result: annotation.result, type: annotation.type })
        .where(eq(annotations.id, existing.id))
        .returning();
      return updated;
    }
    return this.createAnnotation(annotation);
  }

  async getNotifications(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(eq(notifications.userId, userId));
  }

  async getUnreadCount(userId: number): Promise<number> {
    const rows = await db.select().from(notifications).where(
      and(eq(notifications.userId, userId), eq(notifications.isRead, false))
    );
    return rows.length;
  }

  async createNotification(n: InsertNotification): Promise<Notification> {
    const [newN] = await db.insert(notifications).values(n).returning();
    return newN;
  }

  async markNotificationRead(id: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  }

  async markAllNotificationsRead(userId: number): Promise<void> {
    await db.update(notifications).set({ isRead: true }).where(eq(notifications.userId, userId));
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
    const [updated] = await db.update(apiConnectors).set(updates as any).where(eq(apiConnectors.id, id)).returning();
    return updated;
  }

  async deleteConnector(id: number): Promise<void> {
    await db.delete(apiConnectors).where(eq(apiConnectors.id, id));
  }

  async getTemplates(): Promise<AnnotationTemplate[]> {
    return await db.select().from(annotationTemplates);
  }

  async getTemplate(id: number): Promise<AnnotationTemplate | undefined> {
    const [t] = await db.select().from(annotationTemplates).where(eq(annotationTemplates.id, id));
    return t;
  }

  async createTemplate(t: InsertTemplate): Promise<AnnotationTemplate> {
    const [newT] = await db.insert(annotationTemplates).values(t).returning();
    return newT;
  }

  async updateTemplate(id: number, updates: Partial<InsertTemplate>): Promise<AnnotationTemplate> {
    const [updated] = await db.update(annotationTemplates).set(updates as any).where(eq(annotationTemplates.id, id)).returning();
    return updated;
  }

  async deleteTemplate(id: number): Promise<void> {
    await db.delete(annotationTemplates).where(eq(annotationTemplates.id, id));
  }

  async getSettings(): Promise<SystemSetting[]> {
    return await db.select().from(systemSettings);
  }

  async getSetting(key: string): Promise<string | undefined> {
    const [row] = await db.select().from(systemSettings).where(eq(systemSettings.key, key));
    return row?.value;
  }

  async setSetting(key: string, value: string): Promise<SystemSetting> {
    const existing = await this.getSetting(key);
    if (existing !== undefined) {
      const [updated] = await db.update(systemSettings)
        .set({ value, updatedAt: new Date() })
        .where(eq(systemSettings.key, key))
        .returning();
      return updated;
    }
    const [created] = await db.insert(systemSettings).values({ key, value }).returning();
    return created;
  }

  async getUserGroups(): Promise<UserGroup[]> {
    return await db.select().from(userGroups).orderBy(userGroups.createdAt);
  }

  async getUserGroup(id: number): Promise<UserGroup | undefined> {
    const [g] = await db.select().from(userGroups).where(eq(userGroups.id, id));
    return g;
  }

  async createUserGroup(group: InsertUserGroup): Promise<UserGroup> {
    const [g] = await db.insert(userGroups).values(group).returning();
    return g;
  }

  async updateUserGroup(id: number, data: Partial<InsertUserGroup>): Promise<UserGroup> {
    const [g] = await db.update(userGroups).set(data as any).where(eq(userGroups.id, id)).returning();
    return g;
  }

  async deleteUserGroup(id: number): Promise<void> {
    await db.delete(userGroups).where(eq(userGroups.id, id));
  }

  async getRoleRequests(): Promise<RoleRequest[]> {
    return await db.select().from(roleRequests).orderBy(roleRequests.createdAt);
  }

  async getRoleRequestsByUser(userId: number): Promise<RoleRequest[]> {
    return await db.select().from(roleRequests).where(eq(roleRequests.userId, userId)).orderBy(roleRequests.createdAt);
  }

  async createRoleRequest(req: InsertRoleRequest): Promise<RoleRequest> {
    const [r] = await db.insert(roleRequests).values(req).returning();
    return r;
  }

  async updateRoleRequest(id: number, data: Partial<RoleRequest>): Promise<RoleRequest> {
    const [r] = await db.update(roleRequests).set(data as any).where(eq(roleRequests.id, id)).returning();
    return r;
  }
}

export const storage = new DatabaseStorage();
