import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("access atomic contracts", () => {
  it("validates scan input before touching Postgres", async () => {
    const response = await app.request("/api/v1/access/scan", {
      method: "POST",
      body: JSON.stringify({})
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("ships the SQL atomic functions in a versioned migration", () => {
    const migration = readFileSync("drizzle/migrations/0001_access_atomic.sql", "utf8");

    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION access_scan_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION auto_close_access_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION verify_access_chain_v1");
  });
});
