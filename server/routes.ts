import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

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
    const stats = await storage.getExperimentStats(Number(req.params.id));
    res.json(stats);
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

  // --- Tasks ---
  app.get(api.tasks.list.path, async (req, res) => {
    try {
      const query = api.tasks.list.input?.parse(req.query) || {};
      res.json(await storage.getTasks(query.experimentId));
    } catch {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  // --- Annotations ---
  app.get(api.annotations.list.path, async (req, res) => {
    res.json(await storage.getAnnotations());
  });

  // --- Logs ---
  app.get(api.logs.list.path, async (req, res) => {
    res.json(await storage.getLogs());
  });

  // --- Data Import ---
  // Step 1: upload file, parse columns and preview rows
  app.post(api.import.upload.path, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const buf = req.file.buffer;
      const wb = XLSX.read(buf, { type: "buffer" });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) return res.status(400).json({ message: "File is empty" });

      const columns = Object.keys(rows[0]);
      const preview = rows.slice(0, 5);
      res.json({ columns, preview, totalRows: rows.length });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to parse file" });
    }
  });

  // Step 2: apply mapping and create tasks
  app.post(api.import.create.path, async (req, res) => {
    try {
      const { experimentId, rows, mapping } = api.import.create.input.parse(req.body);

      const taskList = rows.map((row) => {
        const originalData: Record<string, unknown> = {};
        for (const [targetField, sourceCol] of Object.entries(mapping)) {
          if (sourceCol && row[sourceCol] !== undefined) {
            originalData[targetField] = row[sourceCol];
          }
        }
        // Also carry all unmapped columns under their original names
        for (const [col, val] of Object.entries(row)) {
          if (!Object.values(mapping).includes(col)) {
            originalData[col] = val;
          }
        }
        return { experimentId, originalData, status: "pending" as const };
      });

      const created = await storage.bulkCreateTasks(taskList);
      res.json({ created });
    } catch (err) {
      console.error(err);
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

  // Manual trigger: fetch from external API and create tasks
  app.post(api.connectors.trigger.path, async (req, res) => {
    try {
      const conn = await storage.getConnector(Number(req.params.id));
      if (!conn) return res.status(404).json({ message: "Connector not found" });

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (conn.authType === "api_key" && conn.authValue) {
        headers["X-API-Key"] = conn.authValue;
      } else if (conn.authType === "bearer" && conn.authValue) {
        headers["Authorization"] = `Bearer ${conn.authValue}`;
      }

      const response = await fetch(conn.url, { headers });
      if (!response.ok) throw new Error(`External API returned ${response.status}`);

      const data = await response.json();
      const rows: Record<string, unknown>[] = Array.isArray(data) ? data : data.data ?? data.items ?? data.results ?? [data];

      const mapping = (conn.fieldMapping || {}) as Record<string, string>;
      const taskList = rows.map((row) => {
        const originalData: Record<string, unknown> = {};
        if (Object.keys(mapping).length > 0) {
          for (const [targetField, sourceField] of Object.entries(mapping)) {
            originalData[targetField] = row[sourceField];
          }
        } else {
          Object.assign(originalData, row);
        }
        return {
          experimentId: conn.experimentId!,
          originalData,
          status: "pending" as const,
        };
      });

      const created = await storage.bulkCreateTasks(taskList);
      await storage.updateConnector(conn.id, { lastFetchedAt: new Date() } as any);

      res.json({ fetched: rows.length, created });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Failed to fetch from external API" });
    }
  });

  // --- Seed ---
  try {
    const existingUsers = await storage.getUsers();
    if (existingUsers.length === 0) {
      await storage.createUser({ username: "admin", password: "password123", role: "admin", email: "admin@example.com" });
      const exp = await storage.createExperiment({
        name: "Q3 电子产品比价实验",
        description: "对比京东与淘宝平台同款电子产品的价格差异",
        deadline: new Date(Date.now() + 86400000 * 7),
        enableReview: true,
        reviewRatio: 20,
        status: "in_progress",
      });
      // Seed a few sample tasks
      await storage.bulkCreateTasks([
        { experimentId: exp.id, originalData: { productA_name: "iPhone 15 128GB", productA_price: "6999", productA_source: "京东", productB_name: "Apple iPhone 15 128G", productB_price: "7099", productB_source: "淘宝" }, status: "pending" },
        { experimentId: exp.id, originalData: { productA_name: "小米14 Pro 256GB", productA_price: "4299", productA_source: "京东", productB_name: "Xiaomi 14 Pro 256G", productB_price: "4199", productB_source: "淘宝" }, status: "annotated" },
        { experimentId: exp.id, originalData: { productA_name: "华为 Mate60 Pro", productA_price: "6999", productA_source: "京东", productB_name: "HUAWEI Mate 60 Pro", productB_price: "6999", productB_source: "淘宝" }, status: "pending" },
      ]);
    }
  } catch (e) {
    console.error("Seed failed:", e);
  }

  return httpServer;
}
