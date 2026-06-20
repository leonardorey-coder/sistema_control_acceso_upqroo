import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { hashScannerToken, issueOpaqueToken } from "../src/shared/security";
import { stripSecretFields } from "../src/shared/sanitize";

describe("security helpers", () => {
  it("issues opaque tokens and stores only a SHA-256 hash", () => {
    const issued = issueOpaqueToken("person_qr");

    expect(issued.token).toStartWith("person_qr_");
    expect(issued.tokenHash).toBe(hashScannerToken(issued.token));
    expect(issued.tokenHash).not.toContain(issued.token);
  });

  it("strips secret fields from API payloads", () => {
    expect(stripSecretFields({
      id: "1",
      tokenHash: "secret",
      passwordHash: "secret",
      sessionHash: "secret",
      visible: true
    })).toEqual({
      id: "1",
      visible: true
    });
  });

  it("requires an admin session for protected administrative routes", async () => {
    const response = await app.request("/api/v1/admins");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("SESSION_REQUIRED");
  });

  it("keeps QR signing key rotation behind super admin auth", async () => {
    const response = await app.request("/api/v1/qr-keys/rotate", { method: "POST" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("SESSION_REQUIRED");
  });
});
