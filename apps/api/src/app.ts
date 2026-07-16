import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { errorHandler } from "./http/middleware/error-handler";
import { accessRoutes } from "./modules/access/access.routes";
import { adminManagementRoutes } from "./modules/admin-management/admin-management.routes";
import { attendanceRoutes, schedulesRoutes, subjectsRoutes } from "./modules/attendance/attendance.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { careersRoutes } from "./modules/careers/careers.routes";
import { configRoutes } from "./modules/config/config.routes";
import { credentialsRoutes } from "./modules/credentials/credentials.routes";
import { filesRoutes } from "./modules/files/files.routes";
import { hotQrRoutes } from "./modules/hot-qr/hot-qr.routes";
import { gatesRoutes } from "./modules/gates/gates.routes";
import { integrityRoutes } from "./modules/integrity/integrity.routes";
import { peopleRoutes } from "./modules/people/people.routes";
import { personTypesRoutes } from "./modules/person-types/person-types.routes";
import { qrKeysRoutes } from "./modules/qr-signing/qr-signing.routes";
import { scannerDeviceRoutes } from "./modules/scanner-devices/scanner-devices.routes";
import { userPortalRoutes } from "./modules/user-portal/user-portal.routes";
import { vehiclesRoutes } from "./modules/vehicles/vehicles.routes";
import { healthRoutes } from "./http/routes/health.routes";
import { requireAdminRole, requireAdminSession } from "./http/middleware/session";

export const app = new Hono();

app.onError(errorHandler);

const allowedOrigins = new Set((env.WEB_ORIGINS ?? env.WEB_ORIGIN)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean));

app.use("*", cors({
  origin: (origin) => allowedOrigins.has(origin) ? origin : env.WEB_ORIGIN,
  credentials: true
}));

app.route("/health", healthRoutes);
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/portal", userPortalRoutes);
// JWKS is public (scanners need it to verify signatures)
app.route("/api/v1/qr-keys", qrKeysRoutes);

for (const path of [
  "/api/v1/people",
  "/api/v1/people/*",
  "/api/v1/person-types",
  "/api/v1/person-types/*",
  "/api/v1/careers",
  "/api/v1/careers/*",
  "/api/v1/access",
  "/api/v1/access/*",
  "/api/v1/attendance",
  "/api/v1/attendance/*",
  "/api/v1/subjects",
  "/api/v1/subjects/*",
  "/api/v1/schedules",
  "/api/v1/schedules/*",
  "/api/v1/hot-qr",
  "/api/v1/hot-qr/*",
  "/api/v1/gates",
  "/api/v1/gates/*",
  "/api/v1/vehicles",
  "/api/v1/vehicles/*",
  "/api/v1/config",
  "/api/v1/config/*",
  "/api/v1/integrity",
  "/api/v1/integrity/*",
  "/api/v1/credentials",
  "/api/v1/credentials/*",
  "/api/v1/files",
  "/api/v1/files/*",
  "/api/v1/scanner-devices",
  "/api/v1/scanner-devices/*"
]) {
  app.use(path, requireAdminSession);
}

app.use("/api/v1/admins", requireAdminRole("super_admin"));
app.use("/api/v1/admins/*", requireAdminRole("super_admin"));

app.route("/api/v1/people", peopleRoutes);
app.route("/api/v1/person-types", personTypesRoutes);
app.route("/api/v1/careers", careersRoutes);
app.route("/api/v1/access", accessRoutes);
app.route("/api/v1/attendance", attendanceRoutes);
app.route("/api/v1/subjects", subjectsRoutes);
app.route("/api/v1/schedules", schedulesRoutes);
app.route("/api/v1/hot-qr", hotQrRoutes);
app.route("/api/v1/gates", gatesRoutes);
app.route("/api/v1/vehicles", vehiclesRoutes);
app.route("/api/v1/config", configRoutes);
app.route("/api/v1/integrity", integrityRoutes);
app.route("/api/v1/admins", adminManagementRoutes);
app.route("/api/v1/credentials", credentialsRoutes);
app.route("/api/v1/files", filesRoutes);
app.route("/api/v1/scanner-devices", scannerDeviceRoutes);
