import { z } from "zod";

const optionalNonEmptyString = z.preprocess(
  (value) => value === "" ? undefined : value,
  z.string().min(1).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url().default("postgres://postgres:postgres@localhost:5432/control_acceso_v2"),
  POSTGRES_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  API_PORT: z.coerce.number().int().positive().default(4000),
  EVENT_COALESCE_MS: z.coerce.number().int().min(0).max(5000).default(300),
  WORKER_INTERVAL_MS: z.coerce.number().int().min(1000).default(60_000),
  OPERATING_TIMEZONE: z.string().min(1).default("America/Cancun"),
  WEB_ORIGIN: z.string().url().default("http://localhost:5173"),
  WEB_ORIGINS: optionalNonEmptyString,
  SESSION_COOKIE_NAME: z.string().min(1).default("ca_session"),
  USER_SESSION_COOKIE_NAME: z.string().min(1).default("ca_user_session"),
  SESSION_SECRET: z.string().min(12).default("development-session-secret"),
  TOKEN_SIGNING_SECRET: z.string().min(12).default("development-token-signing-secret"),
  RATE_LIMIT_DRIVER: z.enum(["memory", "postgres"]).default(process.env.NODE_ENV === "production" ? "postgres" : "memory"),
  ADMIN_CLIENT_AUTH_BYPASS: z.coerce.boolean().default(false),
  SCANNER_DEVICE_AUTH_BYPASS: z.coerce.boolean().default(false),
  INITIAL_ADMIN_USERNAME: z.string().min(3).default("superadmin"),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).default("Cambiar123!"),
  STORAGE_DRIVER: z.enum(["local", "s3", "r2"]).default("local"),
  LOCAL_STORAGE_ROOT: z.string().min(1).default(".local-storage"),
  STORAGE_BUCKET: optionalNonEmptyString,
  STORAGE_REGION: z.string().min(1).default("auto"),
  STORAGE_ENDPOINT: optionalNonEmptyString,
  STORAGE_ACCESS_KEY_ID: optionalNonEmptyString,
  STORAGE_SECRET_ACCESS_KEY: optionalNonEmptyString,
  STORAGE_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
  STORAGE_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  QR_SIGNING_PRIVATE_KEY: optionalNonEmptyString,
  QR_SIGNING_PUBLIC_KEY: optionalNonEmptyString,
  QR_SIGNING_ALG: z.string().min(1).default("ES256"),
  QR_SIGNING_KID: optionalNonEmptyString
});

export const env = envSchema.parse(process.env);
