import { Hono } from "hono";
import { z } from "zod";
import { listCareers } from "./careers.repository";

export const careersRoutes = new Hono();

careersRoutes.get("/", async (c) => {
  const query = z.object({
    includeInactive: z.coerce.boolean().default(false)
  }).parse(c.req.query());
  const rows = await listCareers(query.includeInactive);
  return c.json({ data: { rows } });
});
