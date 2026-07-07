import { importJWK, type JWK } from "jose";
import { env } from "../../config/env";
import { HttpError } from "../../shared/http-error";
import { getOperationalConfig } from "../config/config.repository";
import {
  consumeScannerDeviceChallenge,
  markScannerDeviceSeen
} from "./scanner-devices.repository";

export type ScannerProofPayload = {
  token?: string;
  signedQr?: string;
  manualMatricula?: string;
  scannerCode?: string;
};

export type ScannerDeviceProofInput = {
  adminId: string;
  scannerDeviceId?: string;
  scannerCode?: string;
  scannerChallengeId?: string;
  scannerSignature?: string;
  payload: ScannerProofPayload;
};

export type VerifiedScannerDevice = {
  scannerDeviceId: string;
  scannerCode: string;
};

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function scannerDevicesRequired() {
  if (env.SCANNER_DEVICE_AUTH_BYPASS) return false;

  const [row] = await getOperationalConfig("scanner_devices");
  const value = row?.value as Record<string, unknown> | undefined;

  if (typeof value?.required === "boolean") {
    return value.required;
  }

  return process.env.NODE_ENV === "production";
}

export async function hashScannerScanPayload(payload: ScannerProofPayload) {
  const stablePayload = {
    manualMatricula: payload.manualMatricula ?? "",
    scannerCode: payload.scannerCode ?? "",
    signedQr: payload.signedQr ?? "",
    token: payload.token ?? ""
  };
  const bytes = new TextEncoder().encode(JSON.stringify(stablePayload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toBase64Url(digest);
}

export function buildScannerScanMessage(input: {
  adminId: string;
  scannerDeviceId: string;
  scannerCode: string;
  challenge: string;
  payloadHash: string;
}) {
  return [
    "control-acceso-upqroo.scanner-scan.v1",
    input.adminId,
    input.scannerDeviceId,
    input.scannerCode,
    input.challenge,
    input.payloadHash
  ].join(".");
}

export async function verifyScannerDeviceProof(input: ScannerDeviceProofInput) {
  if (!input.scannerDeviceId || !input.scannerCode || !input.scannerChallengeId || !input.scannerSignature) {
    throw new HttpError(401, "SCANNER_DEVICE_REQUIRED", "A registered scanner device proof is required.");
  }

  const challenge = await consumeScannerDeviceChallenge({
    deviceId: input.scannerDeviceId,
    adminId: input.adminId,
    challengeId: input.scannerChallengeId
  });

  if (!challenge) {
    throw new HttpError(401, "SCANNER_CHALLENGE_INVALID", "The scanner challenge is invalid or expired.");
  }

  if (challenge.scanner_code !== input.scannerCode) {
    throw new HttpError(401, "SCANNER_DEVICE_NOT_FOUND", "The scanner device does not match the registered code.");
  }

  const key = await importJWK(challenge.public_key_jwk as JWK, challenge.algorithm);
  if (key instanceof Uint8Array) {
    throw new HttpError(401, "SCANNER_DEVICE_NOT_FOUND", "The scanner device key is invalid.");
  }

  const payloadHash = await hashScannerScanPayload(input.payload);
  const message = buildScannerScanMessage({
    adminId: input.adminId,
    scannerDeviceId: input.scannerDeviceId,
    scannerCode: input.scannerCode,
    challenge: challenge.challenge,
    payloadHash
  });
  const ok = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    base64UrlToBytes(input.scannerSignature),
    new TextEncoder().encode(message)
  );

  if (!ok) {
    throw new HttpError(401, "SCANNER_SIGNATURE_INVALID", "The scanner device signature is invalid.");
  }

  await markScannerDeviceSeen(input.scannerDeviceId);

  return {
    scannerDeviceId: input.scannerDeviceId,
    scannerCode: input.scannerCode
  };
}
