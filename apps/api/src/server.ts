import { serve } from "bun";
import { env } from "./config/env";
import { app } from "./app";

serve({
  fetch: app.fetch,
  port: env.API_PORT
});

console.info(`Control Acceso API listening on http://localhost:${env.API_PORT}`);
