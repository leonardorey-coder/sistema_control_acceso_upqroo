import { describe, expect, it } from "bun:test";
import { getApiErrorCode, isDeviceBindingError } from "./device-errors";

describe("portal device binding helpers", () => {
  it("extracts API error codes from thrown errors", () => {
    const error = Object.assign(new Error("Device missing"), { code: "DEVICE_NOT_FOUND" });

    expect(getApiErrorCode(error)).toBe("DEVICE_NOT_FOUND");
    expect(getApiErrorCode(new Error("plain"))).toBe("");
    expect(getApiErrorCode({ code: "DEVICE_NOT_FOUND" })).toBe("");
  });

  it("classifies recoverable device binding errors", () => {
    expect(isDeviceBindingError("DEVICE_NOT_FOUND")).toBe(true);
    expect(isDeviceBindingError("DEVICE_PROOF_REQUIRED")).toBe(true);
    expect(isDeviceBindingError("DEVICE_CHALLENGE_INVALID")).toBe(true);
    expect(isDeviceBindingError("DEVICE_KEY_INVALID")).toBe(true);
    expect(isDeviceBindingError("DEVICE_SIGNATURE_INVALID")).toBe(true);
    expect(isDeviceBindingError("SIGNED_QR_DISABLED")).toBe(false);
    expect(isDeviceBindingError("INVALID_SIGNED_QR")).toBe(false);
  });
});
