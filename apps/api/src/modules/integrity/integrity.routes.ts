import { Hono } from "hono";
import { z } from "zod";
import { verifyAccessChain } from "./integrity.repository";

export const integrityRoutes = new Hono();

integrityRoutes.get("/access-chain", async (c) => {
  const query = z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional()
  }).parse(c.req.query());

  const result = await verifyAccessChain(query.from, query.to);
  return c.json({ data: result });
});
