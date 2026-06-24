import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import { app } from "../src/app";

const migrationsDir = join(import.meta.dir, "../drizzle/migrations");
const modulesDir = join(import.meta.dir, "../src/modules");
const srcDir = join(import.meta.dir, "../src");

function readMigration(name: string) {
  return readFileSync(join(migrationsDir, name), "utf8");
}

function readModule(path: string) {
  return readFileSync(join(modulesDir, path), "utf8");
}

function readSource(path: string) {
  return readFileSync(join(srcDir, path), "utf8");
}

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
    const migration = readMigration("0001_access_atomic.sql");

    expect(migration).toContain("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION access_scan_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION auto_close_access_v1");
    expect(migration).toContain("CREATE OR REPLACE FUNCTION verify_access_chain_v1");
  });

  it("ships schema alignment for QR versioning and partial temporal uniqueness", () => {
    const migration = readMigration("0002_schema_alignment.sql");

    expect(migration).toContain("ALTER TABLE \"qr_tokens\" ADD COLUMN IF NOT EXISTS \"token_version\"");
    expect(migration).toContain("ALTER TABLE \"vehicle_permit_qr_tokens\" ADD COLUMN IF NOT EXISTS \"token_version\"");
    expect(migration).toContain("DROP INDEX IF EXISTS \"temporary_daily_qr_unique\"");
    expect(migration).toContain("WHERE \"status\" = 'active'");
    expect(migration).toContain("ALTER TABLE \"audit_log\" ADD COLUMN IF NOT EXISTS \"ip_address\"");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"user_sessions\"");
  });

  it("ships signed dynamic QR schema and anti-replay contracts", () => {
    const migration = readMigration("0003_signed_dynamic_qr.sql");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"qr_signing_keys\"");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"qr_jti_consumptions\"");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS \"jti\" uuid");
    expect(migration).toContain("v_safe_payload jsonb := payload - 'token' - 'signedQr'");
    expect(migration).toContain("WHERE NOT EXISTS (SELECT 1 FROM qr_jti_consumptions WHERE jti = v_pre_verified_jti)");
    expect(migration).toContain("'JTI_ALREADY_CONSUMED'");
  });

  it("ships user device binding schema for client-side QR proof", () => {
    const migration = readMigration("0004_user_device_binding.sql");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"user_device_keys\"");
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"user_device_challenges\"");
    expect(migration).toContain("\"public_key_jwk\" jsonb NOT NULL");
    expect(migration).toContain("\"used_at\" timestamptz");
    expect(migration).toContain("\"requireDeviceBinding\":false");
  });

  it("extends signed QR scope to temporary daily and vehicle permits", () => {
    const migration = readMigration("0005_signed_qr_scope_extension.sql");

    expect(migration).toContain("preVerifiedCredentialType");
    expect(migration).toContain("preVerifiedTemporaryDailyQrId");
    expect(migration).toContain("preVerifiedVehiclePermitId");
    expect(migration).toContain("v_pre_verified_credential_type = 'temporary_daily_qr'");
    expect(migration).toContain("v_pre_verified_credential_type = 'vehicle_permit_qr'");
    expect(migration).toContain("vehicle_permit_id");
    expect(migration).toContain("temporary_daily_qr_id");
    expect(migration).toContain("scanned_token_jti");
  });

  it("keeps the latest access scan function atomic and avoids raw signed payload leakage", () => {
    const migration = readMigration("0005_signed_qr_scope_extension.sql");

    expect(migration).toContain("PERFORM pg_advisory_xact_lock");
    expect(migration).toContain("v_safe_payload jsonb := payload - 'token' - 'signedQr'");
    expect(migration).toContain("INSERT INTO qr_jti_consumptions");
    expect(migration).toContain("WHERE NOT EXISTS (SELECT 1 FROM qr_jti_consumptions WHERE jti = v_pre_verified_jti)");
    expect(migration).toContain("UPDATE qr_jti_consumptions SET access_record_id = v_record.id WHERE jti = v_pre_verified_jti");
    expect(migration).not.toContain("metadata)\n    VALUES (v_pre_verified_person_id, 'person_qr', 'pedestrian', false, 'JTI_ALREADY_CONSUMED',");
  });

  it("keeps the latest access scan function bound to the operational timezone", () => {
    const migration = readMigration("0005_signed_qr_scope_extension.sql");

    expect(migration).toContain("v_operational_timezone text := 'America/Cancun'");
    expect(migration).toContain("v_operational_date date := (v_now AT TIME ZONE v_operational_timezone)::date");
    expect(migration).toContain("v_operational_dow integer := EXTRACT(DOW FROM (v_now AT TIME ZONE v_operational_timezone))::integer");
    expect(migration).toContain("t.operational_date = v_operational_date");
    expect(migration).toContain("s.weekday = v_operational_dow");
  });

  it("derives access scan admin identity from the authenticated session", () => {
    const source = readModule("access/access.routes.ts");

    expect(source).toContain("const session = getAdminSession(c)");
    expect(source).toContain("adminId: session.adminId");
    expect(source).not.toContain("adminId: body.adminId");
    expect(source).not.toContain("adminId: z.string().uuid().optional()");
  });

  it("derives audit actor ids from the authenticated session for mutable admin routes", () => {
    const hotQrRoutes = readModule("hot-qr/hot-qr.routes.ts");
    const credentialsRoutes = readModule("credentials/credentials.routes.ts");
    const vehiclesRoutes = readModule("vehicles/vehicles.routes.ts");
    const configRoutes = readModule("config/config.routes.ts");

    expect(hotQrRoutes).toContain("createdByAdminId: session.adminId");
    expect(credentialsRoutes).toContain("createdByAdminId: session.adminId");
    expect(vehiclesRoutes).toContain("createdByAdminId: session.adminId");
    expect(configRoutes).toContain("updatedByAdminId: session.adminId");

    expect(hotQrRoutes).not.toContain("createdByAdminId: z.string().uuid().optional()");
    expect(credentialsRoutes).not.toContain("createdByAdminId: z.string().uuid().optional()");
    expect(vehiclesRoutes).not.toContain("createdByAdminId: z.string().uuid().optional()");
    expect(configRoutes).not.toContain("updatedByAdminId: z.string().uuid().optional()");
  });

  it("ships a durable login rate-limit table for production deployments", () => {
    const migration = readMigration("0006_durable_rate_limit.sql");

    expect(migration).toContain("CREATE TABLE IF NOT EXISTS \"login_rate_limits\"");
    expect(migration).toContain("\"key\" text PRIMARY KEY");
    expect(migration).toContain("\"locked_until\" timestamptz");
  });

  it("ships S3-compatible storage for R2/S3 instead of local-only placeholders", () => {
    const envSource = readSource("config/env.ts");
    const storageSource = readSource("shared/storage.ts");
    const filesRoutes = readModule("files/files.routes.ts");

    expect(envSource).toContain("STORAGE_DRIVER: z.enum([\"local\", \"s3\", \"r2\"])");
    expect(envSource).toContain("STORAGE_BUCKET");
    expect(envSource).toContain("STORAGE_ENDPOINT");
    expect(envSource).toContain("STORAGE_ACCESS_KEY_ID");
    expect(envSource).toContain("STORAGE_SECRET_ACCESS_KEY");
    expect(envSource).toContain("STORAGE_SIGNED_URL_TTL_SECONDS");

    expect(storageSource).toContain("@aws-sdk/client-s3");
    expect(storageSource).toContain("@aws-sdk/s3-request-presigner");
    expect(storageSource).toContain("class S3CompatibleStorageAdapter implements StorageAdapter");
    expect(storageSource).toContain("new PutObjectCommand");
    expect(storageSource).toContain("new DeleteObjectCommand");
    expect(storageSource).toContain("new GetObjectCommand");
    expect(storageSource).toContain("getSignedUrl");
    expect(storageSource).toContain("requireStorageConfig(config, config.STORAGE_BUCKET, \"BUCKET\")");
    expect(storageSource).toContain("options: { s3Client?: S3Client; signedUrlFactory?: SignedUrlFactory }");
    expect(storageSource).not.toContain("S3_STORAGE_NOT_CONFIGURED");
    expect(storageSource).not.toContain("R2_STORAGE_NOT_CONFIGURED");

    expect(filesRoutes).toContain("storageAdapter.signedUrl(file.objectKey)");
    expect(filesRoutes).toContain("c.redirect(await storageAdapter.signedUrl(file.objectKey), 302)");
  });

  it("keeps attendance catalogs paginated and filterable for the admin UI", () => {
    const attendanceRoutes = readModule("attendance/attendance.routes.ts");
    const attendanceRepository = readModule("attendance/attendance.repository.ts");

    expect(attendanceRoutes).toContain("const subjectQuerySchema");
    expect(attendanceRoutes).toContain("const scheduleQuerySchema");
    expect(attendanceRoutes).toContain("const pagination = parsePagination(c.req.query())");
    expect(attendanceRoutes).toContain("data: paginated(result.rows, result.total, pagination");

    expect(attendanceRepository).toContain("export async function listSubjects(filters: SubjectFilters, pagination: Pagination)");
    expect(attendanceRepository).toContain("export async function listSchedules(filters: ScheduleFilters, pagination: Pagination)");
    expect(attendanceRepository).toContain("ilike(subjects.clave, q)");
    expect(attendanceRepository).toContain("ilike(personas.matricula, q)");
    expect(attendanceRepository).toContain(".limit(pagination.pageSize)");
    expect(attendanceRepository).toContain(".offset(pagination.offset)");
    expect(attendanceRepository).not.toContain(".limit(200)");
  });

  it("keeps personal credential history paginated for the admin UI", () => {
    const credentialsRoutes = readModule("credentials/credentials.routes.ts");
    const credentialsRepository = readModule("credentials/credentials.repository.ts");

    expect(credentialsRoutes).toContain("credentialsRoutes.get(\"/person/:personId\"");
    expect(credentialsRoutes).toContain("const pagination = parsePagination(c.req.query())");
    expect(credentialsRoutes).toContain("paginated(result.rows, result.total, pagination)");
    expect(credentialsRepository).toContain("export async function listPersonQrTokens(personId: string, pagination: Pagination)");
    expect(credentialsRepository).toContain(".limit(pagination.pageSize)");
    expect(credentialsRepository).toContain(".offset(pagination.offset)");
  });
});
