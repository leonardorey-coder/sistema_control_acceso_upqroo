import { Hono } from "hono";
import { z } from "zod";
import { withoutUndefined } from "../../shared/object";
import {
  createVehicle,
  createVehiclePermit,
  createVehiclePermitQrToken,
  listVehiclePermits,
  listVehicles,
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
  vehiclePermitId: z.string().uuid(),
  tokenHash: z.string().min(32),
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

vehiclesRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateVehicle(id, withoutUndefined(vehicleSchema.partial().parse(await c.req.json())));
  return row ? c.json({ data: row }) : c.json({ error: { code: "VEHICLE_NOT_FOUND" } }, 404);
});

vehiclesRoutes.get("/permits", async (c) => {
  const rows = await listVehiclePermits();
  return c.json({ data: { rows } });
});

vehiclesRoutes.post("/permits", async (c) => {
  const row = await createVehiclePermit(permitSchema.parse(await c.req.json()));
  return c.json({ data: row }, 201);
});

vehiclesRoutes.post("/permits/:permitId/qr-tokens", async (c) => {
  const permitId = z.string().uuid().parse(c.req.param("permitId"));
  const body = permitQrSchema.parse({ ...(await c.req.json()), vehiclePermitId: permitId });
  const row = await createVehiclePermitQrToken(body);
  return c.json({ data: row }, 201);
});
