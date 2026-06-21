import { describe, expect, it } from "bun:test";
import { errors as JoseErrors } from "jose";
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../src/db/client";
import { signDynamicQr, verifyDynamicQr } from "../src/modules/qr-signing/qr-signing.service";

async function canUsePostgres() {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const describeIfPostgres = await canUsePostgres() ? describe : describe.skip;

describeIfPostgres("signed dynamic QR", () => {
  it("signs and verifies a personal QR with short-lived claims", async () => {
    const personId = randomUUID();
    const { token, expiresAt, jti } = await signDynamicQr({
      sub: personId,
      uid: "202300120",
      typ: "person_qr"
    }, 15);

    const verified = await verifyDynamicQr(token);

    expect(token.split(".")).toHaveLength(3);
    expect(verified.sub).toBe(personId);
    expect(verified.uid).toBe("202300120");
    expect(verified.typ).toBe("person_qr");
    expect(verified.jti).toBe(jti);
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("requires scoped ids for temporary and vehicle QR types", async () => {
    const personId = randomUUID();
    const temporaryDailyQrId = randomUUID();
    const vehiclePermitId = randomUUID();

    const temporary = await signDynamicQr({
      sub: personId,
      uid: "202300120",
      typ: "temporary_daily_qr",
      temporaryDailyQrId
    }, 15);
    const vehicle = await signDynamicQr({
      sub: personId,
      uid: "202300120",
      typ: "vehicle_permit_qr",
      vehiclePermitId
    }, 15);

    await expect(verifyDynamicQr(temporary.token)).resolves.toMatchObject({
      typ: "temporary_daily_qr",
      temporaryDailyQrId
    });
    await expect(verifyDynamicQr(vehicle.token)).resolves.toMatchObject({
      typ: "vehicle_permit_qr",
      vehiclePermitId
    });
  });

  it("rejects expired signed QR tokens", async () => {
    const { token } = await signDynamicQr({
      sub: randomUUID(),
      uid: "202300120",
      typ: "person_qr"
    }, -1);

    await expect(verifyDynamicQr(token, 0)).rejects.toBeInstanceOf(JoseErrors.JWTExpired);
  });

  it("rejects tampered tokens", async () => {
    const { token } = await signDynamicQr({
      sub: randomUUID(),
      uid: "202300120",
      typ: "person_qr"
    }, 15);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.invalid-signature`;

    await expect(verifyDynamicQr(tampered)).rejects.toThrow();
  });
});
