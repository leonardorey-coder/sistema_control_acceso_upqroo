import { and, desc, eq, or, sql } from "drizzle-orm";
import { db } from "../../db/client";
import { administradores, scannerDeviceChallenges, scannerDevices } from "../../db/schema";
import { withoutUndefined } from "../../shared/object";

export function listScannerDevices() {
  return db.select({
    id: scannerDevices.id,
    code: scannerDevices.code,
    label: scannerDevices.label,
    algorithm: scannerDevices.algorithm,
    status: scannerDevices.status,
    createdBy: administradores.displayName,
    requestedByAdminId: scannerDevices.requestedByAdminId,
    registeredByAdminId: scannerDevices.registeredByAdminId,
    approvedByAdminId: scannerDevices.approvedByAdminId,
    revokedByAdminId: scannerDevices.revokedByAdminId,
    lastSeenAt: scannerDevices.lastSeenAt,
    metadata: scannerDevices.metadata,
    createdAt: scannerDevices.createdAt,
    registeredAt: scannerDevices.registeredAt,
    approvedAt: scannerDevices.approvedAt,
    revokedAt: scannerDevices.revokedAt
  })
    .from(scannerDevices)
    .leftJoin(administradores, eq(scannerDevices.createdByAdminId, administradores.id))
    .orderBy(desc(scannerDevices.createdAt));
}

export async function createScannerDevice(input: typeof scannerDevices.$inferInsert) {
  const [row] = await db.insert(scannerDevices).values(input).returning({
    id: scannerDevices.id,
    code: scannerDevices.code,
    label: scannerDevices.label,
    algorithm: scannerDevices.algorithm,
    status: scannerDevices.status,
    metadata: scannerDevices.metadata,
    createdAt: scannerDevices.createdAt
  });

  return row!;
}

export async function getScannerDeviceById(id: string) {
  return db.query.scannerDevices.findFirst({
    where: eq(scannerDevices.id, id)
  });
}

export function getVisibleScannerDevice(input: {
  id: string;
  adminId: string;
}) {
  return db.query.scannerDevices.findFirst({
    where: and(
      eq(scannerDevices.id, input.id),
      or(
        eq(scannerDevices.requestedByAdminId, input.adminId),
        eq(scannerDevices.registeredByAdminId, input.adminId),
        eq(scannerDevices.status, "active")
      )
    )
  });
}

export async function requestScannerDevice(input: {
  code: string;
  label: string;
  publicKeyJwk: Record<string, unknown>;
  adminId: string;
  metadata?: Record<string, unknown>;
}) {
  const [row] = await db.insert(scannerDevices).values({
    code: input.code,
    label: input.label,
    publicKeyJwk: input.publicKeyJwk,
    algorithm: "ES256",
    status: "pending",
    requestedByAdminId: input.adminId,
    registeredByAdminId: input.adminId,
    registeredAt: new Date(),
    metadata: input.metadata ?? {}
  }).returning({
    id: scannerDevices.id,
    code: scannerDevices.code,
    label: scannerDevices.label,
    algorithm: scannerDevices.algorithm,
    status: scannerDevices.status,
    registeredAt: scannerDevices.registeredAt
  });

  return row!;
}

export async function registerScannerDevice(input: {
  code: string;
  label?: string;
  publicKeyJwk: Record<string, unknown>;
  adminId: string;
}) {
  const [row] = await db.update(scannerDevices)
    .set(withoutUndefined({
      label: input.label,
      publicKeyJwk: input.publicKeyJwk,
      algorithm: "ES256" as const,
      status: "active" as const,
      registeredByAdminId: input.adminId,
      registeredAt: new Date()
    }))
    .where(and(
      eq(scannerDevices.code, input.code),
      eq(scannerDevices.status, "pending")
    ))
    .returning({
      id: scannerDevices.id,
      code: scannerDevices.code,
      label: scannerDevices.label,
      algorithm: scannerDevices.algorithm,
      status: scannerDevices.status,
      registeredAt: scannerDevices.registeredAt
    });

  return row;
}

export async function approveScannerDevice(input: {
  id: string;
  adminId: string;
}) {
  const [row] = await db.update(scannerDevices)
    .set({
      status: "active",
      approvedByAdminId: input.adminId,
      approvedAt: new Date()
    })
    .where(and(
      eq(scannerDevices.id, input.id),
      eq(scannerDevices.status, "pending")
    ))
    .returning({
      id: scannerDevices.id,
      code: scannerDevices.code,
      label: scannerDevices.label,
      status: scannerDevices.status,
      approvedAt: scannerDevices.approvedAt
    });

  return row;
}

export async function revokeScannerDevice(input: {
  id: string;
  adminId: string;
}) {
  const [row] = await db.update(scannerDevices)
    .set({
      status: "revoked",
      revokedByAdminId: input.adminId,
      revokedAt: new Date()
    })
    .where(eq(scannerDevices.id, input.id))
    .returning({
      id: scannerDevices.id,
      code: scannerDevices.code,
      label: scannerDevices.label,
      status: scannerDevices.status,
      revokedAt: scannerDevices.revokedAt
    });

  return row;
}

export async function createScannerDeviceChallenge(input: {
  deviceId: string;
  adminId: string;
  challenge: string;
  expiresAt: Date;
}) {
  const [row] = await db.execute<{
    id: string;
    challenge: string;
    expires_at: Date;
    scanner_code: string;
  }>(sql`
    INSERT INTO scanner_device_challenges (device_id, admin_id, challenge, expires_at)
    SELECT ${input.deviceId}, ${input.adminId}, ${input.challenge}, ${input.expiresAt.toISOString()}::timestamptz
    FROM scanner_devices
    WHERE id = ${input.deviceId}
      AND status = 'active'
      AND public_key_jwk IS NOT NULL
    RETURNING id, challenge, expires_at, (
      SELECT code FROM scanner_devices WHERE id = ${input.deviceId}
    ) as scanner_code
  `);

  if (!row) return null;

  return {
    id: row.id,
    challenge: row.challenge,
    expiresAt: row.expires_at,
    scannerCode: row.scanner_code
  };
}

export async function consumeScannerDeviceChallenge(input: {
  deviceId: string;
  adminId: string;
  challengeId: string;
}) {
  const [row] = await db.execute<{
    challenge_id: string;
    challenge: string;
    public_key_jwk: Record<string, unknown>;
    algorithm: string;
    scanner_code: string;
  }>(sql`
    WITH consumed AS (
      UPDATE scanner_device_challenges c
      SET used_at = now()
      FROM scanner_devices d
      WHERE c.id = ${input.challengeId}
        AND c.device_id = ${input.deviceId}
        AND c.admin_id = ${input.adminId}
        AND c.used_at IS NULL
        AND c.expires_at > now()
        AND d.id = c.device_id
        AND d.status = 'active'
        AND d.public_key_jwk IS NOT NULL
      RETURNING c.id, c.challenge, d.public_key_jwk, d.algorithm, d.code
    )
    SELECT id as challenge_id, challenge, public_key_jwk, algorithm, code as scanner_code
    FROM consumed
  `);

  return row;
}

export async function markScannerDeviceSeen(deviceId: string) {
  const [row] = await db.update(scannerDevices)
    .set({ lastSeenAt: new Date() })
    .where(eq(scannerDevices.id, deviceId))
    .returning({
      id: scannerDevices.id,
      code: scannerDevices.code,
      lastSeenAt: scannerDevices.lastSeenAt
    });

  return row;
}
