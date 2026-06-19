import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "bun:test";
import { eq, sql } from "drizzle-orm";
import { app } from "../src/app";
import { db } from "../src/db/client";
import { administradores, personas } from "../src/db/schema";
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

describeIfPostgres("postgres integration", () => {
  let cookie = "";

  beforeAll(async () => {
    const admin = await ensureIntegrationAdmin();
    const response = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ identity: admin.username, password: admin.password })
    });

    expect(response.status).toBe(200);
    cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("ca_session=");
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
});
