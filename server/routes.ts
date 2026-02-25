import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  app.post(api.auth.login.path, async (req, res) => {
    try {
      const input = api.auth.login.input.parse(req.body);
      const user = await storage.getUserByUsername(input.username);
      
      // Basic mock validation for MVP. In production, use hashing.
      if (!user || user.password !== input.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      res.json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.get(api.users.list.path, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.post(api.users.create.path, async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const user = await storage.createUser(input);
      res.status(201).json(user);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.experiments.list.path, async (req, res) => {
    const exps = await storage.getExperiments();
    res.json(exps);
  });

  app.get(api.experiments.get.path, async (req, res) => {
    const exp = await storage.getExperiment(Number(req.params.id));
    if (!exp) return res.status(404).json({ message: "Not found" });
    res.json(exp);
  });

  app.post(api.experiments.create.path, async (req, res) => {
    try {
      const schema = api.experiments.create.input.extend({
        reviewRatio: z.coerce.number().optional(),
        enableReview: z.boolean().optional()
      });
      const input = schema.parse(req.body);
      const exp = await storage.createExperiment(input as any);
      res.status(201).json(exp);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.put(api.experiments.update.path, async (req, res) => {
    try {
      const input = api.experiments.update.input.parse(req.body);
      const exp = await storage.updateExperiment(Number(req.params.id), input);
      res.json(exp);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.tasks.list.path, async (req, res) => {
    try {
      const query = api.tasks.list.input?.parse(req.query) || {};
      const tasksList = await storage.getTasks(query.experimentId);
      res.json(tasksList);
    } catch (err) {
      res.status(400).json({ message: "Invalid input" });
    }
  });

  app.get(api.annotations.list.path, async (req, res) => {
    const anns = await storage.getAnnotations();
    res.json(anns);
  });

  app.get(api.logs.list.path, async (req, res) => {
    const logList = await storage.getLogs();
    res.json(logList);
  });

  // Seed data
  try {
    const users = await storage.getUsers();
    if (users.length === 0) {
      await storage.createUser({
        username: "admin",
        password: "password123", 
        role: "admin",
        email: "admin@example.com"
      });
      
      await storage.createExperiment({
        name: "Demo Pricing Experiment",
        description: "Comparison of product prices between platforms",
        deadline: new Date(Date.now() + 86400000 * 7), // 7 days from now
        enableReview: true,
        reviewRatio: 20,
        status: "in_progress"
      });
    }
  } catch (e) {
    console.error("Failed to seed database", e);
  }

  return httpServer;
}
