import { Hono } from "hono";
import { z } from "zod";
import { getOperationalConfig, upsertOperationalConfig } from "./config.repository";

const defaultScannerConfig = {
  retryEnabled: true,
  retryDelayMs: 1200,
  cameraEnabled: true,
  manualEntryEnabled: true,
  soundsEnabled: true,
  autoExitEnabled: true
};

const operationalConfigSchema = z.object({
  value: z.record(z.unknown()).default(defaultScannerConfig),
  description: z.string().trim().optional(),
  updatedByAdminId: z.string().uuid().optional()
});

export const configRoutes = new Hono();

configRoutes.get("/operational", async (c) => {
  const [row] = await getOperationalConfig();
  return c.json({ data: row ?? { key: "scanner", value: defaultScannerConfig } });
});

configRoutes.patch("/operational", async (c) => {
  const input = operationalConfigSchema.parse(await c.req.json());
  const row = await upsertOperationalConfig({
    key: "scanner",
    value: input.value,
    description: input.description,
    updatedByAdminId: input.updatedByAdminId
  });

  return c.json({ data: row });
});
