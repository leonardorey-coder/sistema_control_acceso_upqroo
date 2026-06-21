import { describe, expect, it } from "bun:test";
import { app } from "../src/app";
import { env } from "../src/config/env";

describe("HTTP security contracts", () => {
  it("returns controlled validation errors without echoing submitted secrets", async () => {
    const password = "top-secret-test-password";
    const response = await app.request("/api/v1/portal/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identity: "not-an-email",
        password
      })
    });
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(serialized).not.toContain(password);
  });

  it("rejects malformed JSON as a client error instead of an internal error", async () => {
    const response = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{"
    });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("does not reflect untrusted CORS origins", async () => {
    const trustedResponse = await app.request("/health", {
      method: "OPTIONS",
      headers: {
        origin: env.WEB_ORIGIN,
        "access-control-request-method": "GET"
      }
    });
    const hostileResponse = await app.request("/health", {
      method: "OPTIONS",
      headers: {
        origin: "https://evil.example",
        "access-control-request-method": "GET"
      }
    });

    expect(trustedResponse.headers.get("access-control-allow-origin")).toBe(env.WEB_ORIGIN);
    expect(trustedResponse.headers.get("access-control-allow-credentials")).toBe("true");
    expect(hostileResponse.headers.get("access-control-allow-origin")).toBe(env.WEB_ORIGIN);
    expect(hostileResponse.headers.get("access-control-allow-origin")).not.toBe("https://evil.example");
  });

  it("requires admin sessions before protected administrative handlers run", async () => {
    const protectedRequests = [
      { method: "GET", path: "/api/v1/people" },
      { method: "POST", path: "/api/v1/credentials/person" },
      { method: "GET", path: "/api/v1/access/recent" },
      { method: "GET", path: "/api/v1/config" },
      { method: "GET", path: "/api/v1/integrity/access-chain" },
      { method: "GET", path: "/api/v1/files/private%2Favatar.png" },
      { method: "GET", path: "/api/v1/admins" }
    ] as const;

    for (const request of protectedRequests) {
      const init: RequestInit = {
        method: request.method,
        headers: { "content-type": "application/json" }
      };
      if (request.method === "POST") {
        init.body = JSON.stringify({});
      }

      const response = await app.request(request.path, init);
      const body = await response.json();

      expect(response.status, request.path).toBe(401);
      expect(body.error.code, request.path).toBe("SESSION_REQUIRED");
      expect(JSON.stringify(body), request.path).not.toContain("passwordHash");
      expect(JSON.stringify(body), request.path).not.toContain("sessionHash");
    }
  });

  it("requires a portal session for user-only portal resources", async () => {
    const protectedRequests = [
      { method: "GET", path: "/api/v1/portal/me" },
      { method: "GET", path: "/api/v1/portal/qr" },
      { method: "POST", path: "/api/v1/portal/qr/rotate" },
      { method: "GET", path: "/api/v1/portal/devices" },
      { method: "GET", path: "/api/v1/portal/access/recent" },
      { method: "GET", path: "/api/v1/portal/attendance/recent" }
    ] as const;

    for (const request of protectedRequests) {
      const init: RequestInit = {
        method: request.method,
        headers: { "content-type": "application/json" }
      };
      if (request.method === "POST") {
        init.body = JSON.stringify({});
      }

      const response = await app.request(request.path, init);
      const body = await response.json();

      expect(response.status, request.path).toBe(401);
      expect(body.error.code, request.path).toBe("USER_SESSION_REQUIRED");
    }
  });
});
