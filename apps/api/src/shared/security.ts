import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env";

export type IssuedToken = {
  token: string;
  tokenHash: string;
};

export function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashScannerToken(token: string) {
  return sha256Hex(token);
}

export function hashSessionToken(token: string) {
  return sha256Hex(`${env.SESSION_SECRET}:${token}`);
}

export function issueOpaqueToken(prefix: string): IssuedToken {
  const token = `${prefix}_${randomBytes(32).toString("base64url")}`;
  return {
    token,
    tokenHash: hashScannerToken(token)
  };
}

export function issueSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function issueTemporaryPassword() {
  return randomBytes(12).toString("base64url");
}
