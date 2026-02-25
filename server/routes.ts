import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
        if (hoursLeft < 0) continue; // already past

        // Get all tasks for this experiment
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
  // Run hourly
  setInterval(check, 60 * 60 * 1000);
  // Also run at startup after a short delay
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
      const input = api.users.create.input.parse(req.body);
      res.status(201).json(await storage.createUser(input));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
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
      const schema = api.experiments.create.input.extend({
        reviewRatio: z.coerce.number().optional(),
        enableReview: z.boolean().optional(),
      });
      const input = schema.parse(req.body);
      res.status(201).json(await storage.createExperiment(input as any));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.experiments.update.path, async (req, res) => {
    try {
      const input = api.experiments.update.input.parse(req.body);
      res.json(await storage.updateExperiment(Number(req.params.id), input));
    } catch {
      res.status(400).json({ message: "Invalid input" });
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
      res.json({ assigned: count });
    } catch (err) {
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
      res.json({ assigned: total, distribution: result });
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
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
    // also include experiment info
    const exp = task.experimentId ? await storage.getExperiment(task.experimentId) : null;
    const annotation = await storage.getAnnotationByTask(task.id);
    res.json({ ...task, experiment: exp, existingAnnotation: annotation || null });
  });

  // My tasks (for annotators)
  app.get("/api/my-tasks", async (req, res) => {
    try {
      const userId = z.coerce.number().parse(req.query.userId);
      const myTasks = await storage.getMyTasks(userId);
      // Enrich with experiment info
      const expIds = [...new Set(myTasks.map(t => t.experimentId))];
      const expMap: Record<number, any> = {};
      for (const eid of expIds) {
        const exp = await storage.getExperiment(eid);
        if (exp) expMap[eid] = exp;
      }
      const enriched = myTasks.map(t => ({ ...t, experiment: expMap[t.experimentId] || null }));
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

      // Update task status based on type
      if (input.type === "draft") {
        // Keep as assigned, just save draft
      } else {
        await storage.updateTask(input.taskId, { status: "annotated" });
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
      const items = await storage.getNotifications(userId);
      res.json(items);
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
      const buf = req.file.buffer;
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length === 0) return res.status(400).json({ message: "File is empty" });
      res.json({ columns: Object.keys(rows[0]), preview: rows.slice(0, 5), totalRows: rows.length });
    } catch (err) {
      res.status(500).json({ message: "Failed to parse file" });
    }
  });

  app.post(api.import.create.path, async (req, res) => {
    try {
      const { experimentId, rows, mapping } = api.import.create.input.parse(req.body);
      const taskList = rows.map((row) => {
        const originalData: Record<string, unknown> = {};
        for (const [targetField, sourceCol] of Object.entries(mapping)) {
          if (sourceCol && row[sourceCol] !== undefined) originalData[targetField] = row[sourceCol];
        }
        for (const [col, val] of Object.entries(row)) {
          if (!Object.values(mapping).includes(col)) originalData[col] = val;
        }
        return { experimentId, originalData, status: "pending" as const };
      });
      const created = await storage.bulkCreateTasks(taskList);
      res.json({ created });
    } catch (err) {
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

  // --- Seed ---
  try {
    const existingUsers = await storage.getUsers();
    if (existingUsers.length === 0) {
      await storage.createUser({ username: "admin", password: "password123", role: "admin", email: "admin@example.com" });
      const annotator1 = await storage.createUser({ username: "annotator1", password: "password123", role: "annotator", email: "annotator1@example.com" });
      const annotator2 = await storage.createUser({ username: "annotator2", password: "password123", role: "annotator", email: "annotator2@example.com" });
      const exp = await storage.createExperiment({
        name: "Q3 电子产品比价实验",
        description: "对比京东与淘宝平台同款电子产品的价格差异",
        deadline: new Date(Date.now() + 86400000 * 1), // 1 day from now to trigger reminders
        enableReview: true,
        reviewRatio: 20,
        status: "in_progress",
      });
      await storage.bulkCreateTasks([
        { experimentId: exp.id, originalData: { productA_name: "iPhone 15 128GB", productA_price: "6999", productA_source: "京东", productB_name: "Apple iPhone 15 128G", productB_price: "7099", productB_source: "淘宝" }, status: "assigned", assignedTo: annotator1.id, assignedAt: new Date() },
        { experimentId: exp.id, originalData: { productA_name: "小米14 Pro 256GB", productA_price: "4299", productA_source: "京东", productB_name: "Xiaomi 14 Pro 256G", productB_price: "4199", productB_source: "淘宝" }, status: "annotated", assignedTo: annotator1.id, assignedAt: new Date() },
        { experimentId: exp.id, originalData: { productA_name: "华为 Mate60 Pro", productA_price: "6999", productA_source: "京东", productB_name: "HUAWEI Mate 60 Pro", productB_price: "6999", productB_source: "淘宝" }, status: "assigned", assignedTo: annotator2.id, assignedAt: new Date() },
        { experimentId: exp.id, originalData: { productA_name: "三星 Galaxy S24", productA_price: "5999", productA_source: "京东", productB_name: "Samsung Galaxy S24", productB_price: "6099", productB_source: "淘宝" }, status: "pending", assignedTo: null, assignedAt: null },
        { experimentId: exp.id, originalData: { productA_name: "OPPO Find X7", productA_price: "3999", productA_source: "京东", productB_name: "OPPO FindX7", productB_price: "3899", productB_source: "淘宝" }, status: "pending", assignedTo: null, assignedAt: null },
      ]);

      // Seed a welcome notification for annotator1
      await storage.createNotification({
        userId: annotator1.id,
        title: "欢迎加入 LabelFlow",
        message: "你已被分配到「Q3 电子产品比价实验」，请前往「我的任务」开始标注工作。",
        type: "info",
        isRead: false,
        experimentId: exp.id,
      });
    }
  } catch (e) {
    console.error("Seed failed:", e);
  }

  // Start the deadline reminder scheduler
  startDeadlineScheduler();

  return httpServer;
}
