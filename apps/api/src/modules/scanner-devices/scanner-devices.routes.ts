import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getActorMetadata, getAdminSession, requireAdminRole } from "../../http/middleware/session";
import { HttpError } from "../../shared/http-error";
import { withoutUndefined } from "../../shared/object";
import { recordAudit } from "../../shared/audit";
import { broadcastEvent } from "../events/events";
import {
  createScannerDevice,
  createScannerDeviceChallenge,
  approveScannerDevice,
  getScannerDeviceById,
  getVisibleScannerDevice,
  listScannerDevices,
  registerScannerDevice,
  requestScannerDevice,
  revokeScannerDevice
} from "./scanner-devices.repository";

const scannerCodeSchema = z.string().trim().min(3).max(120).regex(/^[a-zA-Z0-9._:-]+$/);

const publicJwkSchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(1),
  y: z.string().min(1),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional()
}).passthrough();

const createScannerDeviceSchema = z.object({
  code: scannerCodeSchema,
  label: z.string().trim().min(1).max(160),
  metadata: z.record(z.unknown()).default({})
}).strict();

const registerScannerDeviceSchema = z.object({
  code: scannerCodeSchema,
  label: z.string().trim().min(1).max(160).optional(),
  publicKeyJwk: publicJwkSchema
}).strict();

const requestScannerDeviceSchema = z.object({
  label: z.string().trim().min(1).max(160).optional(),
  publicKeyJwk: publicJwkSchema
}).strict();

const challengeSchema = z.object({
  scannerDeviceId: z.string().uuid()
}).strict();

function scannerCodeFromUuid() {
  return `scanner-${randomUUID().slice(0, 8)}`;
}

export const scannerDeviceRoutes = new Hono();

scannerDeviceRoutes.get("/", requireAdminRole("super_admin"), async (c) => {
  const rows = await listScannerDevices();
  return c.json({ data: { rows } });
});

scannerDeviceRoutes.post("/", requireAdminRole("super_admin"), async (c) => {
  const input = createScannerDeviceSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  const row = await createScannerDevice({
    code: input.code,
    label: input.label,
    status: "pending",
    metadata: input.metadata,
    createdByAdminId: session.adminId
  });

  await recordAudit({
    ...getActorMetadata(c),
    action: "scanner_device.created",
    entityType: "scanner_device",
    entityId: row.id,
    metadata: { code: row.code, label: row.label }
  });
  broadcastEvent("audit.table", { action: "scanner_device.created", entityId: row.id });

  return c.json({ data: row }, 201);
});

scannerDeviceRoutes.post("/register", async (c) => {
  const input = registerScannerDeviceSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  const row = await registerScannerDevice(withoutUndefined({
    code: input.code,
    label: input.label,
    publicKeyJwk: input.publicKeyJwk,
    adminId: session.adminId
  }));

  if (!row) {
    throw new HttpError(404, "SCANNER_DEVICE_NOT_FOUND", "The scanner code is not pending or does not exist.");
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "scanner_device.registered",
    entityType: "scanner_device",
    entityId: row.id,
    metadata: { code: row.code, label: row.label }
  });
  broadcastEvent("audit.table", { action: "scanner_device.registered", entityId: row.id });

  return c.json({ data: { device: row } }, 201);
});

scannerDeviceRoutes.post("/request", async (c) => {
  const input = requestScannerDeviceSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  const row = await requestScannerDevice({
    code: scannerCodeFromUuid(),
    label: input.label ?? `Scanner ${session.username}`,
    publicKeyJwk: input.publicKeyJwk,
    adminId: session.adminId,
    metadata: withoutUndefined({
      userAgent: c.req.header("user-agent") ?? undefined
    })
  });

  await recordAudit({
    ...getActorMetadata(c),
    action: "scanner_device.requested",
    entityType: "scanner_device",
    entityId: row.id,
    metadata: { code: row.code, label: row.label }
  });
  broadcastEvent("audit.table", { action: "scanner_device.requested", entityId: row.id });

  return c.json({ data: { device: row } }, 201);
});

scannerDeviceRoutes.post("/challenge", async (c) => {
  const input = challengeSchema.parse(await c.req.json().catch(() => ({})));
  const session = getAdminSession(c);
  const challenge = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60);
  const row = await createScannerDeviceChallenge({
    deviceId: input.scannerDeviceId,
    adminId: session.adminId,
    challenge,
    expiresAt
  });

  if (!row) {
    const current = await getScannerDeviceById(input.scannerDeviceId);
    if (current && current.status !== "active") {
      throw new HttpError(409, "SCANNER_DEVICE_DISABLED", "The scanner device is not active.");
    }
    throw new HttpError(404, "SCANNER_DEVICE_NOT_FOUND", "The scanner device is not active.");
  }

  return c.json({
    data: {
      id: row.id,
      challenge: row.challenge,
      scannerCode: row.scannerCode,
      expiresAt: row.expiresAt
    }
  }, 201);
});

scannerDeviceRoutes.get("/:id/status", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const session = getAdminSession(c);
  const row = await getVisibleScannerDevice({ id, adminId: session.adminId });

  if (!row) {
    throw new HttpError(404, "SCANNER_DEVICE_NOT_FOUND", "The scanner device was not found.");
  }

  return c.json({
    data: {
      device: {
        id: row.id,
        code: row.code,
        label: row.label,
        status: row.status,
        approvedAt: row.approvedAt,
        revokedAt: row.revokedAt
      }
    }
  });
});

scannerDeviceRoutes.post("/:id/approve", requireAdminRole("super_admin"), async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const session = getAdminSession(c);
  const current = await getScannerDeviceById(id);

  if (!current) {
    throw new HttpError(404, "SCANNER_DEVICE_NOT_FOUND", "The scanner device was not found.");
  }

  if (!current.publicKeyJwk) {
    throw new HttpError(409, "SCANNER_DEVICE_KEY_REQUIRED", "The scanner device has no public key to approve.");
  }

  const row = await approveScannerDevice({ id, adminId: session.adminId });
  if (!row) {
    throw new HttpError(409, "SCANNER_DEVICE_NOT_PENDING", "The scanner device is not pending approval.");
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "scanner_device.approved",
    entityType: "scanner_device",
    entityId: id,
    metadata: { code: row.code }
  });
  broadcastEvent("audit.table", { action: "scanner_device.approved", entityId: id });

  return c.json({ data: row });
});

scannerDeviceRoutes.post("/:id/revoke", requireAdminRole("super_admin"), async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const session = getAdminSession(c);
  const current = await getScannerDeviceById(id);

  if (!current) {
    throw new HttpError(404, "SCANNER_DEVICE_NOT_FOUND", "The scanner device was not found.");
  }

  const row = await revokeScannerDevice({ id, adminId: session.adminId });

  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "scanner_device.revoked",
      entityType: "scanner_device",
      entityId: id,
      metadata: { code: row.code }
    });
    broadcastEvent("audit.table", { action: "scanner_device.revoked", entityId: id });
  }

  return c.json({ data: row });
});
