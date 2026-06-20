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

  it("ships signed dynamic QR schema and anti-replay contracts", () => {
    const migration = readFileSync("drizzle/migrations/0003_signed_dynamic_qr.sql", "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"qr_signing_keys\"");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"qr_jti_consumptions\"");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS \"jti\" uuid");
    expect(migration).toContain("v_safe_payload jsonb := payload - 'token' - 'signedQr'");
    expect(migration).toContain("WHERE NOT EXISTS (SELECT 1 FROM qr_jti_consumptions WHERE jti = v_pre_verified_jti)");
    expect(migration).toContain("'JTI_ALREADY_CONSUMED'");
  });

  it("ships user device binding schema for client-side QR proof", () => {
    const migration = readFileSync("drizzle/migrations/0004_user_device_binding.sql", "utf8");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"user_device_keys\"");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"user_device_challenges\"");
    expect(migration).toContain("\"public_key_jwk\" jsonb NOT NULL");
    expect(migration).toContain("\"used_at\" timestamptz");
    expect(migration).toContain("\"requireDeviceBinding\":false");
  });
});
