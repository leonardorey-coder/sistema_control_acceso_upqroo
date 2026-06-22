import {
  decodeProtectedHeader,
  exportJWK,
  generateKeyPair,
  importJWK,
  importPKCS8,
  importSPKI,
  jwtVerify,
  SignJWT,
  type JWK
} from "jose";
import { randomUUID } from "node:crypto";
import { db } from "../../db/client";
import { sql } from "drizzle-orm";
import { env } from "../../config/env";

type QrSigningPayloadBase = {
  sub: string;      // person_id
  uid: string;      // matricula (display only, not secret)
  sid?: string;     // session id (optional)
  did?: string;     // user device id (optional possession proof)
};

export type QrSigningPayload =
  | (QrSigningPayloadBase & {
      typ: "person_qr";
    })
  | (QrSigningPayloadBase & {
      typ: "temporary_daily_qr";
      temporaryDailyQrId: string;
    })
  | (QrSigningPayloadBase & {
      typ: "vehicle_permit_qr";
      vehiclePermitId: string;
    });

type ActiveKey = {
  kid: string;
  alg: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicKeyJwk: JWK;
};

let _activeKey: ActiveKey | null = null;

/** Load or generate the signing key. Uses QR_SIGNING_PRIVATE_KEY env var if present. */
export async function loadSigningKey(): Promise<ActiveKey> {
  if (_activeKey) return _activeKey;

  const privateKeyPem = env.QR_SIGNING_PRIVATE_KEY;
  const publicKeyPem = env.QR_SIGNING_PUBLIC_KEY;
  const kidEnv = env.QR_SIGNING_KID;

  if (privateKeyPem && publicKeyPem) {
    const alg = env.QR_SIGNING_ALG;
    const privateKey = await importPKCS8(privateKeyPem, alg);
    const publicKey = await importSPKI(publicKeyPem, alg);
    const publicKeyJwk = await exportJWK(publicKey);
    const kid = kidEnv ?? "env-key-1";
    await persistPublicKey(kid, alg, publicKeyJwk);
    const activeKey = { kid, alg, privateKey, publicKey, publicKeyJwk };
    _activeKey = activeKey;
    return activeKey;
  }

  // Dev fallback: generate ephemeral key and persist public key in DB
  const alg = "ES256";
  const kid = kidEnv ?? `dev-${randomUUID().slice(0, 8)}`;
  const { privateKey, publicKey } = await generateKeyPair(alg, { extractable: true });
  const publicKeyJwk = await exportJWK(publicKey);

  await persistPublicKey(kid, alg, publicKeyJwk);

  const activeKey = { kid, alg, privateKey, publicKey, publicKeyJwk };
  _activeKey = activeKey;
  return activeKey;
}

async function persistPublicKey(kid: string, alg: string, publicKeyJwk: JWK) {
  const [existing] = await db.execute<{ status: string; public_key_jwk: JWK }>(sql`
    SELECT status, public_key_jwk
    FROM qr_signing_keys
    WHERE kid = ${kid}
    LIMIT 1
  `);

  if (existing?.status === "rotated") {
    throw new Error("QR_SIGNING_KID_ROTATED_CHANGE_KID_REQUIRED");
  }

  if (existing && JSON.stringify(existing.public_key_jwk) !== JSON.stringify(publicKeyJwk)) {
    throw new Error("QR_SIGNING_KID_REUSE_WITH_DIFFERENT_KEY");
  }

  await db.execute(sql`
    INSERT INTO qr_signing_keys (kid, algorithm, public_key_jwk, status)
    VALUES (${kid}, ${alg}, ${JSON.stringify(publicKeyJwk)}::jsonb, 'active')
    ON CONFLICT (kid) DO UPDATE
      SET public_key_jwk = EXCLUDED.public_key_jwk,
          algorithm = EXCLUDED.algorithm,
          status = 'active',
          rotated_at = NULL,
          expires_at = NULL
  `);
}

export function clearKeyCache() {
  _activeKey = null;
}

export async function signDynamicQr(
  payload: QrSigningPayload,
  ttlSeconds: number
): Promise<{ token: string; expiresAt: Date; jti: string }> {
  const key = await loadSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ttlSeconds;
  const jti = randomUUID();

  const claims: Record<string, string | undefined> = {
    uid: payload.uid,
    typ: payload.typ,
    sid: payload.sid,
    did: payload.did
  };
  if (payload.typ === "temporary_daily_qr") {
    claims.tid = payload.temporaryDailyQrId;
  }
  if (payload.typ === "vehicle_permit_qr") {
    claims.vpid = payload.vehiclePermitId;
  }

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: key.alg, kid: key.kid })
    .setSubject(payload.sub)
    .setIssuer("control-acceso-upqroo")
    .setAudience("access_scanner")
    .setIssuedAt(now)
    .setNotBefore(now)
    .setExpirationTime(exp)
    .setJti(jti)
    .sign(key.privateKey);

  return { token, expiresAt: new Date(exp * 1000), jti };
}

export type VerifiedQrPayload = {
  sub: string;
  jti: string;
  uid: string;
  typ: "person_qr" | "temporary_daily_qr" | "vehicle_permit_qr";
  kid: string;
  alg: string;
  iat: number;
  exp: number;
  sid?: string | undefined;
  did?: string | undefined;
  temporaryDailyQrId?: string | undefined;
  vehiclePermitId?: string | undefined;
};

export async function verifyDynamicQr(
  token: string,
  clockToleranceSeconds = 5
): Promise<VerifiedQrPayload> {
  const header = decodeProtectedHeader(token);
  const kid = header.kid;

  if (!kid || !header.alg) {
    throw new Error("SIGNED_QR_HEADER_INVALID");
  }

  const resolvedKey = await getPublicKeyByKid(kid, header.alg);

  if (header.alg !== resolvedKey.alg) {
    throw new Error("SIGNED_QR_ALG_INVALID");
  }

  const { payload, protectedHeader } = await jwtVerify(token, resolvedKey.publicKey, {
    issuer: "control-acceso-upqroo",
    audience: "access_scanner",
    algorithms: [resolvedKey.alg],
    clockTolerance: clockToleranceSeconds
  });

  const uid = (payload as Record<string, unknown>).uid;
  const typ = (payload as Record<string, unknown>).typ;
  const allowedTypes = new Set(["person_qr", "temporary_daily_qr", "vehicle_permit_qr"]);

  if (!payload.sub || !payload.jti || typeof uid !== "string" || typeof typ !== "string" || !allowedTypes.has(typ)) {
    throw new Error("SIGNED_QR_CLAIM_INVALID");
  }

  const temporaryDailyQrId = (payload as Record<string, unknown>).tid;
  const vehiclePermitId = (payload as Record<string, unknown>).vpid;

  if (typ === "temporary_daily_qr" && typeof temporaryDailyQrId !== "string") {
    throw new Error("SIGNED_QR_CLAIM_INVALID");
  }

  if (typ === "vehicle_permit_qr" && typeof vehiclePermitId !== "string") {
    throw new Error("SIGNED_QR_CLAIM_INVALID");
  }

  return {
    sub: payload.sub,
    jti: payload.jti,
    uid,
    typ: typ as VerifiedQrPayload["typ"],
    kid,
    alg: protectedHeader.alg,
    iat: payload.iat as number,
    exp: payload.exp as number,
    sid: (payload as Record<string, unknown>).sid as string | undefined,
    did: (payload as Record<string, unknown>).did as string | undefined,
    temporaryDailyQrId: temporaryDailyQrId as string | undefined,
    vehiclePermitId: vehiclePermitId as string | undefined
  };
}

async function getPublicKeyByKid(kid: string, alg: string): Promise<{ publicKey: CryptoKey; alg: string }> {
  const activeKey = await loadSigningKey();

  if (activeKey.kid === kid) {
    return { publicKey: activeKey.publicKey, alg: activeKey.alg };
  }

  const rows = await db.execute<{ public_key_jwk: JWK; algorithm: string }>(sql`
    SELECT public_key_jwk, algorithm
    FROM qr_signing_keys
    WHERE kid = ${kid}
      AND status IN ('active', 'rotated')
      AND (expires_at IS NULL OR expires_at > now())
    LIMIT 1
  `);
  const [row] = rows;

  if (!row) {
    throw new Error("SIGNED_QR_KEY_NOT_FOUND");
  }

  const expectedAlg = row.algorithm || alg;
  const key = await importJWK(row.public_key_jwk, expectedAlg);
  if (key instanceof Uint8Array) {
    throw new Error("SIGNED_QR_KEY_INVALID");
  }

  return { publicKey: key, alg: expectedAlg };
}

export async function getJwks() {
  await loadSigningKey();
  const rows = await db.execute<{ kid: string; algorithm: string; public_key_jwk: JWK }>(
    sql`SELECT kid, algorithm, public_key_jwk FROM qr_signing_keys WHERE status = 'active'`
  );

  const keys = rows.map((r) => ({ ...r.public_key_jwk, kid: r.kid, alg: r.algorithm, use: "sig" }));

  if (_activeKey && !keys.find((k) => k.kid === _activeKey!.kid)) {
    keys.push({ ..._activeKey.publicKeyJwk, kid: _activeKey.kid, alg: _activeKey.alg, use: "sig" });
  }

  return { keys };
}
