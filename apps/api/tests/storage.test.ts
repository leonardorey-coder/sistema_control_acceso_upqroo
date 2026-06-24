import { describe, expect, it } from "bun:test";
import type { S3Client } from "@aws-sdk/client-s3";
import { createStorageAdapter, type StorageRuntimeConfig } from "../src/shared/storage";
import { sha256Hex } from "../src/shared/security";

function storageConfig(overrides: Partial<StorageRuntimeConfig> = {}): StorageRuntimeConfig {
  return {
    STORAGE_DRIVER: "r2",
    LOCAL_STORAGE_ROOT: ".local-storage",
    STORAGE_BUCKET: "control-acceso-test",
    STORAGE_REGION: "auto",
    STORAGE_ENDPOINT: "https://account-id.r2.cloudflarestorage.com",
    STORAGE_ACCESS_KEY_ID: "access-key",
    STORAGE_SECRET_ACCESS_KEY: "secret-key",
    STORAGE_FORCE_PATH_STYLE: true,
    STORAGE_SIGNED_URL_TTL_SECONDS: 300,
    ...overrides
  };
}

class FakeS3Client {
  readonly commands: unknown[] = [];

  async send(command: unknown) {
    this.commands.push(command);
    return {};
  }
}

describe("storage adapters", () => {
  it("uploads S3-compatible objects with stable checksum keys and metadata", async () => {
    const client = new FakeS3Client();
    const bytes = new TextEncoder().encode("profile photo");
    const checksum = sha256Hex(bytes);
    const adapter = createStorageAdapter(storageConfig(), {
      s3Client: client as unknown as S3Client
    });

    const row = await adapter.put({
      bytes,
      mimeType: "image/png",
      originalName: "avatar.PNG"
    });
    const command = client.commands[0] as { constructor: { name: string }; input: Record<string, unknown> };

    expect(command.constructor.name).toBe("PutObjectCommand");
    expect(command.input.Bucket).toBe("control-acceso-test");
    expect(command.input.Key).toBe(`uploads/${checksum.slice(0, 2)}/${checksum}.png`);
    expect(command.input.ContentType).toBe("image/png");
    expect(command.input.Metadata).toEqual({ checksumSha256: checksum });
    expect(row).toMatchObject({
      driver: "r2",
      bucket: "control-acceso-test",
      objectKey: `uploads/${checksum.slice(0, 2)}/${checksum}.png`,
      mimeType: "image/png",
      byteSize: bytes.byteLength,
      checksumSha256: checksum,
      visibility: "private"
    });
  });

  it("deletes S3-compatible objects by bucket and key", async () => {
    const client = new FakeS3Client();
    const adapter = createStorageAdapter(storageConfig(), {
      s3Client: client as unknown as S3Client
    });

    await adapter.delete("uploads/aa/file.png");
    const command = client.commands[0] as { constructor: { name: string }; input: Record<string, unknown> };

    expect(command.constructor.name).toBe("DeleteObjectCommand");
    expect(command.input).toMatchObject({
      Bucket: "control-acceso-test",
      Key: "uploads/aa/file.png"
    });
  });

  it("creates S3-compatible signed URLs with the configured TTL", async () => {
    const client = new FakeS3Client();
    let signedInput: { command?: { input: Record<string, unknown> }; expiresIn?: number } = {};
    const adapter = createStorageAdapter(storageConfig({ STORAGE_SIGNED_URL_TTL_SECONDS: 900 }), {
      s3Client: client as unknown as S3Client,
      signedUrlFactory: async (_client, command, options) => {
        signedInput = { command: command as unknown as { input: Record<string, unknown> }, expiresIn: options.expiresIn };
        return "https://signed.example/uploads/aa/file.png";
      }
    });

    await expect(adapter.signedUrl("uploads/aa/file.png")).resolves.toBe("https://signed.example/uploads/aa/file.png");
    expect(signedInput.expiresIn).toBe(900);
    expect(signedInput.command?.input).toMatchObject({
      Bucket: "control-acceso-test",
      Key: "uploads/aa/file.png"
    });
  });

  it("fails fast with clear configuration errors for external storage", () => {
    expect(() => createStorageAdapter(storageConfig({ STORAGE_BUCKET: undefined }))).toThrow("R2_STORAGE_BUCKET_REQUIRED");
    expect(() => createStorageAdapter(storageConfig({ STORAGE_ACCESS_KEY_ID: undefined }))).toThrow("R2_STORAGE_ACCESS_KEY_ID_REQUIRED");
    expect(() => createStorageAdapter(storageConfig({ STORAGE_SECRET_ACCESS_KEY: undefined }))).toThrow("R2_STORAGE_SECRET_ACCESS_KEY_REQUIRED");
  });
});
