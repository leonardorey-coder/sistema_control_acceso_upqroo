import { readFileSync } from "node:fs";
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

describe("access atomic contracts", () => {
  it("protects scan before touching Postgres", async () => {
    const response = await app.request("/api/v1/access/scan", {
      method: "POST",
      body: JSON.stringify({})
    });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("SESSION_REQUIRED");
  });

  it("ships the SQL atomic functions in a versioned migration", () => {
    const migration = readFileSync("drizzle/migrations/0001_access_atomic.sql", "utf8");

    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION access_scan_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION auto_close_access_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION verify_access_chain_v1");
  });

  it("ships schema alignment for QR versioning and partial temporal uniqueness", () => {
    const migration = readFileSync("drizzle/migrations/0002_schema_alignment.sql", "utf8");

    expect(migration).toContain("ALTER TABLE \"qr_tokens\" ADD COLUMN IF NOT EXISTS \"token_version\"");
    expect(migration).toContain("ALTER TABLE \"vehicle_permit_qr_tokens\" ADD COLUMN IF NOT EXISTS \"token_version\"");
    expect(migration).toContain("DROP INDEX IF EXISTS \"temporary_daily_qr_unique\"");
    expect(migration).toContain("WHERE \"status\" = 'active'");
    expect(migration).toContain("ALTER TABLE \"audit_log\" ADD COLUMN IF NOT EXISTS \"ip_address\"");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"user_sessions\"");
  });
});
