import { Hono } from "hono";
import { cors } from "hono/cors";
import { env } from "./config/env";
import { errorHandler } from "./http/middleware/error-handler";
import { accessRoutes } from "./modules/access/access.routes";
import { authRoutes } from "./modules/auth/auth.routes";
import { peopleRoutes } from "./modules/people/people.routes";
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
app.route("/api/v1/access", accessRoutes);
