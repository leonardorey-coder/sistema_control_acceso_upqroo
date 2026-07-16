import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata, getAdminSession, requireAdminRole } from "../../http/middleware/session";
import { getScannerDeviceById } from "../scanner-devices/scanner-devices.repository";
import { recordAudit } from "../../shared/audit";
import { toOperationalDateRange } from "../../shared/date-range";
import { HttpError } from "../../shared/http-error";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { broadcastEvent } from "../events/events";
import {
  createGate,
  createGateScanner,
  getGate,
  listGates,
  listGateScanners,
  summarizeGates,
  updateGate,
  updateGateScanner
} from "./gates.repository";

const gateTypeSchema = z.enum(["pedestrian", "vehicle", "mixed", "visitors", "staff", "providers", "emergency", "events"]);
const gateStatusSchema = z.enum(["active", "inactive", "maintenance", "entry_only", "exit_only", "blocked", "emergency"]);
const gateScannerStatusSchema = z.enum(["active", "inactive", "revoked"]);
const accessModeSchema = z.enum(["pedestrian", "vehicle", "visitor", "manual"]);
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const scheduleSchema = z.object({
  timezone: z.string().trim().min(1).max(80).default("America/Cancun"),
  weekly: z.record(z.string(), z.array(z.object({ start: timeSchema, end: timeSchema }).strict()).max(8))
    .refine((value) => Object.keys(value).every((key) => /^[0-6]$/.test(key)), "weekly keys must be 0 through 6")
}).strict().or(z.object({}).strict());
const rulesSchema = z.object({
  allowedAccessModes: z.array(accessModeSchema).max(4).optional(),
  allowedPersonTypes: z.array(z.string().trim().min(1).max(40)).max(30).optional()
}).strict();
const gateSchema = z.object({
  code: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(1).max(160),
  type: gateTypeSchema.default("mixed"),
  location: z.string().trim().max(240).optional(),
  status: gateStatusSchema.default("active"),
  schedule: scheduleSchema.default({}),
  rules: rulesSchema.default({}),
  notes: z.string().trim().max(2000).optional()
}).strict();
const scannerSchema = z.object({
  scannerDeviceId: z.string().uuid().optional(),
  scannerId: z.string().trim().min(3).max(120).regex(/^[a-zA-Z0-9._:-]+$/).optional(),
  label: z.string().trim().min(1).max(160).optional(),
  status: gateScannerStatusSchema.default("active"),
  metadata: z.record(z.string(), z.unknown()).default({})
}).strict().refine((value) => value.scannerDeviceId || value.scannerId, "scannerDeviceId or scannerId is required");

export const gatesRoutes = new Hono();

gatesRoutes.get("/", async (c) => {
  const pagination = parsePagination(c.req.query());
  const filters = withoutUndefined(z.object({
    q: z.string().trim().min(1).optional(),
    type: gateTypeSchema.optional(),
    status: gateStatusSchema.optional()
  }).parse(c.req.query()));
  const result = await listGates(filters, pagination);
  return c.json({ data: paginated(result.rows, result.total, pagination) });
});

gatesRoutes.get("/summary", async (c) => {
  const query = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(c.req.query());
  const range = toOperationalDateRange(query.date);
  return c.json({ data: { date: range.date, rows: await summarizeGates(range.from, range.to) } });
});

gatesRoutes.post("/", requireAdminRole("super_admin"), async (c) => {
  const input = gateSchema.parse(await c.req.json());
  const session = getAdminSession(c);
  const row = await createGate({ ...input, createdByAdminId: session.adminId, updatedByAdminId: session.adminId });
  await recordAudit({ ...getActorMetadata(c), action: "gate.created", entityType: "gate", entityId: row.id, metadata: { code: row.code } });
  broadcastEvent("gates.table", { action: "created", id: row.id });
  return c.json({ data: row }, 201);
});

gatesRoutes.get("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await getGate(id);
  if (!row) throw new HttpError(404, "GATE_NOT_FOUND", "Gate not found.");
  return c.json({ data: { ...row, scanners: await listGateScanners(id) } });
});

gatesRoutes.patch("/:id", requireAdminRole("super_admin"), async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const input = withoutUndefined(gateSchema.partial().parse(await c.req.json()));
  const session = getAdminSession(c);
  const row = await updateGate(id, { ...input, updatedByAdminId: session.adminId });
  if (!row) throw new HttpError(404, "GATE_NOT_FOUND", "Gate not found.");
  await recordAudit({ ...getActorMetadata(c), action: "gate.updated", entityType: "gate", entityId: id, metadata: { changes: Object.keys(input) } });
  broadcastEvent("gates.table", { action: "updated", id });
  return c.json({ data: row });
});

for (const [path, status, action] of [
  ["disable", "inactive", "gate.disabled"],
  ["block", "blocked", "gate.blocked"],
  ["emergency", "emergency", "gate.emergency_enabled"]
] as const) {
  gatesRoutes.post(`/:id/${path}`, requireAdminRole("super_admin"), async (c) => {
    const id = z.string().uuid().parse(c.req.param("id"));
    const session = getAdminSession(c);
    const row = await updateGate(id, { status, updatedByAdminId: session.adminId });
    if (!row) throw new HttpError(404, "GATE_NOT_FOUND", "Gate not found.");
    await recordAudit({ ...getActorMetadata(c), action, entityType: "gate", entityId: id });
    broadcastEvent("gates.table", { action, id });
    return c.json({ data: row });
  });
}

gatesRoutes.get("/:id/scanners", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  if (!await getGate(id)) throw new HttpError(404, "GATE_NOT_FOUND", "Gate not found.");
  return c.json({ data: { rows: await listGateScanners(id) } });
});

gatesRoutes.post("/:id/scanners", requireAdminRole("super_admin"), async (c) => {
  const gateId = z.string().uuid().parse(c.req.param("id"));
  const input = scannerSchema.parse(await c.req.json());
  if (!await getGate(gateId)) throw new HttpError(404, "GATE_NOT_FOUND", "Gate not found.");
  const device = input.scannerDeviceId ? await getScannerDeviceById(input.scannerDeviceId) : null;
  if (input.scannerDeviceId && !device) throw new HttpError(404, "SCANNER_DEVICE_NOT_FOUND", "Scanner device not found.");
  const row = await createGateScanner({
    gateId,
    scannerDeviceId: input.scannerDeviceId,
    scannerId: device?.code ?? input.scannerId!,
    label: input.label ?? device?.label ?? input.scannerId!,
    status: input.status,
    metadata: input.metadata
  });
  await recordAudit({ ...getActorMetadata(c), action: "gate_scanner.created", entityType: "gate_scanner", entityId: row.id, metadata: { gateId, scannerId: row.scannerId } });
  broadcastEvent("gates.table", { action: "scanner_created", id: gateId, scannerId: row.id });
  return c.json({ data: row }, 201);
});

gatesRoutes.patch("/:id/scanners/:scannerId", requireAdminRole("super_admin"), async (c) => {
  const gateId = z.string().uuid().parse(c.req.param("id"));
  const scannerId = z.string().uuid().parse(c.req.param("scannerId"));
  const input = withoutUndefined(z.object({
    label: z.string().trim().min(1).max(160).optional(),
    status: gateScannerStatusSchema.optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }).strict().parse(await c.req.json()));
  const row = await updateGateScanner(gateId, scannerId, input);
  if (!row) throw new HttpError(404, "GATE_SCANNER_NOT_FOUND", "Gate scanner not found.");
  await recordAudit({ ...getActorMetadata(c), action: "gate_scanner.updated", entityType: "gate_scanner", entityId: scannerId, metadata: { gateId } });
  broadcastEvent("gates.table", { action: "scanner_updated", id: gateId, scannerId });
  return c.json({ data: row });
});

gatesRoutes.post("/:id/scanners/:scannerId/revoke", requireAdminRole("super_admin"), async (c) => {
  const gateId = z.string().uuid().parse(c.req.param("id"));
  const scannerId = z.string().uuid().parse(c.req.param("scannerId"));
  const row = await updateGateScanner(gateId, scannerId, { status: "revoked" });
  if (!row) throw new HttpError(404, "GATE_SCANNER_NOT_FOUND", "Gate scanner not found.");
  await recordAudit({ ...getActorMetadata(c), action: "gate_scanner.revoked", entityType: "gate_scanner", entityId: scannerId, metadata: { gateId } });
  broadcastEvent("gates.table", { action: "scanner_revoked", id: gateId, scannerId });
  return c.json({ data: row });
});
