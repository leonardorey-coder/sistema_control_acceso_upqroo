import { Hono } from "hono";

export const accessRoutes = new Hono();

accessRoutes.post("/scan", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    data: {
      accepted: false,
      reasonCode: "NOT_IMPLEMENTED",
      received: body
    }
  }, 501);
});
