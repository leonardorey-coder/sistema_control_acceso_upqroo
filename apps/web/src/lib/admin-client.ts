import { apiRequest } from "$lib/api/client";
import type { AdminClientRowPayload } from "@control-acceso/shared";

export type StoredAdminClient = {
  id: string;
  privateKey: CryptoKey;
  label?: string;
};

function toBase64Url(bytes: ArrayBuffer) {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function openAdminClientDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("control-acceso-admin-clients", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("clients");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function readStoredAdminClient() {
  const db = await openAdminClientDb();
  return new Promise<StoredAdminClient | null>((resolve, reject) => {
    const tx = db.transaction("clients", "readonly");
    const request = tx.objectStore("clients").get("current");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve((request.result as StoredAdminClient | undefined) ?? null);
    tx.oncomplete = () => db.close();
  });
}

export async function writeStoredAdminClient(client: StoredAdminClient) {
  const db = await openAdminClientDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("clients", "readwrite");
    tx.objectStore("clients").put(client, "current");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

export async function clearStoredAdminClient() {
  const db = await openAdminClientDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("clients", "readwrite");
    tx.objectStore("clients").delete("current");
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
  });
}

export async function authorizeCurrentAdminBrowser(label = navigator.userAgent.slice(0, 160)) {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"]
  );
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const result = await apiRequest<{ client: { id: string; label?: string | null } }>("/api/v1/auth/admin-clients", {
    method: "POST",
    body: JSON.stringify({ publicKeyJwk, label })
  });
  const client = { id: result.client.id, label: result.client.label ?? label, privateKey: pair.privateKey };
  await writeStoredAdminClient(client);
  return client;
}

export async function buildAdminClientLoginProof() {
  if (!("indexedDB" in window) || !crypto?.subtle) return {};

  const client = await readStoredAdminClient().catch(() => null);
  if (!client?.id || !client.privateKey) return {};

  try {
    const challenge = await apiRequest<{ id: string; message: string }>("/api/v1/auth/admin-clients/challenge", {
      method: "POST",
      body: JSON.stringify({ adminClientId: client.id })
    });
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      client.privateKey,
      new TextEncoder().encode(challenge.message)
    );

    return {
      adminClientId: client.id,
      adminClientChallengeId: challenge.id,
      adminClientSignature: toBase64Url(signature)
    };
  } catch {
    await clearStoredAdminClient().catch(() => null);
    return {};
  }
}

export function listAdminClients() {
  return apiRequest<{ rows: AdminClientRowPayload[] }>("/api/v1/auth/admin-clients");
}

export function revokeAdminClient(id: string) {
  return apiRequest(`/api/v1/auth/admin-clients/${id}`, { method: "DELETE" });
}
