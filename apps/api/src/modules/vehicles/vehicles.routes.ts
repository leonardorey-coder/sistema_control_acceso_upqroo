import { Hono } from "hono";
import { z } from "zod";
import { withoutUndefined } from "../../shared/object";
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
  const rows = await listVehicles();
  return c.json({ data: { rows } });
});

vehiclesRoutes.post("/", async (c) => {
  const row = await createVehicle(vehicleSchema.parse(await c.req.json()));
  return c.json({ data: row }, 201);
});

vehiclesRoutes.get("/permits", async (c) => {
  const rows = await listVehiclePermits();
  return c.json({ data: { rows } });
});

vehiclesRoutes.post("/permits", async (c) => {
  const row = await createVehiclePermit(permitSchema.parse(await c.req.json()));
  return c.json({ data: row }, 201);
});

vehiclesRoutes.post("/permits/:permitId/revoke", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const row = await updateVehiclePermit(permitId, { status: "revoked", revokedAt: new Date() });
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
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.post("/:id/disable", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateVehicle(id, { status: "inactive" });
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});
