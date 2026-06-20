import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { HttpError } from "../../shared/http-error";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { stripSecretFields } from "../../shared/sanitize";
import { issueOpaqueToken } from "../../shared/security";
import { getOperationalConfig } from "../config/config.repository";
import { signDynamicQr } from "../qr-signing/qr-signing.service";
import {
  createVehicle,
  createVehiclePermit,
  createVehiclePermitQrToken,
  getVehiclePermitEligibility,
  getVehiclePermitSigningContext,
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
  const input = permitSchema.parse(await c.req.json());
  const eligibility = await getVehiclePermitEligibility(input.personId);

  if (!eligibility) {
    throw new HttpError(404, "PERSON_NOT_FOUND", "Person was not found.");
  }

  if (eligibility.estado !== "activo") {
    throw new HttpError(409, "PERSON_NOT_ACTIVE", "Vehicle permits require an active person.");
  }

  if (!eligibility.canHaveVehiclePermit) {
    throw new HttpError(409, "PERSON_TYPE_VEHICLE_PERMIT_NOT_ALLOWED", "This person type cannot have vehicle permits.");
  }

  const row = await createVehiclePermit(input);
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
