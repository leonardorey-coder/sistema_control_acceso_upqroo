import { Hono } from "hono";
import { z } from "zod";
import { atomicBackendContracts } from "../../shared/contracts";
import { toOperationalDateRange } from "../../shared/date-range";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { listAccessToday } from "./access.repository";

export const accessRoutes = new Hono();

accessRoutes.post("/scan", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    error: {
      code: "ATOMIC_SQL_REQUIRED",
      message: atomicBackendContracts.scanAccess,
      received: body
    }
  }, 501);
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
  return c.json({
    error: {
      code: "ATOMIC_SQL_REQUIRED",
      message: atomicBackendContracts.autoExits
    }
  }, 501);
});
