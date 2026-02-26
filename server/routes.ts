import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import archiver from "archiver";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const uploadRowCache = new Map<string, { rows: Record<string, unknown>[]; ts: number }>();
const UPLOAD_TTL = 30 * 60 * 1000;
function cleanUploadCache() {
  const now = Date.now();
  for (const [k, v] of uploadRowCache.entries()) {
    if (now - v.ts > UPLOAD_TTL) uploadRowCache.delete(k);
  }
}

// Trigger review for a task based on experiment settings
async function triggerReviewCheck(taskId: number, experimentId: number) {
  try {
    const exp = await storage.getExperiment(experimentId);
    if (!exp || !exp.enableReview || exp.reviewRatio <= 0) return;

    // Roll the dice: reviewRatio is a percentage (e.g. 30 = 30%)
    const roll = Math.random() * 100;
    if (roll > exp.reviewRatio) return; // not selected

    // Find a reviewer (admin user or any non-annotator)
    const allUsers = await storage.getUsers();
    const reviewers = allUsers.filter(u => u.role === "admin" || u.role === "reviewer");
    if (reviewers.length === 0) return;

    // Round-robin: pick reviewer with fewest pending review tasks
    let selectedReviewer = reviewers[0];
    let minPending = Infinity;
    for (const reviewer of reviewers) {
      const reviewTasks = await storage.getMyReviewTasks(reviewer.id);
      if (reviewTasks.length < minPending) {
        minPending = reviewTasks.length;
        selectedReviewer = reviewer;
      }
    }

    // Update task to needs_review and assign reviewer
    await storage.updateTask(taskId, {
      status: "needs_review",
      reviewedBy: selectedReviewer.id,
    } as any);
  } catch (e) {
    console.error("Review trigger error:", e);
  }
}

// Background scheduler: check deadlines every hour
function startDeadlineScheduler() {
  const check = async () => {
    try {
      const exps = await storage.getExperiments();
      const now = new Date();

      for (const exp of exps) {
        if (exp.status !== "in_progress" || !exp.deadline) continue;

        const deadline = new Date(exp.deadline);
        const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
        if (hoursLeft < 0) continue;

        const expTasks = await storage.getTasks(exp.id);
        const pendingByUser: Record<number, number> = {};
        for (const t of expTasks) {
          if (t.assignedTo && (t.status === "assigned" || t.status === "pending")) {
            pendingByUser[t.assignedTo] = (pendingByUser[t.assignedTo] || 0) + 1;
          }
        }

        for (const [userIdStr, pendingCount] of Object.entries(pendingByUser)) {
          const userId = Number(userIdStr);
          if (hoursLeft <= 1) {
            await storage.createNotification({
              userId,
              title: "紧急提醒：标注截止时间不足1小时",
              message: `实验「${exp.name}」将于 ${deadline.toLocaleString("zh-CN")} 截止，你还有 ${pendingCount} 个任务待完成，请尽快完成！`,
              type: "urgent",
              isRead: false,
              experimentId: exp.id,
            });
          } else if (hoursLeft <= 24) {
            await storage.createNotification({
              userId,
              title: "标注截止提醒：还剩不足24小时",
              message: `实验「${exp.name}」将于明日截止，你还有 ${pendingCount} 个任务待完成，请抓紧时间。`,
              type: "warning",
              isRead: false,
              experimentId: exp.id,
            });
          }
        }
      }
    } catch (e) {
      console.error("Deadline scheduler error:", e);
    }
  };
  setInterval(check, 60 * 60 * 1000);
  setTimeout(check, 10000);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- Auth ---
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(input.username);
      if (!user || user.password !== input.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) return res.status(400).json({ message: err.errors[0].message });
      res.status(500).json({ message: "Server error" });
    }
  });

  // --- Users ---
  app.get(api.users.list.path, async (req, res) => {
    res.json(await storage.getUsers());
  });

  app.post(api.users.create.path, async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(6),
        email: z.string().email().optional().default(""),
        role: z.enum(["admin", "publisher", "annotator"]).default("annotator"),
      });
      const input = schema.parse(req.body);
      const existing = await storage.getUserByUsername(input.username);
      if (existing) return res.status(400).json({ message: "用户名已存在" });
      res.status(201).json(await storage.createUser(input));
    } catch (e: any) {
      if (e?.message) return res.status(400).json({ message: e.message });
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const schema = z.object({
        username: z.string().min(1).optional(),
        password: z.string().min(6).optional(),
        email: z.string().optional(),
        role: z.enum(["admin", "publisher", "annotator"]).optional(),
      });
      const input = schema.parse(req.body);
      const updated = await storage.updateUser(Number(req.params.id), input);
      if (!updated) return res.status(404).json({ message: "User not found" });
      res.json(updated);
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    await storage.deleteUser(Number(req.params.id));
    res.json({ success: true });
  });

  // --- Experiments ---
  app.get(api.experiments.list.path, async (req, res) => {
    res.json(await storage.getExperiments());
  });

  app.get(api.experiments.get.path, async (req, res) => {
    const exp = await storage.getExperiment(Number(req.params.id));
    if (!exp) return res.status(404).json({ message: "Not found" });
    res.json(exp);
  });

  app.get(api.experiments.stats.path, async (req, res) => {
    res.json(await storage.getExperimentStats(Number(req.params.id)));
  });

  app.post(api.experiments.create.path, async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        priority: z.enum(["P1", "P2", "P3"]).optional().default("P2"),
        description: z.string().optional().nullable(),
        deadline: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
        enableReview: z.boolean().optional().default(false),
        reviewRatio: z.coerce.number().min(0).max(100).optional().default(0),
        status: z.string().optional().default("draft"),
        templateId: z.coerce.number().optional().nullable(),
        createdBy: z.coerce.number().optional().nullable(),
      });
      const input = schema.parse(req.body);
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      const rand = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
      const priority = input.priority ?? "P2";
      const autoCode = `EXP-${ymd}-${priority}-${rand}`;
      const created = await storage.createExperiment({ ...input, code: autoCode } as any);
      res.status(201).json(created);
    } catch (e) {
      console.error("Create experiment error:", e);
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.experiments.update.path, async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const current = await storage.getExperiment(expId);
      if (!current) return res.status(404).json({ message: "Not found" });
      // Only allow editing draft experiments
      const { role } = z.object({ role: z.string().optional() }).parse(req.body);
      if (current.status !== "draft" && role !== "admin") {
        return res.status(403).json({ message: "只能修改草稿状态的实验，已发布或归档的实验不可编辑。" });
      }
      const schema = z.object({
        name: z.string().min(1).optional(),
        code: z.string().optional().nullable(),
        priority: z.enum(["P1", "P2", "P3"]).optional(),
        description: z.string().optional().nullable(),
        deadline: z.string().optional().nullable().transform(v => v ? new Date(v) : null),
        enableReview: z.boolean().optional(),
        reviewRatio: z.coerce.number().min(0).max(100).optional(),
        status: z.string().optional(),
        templateId: z.coerce.number().optional().nullable(),
        role: z.string().optional(),
      });
      const input = schema.parse(req.body);
      const { role: _role, ...updateData } = input;
      res.json(await storage.updateExperiment(expId, updateData as any));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Soft delete experiment (admin only)
  app.delete("/api/experiments/:id", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const { adminUserId } = z.object({ adminUserId: z.number() }).parse(req.body);
      const exp = await storage.getExperiment(expId);
      if (!exp) return res.status(404).json({ message: "Not found" });
      await storage.softDeleteExperiment(expId, adminUserId);
      res.json({ success: true });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // --- Templates ---
  app.get("/api/templates", async (req, res) => {
    res.json(await storage.getTemplates());
  });

  app.get("/api/templates/:id", async (req, res) => {
    const t = await storage.getTemplate(Number(req.params.id));
    if (!t) return res.status(404).json({ message: "Template not found" });
    res.json(t);
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1),
        description: z.string().optional().nullable(),
        displayFields: z.array(z.object({ key: z.string(), label: z.string() })),
        annotationFields: z.array(z.object({
          key: z.string(), label: z.string(),
          type: z.enum(["select", "radio", "text"]),
          options: z.array(z.string()).optional(),
          required: z.boolean().optional(),
          isJudgment: z.boolean().optional(),
        })),
        judgmentField: z.string().min(1),
      });
      const input = schema.parse(req.body);
      res.status(201).json(await storage.createTemplate(input as any));
    } catch (e) {
      console.error(e);
      res.status(400).json({ message: "Invalid template" });
    }
  });

  app.put("/api/templates/:id", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        displayFields: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
        annotationFields: z.array(z.object({
          key: z.string(), label: z.string(),
          type: z.enum(["select", "radio", "text"]),
          options: z.array(z.string()).optional(),
          required: z.boolean().optional(),
          isJudgment: z.boolean().optional(),
        })).optional(),
        judgmentField: z.string().optional(),
      });
      const input = schema.parse(req.body);
      res.json(await storage.updateTemplate(Number(req.params.id), input as any));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete("/api/templates/:id", async (req, res) => {
    await storage.deleteTemplate(Number(req.params.id));
    res.json({ success: true });
  });

  // Tasks awaiting adjudication (has both initial + review annotations)
  app.get("/api/experiments/:id/review-queue", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const reviewTasks = await storage.getTasksNeedingAdjudication(expId);
      const enriched = await Promise.all(reviewTasks.map(async (t) => {
        const anns = await storage.getAnnotationsByTask(t.id);
        const initialAnn = anns.find(a => a.type === "initial");
        const reviewAnn = anns.find(a => a.type === "review");
        const allUsers = await storage.getUsers();
        const annotatorUser = t.assignedTo ? allUsers.find(u => u.id === t.assignedTo) : null;
        const reviewerUser = t.reviewedBy ? allUsers.find(u => u.id === t.reviewedBy) : null;
        return {
          ...t,
          initialAnnotation: initialAnn || null,
          reviewAnnotation: reviewAnn || null,
          annotatorUser: annotatorUser || null,
          reviewerUser: reviewerUser || null,
          hasConflict: initialAnn && reviewAnn ? detectConflict(
            initialAnn.result as Record<string, unknown>,
            reviewAnn.result as Record<string, unknown>
          ) : false,
        };
      }));
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load review queue" });
    }
  });

  // Task assignment: manual
  app.post("/api/experiments/:id/assign", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const { userId, taskIds } = z.object({
        userId: z.number(),
        taskIds: z.array(z.number()),
      }).parse(req.body);
      const count = await storage.assignTasksToUser(taskIds, userId);
      // Create batch record
      const exp = await storage.getExperiment(expId);
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
      const reviewFlag = exp?.enableReview ? "R" : "N";
      const batchCode = `${ymd}-${count}T-1U-M-${reviewFlag}`;
      const batch = await storage.createTaskBatch({
        code: batchCode,
        experimentId: expId,
        taskCount: count,
        userCount: 1,
        assignType: "manual",
        reviewEnabled: exp?.enableReview ?? false,
        taskIds: taskIds as any,
        assignedUserIds: [userId] as any,
      });
      // Update tasks with batchId
      for (const tid of taskIds) {
        await storage.updateTask(tid, { batchId: batch.id } as any);
      }
      // Notify annotator
      const deadlineStr = exp?.deadline ? `截止时间：${new Date(exp.deadline).toLocaleString("zh-CN")}` : "（无截止时间）";
      await storage.createNotification({
        userId,
        title: "你有新的标注任务",
        message: `实验「${exp?.name ?? expId}」已为你分配了 ${count} 条标注数据，${deadlineStr}，请前往【我的任务】开始标注。`,
        type: "info",
        isRead: false,
        experimentId: expId,
      });
      res.json({ assigned: count, batch });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Task assignment: random
  app.post("/api/experiments/:id/assign-random", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const { userIds, count } = z.object({
        userIds: z.array(z.number()),
        count: z.number().optional(),
      }).parse(req.body);
      const result = await storage.assignTasksRandom(expId, userIds, count);
      const total = Object.values(result).reduce((a, b) => a + b, 0);
      // Create batch record
      const exp = await storage.getExperiment(expId);
      const now = new Date();
      const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}`;
      const reviewFlag = exp?.enableReview ? "R" : "N";
      const batchCode = `${ymd}-${total}T-${userIds.length}U-A-${reviewFlag}`;
      const allExpTasks = await storage.getTasks(expId);
      const assignedTaskIds = allExpTasks
        .filter(t => t.assignedTo && userIds.includes(t.assignedTo) && t.status === "assigned")
        .map(t => t.id);
      const recentBatchIds = assignedTaskIds.slice(-total);
      const batch = await storage.createTaskBatch({
        code: batchCode,
        experimentId: expId,
        taskCount: total,
        userCount: userIds.length,
        assignType: "auto",
        reviewEnabled: exp?.enableReview ?? false,
        taskIds: recentBatchIds as any,
        assignedUserIds: userIds as any,
      });
      // Update tasks with batchId
      for (const tid of recentBatchIds) {
        await storage.updateTask(tid, { batchId: batch.id } as any);
      }
      // Notify each annotator
      const deadlineStr2 = exp?.deadline ? `截止时间：${new Date(exp.deadline).toLocaleString("zh-CN")}` : "（无截止时间）";
      for (const uid of userIds) {
        const userCount = result[uid] ?? 0;
        if (userCount > 0) {
          await storage.createNotification({
            userId: uid,
            title: "你有新的标注任务",
            message: `实验「${exp?.name ?? expId}」已为你分配了 ${userCount} 条标注数据，${deadlineStr2}，请前往【我的任务】开始标注。`,
            type: "info",
            isRead: false,
            experimentId: expId,
          });
        }
      }
      res.json({ assigned: total, distribution: result, batch });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Confirm-submit: annotator confirms all their annotated tasks in an experiment
  app.post("/api/experiments/:id/confirm-submit", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const { userId } = z.object({ userId: z.number() }).parse(req.body);
      const tasks = await storage.getTasks(expId);
      const toComplete = tasks.filter(t => t.assignedTo === userId && t.status === "annotated");
      for (const t of toComplete) {
        await storage.updateTask(t.id, { status: "completed" } as any);
      }
      res.json({ confirmed: toComplete.length });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Reset assignments for an experiment
  app.post("/api/experiments/:id/reset-assignments", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const count = await storage.resetExperimentAssignments(expId);
      res.json({ reset: count });
    } catch {
      res.status(500).json({ message: "Reset failed" });
    }
  });

  // Task batches list
  app.get("/api/task-batches", async (req, res) => {
    try {
      const { search, startDate, endDate, experimentId } = z.object({
        search: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        experimentId: z.coerce.number().optional(),
      }).parse(req.query);
      const batches = await storage.getTaskBatches({
        search,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        experimentId,
      });
      // Enrich with experiment info
      const enriched = await Promise.all(batches.map(async (b) => {
        const exp = await storage.getExperiment(b.experimentId);
        return { ...b, experiment: exp ?? null };
      }));
      res.json(enriched);
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // Task batch results
  app.get("/api/task-batches/:id/results", async (req, res) => {
    try {
      const batchId = Number(req.params.id);
      const batch = await storage.getTaskBatch(batchId);
      if (!batch) return res.status(404).json({ message: "Batch not found" });
      const exp = await storage.getExperiment(batch.experimentId);
      const template = exp?.templateId ? await storage.getTemplate(exp.templateId) : null;
      const taskResults = await storage.getTaskBatchResults(batchId);
      res.json({ batch, experiment: exp ?? null, template, tasks: taskResults });
    } catch {
      res.status(500).json({ message: "Failed to load batch results" });
    }
  });

  // --- Tasks ---
  app.get(api.tasks.list.path, async (req, res) => {
    try {
      const query = api.tasks.list.input?.parse(req.query) || {};
      res.json(await storage.getTasks(query.experimentId));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/tasks/:id", async (req, res) => {
    const task = await storage.getTask(Number(req.params.id));
    if (!task) return res.status(404).json({ message: "Task not found" });
    const exp = task.experimentId ? await storage.getExperiment(task.experimentId) : null;
    const template = exp?.templateId ? await storage.getTemplate(exp.templateId) : null;
    const allAnnotations = await storage.getAnnotationsByTask(task.id);
    const initialAnnotation = allAnnotations.find(a => a.type === "initial") || null;
    const reviewAnnotation = allAnnotations.find(a => a.type === "review") || null;
    const existingAnnotation = allAnnotations[0] || null;
    res.json({ ...task, experiment: exp, template, existingAnnotation, initialAnnotation, reviewAnnotation, allAnnotations });
  });

  // Adjudicate a task (admin final decision)
  app.post("/api/tasks/:id/adjudicate", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const { finalResult } = z.object({
        finalResult: z.record(z.any()),
      }).parse(req.body);
      const updated = await storage.adjudicateTask(taskId, finalResult);
      res.json(updated);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: "Failed to adjudicate" });
    }
  });

  // My tasks (for annotators)
  app.get("/api/my-tasks", async (req, res) => {
    try {
      const showAll = req.query.all === "true";
      const myTasks = showAll
        ? await storage.getTasks()
        : await storage.getMyTasks(z.coerce.number().parse(req.query.userId));
      const expIds = Array.from(new Set(myTasks.map(t => t.experimentId)));
      const expMap: Record<number, any> = {};
      const templateMap: Record<number, any> = {};
      for (const eid of expIds) {
        const exp = await storage.getExperiment(eid);
        if (exp) {
          expMap[eid] = exp;
          if (exp.templateId && !templateMap[exp.templateId]) {
            const tmpl = await storage.getTemplate(exp.templateId);
            if (tmpl) templateMap[exp.templateId] = tmpl;
          }
        }
      }
      const enriched = myTasks.map(t => {
        const exp = expMap[t.experimentId] || null;
        const template = exp?.templateId ? (templateMap[exp.templateId] || null) : null;
        return { ...t, experiment: exp, template };
      });
      res.json(enriched);
    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // My experiments (experiment-level view for annotators/admin)
  app.get("/api/my-experiments", async (req, res) => {
    try {
      if (req.query.all === "true") {
        const exps = await storage.getExperiments();
        const result = await Promise.all(exps.map(async (exp) => {
          const expTasks = await storage.getTasks(exp.id);
          const annotated = expTasks.filter(t => ["annotated","needs_review","completed"].includes(t.status)).length;
          const template = exp.templateId ? await storage.getTemplate(exp.templateId) : null;
          return { experiment: exp, template, totalTasks: expTasks.length, annotatedTasks: annotated };
        }));
        return res.json(result.filter(r => r.totalTasks > 0));
      }
      const userId = z.coerce.number().parse(req.query.userId);
      const items = await storage.getMyExperiments(userId);
      const result = await Promise.all(items.map(async (item) => {
        const template = item.experiment.templateId ? await storage.getTemplate(item.experiment.templateId) : null;
        return { ...item, template };
      }));
      const PRIORITY_ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
      result.sort((a, b) => (PRIORITY_ORDER[a.experiment.priority ?? "P2"] ?? 1) - (PRIORITY_ORDER[b.experiment.priority ?? "P2"] ?? 1));
      res.json(result);
    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Tasks for a specific experiment (table view for annotator)
  app.get("/api/experiments/:id/tasks-for-user", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const userId = req.query.all === "true" ? null : z.coerce.number().parse(req.query.userId);
      const expTasks = await storage.getExperimentTasksForUser(expId, userId);
      const exp = await storage.getExperiment(expId);
      const template = exp?.templateId ? await storage.getTemplate(exp.templateId) : null;
      res.json({ tasks: expTasks, experiment: exp, template });
    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Inline annotation (for table view)
  app.post("/api/tasks/:id/annotate-inline", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const { userId, result } = z.object({
        userId: z.number(),
        result: z.record(z.any()),
      }).parse(req.body);
      const annotation = await storage.upsertAnnotation({ taskId, userId, result, type: "initial" });
      await storage.updateTask(taskId, { status: "annotated" });
      await triggerReviewCheck(taskId, (await storage.getTask(taskId))?.experimentId ?? 0);
      res.json({ annotation });
    } catch {
      res.status(400).json({ message: "Invalid request" });
    }
  });

  // Review tasks (for reviewers/admins)
  app.get("/api/review-tasks", async (req, res) => {
    try {
      const userId = z.coerce.number().parse(req.query.userId);
      const reviewTasks = await storage.getMyReviewTasks(userId);
      const expIds = Array.from(new Set(reviewTasks.map(t => t.experimentId)));
      const expMap: Record<number, any> = {};
      for (const eid of expIds) {
        const exp = await storage.getExperiment(eid);
        if (exp) expMap[eid] = exp;
      }
      // Enrich each task with its initial annotation
      const enriched = await Promise.all(reviewTasks.map(async (t) => {
        const anns = await storage.getAnnotationsByTask(t.id);
        const initialAnn = anns.find(a => a.type === "initial") || null;
        return { ...t, experiment: expMap[t.experimentId] || null, initialAnnotation: initialAnn };
      }));
      res.json(enriched);
    } catch {
      res.status(400).json({ message: "Invalid userId" });
    }
  });

  // --- Annotations ---
  app.get(api.annotations.list.path, async (req, res) => {
    res.json(await storage.getAnnotations());
  });

  app.post("/api/annotations", async (req, res) => {
    try {
      const input = z.object({
        taskId: z.number(),
        userId: z.number(),
        result: z.record(z.any()),
        type: z.enum(["initial", "review", "draft"]).default("initial"),
      }).parse(req.body);

      const annotation = await storage.upsertAnnotation(input);

      if (input.type === "draft") {
        // Keep status as-is, just save draft
      } else if (input.type === "review") {
        // Reviewer submitted: keep status as needs_review (admin adjudicates later)
        // No status change needed
      } else {
        // Initial annotation: mark as annotated and check for review
        const task = await storage.getTask(input.taskId);
        if (task) {
          await storage.updateTask(input.taskId, { status: "annotated" });
          // Trigger review check after updating status
          await triggerReviewCheck(input.taskId, task.experimentId);
        }
      }

      res.status(201).json(annotation);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: "Failed to save annotation" });
    }
  });

  // --- Notifications ---
  app.get("/api/notifications", async (req, res) => {
    try {
      const userId = z.coerce.number().parse(req.query.userId);
      res.json(await storage.getNotifications(userId));
    } catch {
      res.status(400).json({ message: "Invalid userId" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const userId = z.coerce.number().parse(req.query.userId);
      const count = await storage.getUnreadCount(userId);
      res.json({ count });
    } catch {
      res.status(400).json({ message: "Invalid userId" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    await storage.markNotificationRead(Number(req.params.id));
    res.json({ ok: true });
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const userId = z.coerce.number().parse(req.body.userId);
      await storage.markAllNotificationsRead(userId);
      res.json({ ok: true });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // --- Logs ---
  app.get(api.logs.list.path, async (req, res) => {
    res.json(await storage.getLogs());
  });

  // --- Data Import ---
  app.post(api.import.upload.path, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });
      const wb = XLSX.read(req.file.buffer, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length === 0) return res.status(400).json({ message: "File is empty" });
      const uploadId = randomUUID();
      uploadRowCache.set(uploadId, { rows, ts: Date.now() });
      cleanUploadCache();
      res.json({ columns: Object.keys(rows[0]), preview: rows.slice(0, 5), totalRows: rows.length, uploadId });
    } catch {
      res.status(500).json({ message: "Failed to parse file" });
    }
  });

  app.post(api.import.create.path, async (req, res) => {
    try {
      const body = z.object({
        experimentId: z.number(),
        uploadId: z.string(),
        mapping: z.record(z.string()),
      }).parse(req.body);
      const cached = uploadRowCache.get(body.uploadId);
      if (!cached) return res.status(400).json({ message: "上传已过期，请重新上传文件" });
      const rows = cached.rows;
      const mapping = body.mapping;
      const taskList = rows.map((row) => {
        const originalData: Record<string, unknown> = {};
        for (const [targetField, sourceCol] of Object.entries(mapping)) {
          if (sourceCol && row[sourceCol] !== undefined) originalData[targetField] = row[sourceCol];
        }
        for (const [col, val] of Object.entries(row)) {
          if (!Object.values(mapping).includes(col)) originalData[col] = val;
        }
        return { experimentId: body.experimentId, originalData, status: "pending" as const };
      });
      const created = await storage.bulkCreateTasks(taskList);
      uploadRowCache.delete(body.uploadId);
      res.json({ created });
    } catch (e) {
      res.status(400).json({ message: "Failed to create tasks" });
    }
  });

  // --- API Connectors ---
  app.get(api.connectors.list.path, async (req, res) => {
    res.json(await storage.getConnectors());
  });

  app.post(api.connectors.create.path, async (req, res) => {
    try {
      const input = api.connectors.create.input.parse(req.body);
      res.status(201).json(await storage.createConnector(input as any));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.connectors.update.path, async (req, res) => {
    try {
      const input = api.connectors.update.input.parse(req.body);
      res.json(await storage.updateConnector(Number(req.params.id), input));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.delete(api.connectors.delete.path, async (req, res) => {
    await storage.deleteConnector(Number(req.params.id));
    res.status(204).end();
  });

  app.post(api.connectors.trigger.path, async (req, res) => {
    try {
      const conn = await storage.getConnector(Number(req.params.id));
      if (!conn) return res.status(404).json({ message: "Connector not found" });
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (conn.authType === "api_key" && conn.authValue) headers["X-API-Key"] = conn.authValue;
      else if (conn.authType === "bearer" && conn.authValue) headers["Authorization"] = `Bearer ${conn.authValue}`;
      const response = await fetch(conn.url, { headers });
      if (!response.ok) throw new Error(`External API returned ${response.status}`);
      const data = await response.json();
      const rows: Record<string, unknown>[] = Array.isArray(data) ? data : data.data ?? data.items ?? data.results ?? [data];
      const mapping = (conn.fieldMapping || {}) as Record<string, string>;
      const taskList = rows.map((row) => {
        const originalData: Record<string, unknown> = {};
        if (Object.keys(mapping).length > 0) {
          for (const [targetField, sourceField] of Object.entries(mapping)) originalData[targetField] = row[sourceField];
        } else {
          Object.assign(originalData, row);
        }
        return { experimentId: conn.experimentId!, originalData, status: "pending" as const };
      });
      const created = await storage.bulkCreateTasks(taskList);
      await storage.updateConnector(conn.id, { lastFetchedAt: new Date() } as any);
      res.json({ fetched: rows.length, created });
    } catch (err: any) {
      res.status(500).json({ message: err.message || "Failed to fetch from external API" });
    }
  });

  // --- Stats Overview ---
  app.get("/api/stats/overview", async (req, res) => {
    try {
      const [allExperiments, allTasks, allAnnotations, allUsers] = await Promise.all([
        storage.getExperiments(),
        storage.getTasks(),
        storage.getAnnotations(),
        storage.getUsers(),
      ]);

      const now = Date.now();
      const dayMs = 86400000;
      const weekMs = 7 * dayMs;

      // Filters
      const dateFrom = req.query.dateFrom ? new Date(req.query.dateFrom as string) : new Date(now - 30 * dayMs);
      const dateTo = req.query.dateTo ? new Date(req.query.dateTo as string) : new Date(now + dayMs);
      const annotatorId = req.query.annotatorId ? Number(req.query.annotatorId) : null;
      const expSearch = req.query.experimentCode ? String(req.query.experimentCode).toLowerCase() : null;
      const selfOnly = req.query.selfOnly === "true" ? Number(req.query.selfOnly === "true" ? req.query.userId : null) : null;
      const userId = req.query.userId ? Number(req.query.userId) : null;

      // Filter experiments by date range and code search
      const filteredExperiments = allExperiments.filter(exp => {
        const created = new Date(exp.createdAt!);
        if (created < dateFrom || created > dateTo) return false;
        if (expSearch && !exp.name.toLowerCase().includes(expSearch) && !(exp.code || "").toLowerCase().includes(expSearch)) return false;
        return true;
      });
      const filteredExpIds = new Set(filteredExperiments.map(e => e.id));

      // Filter tasks to those in filtered experiments
      const filteredTasks = allTasks.filter(t => filteredExpIds.has(t.experimentId));
      const filteredTaskIds = new Set(filteredTasks.map(t => t.id));

      // Filter annotations to those in filtered tasks
      const filteredAnnotations = allAnnotations.filter(a => filteredTaskIds.has(a.taskId));

      const experimentProgress = filteredExperiments.map(exp => {
        const expTasks = filteredTasks.filter(t => t.experimentId === exp.id);
        const total = expTasks.length;
        const done = expTasks.filter(t => ["annotated", "needs_review", "completed"].includes(t.status)).length;
        return { id: exp.id, name: exp.name, status: exp.status, total, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 };
      });

      const initialAnnotations = filteredAnnotations.filter(a => a.type === "initial");

      // Filter annotators
      let annotatorPool = allUsers.filter(u => u.role === "annotator");
      if (annotatorId) annotatorPool = annotatorPool.filter(u => u.id === annotatorId);
      if (userId && req.query.selfOnly === "true") annotatorPool = annotatorPool.filter(u => u.id === userId);

      const userEfficiency = annotatorPool.map(user => {
        const userAnns = initialAnnotations.filter(a => a.userId === user.id);
        const sorted = [...userAnns].sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
        const daysActive = sorted[0] ? Math.max(1, Math.ceil((now - new Date(sorted[0].createdAt!).getTime()) / dayMs)) : 1;
        const lastWeek = userAnns.filter(a => (now - new Date(a.createdAt!).getTime()) < weekMs).length;
        return {
          userId: user.id, username: user.username,
          totalAnnotated: userAnns.length,
          perDay: Number((userAnns.length / daysActive).toFixed(1)),
          perWeek: lastWeek,
        };
      });

      const reviewedTaskIds = Array.from(new Set(filteredAnnotations.filter(a => a.type === "review").map(a => a.taskId)));
      const accuracyByUser: Record<number, { total: number; matched: number }> = {};
      for (const taskId of reviewedTaskIds) {
        const taskAnns = filteredAnnotations.filter(a => a.taskId === taskId);
        const initialAnn = taskAnns.find(a => a.type === "initial");
        const reviewAnn = taskAnns.find(a => a.type === "review");
        if (!initialAnn || !reviewAnn) continue;
        if (annotatorId && initialAnn.userId !== annotatorId) continue;
        if (userId && req.query.selfOnly === "true" && initialAnn.userId !== userId) continue;
        const uid = initialAnn.userId;
        if (!accuracyByUser[uid]) accuracyByUser[uid] = { total: 0, matched: 0 };
        accuracyByUser[uid].total++;
        if (!detectConflict(initialAnn.result as Record<string, unknown>, reviewAnn.result as Record<string, unknown>)) {
          accuracyByUser[uid].matched++;
        }
      }
      const accuracyStats = Object.entries(accuracyByUser).map(([uid, s]) => {
        const user = allUsers.find(u => u.id === Number(uid));
        return {
          userId: Number(uid), username: user?.username || "未知",
          totalReviewed: s.total, matched: s.matched,
          accuracy: s.total > 0 ? Math.round((s.matched / s.total) * 100) : 0,
        };
      }).sort((a, b) => b.accuracy - a.accuracy);

      res.json({ experimentProgress, userEfficiency, accuracyStats });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to load stats" });
    }
  });

  // --- User Groups ---
  app.get("/api/user-groups", async (_req, res) => {
    try {
      const groups = await storage.getUserGroups();
      res.json(groups);
    } catch (err) {
      res.status(500).json({ message: "Failed to load user groups" });
    }
  });

  app.post("/api/user-groups", async (req, res) => {
    try {
      const { name, description, userIds } = req.body;
      if (!name) return res.status(400).json({ message: "Name required" });
      const group = await storage.createUserGroup({ name, description, userIds: userIds || [] });
      res.json(group);
    } catch (err) {
      res.status(500).json({ message: "Failed to create user group" });
    }
  });

  app.put("/api/user-groups/:id", async (req, res) => {
    try {
      const { name, description, userIds } = req.body;
      const group = await storage.updateUserGroup(Number(req.params.id), { name, description, userIds });
      res.json(group);
    } catch (err) {
      res.status(500).json({ message: "Failed to update user group" });
    }
  });

  app.delete("/api/user-groups/:id", async (req, res) => {
    try {
      await storage.deleteUserGroup(Number(req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ message: "Failed to delete user group" });
    }
  });

  // --- Role Requests ---
  app.get("/api/role-requests", async (req, res) => {
    try {
      const userId = req.query.userId ? Number(req.query.userId) : null;
      const requests = userId ? await storage.getRoleRequestsByUser(userId) : await storage.getRoleRequests();
      const allUsers = await storage.getUsers();
      const userMap: Record<number, string> = {};
      allUsers.forEach(u => (userMap[u.id] = u.username));
      const enriched = requests.map(r => ({ ...r, username: userMap[r.userId] || "未知" }));
      res.json(enriched);
    } catch (err) {
      res.status(500).json({ message: "Failed to load role requests" });
    }
  });

  app.post("/api/role-requests", async (req, res) => {
    try {
      const { userId, requestedRole, reason } = req.body;
      if (!userId || !requestedRole) return res.status(400).json({ message: "userId and requestedRole required" });
      // Check if user already has a pending request
      const existing = await storage.getRoleRequestsByUser(userId);
      const pending = existing.find(r => r.status === "pending");
      if (pending) return res.status(400).json({ message: "已有待审核的权限申请" });
      const request = await storage.createRoleRequest({ userId, requestedRole, reason, status: "pending", reviewedBy: null, reviewedAt: null } as any);
      res.json(request);
    } catch (err) {
      res.status(500).json({ message: "Failed to create role request" });
    }
  });

  app.put("/api/role-requests/:id", async (req, res) => {
    try {
      const { status, reviewedBy } = req.body;
      if (!["approved", "rejected"].includes(status)) return res.status(400).json({ message: "Invalid status" });
      const request = await storage.getRoleRequests().then(rs => rs.find(r => r.id === Number(req.params.id)));
      if (!request) return res.status(404).json({ message: "Request not found" });
      const updated = await storage.updateRoleRequest(Number(req.params.id), {
        status, reviewedBy, reviewedAt: new Date(),
      } as any);
      // If approved, update user role
      if (status === "approved") {
        await storage.updateUser(request.userId, { role: request.requestedRole } as any);
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to update role request" });
    }
  });

  // --- Assign reviewer to task ---
  app.put("/api/tasks/:id/reviewer", async (req, res) => {
    try {
      const taskId = Number(req.params.id);
      const { reviewedBy } = req.body;
      const updated = await storage.updateTask(taskId, { reviewedBy } as any);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to assign reviewer" });
    }
  });

  // --- System Settings ---
  app.get("/api/settings", async (req, res) => {
    try {
      const rows = await storage.getSettings();
      const masked = rows.map(r => ({
        key: r.key,
        value: r.key.toLowerCase().includes("key") || r.key.toLowerCase().includes("secret") ? "••••••••" : r.value,
        hasValue: Boolean(r.value),
      }));
      res.json(masked);
    } catch (err) {
      res.status(500).json({ message: "Failed to load settings" });
    }
  });

  app.put("/api/settings/:key", async (req, res) => {
    try {
      const { value } = z.object({ value: z.string() }).parse(req.body);
      const setting = await storage.setSetting(req.params.key, value);
      res.json({ key: setting.key, hasValue: Boolean(setting.value) });
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get("/api/settings/shufang-status", async (req, res) => {
    const apiUrl = await storage.getSetting("shufang_api_url");
    const apiKey = await storage.getSetting("shufang_api_key");
    res.json({ configured: Boolean(apiUrl && apiKey), hasUrl: Boolean(apiUrl), hasKey: Boolean(apiKey) });
  });

  // --- Archive Experiment ---
  app.post("/api/experiments/:id/archive", async (req, res) => {
    try {
      const expId = Number(req.params.id);
      const [exp, expTasks, allAnnotations, allUsers] = await Promise.all([
        storage.getExperiment(expId),
        storage.getTasks(expId),
        storage.getAnnotations(),
        storage.getUsers(),
      ]);
      if (!exp) return res.status(404).json({ message: "Experiment not found" });

      const taskIds = new Set(expTasks.map(t => t.id));
      const expAnnotations = allAnnotations.filter(a => taskIds.has(a.taskId));

      const userMap: Record<number, string> = {};
      allUsers.forEach(u => (userMap[u.id] = u.username));

      const toCSV = (rows: Record<string, unknown>[]): string => {
        if (rows.length === 0) return "";
        const keys = Object.keys(rows[0]);
        const header = keys.join(",");
        const lines = rows.map(row =>
          keys.map(k => {
            const v = row[k];
            const str = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
            return `"${str.replace(/"/g, '""')}"`;
          }).join(",")
        );
        return [header, ...lines].join("\n");
      };

      const tasksRows = expTasks.map(t => ({
        id: t.id, experimentId: t.experimentId, status: t.status,
        assignedTo: t.assignedTo ? userMap[t.assignedTo] || t.assignedTo : "",
        reviewedBy: t.reviewedBy ? userMap[t.reviewedBy] || t.reviewedBy : "",
        originalData: JSON.stringify(t.originalData),
        finalResult: t.finalResult ? JSON.stringify(t.finalResult) : "",
        createdAt: t.createdAt,
      }));
      const annotationsRows = expAnnotations.map(a => ({
        id: a.id, taskId: a.taskId,
        userId: userMap[a.userId] || a.userId,
        type: a.type, result: JSON.stringify(a.result), createdAt: a.createdAt,
      }));

      const zipChunks: Buffer[] = [];
      const arc = archiver("zip", { zlib: { level: 9 } });
      arc.on("data", (chunk: Buffer) => zipChunks.push(chunk));
      const zipReady = new Promise<Buffer>((resolve, reject) => {
        arc.on("end", () => resolve(Buffer.concat(zipChunks)));
        arc.on("error", reject);
      });

      arc.append(Buffer.from(JSON.stringify(exp, null, 2), "utf8"), { name: "experiment.json" });
      arc.append(Buffer.from(toCSV(tasksRows as any), "utf8"), { name: "tasks.csv" });
      arc.append(Buffer.from(toCSV(annotationsRows as any), "utf8"), { name: "annotations.csv" });
      arc.finalize();
      const zipBuffer = await zipReady;

      await storage.updateExperiment(expId, { status: "archived" } as any);

      let shufangStatus = "not_configured";
      const shufangUrl = await storage.getSetting("shufang_api_url");
      const shufangKey = await storage.getSetting("shufang_api_key");
      if (shufangUrl && shufangKey) {
        try {
          const uploadRes = await fetch(shufangUrl, {
            method: "POST",
            headers: {
              "X-API-Key": shufangKey,
              "Content-Type": "application/zip",
              "X-Experiment-Id": String(expId),
              "X-Experiment-Name": exp.name,
              "X-Filename": `experiment_${expId}.zip`,
            },
            body: zipBuffer,
          });
          shufangStatus = uploadRes.ok ? "success" : `error_${uploadRes.status}`;
        } catch (e: any) {
          shufangStatus = `upload_error: ${e.message}`;
        }
      }

      res.set({
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="experiment_${expId}_${Date.now()}.zip"`,
        "X-Shufang-Status": shufangStatus,
        "Access-Control-Expose-Headers": "X-Shufang-Status",
      });
      res.send(zipBuffer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Archive failed" });
    }
  });

  // --- Seed ---
  try {
    const existingUsers = await storage.getUsers();
    if (existingUsers.length === 0) {
      await storage.createUser({ username: "admin", password: "password123", role: "admin", email: "admin@example.com" });
      const a1 = await storage.createUser({ username: "annotator1", password: "password123", role: "annotator", email: "annotator1@example.com" });
      const a2 = await storage.createUser({ username: "annotator2", password: "password123", role: "annotator", email: "annotator2@example.com" });
      const exp = await storage.createExperiment({
        name: "Q3 电子产品比价实验",
        description: "对比京东与淘宝平台同款电子产品的价格差异",
        deadline: new Date(Date.now() + 86400000 * 7),
        enableReview: true,
        reviewRatio: 30,
        status: "in_progress",
      });
      await storage.bulkCreateTasks([
        { experimentId: exp.id, originalData: { productA_name: "iPhone 15 128GB", productA_price: "6999", productA_source: "京东", productB_name: "Apple iPhone 15 128G", productB_price: "7099", productB_source: "淘宝" }, status: "assigned", assignedTo: a1.id, assignedAt: new Date() },
        { experimentId: exp.id, originalData: { productA_name: "小米14 Pro 256GB", productA_price: "4299", productA_source: "京东", productB_name: "Xiaomi 14 Pro 256G", productB_price: "4199", productB_source: "淘宝" }, status: "annotated", assignedTo: a1.id, assignedAt: new Date() },
        { experimentId: exp.id, originalData: { productA_name: "华为 Mate60 Pro", productA_price: "6999", productA_source: "京东", productB_name: "HUAWEI Mate 60 Pro", productB_price: "6999", productB_source: "淘宝" }, status: "assigned", assignedTo: a2.id, assignedAt: new Date() },
        { experimentId: exp.id, originalData: { productA_name: "三星 Galaxy S24", productA_price: "5999", productA_source: "京东", productB_name: "Samsung Galaxy S24", productB_price: "6099", productB_source: "淘宝" }, status: "pending" },
        { experimentId: exp.id, originalData: { productA_name: "OPPO Find X7", productA_price: "3999", productA_source: "京东", productB_name: "OPPO FindX7", productB_price: "3899", productB_source: "淘宝" }, status: "pending" },
      ]);
    }
  } catch (e) {
    console.error("Seed failed:", e);
  }

  startDeadlineScheduler();
  return httpServer;
}

// Helper: detect conflicts between two annotation results
function detectConflict(r1: Record<string, unknown>, r2: Record<string, unknown>): boolean {
  const keyFields = ["is_same_product", "price_comparison", "quality_comparison"];
  return keyFields.some(k => r1[k] !== undefined && r2[k] !== undefined && r1[k] !== r2[k]);
}
