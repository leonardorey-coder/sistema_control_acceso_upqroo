import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("access atomic contracts", () => {
  it("keeps scan behind the SQL atomic implementation boundary", async () => {
    const response = await app.request("/api/v1/access/scan", {
      method: "POST",
      body: JSON.stringify({ token: "demo" })
    });
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error.code).toBe("ATOMIC_SQL_REQUIRED");
  });

  it("keeps integrity verification behind the SQL implementation boundary", async () => {
    const response = await app.request("/api/v1/integrity/access-chain");
    const body = await response.json();

    expect(response.status).toBe(501);
    expect(body.error.code).toBe("ATOMIC_SQL_REQUIRED");
  });
});
