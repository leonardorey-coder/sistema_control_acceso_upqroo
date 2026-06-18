import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { errorHandler } from "./http/middleware/error-handler";
import { accessRoutes } from "./modules/access/access.routes";
import { adminManagementRoutes } from "./modules/admin-management/admin-management.routes";
import { attendanceRoutes, schedulesRoutes, subjectsRoutes } from "./modules/attendance/attendance.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { configRoutes } from "./modules/config/config.routes";
import { credentialsRoutes } from "./modules/credentials/credentials.routes";
import { hotQrRoutes } from "./modules/hot-qr/hot-qr.routes";
import { integrityRoutes } from "./modules/integrity/integrity.routes";
import { peopleRoutes } from "./modules/people/people.routes";
import { personTypesRoutes } from "./modules/person-types/person-types.routes";
import { vehiclesRoutes } from "./modules/vehicles/vehicles.routes";
import { healthRoutes } from "./http/routes/health.routes";

export const app = new Hono();

app.onError(errorHandler);

app.use("*", cors({
  origin: env.WEB_ORIGIN,
  credentials: true
}));

app.route("/health", healthRoutes);
app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/people", peopleRoutes);
app.route("/api/v1/person-types", personTypesRoutes);
app.route("/api/v1/access", accessRoutes);
app.route("/api/v1/attendance", attendanceRoutes);
app.route("/api/v1/subjects", subjectsRoutes);
app.route("/api/v1/schedules", schedulesRoutes);
app.route("/api/v1/hot-qr", hotQrRoutes);
app.route("/api/v1/vehicles", vehiclesRoutes);
app.route("/api/v1/config", configRoutes);
app.route("/api/v1/integrity", integrityRoutes);
app.route("/api/v1/admins", adminManagementRoutes);
app.route("/api/v1/credentials", credentialsRoutes);
