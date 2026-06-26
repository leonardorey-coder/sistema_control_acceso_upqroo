import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import {
  accessScanEvents,
  administradores,
  operationalConfig,
  personas,
  qrJtiConsumptions,
  registrosAcceso,
  temporaryDailyQrTokens,
  userAccounts
} from "../src/db/schema";
import { currentOperationalDate } from "../src/shared/date-range";
import { signDynamicQr } from "../src/modules/qr-signing/qr-signing.service";
import { runWorkerCycle } from "../src/worker";

async function canUsePostgres() {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const describeIfPostgres = await canUsePostgres() ? describe : describe.skip;

function jsonHeaders(cookie?: string) {
  return {
    "content-type": "application/json",
    ...(cookie ? { cookie } : {})
  };
}

async function ensureIntegrationAdmin() {
  const username = "integration_super";
  const password = "Integration123!";
  const existing = await db.query.administradores.findFirst({
    where: eq(administradores.username, username)
  });

  if (!existing) {
    await db.insert(administradores).values({
      username,
      displayName: "Integration Super Admin",
      passwordHash: await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 }),
      role: "super_admin",
      status: "active",
      mustChangePassword: false
    });
  }

  return { username, password };
}

async function getAdminByUsername(username: string) {
  const admin = await db.query.administradores.findFirst({
    where: eq(administradores.username, username)
  });

  if (!admin) throw new Error(`Missing admin ${username}`);
  return admin;
}

async function ensureSpoofTargetAdmin() {
  const username = "integration_spoof_target";
  const existing = await db.query.administradores.findFirst({
    where: eq(administradores.username, username)
  });

  if (existing) return existing;

  const [admin] = await db.insert(administradores).values({
    username,
    displayName: "Integration Spoof Target",
    passwordHash: await Bun.password.hash("Integration123!", { algorithm: "bcrypt", cost: 10 }),
    role: "admin",
    status: "active",
    mustChangePassword: false
  }).returning();

  return admin!;
}

async function ensurePortalUser() {
  const suffix = randomUUID().slice(0, 8);
  const password = "Portal123!";
  const [person] = await db.insert(personas).values({
    matricula: `PU-${suffix}`,
    nombres: "Portal",
    apellidos: "Integracion",
    tipoPersona: "docente",
    estado: "activo"
  }).returning();
  const email = `portal-${suffix}@example.test`;
  const [account] = await db.insert(userAccounts).values({
    personId: person!.id,
    email,
    passwordHash: await Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 }),
    status: "active",
    mustChangePassword: false
  }).returning();

  return { account: account!, person: person!, email, password };
}

async function createActivePerson(prefix: string) {
  const suffix = randomUUID().slice(0, 8);
  const [person] = await db.insert(personas).values({
    matricula: `${prefix}-${suffix}`,
    nombres: prefix,
    apellidos: "Firmado",
    tipoPersona: "docente",
    estado: "activo"
  }).returning();

  return person!;
}

async function enableSignedQr() {
  await db.insert(operationalConfig).values({
    key: "signed_qr",
    value: {
      enabled: true,
      ttlSeconds: 30,
      clockToleranceSeconds: 5,
      compatibilityOpaqueTokens: true,
      requireDeviceBinding: false
    },
    description: "Integration signed QR config"
  }).onConflictDoUpdate({
    target: operationalConfig.key,
    set: {
      value: {
        enabled: true,
        ttlSeconds: 30,
        clockToleranceSeconds: 5,
        compatibilityOpaqueTokens: true,
        requireDeviceBinding: false
      },
      description: "Integration signed QR config",
      updatedAt: new Date()
    }
  });
}

async function loginPortalUser() {
  const portalUser = await ensurePortalUser();
  const loginResponse = await app.request("/api/v1/portal/auth/login", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      identity: portalUser.email,
      password: portalUser.password
    })
  });

  expect(loginResponse.status).toBe(200);
  return {
    ...portalUser,
    cookie: loginResponse.headers.get("set-cookie") ?? ""
  };
}

async function scanSignedQr(adminCookie: string, token: string) {
  const response = await app.request("/api/v1/access/scan", {
    method: "POST",
    headers: jsonHeaders(adminCookie),
    body: JSON.stringify({ signedQr: token, scannerId: "integration-scanner" })
  });
  const body = await response.json();

  expect(response.status).toBe(200);
  return body.data as Record<string, unknown>;
}

async function expectSignedQrPersisted(
  jti: string,
  registroId: string,
  credentialType: "person_qr" | "temporary_daily_qr" | "vehicle_permit_qr"
) {
  const accessRecord = await db.query.registrosAcceso.findFirst({
    where: eq(registrosAcceso.id, registroId)
  });
  const consumption = await db.query.qrJtiConsumptions.findFirst({
    where: eq(qrJtiConsumptions.jti, jti)
  });
  const event = await db.query.accessScanEvents.findFirst({
    where: eq(accessScanEvents.jti, jti)
  });

  expect(accessRecord?.scannedTokenJti).toBe(jti);
  expect(consumption?.jti).toBe(jti);
  expect(consumption?.accessRecordId).toBe(registroId);
  expect(event?.signatureVerified).toBe(true);
  expect(event?.credentialType).toBe(credentialType);
}

function tamperJwt(token: string) {
  const parts = token.split(".");
  return `${parts[0]}.${parts[1]}.invalid-signature`;
}

function expectCookieSecurity(setCookie: string, cookieName: string) {
  expect(setCookie).toContain(`${cookieName}=`);
  expect(setCookie).toContain("HttpOnly");
  expect(setCookie).toContain("SameSite=Lax");
  expect(setCookie).toContain("Path=/");
  expect(setCookie).not.toContain("passwordHash");
  expect(setCookie).not.toContain("sessionHash");
}

function expectNoSecretFieldNames(payload: unknown) {
  const serialized = JSON.stringify(payload);

  expect(serialized).not.toContain("passwordHash");
  expect(serialized).not.toContain("sessionHash");
  expect(serialized).not.toContain("tokenHash");
}

describeIfPostgres("postgres integration", () => {
  let cookie = "";
  let sessionAdminId = "";
  let spoofAdminId = "";

  beforeAll(async () => {
    const admin = await ensureIntegrationAdmin();
    sessionAdminId = (await getAdminByUsername(admin.username)).id;
    spoofAdminId = (await ensureSpoofTargetAdmin()).id;
    const response = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identity: admin.username, password: admin.password })
    });

    expect(response.status).toBe(200);
    cookie = response.headers.get("set-cookie") ?? "";
    expectCookieSecurity(cookie, "ca_session");
  });

  it("returns public admin session and admin lists without stored hashes", async () => {
    const meResponse = await app.request("/api/v1/auth/me", {
      headers: jsonHeaders(cookie)
    });
    const meBody = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meBody.data.admin.username).toBe("integration_super");
    expectNoSecretFieldNames(meBody);

    const adminsResponse = await app.request("/api/v1/admins", {
      headers: jsonHeaders(cookie)
    });
    const adminsBody = await adminsResponse.json();

    expect(adminsResponse.status).toBe(200);
    expect(adminsBody.data.rows.length).toBeGreaterThan(0);
    expectNoSecretFieldNames(adminsBody);
  });

  it("creates a person QR and scans entry, exit and integrity", async () => {
    const suffix = randomUUID().slice(0, 8);
    const matricula = `IT-${suffix}`;

    const personResponse = await app.request("/api/v1/people", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        matricula,
        nombres: "Integracion",
        apellidos: "Backend",
        tipoPersona: "docente",
        estado: "activo"
      })
    });
    const personBody = await personResponse.json();

    expect(personResponse.status).toBe(201);
    expect(personBody.data.matricula).toBe(matricula);

    const qrResponse = await app.request("/api/v1/credentials/person", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        personId: personBody.data.id,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString()
      })
    });
    const qrBody = await qrResponse.json();

    expect(qrResponse.status).toBe(201);
    expect(qrBody.data.token).toStartWith("person_qr_");
    expect(qrBody.data.credential.tokenHash).toBeUndefined();
    expectNoSecretFieldNames(qrBody.data.credential);

    const entryResponse = await app.request("/api/v1/access/scan", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ token: qrBody.data.token })
    });
    const entryBody = await entryResponse.json();

    expect(entryResponse.status).toBe(200);
    expect(entryBody.data.accepted).toBe(true);
    expect(entryBody.data.action).toBe("entry");
    expect(entryBody.data.matricula).toBe(matricula);

    const exitResponse = await app.request("/api/v1/access/scan", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ token: qrBody.data.token })
    });
    const exitBody = await exitResponse.json();

    expect(exitResponse.status).toBe(200);
    expect(exitBody.data.accepted).toBe(true);
    expect(exitBody.data.action).toBe("exit");

    const integrityResponse = await app.request("/api/v1/integrity/access-chain", {
      headers: jsonHeaders(cookie)
    });
    const integrityBody = await integrityResponse.json();

    expect(integrityResponse.status).toBe(200);
    expect(integrityBody.data.valid).toBe(true);
  });

  it("keeps the access hash chain valid during concurrent scans over different people", async () => {
    const people = await Promise.all(
      Array.from({ length: 50 }, async (_, index) => {
        const suffix = randomUUID().slice(0, 8);
        const matricula = `HC-${index}-${suffix}`;

        await db.insert(personas).values({
          matricula,
          nombres: "Hash",
          apellidos: "Concurrente",
          tipoPersona: "docente",
          estado: "activo"
        });

        return matricula;
      })
    );

    const scanResults = await Promise.all(
      people.map(async (matricula) => {
        const response = await app.request("/api/v1/access/scan", {
          method: "POST",
          headers: jsonHeaders(cookie),
          body: JSON.stringify({ manualMatricula: matricula })
        });
        const body = await response.json();

        return { response, body };
      })
    );

    for (const result of scanResults) {
      expect(result.response.status).toBe(200);
      expect(result.body.data.accepted).toBe(true);
      expect(result.body.data.action).toBe("entry");
    }

    const integrityResponse = await app.request("/api/v1/integrity/access-chain", {
      headers: jsonHeaders(cookie)
    });
    const integrityBody = await integrityResponse.json();

    expect(integrityResponse.status).toBe(200);
    expect(integrityBody.data.valid).toBe(true);
    expect(integrityBody.data.checked).toBeGreaterThanOrEqual(50);
  });

  it("rejects spoofed actor fields and persists the session admin for access and temporary QR audit", async () => {
    const suffix = randomUUID().slice(0, 8);
    const matricula = `SP-${suffix}`;

    const personResponse = await app.request("/api/v1/people", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        matricula,
        nombres: "Spoof",
        apellidos: "Integracion",
        tipoPersona: "docente",
        estado: "activo"
      })
    });
    const personBody = await personResponse.json();
    expect(personResponse.status).toBe(201);

    const qrResponse = await app.request("/api/v1/credentials/person", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        personId: personBody.data.id,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString()
      })
    });
    const qrBody = await qrResponse.json();
    expect(qrResponse.status).toBe(201);

    const rejectedScanResponse = await app.request("/api/v1/access/scan", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ token: qrBody.data.token, adminId: spoofAdminId })
    });
    const rejectedScanBody = await rejectedScanResponse.json();

    expect(rejectedScanResponse.status).toBe(400);
    expect(rejectedScanBody.error.code).toBe("VALIDATION_ERROR");

    const scanResponse = await app.request("/api/v1/access/scan", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ token: qrBody.data.token })
    });
    const scanBody = await scanResponse.json();
    expect(scanResponse.status).toBe(200);
    expect(scanBody.data.accepted).toBe(true);

    const accessRecord = await db.query.registrosAcceso.findFirst({
      where: eq(registrosAcceso.id, scanBody.data.registroId)
    });
    expect(accessRecord?.adminEntradaId).toBe(sessionAdminId);
    expect(accessRecord?.adminEntradaId).not.toBe(spoofAdminId);

    const rejectedTemporaryResponse = await app.request("/api/v1/credentials/temporary-daily", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        personId: personBody.data.id,
        operationalDate: new Date().toISOString().slice(0, 10),
        missingCredentialType: "credential_unavailable",
        reasonCode: "spoof_attempt",
        maxUses: 1,
        validUntil: new Date(Date.now() + 3_600_000).toISOString(),
        createdByAdminId: spoofAdminId
      })
    });
    const rejectedTemporaryBody = await rejectedTemporaryResponse.json();
    expect(rejectedTemporaryResponse.status).toBe(400);
    expect(rejectedTemporaryBody.error.code).toBe("VALIDATION_ERROR");

    const temporaryResponse = await app.request("/api/v1/credentials/temporary-daily", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        personId: personBody.data.id,
        operationalDate: new Date().toISOString().slice(0, 10),
        missingCredentialType: "credential_unavailable",
        reasonCode: "valid_session_actor",
        maxUses: 1,
        validUntil: new Date(Date.now() + 3_600_000).toISOString()
      })
    });
    const temporaryBody = await temporaryResponse.json();
    expect(temporaryResponse.status).toBe(201);

    const temporaryRecord = await db.query.temporaryDailyQrTokens.findFirst({
      where: eq(temporaryDailyQrTokens.id, temporaryBody.data.credential.id)
    });
    expect(temporaryRecord?.createdByAdminId).toBe(sessionAdminId);
    expect(temporaryRecord?.createdByAdminId).not.toBe(spoofAdminId);
  });

  it("scans signed personal QR once and rejects replayed JTI", async () => {
    await enableSignedQr();
    const portalUser = await loginPortalUser();

    const dynamicResponse = await app.request("/api/v1/portal/qr/dynamic", {
      method: "POST",
      headers: jsonHeaders(portalUser.cookie),
      body: JSON.stringify({})
    });
    const dynamicBody = await dynamicResponse.json();

    expect(dynamicResponse.status).toBe(200);
    expect(dynamicBody.data.token.split(".")).toHaveLength(3);

    const firstScan = await scanSignedQr(cookie, dynamicBody.data.token);
    expect(firstScan.accepted).toBe(true);
    expect(firstScan.credentialType).toBe("person_qr");
    await expectSignedQrPersisted(dynamicBody.data.jti, String(firstScan.registroId), "person_qr");

    const replayScan = await scanSignedQr(cookie, dynamicBody.data.token);
    expect(replayScan.accepted).toBe(false);
    expect(replayScan.reasonCode).toBe("JTI_ALREADY_CONSUMED");
  });

  it("scans signed temporary daily QR once and rejects replayed JTI", async () => {
    await enableSignedQr();
    const person = await createActivePerson("TEMP");

    const temporaryResponse = await app.request("/api/v1/credentials/temporary-daily", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        personId: person.id,
        operationalDate: currentOperationalDate(),
        missingCredentialType: "personal_qr",
        reasonCode: "integration_signed_temp",
        maxUses: 2,
        validUntil: new Date(Date.now() + 3_600_000).toISOString()
      })
    });
    const temporaryBody = await temporaryResponse.json();
    expect(temporaryResponse.status).toBe(201);

    const dynamicResponse = await app.request(`/api/v1/credentials/temporary-daily/${temporaryBody.data.credential.id}/dynamic`, {
      method: "POST",
      headers: jsonHeaders(cookie)
    });
    const dynamicBody = await dynamicResponse.json();
    expect(dynamicResponse.status).toBe(201);

    const firstScan = await scanSignedQr(cookie, dynamicBody.data.token);
    expect(firstScan.accepted).toBe(true);
    expect(firstScan.credentialType).toBe("temporary_daily_qr");
    await expectSignedQrPersisted(dynamicBody.data.jti, String(firstScan.registroId), "temporary_daily_qr");

    const replayScan = await scanSignedQr(cookie, dynamicBody.data.token);
    expect(replayScan.accepted).toBe(false);
    expect(replayScan.reasonCode).toBe("JTI_ALREADY_CONSUMED");
  });

  it("scans signed vehicle permit QR once and rejects replayed JTI", async () => {
    await enableSignedQr();
    const person = await createActivePerson("VEH");

    const vehicleResponse = await app.request("/api/v1/vehicles", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        ownerPersonId: person.id,
        plate: `QR-${randomUUID().slice(0, 6)}`,
        make: "Integracion",
        model: "Firmado",
        color: "Blanco"
      })
    });
    const vehicleBody = await vehicleResponse.json();
    expect(vehicleResponse.status).toBe(201);

    const permitResponse = await app.request("/api/v1/vehicles/permits", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({
        personId: person.id,
        vehicleId: vehicleBody.data.id,
        validUntil: new Date(Date.now() + 86_400_000).toISOString()
      })
    });
    const permitBody = await permitResponse.json();
    expect(permitResponse.status).toBe(201);

    const dynamicResponse = await app.request(`/api/v1/vehicles/permits/${permitBody.data.id}/qr/dynamic`, {
      method: "POST",
      headers: jsonHeaders(cookie)
    });
    const dynamicBody = await dynamicResponse.json();
    expect(dynamicResponse.status).toBe(201);

    const firstScan = await scanSignedQr(cookie, dynamicBody.data.token);
    expect(firstScan.accepted).toBe(true);
    expect(firstScan.credentialType).toBe("vehicle_permit_qr");
    await expectSignedQrPersisted(dynamicBody.data.jti, String(firstScan.registroId), "vehicle_permit_qr");

    const replayScan = await scanSignedQr(cookie, dynamicBody.data.token);
    expect(replayScan.accepted).toBe(false);
    expect(replayScan.reasonCode).toBe("JTI_ALREADY_CONSUMED");
  });

  it("rejects tampered and expired signed QR tokens during scan", async () => {
    await enableSignedQr();
    const person = await createActivePerson("BAD");
    const valid = await signDynamicQr({
      sub: person.id,
      uid: person.matricula,
      typ: "person_qr"
    }, 15);
    const expired = await signDynamicQr({
      sub: person.id,
      uid: person.matricula,
      typ: "person_qr"
    }, -30);

    const tamperedScan = await scanSignedQr(cookie, tamperJwt(valid.token));
    expect(tamperedScan.accepted).toBe(false);
    expect(tamperedScan.reasonCode).toBe("INVALID_SIGNED_QR");

    const expiredScan = await scanSignedQr(cookie, expired.token);
    expect(expiredScan.accepted).toBe(false);
    expect(expiredScan.reasonCode).toBe("SIGNED_QR_EXPIRED");
  });

  it("rejects inactive people and expires worker-managed records", async () => {
    const suffix = randomUUID().slice(0, 8);
    const matricula = `IN-${suffix}`;

    await db.insert(personas).values({
      matricula,
      nombres: "Inactivo",
      apellidos: "Integracion",
      tipoPersona: "docente",
      estado: "inactivo"
    });

    const scanResponse = await app.request("/api/v1/access/scan", {
      method: "POST",
      headers: jsonHeaders(cookie),
      body: JSON.stringify({ manualMatricula: matricula })
    });
    const scanBody = await scanResponse.json();

    expect(scanResponse.status).toBe(200);
    expect(scanBody.data.accepted).toBe(false);
    expect(scanBody.data.reasonCode).toBe("PERSON_NOT_ACTIVE");

    const workerResult = await runWorkerCycle();
    expect(workerResult).toHaveProperty("expired");
  });

  it("logs portal users in with secure cookies and hides session and QR hashes", async () => {
    const portalUser = await ensurePortalUser();
    const loginResponse = await app.request("/api/v1/portal/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({
        identity: portalUser.email,
        password: portalUser.password
      })
    });
    const loginBody = await loginResponse.json();
    const portalCookie = loginResponse.headers.get("set-cookie") ?? "";

    expect(loginResponse.status).toBe(200);
    expect(loginBody.data.user.email).toBe(portalUser.email);
    expectCookieSecurity(portalCookie, "ca_user_session");
    expectNoSecretFieldNames(loginBody);

    const meResponse = await app.request("/api/v1/portal/me", {
      headers: jsonHeaders(portalCookie)
    });
    const meBody = await meResponse.json();

    expect(meResponse.status).toBe(200);
    expect(meBody.data.user.accountId).toBe(portalUser.account.id);
    expect(meBody.data.user.personId).toBe(portalUser.person.id);
    expectNoSecretFieldNames(meBody);

    const rotateResponse = await app.request("/api/v1/portal/qr/rotate", {
      method: "POST",
      headers: jsonHeaders(portalCookie),
      body: JSON.stringify({})
    });
    const rotateBody = await rotateResponse.json();

    expect(rotateResponse.status).toBe(201);
    expect(rotateBody.data.token).toStartWith("person_qr_");
    expect(rotateBody.data.credential.personId).toBe(portalUser.person.id);
    expectNoSecretFieldNames(rotateBody.data.credential);
  });
});
