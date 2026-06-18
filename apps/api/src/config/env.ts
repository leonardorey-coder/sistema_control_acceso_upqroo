import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().default("postgres://postgres:postgres@localhost:5432/control_acceso_v2"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  SESSION_COOKIE_NAME: z.string().min(1).default("ca_session"),
  SESSION_SECRET: z.string().min(12).default("development-session-secret"),
  TOKEN_SIGNING_SECRET: z.string().min(12).default("development-token-signing-secret"),
  INITIAL_ADMIN_USERNAME: z.string().min(3).default("superadmin"),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).default("Cambiar123!")
});

export const env = envSchema.parse(process.env);
