import { describe, expect, it } from "bun:test";
import type { ApiHealth } from ".";

describe("shared contracts", () => {
  it("supports the health contract", () => {
    const payload: ApiHealth = {
      ok: true,
      service: "control-acceso-api",
      version: "0.1.0",
      checkedAt: new Date(0).toISOString()
    };

    expect(payload.ok).toBe(true);
  });
});
