import { Hono } from "hono";

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  return c.json({
    data: {
      status: "not_implemented",
      receivedIdentity: typeof body.identity === "string"
    }
  }, 501);
});
