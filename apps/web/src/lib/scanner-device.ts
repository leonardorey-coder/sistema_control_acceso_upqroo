import { apiRequest } from "$lib/api/client";

export type StoredScannerDevice = {
  id: string;
  code: string;
  status: "pending" | "active" | "disabled" | "revoked";
  label?: string;
  privateKey: CryptoKey;
};

export type ScannerPayload = {
  token?: string;
  signedQr?: string;
  manualMatricula?: string;
};

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function openScannerDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("control-acceso-scanner-devices", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("devices");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function readStoredScannerDevice() {
  const db = await openScannerDb();
  return new Promise<StoredScannerDevice | null>((resolve, reject) => {
    const tx = db.transaction("devices", "readonly");
    const request = tx.objectStore("devices").get("current");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredScannerDevice | undefined) ?? null);
    tx.oncomplete = () => db.close();
  });
}

async function writeStoredScannerDevice(device: StoredScannerDevice) {
  const db = await openScannerDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("devices", "readwrite");
    tx.objectStore("devices").put(device, "current");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

export async function clearStoredScannerDevice() {
  const db = await openScannerDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("devices", "readwrite");
    tx.objectStore("devices").delete("current");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

export async function requestScannerDevice(input: {
  label?: string;
}) {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const result = await apiRequest<{ device: { id: string; code: string; status: StoredScannerDevice["status"]; label: string } }>("/api/v1/scanner-devices/request", {
    method: "POST",
    body: JSON.stringify({
      label: input.label,
      publicKeyJwk
    })
  });
  const device = {
    id: result.device.id,
    code: result.device.code,
    status: result.device.status,
    label: result.device.label,
    privateKey: pair.privateKey
  };
  await writeStoredScannerDevice(device);
  return device;
}

export async function refreshScannerDeviceStatus(device: StoredScannerDevice) {
  const result = await apiRequest<{
    device: {
      id: string;
      code: string;
      status: StoredScannerDevice["status"];
      label?: string;
    };
  }>(`/api/v1/scanner-devices/${device.id}/status`);
  const updated = {
    ...device,
    code: result.device.code,
    status: result.device.status,
    label: result.device.label
  };
  await writeStoredScannerDevice(updated);
  return updated;
}

export async function hashScannerPayload(payload: ScannerPayload & { scannerCode: string }) {
  const stablePayload = {
    manualMatricula: payload.manualMatricula ?? "",
    scannerCode: payload.scannerCode,
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

export async function buildScannerProof(input: {
  adminId: string;
  device: StoredScannerDevice;
  payload: ScannerPayload;
}) {
  const challenge = await apiRequest<{
    id: string;
    challenge: string;
    scannerCode: string;
  }>("/api/v1/scanner-devices/challenge", {
    method: "POST",
    body: JSON.stringify({ scannerDeviceId: input.device.id })
  });
  const payloadHash = await hashScannerPayload({
    ...input.payload,
    scannerCode: challenge.scannerCode
  });
  const message = buildScannerScanMessage({
    adminId: input.adminId,
    scannerDeviceId: input.device.id,
    scannerCode: challenge.scannerCode,
    challenge: challenge.challenge,
    payloadHash
  });
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    input.device.privateKey,
    new TextEncoder().encode(message)
  );

  return {
    scannerDeviceId: input.device.id,
    scannerCode: challenge.scannerCode,
    scannerChallengeId: challenge.id,
    scannerSignature: toBase64Url(signature)
  };
}
