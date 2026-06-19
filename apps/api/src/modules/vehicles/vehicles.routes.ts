import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { stripSecretFields } from "../../shared/sanitize";
import { issueOpaqueToken } from "../../shared/security";
import {
  createVehicle,
  createVehiclePermit,
  createVehiclePermitQrToken,
  getVehicle,
  listVehiclePermits,
  listVehicles,
  rotateVehiclePermitQrTokens,
  updateVehiclePermit,
  updateVehicle
} from "./vehicles.repository";

const vehicleSchema = z.object({
  ownerPersonId: z.string().uuid(),
  plate: z.string().trim().min(1).max(20),
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
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  reason: z.string().trim().optional(),
  createdByAdminId: z.string().uuid().optional()
});

const permitQrSchema = z.object({
  expiresAt: z.coerce.date()
});

export const vehiclesRoutes = new Hono();

vehiclesRoutes.get("/", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(z.object({
    q: z.string().trim().min(1).optional(),
    status: z.enum(["active", "inactive", "blocked"]).optional(),
    ownerPersonId: z.string().uuid().optional()
  }).parse(c.req.query()));
  const result = await listVehicles(query, pagination);
  return c.json({ data: paginated(result.rows, result.total, pagination) });
});

vehiclesRoutes.post("/", async (c) => {
  const row = await createVehicle(vehicleSchema.parse(await c.req.json()));
  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle.created",
    entityType: "vehicle",
    entityId: row.id,
    metadata: { plate: row.plate, ownerPersonId: row.ownerPersonId }
  });
  return c.json({ data: row }, 201);
});

vehiclesRoutes.get("/permits", async (c) => {
  const pagination = parsePagination(c.req.query());
  const result = await listVehiclePermits(pagination);
  return c.json({ data: paginated(result.rows, result.total, pagination) });
});

vehiclesRoutes.post("/permits", async (c) => {
  const row = await createVehiclePermit(permitSchema.parse(await c.req.json()));
  await recordAudit({
    ...getActorMetadata(c),
    action: "vehicle_permit.created",
    entityType: "vehicle_permit",
    entityId: row.id,
    metadata: { personId: row.personId, vehicleId: row.vehicleId }
  });
  return c.json({ data: row }, 201);
});

vehiclesRoutes.post("/permits/:permitId/revoke", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const row = await updateVehiclePermit(permitId, { status: "revoked", revokedAt: new Date() });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle_permit.revoked",
      entityType: "vehicle_permit",
      entityId: permitId
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_PERMIT_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/permits/:permitId/qr/rotate", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const body = permitQrSchema.parse(await c.req.json());
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

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

vehiclesRoutes.get("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await getVehicle(id);
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateVehicle(id, withoutUndefined(vehicleSchema.partial().parse(await c.req.json())));
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "vehicle.updated",
      entityType: "vehicle",
      entityId: id
    });
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
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});
