import { Hono } from "hono";
import { z } from "zod";
import { toOperationalDateRange } from "../../shared/date-range";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { listHotQrToday } from "./hot-qr.repository";

const hotQrQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  status: z.enum(["active", "used", "expired", "revoked", "disabled"]).optional(),
  creatorId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export const hotQrRoutes = new Hono();

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
