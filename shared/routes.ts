import { z } from "zod";
import {
  insertUserSchema, users,
  insertExperimentSchema, experiments,
  insertTaskSchema, tasks,
  insertAnnotationSchema, annotations,
  insertApiConnectorSchema, apiConnectors,
} from "./schema";

export const errorSchemas = {
  validation: z.object({ message: z.string(), field: z.string().optional() }),
  notFound: z.object({ message: z.string() }),
  internal: z.object({ message: z.string() }),
};

export const api = {
  users: {
    list: {
      method: "GET" as const,
      path: "/api/users" as const,
      responses: { 200: z.array(z.custom<typeof users.$inferSelect>()) }
    },
    create: {
      method: "POST" as const,
      path: "/api/users" as const,
      input: insertUserSchema,
      responses: { 201: z.custom<typeof users.$inferSelect>(), 400: errorSchemas.validation }
    }
  },
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/login" as const,
      input: z.object({ username: z.string(), password: z.string() }),
      responses: { 200: z.custom<typeof users.$inferSelect>(), 401: errorSchemas.validation }
    }
  },
  experiments: {
    list: {
      method: "GET" as const,
      path: "/api/experiments" as const,
      responses: { 200: z.array(z.custom<typeof experiments.$inferSelect>()) }
    },
    get: {
      method: "GET" as const,
      path: "/api/experiments/:id" as const,
      responses: { 200: z.custom<typeof experiments.$inferSelect>(), 404: errorSchemas.notFound }
    },
    stats: {
      method: "GET" as const,
      path: "/api/experiments/:id/stats" as const,
      responses: { 200: z.any() }
    },
    create: {
      method: "POST" as const,
      path: "/api/experiments" as const,
      input: insertExperimentSchema,
      responses: { 201: z.custom<typeof experiments.$inferSelect>(), 400: errorSchemas.validation }
    },
    update: {
      method: "PUT" as const,
      path: "/api/experiments/:id" as const,
      input: insertExperimentSchema.partial(),
      responses: { 200: z.custom<typeof experiments.$inferSelect>(), 404: errorSchemas.notFound }
    }
  },
  tasks: {
    list: {
      method: "GET" as const,
      path: "/api/tasks" as const,
      input: z.object({ experimentId: z.coerce.number().optional() }).optional(),
      responses: { 200: z.array(z.custom<typeof tasks.$inferSelect>()) }
    }
  },
  annotations: {
    list: {
      method: "GET" as const,
      path: "/api/annotations" as const,
      responses: { 200: z.array(z.custom<typeof annotations.$inferSelect>()) }
    }
  },
  logs: {
    list: {
      method: "GET" as const,
      path: "/api/logs" as const,
      responses: { 200: z.array(z.custom<typeof apiConnectors.$inferSelect>()) }
    }
  },
  import: {
    upload: {
      method: "POST" as const,
      path: "/api/import/upload" as const,
      responses: {
        200: z.object({
          columns: z.array(z.string()),
          preview: z.array(z.record(z.string())),
          totalRows: z.number(),
        })
      }
    },
    create: {
      method: "POST" as const,
      path: "/api/import/create-tasks" as const,
      input: z.object({
        experimentId: z.number(),
        rows: z.array(z.record(z.any())),
        mapping: z.record(z.string()),
      }),
      responses: { 200: z.object({ created: z.number() }) }
    }
  },
  connectors: {
    list: {
      method: "GET" as const,
      path: "/api/connectors" as const,
      responses: { 200: z.array(z.custom<typeof apiConnectors.$inferSelect>()) }
    },
    create: {
      method: "POST" as const,
      path: "/api/connectors" as const,
      input: insertApiConnectorSchema,
      responses: { 201: z.custom<typeof apiConnectors.$inferSelect>() }
    },
    update: {
      method: "PUT" as const,
      path: "/api/connectors/:id" as const,
      input: insertApiConnectorSchema.partial(),
      responses: { 200: z.custom<typeof apiConnectors.$inferSelect>() }
    },
    delete: {
      method: "DELETE" as const,
      path: "/api/connectors/:id" as const,
      responses: { 204: z.void() }
    },
    trigger: {
      method: "POST" as const,
      path: "/api/connectors/:id/trigger" as const,
      responses: { 200: z.object({ fetched: z.number(), created: z.number() }) }
    }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
