import { afterEach, describe, expect, it } from "bun:test";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { administradores } from "../src/db/schema";
import {
  approveScannerDevice,
  createScannerDeviceChallenge,
  requestScannerDevice
} from "../src/modules/scanner-devices/scanner-devices.repository";
import {
  buildScannerScanMessage,
  hashScannerScanPayload,
  verifyScannerDeviceProof
} from "../src/modules/scanner-devices/scanner-devices.service";
import { HttpError } from "../src/shared/http-error";

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function canUseScannerDeviceTables() {
  try {
    const [row] = await db.execute<{ exists: string | null }>(
      sql`select to_regclass('public.scanner_devices')::text as exists`
    );
    return Boolean(row?.exists);
  } catch {
    return false;
  }
}

describe("scanner device proof helpers", () => {
  it("hashes scan payloads with stable field order", async () => {
    const payloadHash = await hashScannerScanPayload({
      signedQr: "jwt",
      scannerCode: "caseta-principal-01"
    });
    const sameHash = await hashScannerScanPayload({
      scannerCode: "caseta-principal-01",
      signedQr: "jwt"
    });

    expect(payloadHash).toBe(sameHash);
    expect(payloadHash.length).toBeGreaterThan(20);
  });

  it("builds a namespaced scanner-auth message", () => {
    expect(buildScannerScanMessage({
      adminId: "admin-id",
      scannerDeviceId: "device-id",
      scannerCode: "caseta-principal-01",
      challenge: "challenge",
      payloadHash: "hash"
    })).toBe("control-acceso-upqroo.scanner-scan.v1.admin-id.device-id.caseta-principal-01.challenge.hash");
  });

  it("requires a complete scanner proof", async () => {
    await expect(verifyScannerDeviceProof({
      adminId: "admin-id",
      payload: { scannerCode: "caseta-principal-01" }
    })).rejects.toMatchObject({
      code: "SCANNER_DEVICE_REQUIRED"
    });
  });
});

const hasScannerTables = await canUseScannerDeviceTables();
const describeIfScannerTables = hasScannerTables ? describe : describe.skip;

afterEach(async () => {
  if (!hasScannerTables) return;

  await db.execute(sql`
    DELETE FROM scanner_device_challenges
    WHERE device_id IN (
      SELECT id FROM scanner_devices WHERE code LIKE 'caseta-test-%'
    )
  `);
  await db.execute(sql`DELETE FROM scanner_devices WHERE code LIKE 'caseta-test-%'`);
  await db.execute(sql`DELETE FROM administradores WHERE username LIKE 'scanner_test_%'`);
});

describeIfScannerTables("scanner devices with postgres", () => {
  it("registers a scanner and verifies a real device signature", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const [admin] = await db.insert(administradores).values({
      username: `scanner_test_admin_${suffix}`,
      displayName: "Scanner Admin",
      passwordHash: "test"
    }).returning();
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    );
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey) as Record<string, unknown>;
    const scanner = await requestScannerDevice({
      code: `caseta-test-${suffix}`,
      label: "Caseta test",
      publicKeyJwk,
      adminId: admin!.id
    });
    const approved = await approveScannerDevice({
      id: scanner.id,
      adminId: admin!.id
    });
    const challenge = await createScannerDeviceChallenge({
      deviceId: scanner.id,
      adminId: admin!.id,
      challenge: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60_000)
    });
    const payload = { signedQr: "jwt", scannerCode: scanner.code };
    const payloadHash = await hashScannerScanPayload(payload);
    const message = buildScannerScanMessage({
      adminId: admin!.id,
      scannerDeviceId: scanner.id,
      scannerCode: scanner.code,
      challenge: challenge!.challenge,
      payloadHash
    });
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(message)
    );

    await expect(verifyScannerDeviceProof({
      adminId: admin!.id,
      scannerDeviceId: scanner.id,
      scannerCode: scanner.code,
      scannerChallengeId: challenge!.id,
      scannerSignature: toBase64Url(signature),
      payload
    })).resolves.toMatchObject({
      scannerDeviceId: scanner.id,
      scannerCode: scanner.code
    });
    expect(approved?.status).toBe("active");
  });

  it("rejects invalid scanner signatures", async () => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const [admin] = await db.insert(administradores).values({
      username: `scanner_test_bad_${suffix}`,
      displayName: "Scanner Bad",
      passwordHash: "test"
    }).returning();
    const pair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign", "verify"]
    );
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey) as Record<string, unknown>;
    const scanner = await requestScannerDevice({
      code: `caseta-test-bad-${suffix}`,
      label: "Caseta bad",
      publicKeyJwk,
      adminId: admin!.id
    });
    await approveScannerDevice({
      id: scanner.id,
      adminId: admin!.id
    });
    const challenge = await createScannerDeviceChallenge({
      deviceId: scanner.id,
      adminId: admin!.id,
      challenge: crypto.randomUUID(),
      expiresAt: new Date(Date.now() + 60_000)
    });

    await expect(verifyScannerDeviceProof({
      adminId: admin!.id,
      scannerDeviceId: scanner.id,
      scannerCode: scanner.code,
      scannerChallengeId: challenge!.id,
      scannerSignature: "invalid",
      payload: { scannerCode: scanner.code }
    })).rejects.toBeInstanceOf(HttpError);
  });
});
