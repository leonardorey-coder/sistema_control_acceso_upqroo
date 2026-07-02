import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata, getAdminSession } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { broadcastEvent } from "../events/events";
import { getOperationalConfig, upsertOperationalConfig } from "./config.repository";

const defaultScannerConfig = {
  retryEnabled: true,
  retryDelayMs: 1200,
  cameraEnabled: true,
  manualEntryEnabled: true,
  soundsEnabled: true,
  autoExitEnabled: true
};

const defaultSignedQrConfig = {
  enabled: false,
  ttlSeconds: 30,
  clockToleranceSeconds: 5,
  compatibilityOpaqueTokens: true
};

const defaultScannerDevicesConfig = {
  required: process.env.NODE_ENV === "production"
};

const operationalConfigSchema = z.object({
  value: z.record(z.unknown()).default(defaultScannerConfig),
  description: z.string().trim().optional()
}).strict();

const signedQrConfigSchema = z.object({
  value: z.object({
    enabled: z.boolean().default(defaultSignedQrConfig.enabled),
    ttlSeconds: z.number().int().min(15).max(30).default(defaultSignedQrConfig.ttlSeconds),
    clockToleranceSeconds: z.number().int().min(0).max(30).default(defaultSignedQrConfig.clockToleranceSeconds),
    compatibilityOpaqueTokens: z.boolean().default(defaultSignedQrConfig.compatibilityOpaqueTokens),
    requireDeviceBinding: z.boolean().default(false)
  }).default(defaultSignedQrConfig),
  description: z.string().trim().optional()
}).strict();

const scannerDevicesConfigSchema = z.object({
  value: z.object({
    required: z.boolean().default(defaultScannerDevicesConfig.required)
  }).default(defaultScannerDevicesConfig),
  description: z.string().trim().optional()
}).strict();

export const configRoutes = new Hono();

configRoutes.get("/operational", async (c) => {
  const [row] = await getOperationalConfig();
  return c.json({ data: row ?? { key: "scanner", value: defaultScannerConfig } });
});

configRoutes.patch("/operational", async (c) => {
  const input = operationalConfigSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  const row = await upsertOperationalConfig({
    key: "scanner",
    value: input.value,
    description: input.description,
    updatedByAdminId: session.adminId
  });

  await recordAudit({
    ...getActorMetadata(c),
    action: "config.operational_updated",
    entityType: "operational_config",
    metadata: { key: "scanner" }
  });
  broadcastEvent("config.table", { action: "operational_updated", key: "scanner" });

  return c.json({ data: row });
});

configRoutes.get("/signed-qr", async (c) => {
  const [row] = await getOperationalConfig("signed_qr");
  return c.json({ data: row ?? { key: "signed_qr", value: defaultSignedQrConfig } });
});

configRoutes.patch("/signed-qr", async (c) => {
  const input = signedQrConfigSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  const row = await upsertOperationalConfig({
    key: "signed_qr",
    value: input.value,
    description: input.description ?? "Signed dynamic QR settings",
    updatedByAdminId: session.adminId
  });

  await recordAudit({
    ...getActorMetadata(c),
    action: "config.signed_qr_updated",
    entityType: "operational_config",
    metadata: { key: "signed_qr" }
  });
  broadcastEvent("config.table", { action: "signed_qr_updated", key: "signed_qr" });

  return c.json({ data: row });
});

configRoutes.get("/scanner-devices", async (c) => {
  const [row] = await getOperationalConfig("scanner_devices");
  return c.json({
    data: row
      ? { ...row, value: { ...defaultScannerDevicesConfig, ...(row.value as Record<string, unknown>) } }
      : { key: "scanner_devices", value: defaultScannerDevicesConfig }
  });
});

configRoutes.patch("/scanner-devices", async (c) => {
  const input = scannerDevicesConfigSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  const row = await upsertOperationalConfig({
    key: "scanner_devices",
    value: input.value,
    description: input.description ?? "Scanner device authentication settings",
    updatedByAdminId: session.adminId
  });

  await recordAudit({
    ...getActorMetadata(c),
    action: "config.scanner_devices_updated",
    entityType: "operational_config",
    metadata: { key: "scanner_devices" }
  });
  broadcastEvent("config.table", { action: "scanner_devices_updated", key: "scanner_devices" });

  return c.json({ data: row });
});
