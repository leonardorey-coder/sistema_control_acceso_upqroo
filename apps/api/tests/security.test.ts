import { describe, expect, it } from "bun:test";
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
});
