import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url().default("postgres://postgres:postgres@localhost:5432/control_acceso_v2"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_COOKIE_NAME: z.string().min(1).default("ca_session"),
  SESSION_SECRET: z.string().min(12).default("development-session-secret")
});

export const env = envSchema.parse(process.env);
