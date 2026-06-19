import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { db } from "../db/client";
import { storedFiles } from "../db/schema";
import { env } from "../config/env";
import { sha256Hex } from "./security";

export type StoredFileRecord = typeof storedFiles.$inferSelect;

export type PutObjectInput = {
  bytes: Uint8Array;
  mimeType: string;
  originalName?: string;
  visibility?: "private" | "public";
};

export interface StorageAdapter {
  put(input: PutObjectInput): Promise<Omit<typeof storedFiles.$inferInsert, "id" | "createdAt">>;
  delete(objectKey: string): Promise<void>;
  signedUrl(objectKey: string): Promise<string>;
}

class LocalStorageAdapter implements StorageAdapter {
  async put(input: PutObjectInput) {
    const checksum = sha256Hex(input.bytes);
    const extension = input.originalName?.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const objectKey = `uploads/${checksum.slice(0, 2)}/${checksum}${extension ? `.${extension}` : ""}`;
    const path = join(env.LOCAL_STORAGE_ROOT, objectKey);

    await mkdir(dirname(path), { recursive: true });
    await Bun.write(path, input.bytes);

    return {
      driver: "local",
      objectKey,
      mimeType: input.mimeType,
      byteSize: input.bytes.byteLength,
      checksumSha256: checksum,
      visibility: input.visibility ?? "private"
    };
  }

  async delete() {
    // Local deletes are intentionally deferred until retention policy exists.
  }

  async signedUrl(objectKey: string) {
    return `/api/v1/files/${encodeURIComponent(objectKey)}`;
  }
}

class ExternalStoragePlaceholder implements StorageAdapter {
  async put(): Promise<Omit<typeof storedFiles.$inferInsert, "id" | "createdAt">> {
    throw new Error(`${env.STORAGE_DRIVER.toUpperCase()}_STORAGE_NOT_CONFIGURED`);
  }

  async delete() {
    throw new Error(`${env.STORAGE_DRIVER.toUpperCase()}_STORAGE_NOT_CONFIGURED`);
  }

  async signedUrl(): Promise<string> {
    throw new Error(`${env.STORAGE_DRIVER.toUpperCase()}_STORAGE_NOT_CONFIGURED`);
  }
}

function createStorageAdapter(): StorageAdapter {
  if (env.STORAGE_DRIVER === "local") {
    return new LocalStorageAdapter();
  }

  return new ExternalStoragePlaceholder();
}

export const storageAdapter = createStorageAdapter();

export async function storeFile(input: PutObjectInput) {
  const storageRow = await storageAdapter.put(input);
  const [row] = await db.insert(storedFiles).values(storageRow).returning();
  return row!;
}
