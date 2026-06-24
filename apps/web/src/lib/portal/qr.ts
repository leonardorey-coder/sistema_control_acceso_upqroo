import { apiRequest } from "$lib/api/client";
import { buildDeviceProof, type DeviceStatusHandler } from "./device-binding";

export type DynamicQrPayload = {
  token: string;
  expiresAt: string;
  refreshAfterMs: number;
  jti: string;
  deviceId?: string;
};

export function requestPersonalDynamicQr(onStatus?: DeviceStatusHandler) {
  return buildDeviceProof(onStatus).then((proof) => apiRequest<DynamicQrPayload>("/api/v1/portal/qr/dynamic", {
    method: "POST",
    body: JSON.stringify(proof)
  }));
}

export function requestTemporaryDynamicQr(onStatus?: DeviceStatusHandler) {
  return buildDeviceProof(onStatus).then((proof) => apiRequest<DynamicQrPayload>("/api/v1/portal/temporary-daily-qr/dynamic", {
    method: "POST",
    body: JSON.stringify(proof)
  }));
}
