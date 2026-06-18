import { Hono } from "hono";
import { z } from "zod";
import { listPeople } from "./people.repository";

export const peopleRoutes = new Hono();

peopleRoutes.get("/", async (c) => {
  const query = z.object({
    limit: z.coerce.number().int().min(1).max(50).default(25)
  }).parse(c.req.query());

  const people = await listPeople();
  return c.json({ data: people.slice(0, query.limit) });
});
