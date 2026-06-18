import { Hono } from "hono";
import { z } from "zod";
import { toOperationalDateRange } from "../../shared/date-range";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { broadcastEvent } from "../events/events";
import { listAccessToday, runAccessScan, runAutoExits } from "./access.repository";

export const accessRoutes = new Hono();

accessRoutes.post("/scan", async (c) => {
  const body = z.object({
    token: z.string().trim().min(1).optional(),
    manualMatricula: z.string().trim().min(1).optional(),
    adminId: z.string().uuid().optional(),
    scannerId: z.string().trim().optional()
  }).refine((input) => input.token || input.manualMatricula, {
    message: "token or manualMatricula is required"
  }).parse(await c.req.json().catch(() => ({})));

  const result = await runAccessScan(withoutUndefined(body));
  broadcastEvent("access.scan", { result: result as Record<string, unknown> });
  broadcastEvent("access.table", {});
  broadcastEvent("attendance.table", {});

  return c.json({ data: result });
});

const accessTodayQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  personType: z.string().trim().min(1).optional(),
  accessMode: z.enum(["pedestrian", "vehicle", "visitor", "manual"]).optional(),
  status: z.enum(["in_progress", "completed", "auto_closed", "rejected"]).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

accessRoutes.get("/today", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(accessTodayQuerySchema.parse(c.req.query()));
  const range = toOperationalDateRange(query.date);
  const result = await listAccessToday({ ...query, from: range.from, to: range.to }, pagination);

  return c.json({
    data: paginated(result.rows, result.total, pagination, {
      date: range.date,
      filtered: Boolean(query.q || query.personType || query.accessMode || query.status)
    })
  });
});

accessRoutes.post("/auto-exits", async (c) => {
  const body = z.object({
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  }).parse(await c.req.json().catch(() => ({})));
  const result = await runAutoExits(body.targetDate);
  broadcastEvent("access.table", { autoExits: result as Record<string, unknown> });
  broadcastEvent("attendance.table", {});

  return c.json({ data: result });
});
