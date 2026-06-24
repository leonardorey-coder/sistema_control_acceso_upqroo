import { apiRequest } from "$lib/api/client";
export { getApiErrorCode, isDeviceBindingError } from "./device-errors";

export type StoredDevice = {
  id: string;
  privateKey: CryptoKey;
};

export type DeviceStatusHandler = (status: string) => void;

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function openDeviceDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("control-acceso-device-binding", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("devices");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function readStoredDevice() {
  const db = await openDeviceDb();
  return new Promise<StoredDevice | null>((resolve, reject) => {
    const tx = db.transaction("devices", "readonly");
    const request = tx.objectStore("devices").get("current");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredDevice | undefined) ?? null);
    tx.oncomplete = () => db.close();
  });
}

export async function writeStoredDevice(device: StoredDevice) {
  const db = await openDeviceDb();
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

export async function clearStoredDevice() {
  const db = await openDeviceDb();
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

export async function ensureDevice(onStatus?: DeviceStatusHandler) {
  if (!("indexedDB" in window) || !crypto?.subtle) {
    onStatus?.("Dispositivo sin soporte criptografico");
    return null;
  }

  const stored = await readStoredDevice().catch(() => null);
  if (stored?.id && stored.privateKey) {
    onStatus?.("Dispositivo verificado");
    return stored;
  }

  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const result = await apiRequest<{ device: { id: string } }>("/api/v1/portal/devices", {
    method: "POST",
    body: JSON.stringify({
      publicKeyJwk,
      label: navigator.userAgent.slice(0, 120)
    })
  });
  const device = { id: result.device.id, privateKey: pair.privateKey };
  await writeStoredDevice(device);
  onStatus?.("Dispositivo registrado");
  return device;
}

export async function buildDeviceProof(onStatus?: DeviceStatusHandler) {
  const device = await ensureDevice(onStatus);
  if (!device) return {};

  const challenge = await apiRequest<{ id: string; message: string }>("/api/v1/portal/devices/challenge", {
    method: "POST",
    body: JSON.stringify({ deviceId: device.id })
  });
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    device.privateKey,
    new TextEncoder().encode(challenge.message)
  );

  return {
    deviceId: device.id,
    challengeId: challenge.id,
    signature: toBase64Url(signature)
  };
}
