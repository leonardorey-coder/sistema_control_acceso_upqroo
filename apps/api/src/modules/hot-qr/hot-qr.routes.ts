import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { toOperationalDateRange } from "../../shared/date-range";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { stripSecretFields } from "../../shared/sanitize";
import { issueOpaqueToken } from "../../shared/security";
import { broadcastEvent } from "../events/events";
import { createHotQr, listHotQrToday, revokeHotQr } from "./hot-qr.repository";

const hotQrQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["active", "used", "expired", "revoked", "disabled"]).optional(),
  creatorId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const hotQrRoutes = new Hono();

const hotQrCreateSchema = z.object({
  visitorName: z.string().trim().min(1).max(160),
  reason: z.string().trim().min(1),
  maxUses: z.number().int().min(1).max(10).default(1),
  validUntil: z.coerce.date(),
  createdByAdminId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).default({})
});

hotQrRoutes.get("/today", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(hotQrQuerySchema.parse(c.req.query()));
  const range = toOperationalDateRange(query.date);
  const result = await listHotQrToday({ ...query, from: range.from, to: range.to }, pagination);

  return c.json({
    data: paginated(result.rows, result.total, pagination, {
      date: range.date,
      filtered: Boolean(query.q || query.status || query.creatorId)
    })
  });
});

hotQrRoutes.post("/", async (c) => {
  const input = hotQrCreateSchema.parse(await c.req.json());
  const issued = issueOpaqueToken("hot_qr");
  const row = await createHotQr({
    ...input,
    tokenHash: issued.tokenHash
  });

  if (!row) {
    throw new Error("Failed to create Hot-QR");
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "hot_qr.created",
    entityType: "hot_qr",
    entityId: row.id,
    metadata: { visitorName: row.visitorName, validUntil: row.validUntil }
  });

  broadcastEvent("hot-qr.table", { action: "created", id: row.id });
  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

hotQrRoutes.post("/:id/revoke", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await revokeHotQr(id);

  if (!row) {
    return c.json({ error: { code: "HOT_QR_NOT_FOUND" } }, 404);
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "hot_qr.revoked",
    entityType: "hot_qr",
    entityId: id
  });

  broadcastEvent("hot-qr.table", { action: "revoked", id });
  return c.json({ data: stripSecretFields(row) });
});
