import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("health route", () => {
  it("returns service status", async () => {
    const response = await app.request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.service).toBe("control-acceso-api");
  });
});
