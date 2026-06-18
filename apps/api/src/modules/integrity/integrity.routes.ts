import { Hono } from "hono";
import { atomicBackendContracts } from "../../shared/contracts";

export const integrityRoutes = new Hono();

integrityRoutes.get("/access-chain", async (c) => {
  return c.json({
    error: {
      code: "ATOMIC_SQL_REQUIRED",
      message: atomicBackendContracts.integrityVerification
    }
  }, 501);
});
