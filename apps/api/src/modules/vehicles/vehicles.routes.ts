import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata, getAdminSession } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { HttpError } from "../../shared/http-error";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { stripSecretFields } from "../../shared/sanitize";
import { issueOpaqueToken } from "../../shared/security";
import { getOperationalConfig } from "../config/config.repository";
import { broadcastEvent } from "../events/events";
import { createHotQr, revokeHotQr } from "../hot-qr/hot-qr.repository";
import { signDynamicQr } from "../qr-signing/qr-signing.service";
import {
  createVehicle,
  createVehiclePermit,
  createVehiclePermitQrToken,
  createVehicleVisitorPermit,
  getVehiclePermit,
  getVehiclePermitEligibility,
  getVehiclePermitPrerequisites,
  getVehiclePermitSigningContext,
  getVehicle,
  listVehiclePermits,
  listVehicleVisitorPermits,
  listVehicles,
  revokeVehicleVisitorPermit,
  rotateVehiclePermitQrTokens,
  updateVehiclePermit,
  updateVehicle
} from "./vehicles.repository";

const vehicleTypeSchema = z.enum(["car", "motorcycle", "bicycle", "electric_scooter", "truck", "official", "university_transport", "visitor", "other"]);
const vehicleApprovalStatusSchema = z.enum(["pending", "approved", "rejected"]);
const permitTypeSchema = z.enum(["standard", "temporary", "official", "visitor", "provider", "event", "emergency"]);

function normalizePlate(plate: string) {
  return plate.trim().toUpperCase().replace(/\s+/g, "");
}

const vehicleSchema = z.object({
  ownerPersonId: z.string().uuid(),
  plate: z.string().trim().min(1).max(20),
  vehicleType: vehicleTypeSchema.default("car"),
  make: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  color: z.string().trim().max(60).optional(),
  status: z.enum(["active", "inactive", "blocked"]).default("active"),
  notes: z.string().trim().optional()
});

const permitSchema = z.object({
  personId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  status: z.enum(["active", "expired", "revoked", "suspended"]).default("active"),
  permitType: permitTypeSchema.default("standard"),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  reason: z.string().trim().optional()
}).strict();

const permitQrSchema = z.object({
  expiresAt: z.coerce.date()
});

const vehicleRejectSchema = z.object({
  reason: z.string().trim().min(1).max(500)
}).strict();

const visitorPermitSchema = z.object({
  visitorName: z.string().trim().min(1).max(160),
  plate: z.string().trim().min(1).max(20),
  vehicleType: vehicleTypeSchema.default("visitor"),
  color: z.string().trim().max(60).optional(),
  reason: z.string().trim().min(1),
  maxUses: z.number().int().min(1).max(10).default(1),
  validUntil: z.coerce.date(),
  metadata: z.record(z.unknown()).default({})
}).strict();

export const vehiclesRoutes = new Hono();

async function assertVehiclePermitAllowed(personId: string, vehicleId: string) {
  const eligibility = await getVehiclePermitEligibility(personId);

  if (!eligibility) {
    throw new HttpError(404, "PERSON_NOT_FOUND", "Person was not found.");
  }

  if (eligibility.estado !== "activo") {
    throw new HttpError(409, "PERSON_NOT_ACTIVE", "Vehicle permits require an active person.");
  }

  if (!eligibility.canHaveVehiclePermit) {
    throw new HttpError(409, "PERSON_TYPE_VEHICLE_PERMIT_NOT_ALLOWED", "This person type cannot have vehicle permits.");
  }

  const prerequisites = await getVehiclePermitPrerequisites(personId, vehicleId);
  if (!prerequisites) {
    throw new HttpError(404, "VEHICLE_NOT_FOUND", "Vehicle was not found.");
  }
  if (prerequisites.vehicleStatus !== "active") {
    throw new HttpError(409, "VEHICLE_NOT_ACTIVE", "Vehicle permits require an active vehicle.");
  }
  if (prerequisites.approvalStatus === "pending") {
    throw new HttpError(409, "VEHICLE_PENDING_APPROVAL", "Vehicle must be approved before creating a permit.");
  }
  if (prerequisites.approvalStatus === "rejected") {
    throw new HttpError(409, "VEHICLE_REJECTED", "Rejected vehicles cannot receive permits.");
  }
  if (prerequisites.deletedAt) {
    throw new HttpError(409, "VEHICLE_DELETED", "Deleted vehicles cannot receive permits.");
  }
}

vehiclesRoutes.get("/", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(z.object({
    q: z.string().trim().min(1).optional(),
    status: z.enum(["active", "inactive", "blocked"]).optional(),
    approvalStatus: vehicleApprovalStatusSchema.optional(),
    vehicleType: vehicleTypeSchema.optional(),
    ownerPersonId: z.string().uuid().optional()
  }).parse(c.req.query()));
  const result = await listVehicles(query, pagination);
  return c.json({ data: paginated(result.rows, result.total, pagination) });
});

vehiclesRoutes.post("/", async (c) => {
  const session = getAdminSession(c);
  const input = vehicleSchema.parse(await c.req.json());
  const row = await createVehicle({
    ...input,
    plate: normalizePlate(input.plate),
    registeredByAdminId: session.adminId,
    approvalStatus: "pending"
  });
  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle.created",
    entityType: "vehicle",
    entityId: row.id,
    metadata: { plate: row.plate, ownerPersonId: row.ownerPersonId }
  });
  broadcastEvent("vehicles.table", { action: "created", id: row.id, ownerPersonId: row.ownerPersonId });
  return c.json({ data: row }, 201);
});

vehiclesRoutes.get("/permits", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(z.object({
    q: z.string().trim().min(1).optional(),
    status: z.enum(["active", "expired", "revoked", "suspended"]).optional(),
    permitType: permitTypeSchema.optional(),
    personId: z.string().uuid().optional(),
    vehicleId: z.string().uuid().optional()
  }).parse(c.req.query()));
  const result = await listVehiclePermits(query, pagination);
  return c.json({ data: paginated(result.rows, result.total, pagination) });
});

vehiclesRoutes.post("/permits", async (c) => {
  const input = permitSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  await assertVehiclePermitAllowed(input.personId, input.vehicleId);

  const row = await createVehiclePermit({
    ...input,
    createdByAdminId: session.adminId
  });
  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle_permit.created",
    entityType: "vehicle_permit",
    entityId: row.id,
    metadata: { personId: row.personId, vehicleId: row.vehicleId }
  });
  broadcastEvent("vehicle-permits.table", { action: "created", id: row.id, personId: row.personId, vehicleId: row.vehicleId });
  return c.json({ data: row }, 201);
});

vehiclesRoutes.patch("/permits/:permitId", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const input = withoutUndefined(permitSchema.partial().parse(await c.req.json()));
  const current = await getVehiclePermit(permitId);
  if (!current) {
    return c.json({ error: { code: "VEHICLE_PERMIT_NOT_FOUND" } }, 404);
  }
  const nextStatus = input.status ?? current.status;
  const nextPersonId = input.personId ?? current.personId;
  const nextVehicleId = input.vehicleId ?? current.vehicleId;
  if (nextStatus === "active") {
    await assertVehiclePermitAllowed(nextPersonId, nextVehicleId);
  }
  const row = await updateVehiclePermit(permitId, input);
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle_permit.updated",
      entityType: "vehicle_permit",
      entityId: permitId
    });
    broadcastEvent("vehicle-permits.table", { action: "updated", id: permitId });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_PERMIT_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/permits/:permitId/revoke", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const session = getAdminSession(c);
  const row = await updateVehiclePermit(permitId, { status: "revoked", revokedByAdminId: session.adminId, revokedAt: new Date() });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle_permit.revoked",
      entityType: "vehicle_permit",
      entityId: permitId
    });
    broadcastEvent("vehicle-permits.table", { action: "revoked", id: permitId });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_PERMIT_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/permits/:permitId/qr/rotate", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const body = permitQrSchema.parse(await c.req.json());
  const permit = await getVehiclePermitSigningContext(permitId);
  if (!permit) {
    throw new HttpError(404, "VEHICLE_PERMIT_NOT_SIGNABLE", "Vehicle permit is not active or signable.");
  }
  await rotateVehiclePermitQrTokens(permitId);
  const issued = issueOpaqueToken("vehicle_permit_qr");
  const row = await createVehiclePermitQrToken({
    vehiclePermitId: permitId,
    tokenHash: issued.tokenHash,
    expiresAt: body.expiresAt
  });

  if (!row) {
    throw new Error("Failed to create vehicle permit QR token");
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle_permit_qr.rotated",
    entityType: "vehicle_permit",
    entityId: permitId,
    metadata: { qrTokenId: row.id }
  });
  broadcastEvent("vehicle-permits.table", { action: "qr_rotated", id: permitId, qrTokenId: row.id });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

vehiclesRoutes.post("/permits/:permitId/qr/dynamic", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const [configRow] = await getOperationalConfig("signed_qr");
  const config = (configRow?.value as Record<string, unknown> | undefined) ?? {};
  if (config.enabled !== true) {
    throw new HttpError(409, "SIGNED_QR_DISABLED", "Signed dynamic QR is disabled.");
  }

  const permit = await getVehiclePermitSigningContext(permitId);
  if (!permit) {
    throw new HttpError(404, "VEHICLE_PERMIT_NOT_SIGNABLE", "Vehicle permit is not active or signable.");
  }

  const configuredTtl = typeof config.ttlSeconds === "number" ? config.ttlSeconds : 30;
  const ttlSeconds = Math.min(30, Math.max(15, Math.floor(configuredTtl)));
  const { token, expiresAt, jti } = await signDynamicQr({
    sub: permit.personId,
    uid: permit.matricula,
    typ: "vehicle_permit_qr",
    vehiclePermitId: permit.permitId
  }, ttlSeconds);

  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle_permit_qr.dynamic_issued",
    entityType: "vehicle_permit",
    entityId: permit.permitId,
    metadata: { personId: permit.personId, vehicleId: permit.vehicleId, jti }
  });
  broadcastEvent("vehicle-permits.table", { action: "dynamic_issued", id: permit.permitId, vehicleId: permit.vehicleId });

  return c.json({
    data: {
      permit: stripSecretFields(permit),
      token,
      expiresAt,
      refreshAfterMs: Math.max(5000, (ttlSeconds - 5) * 1000),
      jti
    }
  }, 201);
});

vehiclesRoutes.get("/visitor-permits", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(z.object({
    q: z.string().trim().min(1).optional(),
    status: z.enum(["active", "expired", "revoked"]).optional()
  }).parse(c.req.query()));
  const result = await listVehicleVisitorPermits(query, pagination);
  return c.json({ data: paginated(result.rows, result.total, pagination) });
});

vehiclesRoutes.post("/visitor-permits", async (c) => {
  const session = getAdminSession(c);
  const input = visitorPermitSchema.parse(await c.req.json());
  const issued = issueOpaqueToken("hot_qr");
  const hotQr = await createHotQr({
    visitorName: input.visitorName,
    reason: input.reason,
    tokenHash: issued.tokenHash,
    maxUses: input.maxUses,
    validUntil: input.validUntil,
    createdByAdminId: session.adminId,
    metadata: {
      ...input.metadata,
      vehicleAccess: true,
      vehiclePlate: normalizePlate(input.plate),
      vehicleType: input.vehicleType,
      vehicleColor: input.color
    }
  });

  const row = await createVehicleVisitorPermit({
    hotQrTokenId: hotQr.id,
    visitorName: input.visitorName,
    plate: normalizePlate(input.plate),
    vehicleType: input.vehicleType,
    color: input.color,
    reason: input.reason,
    validUntil: input.validUntil,
    createdByAdminId: session.adminId,
    metadata: input.metadata
  });

  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle_visitor_permit.created",
    entityType: "vehicle_visitor_permit",
    entityId: row.id,
    metadata: { visitorName: row.visitorName, plate: row.plate, hotQrTokenId: hotQr.id }
  });
  broadcastEvent("vehicle-visitor-permits.table", { action: "created", id: row.id });
  broadcastEvent("hot-qr.table", { action: "created", id: hotQr.id });

  return c.json({ data: { permit: row, credential: stripSecretFields(hotQr), token: issued.token } }, 201);
});

vehiclesRoutes.post("/visitor-permits/:id/revoke", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const session = getAdminSession(c);
  const row = await revokeVehicleVisitorPermit(id, session.adminId);
  if (!row) {
    return c.json({ error: { code: "VEHICLE_VISITOR_PERMIT_NOT_FOUND" } }, 404);
  }
  await revokeHotQr(row.hotQrTokenId);
  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle_visitor_permit.revoked",
    entityType: "vehicle_visitor_permit",
    entityId: id
  });
  broadcastEvent("vehicle-visitor-permits.table", { action: "revoked", id });
  broadcastEvent("hot-qr.table", { action: "revoked", id: row.hotQrTokenId });
  return c.json({ data: row });
});

vehiclesRoutes.get("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await getVehicle(id);
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const input = withoutUndefined(vehicleSchema.partial().parse(await c.req.json()));
  const row = await updateVehicle(id, withoutUndefined({
    ...input,
    plate: input.plate ? normalizePlate(input.plate) : undefined
  }));
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle.updated",
      entityType: "vehicle",
      entityId: id
    });
    broadcastEvent("vehicles.table", { action: "updated", id });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/:id/approve", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const session = getAdminSession(c);
  const row = await updateVehicle(id, {
    approvalStatus: "approved",
    approvedByAdminId: session.adminId,
    approvedAt: new Date(),
    rejectedByAdminId: null,
    rejectedAt: null,
    rejectionReason: null
  });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle.approved",
      entityType: "vehicle",
      entityId: id,
      metadata: { plate: row.plate }
    });
    broadcastEvent("vehicles.table", { action: "approved", id });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/:id/reject", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const session = getAdminSession(c);
  const input = vehicleRejectSchema.parse(await c.req.json());
  const row = await updateVehicle(id, {
    approvalStatus: "rejected",
    rejectedByAdminId: session.adminId,
    rejectedAt: new Date(),
    rejectionReason: input.reason,
    approvedByAdminId: null,
    approvedAt: null
  });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle.rejected",
      entityType: "vehicle",
      entityId: id,
      metadata: { plate: row.plate, reason: input.reason }
    });
    broadcastEvent("vehicles.table", { action: "rejected", id });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/:id/block", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateVehicle(id, { status: "blocked" });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle.blocked",
      entityType: "vehicle",
      entityId: id,
      metadata: { plate: row.plate }
    });
    broadcastEvent("vehicles.table", { action: "blocked", id });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/:id/delete", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateVehicle(id, { status: "inactive", deletedAt: new Date() });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle.deleted",
      entityType: "vehicle",
      entityId: id,
      metadata: { plate: row.plate }
    });
    broadcastEvent("vehicles.table", { action: "deleted", id });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/:id/disable", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateVehicle(id, { status: "inactive" });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle.disabled",
      entityType: "vehicle",
      entityId: id
    });
    broadcastEvent("vehicles.table", { action: "disabled", id });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});
