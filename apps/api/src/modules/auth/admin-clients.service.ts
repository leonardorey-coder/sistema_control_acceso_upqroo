import { importJWK, type JWK } from "jose";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http-error";
import { getOperationalConfig } from "../config/config.repository";
import {
  consumeAdminClientChallenge,
  markAdminClientUsed
} from "./auth.repository";

export type AdminClientProofInput = {
  adminId: string;
  role: "admin" | "super_admin";
  adminClientId?: string;
  adminClientChallengeId?: string;
  adminClientSignature?: string;
};

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

export async function adminClientAuthRequired(role: "admin" | "super_admin") {
  if (env.ADMIN_CLIENT_AUTH_BYPASS || role === "super_admin") return false;

  const [row] = await getOperationalConfig("admin_clients");
  const value = row?.value as Record<string, unknown> | undefined;
  return value?.required === true;
}

export function buildAdminClientLoginMessage(input: {
  adminId: string;
  adminClientId: string;
  challenge: string;
}) {
  return [
    "control-acceso-upqroo.admin-client-login.v1",
    input.adminId,
    input.adminClientId,
    input.challenge
  ].join(".");
}

export async function verifyAdminClientProof(input: AdminClientProofInput) {
  if (!input.adminClientId || !input.adminClientChallengeId || !input.adminClientSignature) {
    throw new HttpError(401, "ADMIN_CLIENT_REQUIRED", "An authorized administrative browser is required.");
  }

  const challenge = await consumeAdminClientChallenge({
    clientId: input.adminClientId,
    challengeId: input.adminClientChallengeId
  });

  if (!challenge || challenge.admin_id !== input.adminId) {
    throw new HttpError(401, "ADMIN_CLIENT_CHALLENGE_INVALID", "The administrative browser challenge is invalid or expired.");
  }

  const key = await importJWK(challenge.public_key_jwk as JWK, challenge.algorithm);
  if (key instanceof Uint8Array) {
    throw new HttpError(401, "ADMIN_CLIENT_KEY_INVALID", "The administrative browser key is invalid.");
  }

  const message = buildAdminClientLoginMessage({
    adminId: input.adminId,
    adminClientId: input.adminClientId,
    challenge: challenge.challenge
  });
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    base64UrlToBytes(input.adminClientSignature),
    new TextEncoder().encode(message)
  );

  if (!ok) {
    throw new HttpError(401, "ADMIN_CLIENT_SIGNATURE_INVALID", "The administrative browser signature is invalid.");
  }

  await markAdminClientUsed(input.adminClientId);
  return { adminClientId: input.adminClientId };
}
