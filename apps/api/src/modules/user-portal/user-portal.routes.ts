import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { Hono } from "hono";
import type { Context } from "hono";
import { importJWK, type JWK } from "jose";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { recordAudit } from "../../shared/audit";
import { currentOperationalDate } from "../../shared/date-range";
import { HttpError } from "../../shared/http-error";
import { withoutUndefined } from "../../shared/object";
import { assertLoginNotRateLimited, clearLoginFailures, recordLoginFailure } from "../../shared/rate-limit";
import { hashSessionToken, issueOpaqueToken, issueSessionToken } from "../../shared/security";
import { stripSecretFields } from "../../shared/sanitize";
import { signDynamicQr } from "../qr-signing/qr-signing.service";
import { getOperationalConfig } from "../config/config.repository";
import { getTemporaryDailyQrSigningContext } from "../credentials/credentials.repository";
import {
  consumeUserDeviceChallenge,
  createUserDevice,
  createUserDeviceChallenge,
  createPortalTemporaryDailyQr,
  createUserSession,
  findUserAccountForLogin,
  getActivePortalQr,
  getCurrentPortalTemporaryDailyQr,
  getUserSessionByHash,
  getUserAccountCredentialsById,
  listUserDevices,
  listPortalAccess,
  listPortalAttendance,
  listPortalTemporaryDailyQrHistory,
  markUserDeviceUsed,
  revokeUserDevice,
  revokeUserSession,
  revokeOtherUserSessions,
  rotatePortalQr,
  touchUserSession,
  updateUserPassword
} from "./user-portal.repository";

const loginSchema = z.object({
  identity: z.string().trim().email(),
  password: z.string().min(1)
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128)
});

const temporaryDailyRequestSchema = z.object({
  missingCredentialType: z.string().trim().min(1).max(80).default("personal_qr"),
  reasonCode: z.string().trim().min(1).max(80).default("credential_unavailable"),
  reasonText: z.string().trim().max(500).optional(),
  maxUses: z.number().int().min(1).max(10).default(10),
  validUntil: z.coerce.date().optional()
});

const publicJwkSchema = z.object({
  kty: z.literal("EC"),
  crv: z.literal("P-256"),
  x: z.string().min(1),
  y: z.string().min(1),
  ext: z.boolean().optional(),
  key_ops: z.array(z.string()).optional()
}).passthrough();

const registerDeviceSchema = z.object({
  publicKeyJwk: publicJwkSchema,
  label: z.string().trim().min(1).max(120).optional()
});

const deviceChallengeSchema = z.object({
  deviceId: z.string().uuid()
});

const dynamicQrSchema = z.object({
  deviceId: z.string().uuid().optional(),
  challengeId: z.string().uuid().optional(),
  signature: z.string().trim().min(1).optional()
});

function userSessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "Lax" as const,
    path: "/",
    expires
  };
}

function publicPortalSession(row: NonNullable<Awaited<ReturnType<typeof getUserSessionByHash>>>) {
  return {
    user: {
      accountId: row.accountId,
      personId: row.personId,
      email: row.email,
      matricula: row.matricula,
      fullName: `${row.nombres} ${row.apellidos}`.trim(),
      personType: row.tipoPersona,
      status: row.estado,
      mustChangePassword: row.mustChangePassword
    },
    expiresAt: row.expiresAt
  };
}

async function requirePortalSession(c: Context) {
  const token = getCookie(c, env.USER_SESSION_COOKIE_NAME);

  if (!token) {
    throw new HttpError(401, "USER_SESSION_REQUIRED", "A valid user session is required.");
  }

  const sessionHash = hashSessionToken(token);
  const session = await getUserSessionByHash(sessionHash);

  if (!session) {
    throw new HttpError(401, "USER_SESSION_INVALID", "The user session is invalid or expired.");
  }

  return { token, sessionHash, session };
}

export const userPortalRoutes = new Hono();

function operationalDateToday() {
  return currentOperationalDate();
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function verifyDeviceProof(input: {
  accountId: string;
  personId: string;
  deviceId?: string;
  challengeId?: string;
  signature?: string;
}) {
  if (!input.deviceId || !input.challengeId || !input.signature) {
    return null;
  }

  const challenge = await consumeUserDeviceChallenge({
    accountId: input.accountId,
    deviceId: input.deviceId,
    challengeId: input.challengeId
  });

  if (!challenge) {
    throw new HttpError(401, "DEVICE_CHALLENGE_INVALID", "The device challenge is invalid or expired.");
  }

  const key = await importJWK(challenge.public_key_jwk as JWK, challenge.algorithm);
  if (key instanceof Uint8Array) {
    throw new HttpError(401, "DEVICE_KEY_INVALID", "The device key is invalid.");
  }

  const message = new TextEncoder().encode([
    "control-acceso-upqroo.device-proof.v1",
    input.accountId,
    input.personId,
    input.deviceId,
    challenge.challenge
  ].join("."));
  const signature = base64UrlToBytes(input.signature);
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signature,
    message
  );

  if (!ok) {
    throw new HttpError(401, "DEVICE_SIGNATURE_INVALID", "The device signature is invalid.");
  }

  await markUserDeviceUsed(input.deviceId);
  return input.deviceId;
}

userPortalRoutes.post("/auth/login", async (c) => {
  const input = loginSchema.parse(await c.req.json());
  const ipAddress = c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip") ?? undefined;
  const rateLimitKey = await assertLoginNotRateLimited("portal", input.identity, ipAddress);
  const account = await findUserAccountForLogin(input.identity);

  if (!account || account.status !== "active" || account.estado !== "activo") {
    await recordLoginFailure(rateLimitKey);
    await recordAudit({
      action: "user.login_failed",
      entityType: "user_session",
      ipAddress,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { identity: input.identity, reason: "not_found_or_disabled" }
    });
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  const passwordOk = await Bun.password.verify(input.password, account.passwordHash);

  if (!passwordOk) {
    await recordLoginFailure(rateLimitKey);
    await recordAudit({
      actorAccountId: account.id,
      action: "user.login_failed",
      entityType: "user_session",
      ipAddress,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { identity: input.identity, reason: "bad_password" }
    });
    throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid credentials.");
  }

  await clearLoginFailures(rateLimitKey);

  const token = issueSessionToken();
  const sessionHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

  await createUserSession({
    accountId: account.id,
    sessionHash,
    ipAddress,
    userAgent: c.req.header("user-agent") ?? undefined,
    expiresAt
  });

  setCookie(c, env.USER_SESSION_COOKIE_NAME, token, userSessionCookieOptions(expiresAt));

  await recordAudit({
    actorAccountId: account.id,
    action: "user.login_success",
    entityType: "user_session",
    ipAddress,
    userAgent: c.req.header("user-agent") ?? undefined
  });

  return c.json({
    data: {
      user: {
        accountId: account.id,
        personId: account.personId,
        email: account.email,
        matricula: account.matricula,
        fullName: `${account.nombres} ${account.apellidos}`.trim(),
        personType: account.tipoPersona,
        status: account.estado,
        mustChangePassword: account.mustChangePassword
      },
      expiresAt
    }
  });
});

userPortalRoutes.post("/auth/logout", async (c) => {
  const token = getCookie(c, env.USER_SESSION_COOKIE_NAME);

  if (token) {
    await revokeUserSession(hashSessionToken(token));
  }

  deleteCookie(c, env.USER_SESSION_COOKIE_NAME, { path: "/" });
  return c.json({ data: { ok: true } });
});

userPortalRoutes.get("/me", async (c) => {
  const { sessionHash, session } = await requirePortalSession(c);
  await touchUserSession(sessionHash);
  return c.json({ data: publicPortalSession(session) });
});

userPortalRoutes.post("/auth/change-password", async (c) => {
  const { sessionHash, session } = await requirePortalSession(c);
  const input = changePasswordSchema.parse(await c.req.json());
  const account = await getUserAccountCredentialsById(session.accountId);

  if (!account || account.status !== "active") {
    throw new HttpError(401, "USER_SESSION_INVALID", "The user session is invalid or expired.");
  }

  const passwordOk = await Bun.password.verify(input.currentPassword, account.passwordHash);

  if (!passwordOk) {
    await recordAudit({
      actorAccountId: account.id,
      action: "user.change_password_failed",
      entityType: "user_account",
      entityId: account.id,
      ipAddress: c.req.header("x-forwarded-for") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
      metadata: { reason: "bad_current_password" }
    });
    throw new HttpError(401, "INVALID_CURRENT_PASSWORD", "The current password is incorrect.");
  }

  const passwordHash = await Bun.password.hash(input.newPassword, {
    algorithm: "bcrypt",
    cost: 10
  });

  await updateUserPassword(account.id, passwordHash);
  await revokeOtherUserSessions(account.id, sessionHash);
  await recordAudit({
    actorAccountId: account.id,
    action: "user.password_changed",
    entityType: "user_account",
    entityId: account.id,
    ipAddress: c.req.header("x-forwarded-for") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined
  });

  return c.json({ data: { ok: true } });
});

userPortalRoutes.get("/qr", async (c) => {
  const { session } = await requirePortalSession(c);
  const [credential] = await getActivePortalQr(session.personId);
  return c.json({ data: { credential: credential ?? null } });
});

userPortalRoutes.get("/devices", async (c) => {
  const { session } = await requirePortalSession(c);
  const rows = await listUserDevices(session.accountId);
  return c.json({ data: { rows } });
});

userPortalRoutes.post("/devices", async (c) => {
  const { session } = await requirePortalSession(c);
  const input = registerDeviceSchema.parse(await c.req.json().catch(() => ({})));
  const row = await createUserDevice({
    accountId: session.accountId,
    publicKeyJwk: input.publicKeyJwk,
    algorithm: "ES256",
    label: input.label
  });

  await recordAudit({
    actorAccountId: session.accountId,
    action: "user.device_registered",
    entityType: "user_device",
    entityId: row.id,
    metadata: { algorithm: row.algorithm, label: row.label }
  });

  return c.json({ data: { device: row } }, 201);
});

userPortalRoutes.delete("/devices/:deviceId", async (c) => {
  const { session } = await requirePortalSession(c);
  const deviceId = z.string().uuid().parse(c.req.param("deviceId"));
  const row = await revokeUserDevice(session.accountId, deviceId);

  if (!row) {
    throw new HttpError(404, "DEVICE_NOT_FOUND", "The device was not found for this account.");
  }

  await recordAudit({
    actorAccountId: session.accountId,
    action: "user.device_revoked",
    entityType: "user_device",
    entityId: row.id,
    metadata: { status: row.status }
  });

  return c.json({ data: row });
});

userPortalRoutes.post("/devices/challenge", async (c) => {
  const { session } = await requirePortalSession(c);
  const input = deviceChallengeSchema.parse(await c.req.json().catch(() => ({})));
  const challenge = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60);
  const row = await createUserDeviceChallenge({
    accountId: session.accountId,
    deviceId: input.deviceId,
    challenge,
    expiresAt
  });

  if (!row) {
    throw new HttpError(404, "DEVICE_NOT_FOUND", "The device is not active for this account.");
  }

  return c.json({
    data: {
      id: row.id,
      challenge: row.challenge,
      expiresAt: row.expiresAt,
      message: [
        "control-acceso-upqroo.device-proof.v1",
        session.accountId,
        session.personId,
        input.deviceId,
        row.challenge
      ].join(".")
    }
  }, 201);
});

userPortalRoutes.post("/qr/rotate", async (c) => {
  const { session } = await requirePortalSession(c);
  const issued = issueOpaqueToken("person_qr");
  const row = await rotatePortalQr(
    session.personId,
    issued.tokenHash,
    new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
  );

  await recordAudit({
    actorAccountId: session.accountId,
    action: "user.portal_qr_rotated",
    entityType: "qr_token",
    entityId: row.id,
    metadata: { personId: session.personId }
  });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

userPortalRoutes.post("/qr/dynamic", async (c) => {
  const { session } = await requirePortalSession(c);
  const proofInput = dynamicQrSchema.parse(await c.req.json().catch(() => ({})));

  const [configRow] = await getOperationalConfig("signed_qr");
  const config = (configRow?.value as Record<string, unknown> | undefined) ?? {};
  if (config.enabled !== true) {
    throw new HttpError(409, "SIGNED_QR_DISABLED", "Signed dynamic QR is disabled.");
  }
  const configuredTtl = typeof config.ttlSeconds === "number" ? config.ttlSeconds : 30;
  const ttlSeconds = Math.min(30, Math.max(15, Math.floor(configuredTtl)));
  const deviceId = await verifyDeviceProof(withoutUndefined({
    accountId: session.accountId,
    personId: session.personId,
    deviceId: proofInput.deviceId,
    challengeId: proofInput.challengeId,
    signature: proofInput.signature
  }));

  if (config.requireDeviceBinding === true && !deviceId) {
    throw new HttpError(401, "DEVICE_PROOF_REQUIRED", "A valid device proof is required.");
  }

  const { token, expiresAt, jti } = await signDynamicQr({
    sub: session.personId,
    uid: session.matricula,
    typ: "person_qr",
    sid: session.accountId,
    ...(deviceId ? { did: deviceId } : {})
  }, ttlSeconds);

  const refreshAfterMs = Math.max(5000, (ttlSeconds - 5) * 1000);

  return c.json({
    data: { token, expiresAt, refreshAfterMs, jti, deviceId }
  });
});

userPortalRoutes.get("/access/recent", async (c) => {
  const { session } = await requirePortalSession(c);
  const rows = await listPortalAccess(session.personId);
  return c.json({ data: { rows } });
});

userPortalRoutes.get("/attendance/recent", async (c) => {
  const { session } = await requirePortalSession(c);
  const rows = await listPortalAttendance(session.personId);
  return c.json({ data: { rows } });
});

userPortalRoutes.get("/temporary-daily-qr/current", async (c) => {
  const { session } = await requirePortalSession(c);
  const [credential] = await getCurrentPortalTemporaryDailyQr(session.personId, operationalDateToday());
  return c.json({ data: { credential: credential ?? null } });
});

userPortalRoutes.post("/temporary-daily-qr/request", async (c) => {
  const { session } = await requirePortalSession(c);
  const input = temporaryDailyRequestSchema.parse(await c.req.json().catch(() => ({})));
  const issued = issueOpaqueToken("temporary_daily_qr");
  const operationalDate = operationalDateToday();
  const validUntil = input.validUntil ?? new Date(Date.now() + 1000 * 60 * 60 * 8);
  const row = await createPortalTemporaryDailyQr({
    personId: session.personId,
    tokenHash: issued.tokenHash,
    operationalDate,
    missingCredentialType: input.missingCredentialType,
    reasonCode: input.reasonCode,
    reasonText: input.reasonText,
    maxUses: input.maxUses,
    validUntil
  });

  await recordAudit({
    actorAccountId: session.accountId,
    action: "user.temporary_daily_qr_requested",
    entityType: "temporary_daily_qr",
    entityId: row.id,
    metadata: { personId: session.personId, operationalDate }
  });

  return c.json({ data: { credential: stripSecretFields(row), token: issued.token } }, 201);
});

userPortalRoutes.post("/temporary-daily-qr/dynamic", async (c) => {
  const { session } = await requirePortalSession(c);
  const proofInput = dynamicQrSchema.parse(await c.req.json().catch(() => ({})));
  const operationalDate = operationalDateToday();
  const [credential] = await getCurrentPortalTemporaryDailyQr(session.personId, operationalDate);

  if (!credential) {
    throw new HttpError(404, "TEMPORARY_DAILY_QR_NOT_FOUND", "No active temporary daily QR exists for this operational day.");
  }

  const signableCredential = await getTemporaryDailyQrSigningContext(credential.id);
  if (!signableCredential || signableCredential.personId !== session.personId) {
    throw new HttpError(409, "TEMPORARY_DAILY_QR_NOT_SIGNABLE", "Temporary daily QR is not active or signable.");
  }

  const [configRow] = await getOperationalConfig("signed_qr");
  const config = (configRow?.value as Record<string, unknown> | undefined) ?? {};
  if (config.enabled !== true) {
    throw new HttpError(409, "SIGNED_QR_DISABLED", "Signed dynamic QR is disabled.");
  }

  const configuredTtl = typeof config.ttlSeconds === "number" ? config.ttlSeconds : 30;
  const ttlSeconds = Math.min(30, Math.max(15, Math.floor(configuredTtl)));
  const deviceId = await verifyDeviceProof(withoutUndefined({
    accountId: session.accountId,
    personId: session.personId,
    deviceId: proofInput.deviceId,
    challengeId: proofInput.challengeId,
    signature: proofInput.signature
  }));

  if (config.requireDeviceBinding === true && !deviceId) {
    throw new HttpError(401, "DEVICE_PROOF_REQUIRED", "A valid device proof is required.");
  }

  const { token, expiresAt, jti } = await signDynamicQr({
    sub: session.personId,
    uid: session.matricula,
    typ: "temporary_daily_qr",
    sid: session.accountId,
    temporaryDailyQrId: signableCredential.id,
    ...(deviceId ? { did: deviceId } : {})
  }, ttlSeconds);

  await recordAudit({
    actorAccountId: session.accountId,
    action: "user.temporary_daily_qr_dynamic_issued",
    entityType: "temporary_daily_qr",
    entityId: signableCredential.id,
    metadata: { operationalDate, jti }
  });

  return c.json({
    data: {
      credential: stripSecretFields(signableCredential),
      token,
      expiresAt,
      refreshAfterMs: Math.max(5000, (ttlSeconds - 5) * 1000),
      jti,
      deviceId
    }
  }, 201);
});

userPortalRoutes.get("/temporary-daily-qr/history", async (c) => {
  const { session } = await requirePortalSession(c);
  const rows = await listPortalTemporaryDailyQrHistory(session.personId);
  return c.json({ data: { rows } });
});
