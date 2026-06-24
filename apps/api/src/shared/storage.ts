import { mkdir } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
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

export type StorageRuntimeConfig = Pick<typeof env,
  | "STORAGE_DRIVER"
  | "LOCAL_STORAGE_ROOT"
  | "STORAGE_BUCKET"
  | "STORAGE_REGION"
  | "STORAGE_ENDPOINT"
  | "STORAGE_ACCESS_KEY_ID"
  | "STORAGE_SECRET_ACCESS_KEY"
  | "STORAGE_FORCE_PATH_STYLE"
  | "STORAGE_SIGNED_URL_TTL_SECONDS"
>;

type SignedUrlFactory = (
  client: S3Client,
  command: GetObjectCommand,
  options: { expiresIn: number }
) => Promise<string>;

class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly config: StorageRuntimeConfig = env) {}

  async put(input: PutObjectInput) {
    const checksum = sha256Hex(input.bytes);
    const extension = input.originalName?.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const objectKey = `uploads/${checksum.slice(0, 2)}/${checksum}${extension ? `.${extension}` : ""}`;
    const path = join(this.config.LOCAL_STORAGE_ROOT, objectKey);

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

function requireStorageConfig(config: StorageRuntimeConfig, value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`${config.STORAGE_DRIVER.toUpperCase()}_STORAGE_${name}_REQUIRED`);
  }

  return value;
}

function objectKeyFor(input: PutObjectInput) {
  const checksum = sha256Hex(input.bytes);
  const extension = input.originalName?.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  return {
    checksum,
    objectKey: `uploads/${checksum.slice(0, 2)}/${checksum}${extension ? `.${extension}` : ""}`
  };
}

export class S3CompatibleStorageAdapter implements StorageAdapter {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly signedUrlFactory: SignedUrlFactory;

  constructor(
    private readonly config: StorageRuntimeConfig = env,
    client?: S3Client,
    signedUrlFactory: SignedUrlFactory = getSignedUrl
  ) {
    this.bucket = requireStorageConfig(config, config.STORAGE_BUCKET, "BUCKET");
    this.client = client ?? new S3Client({
      region: config.STORAGE_REGION,
      ...(config.STORAGE_ENDPOINT ? { endpoint: config.STORAGE_ENDPOINT } : {}),
      forcePathStyle: config.STORAGE_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: requireStorageConfig(config, config.STORAGE_ACCESS_KEY_ID, "ACCESS_KEY_ID"),
        secretAccessKey: requireStorageConfig(config, config.STORAGE_SECRET_ACCESS_KEY, "SECRET_ACCESS_KEY")
      }
    });
    this.signedUrlFactory = signedUrlFactory;
  }

  async put(input: PutObjectInput) {
    const { checksum, objectKey } = objectKeyFor(input);

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: input.bytes,
      ContentType: input.mimeType,
      Metadata: {
        checksumSha256: checksum
      }
    }));

    return {
      driver: this.config.STORAGE_DRIVER,
      bucket: this.bucket,
      objectKey,
      mimeType: input.mimeType,
      byteSize: input.bytes.byteLength,
      checksumSha256: checksum,
      visibility: input.visibility ?? "private"
    };
  }

  async delete(objectKey: string) {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: objectKey
    }));
  }

  signedUrl(objectKey: string) {
    return this.signedUrlFactory(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: objectKey
      }),
      { expiresIn: this.config.STORAGE_SIGNED_URL_TTL_SECONDS }
    );
  }
}

export function createStorageAdapter(
  config: StorageRuntimeConfig = env,
  options: { s3Client?: S3Client; signedUrlFactory?: SignedUrlFactory } = {}
): StorageAdapter {
  if (config.STORAGE_DRIVER === "local") {
    return new LocalStorageAdapter(config);
  }

  return new S3CompatibleStorageAdapter(config, options.s3Client, options.signedUrlFactory);
}

export const storageAdapter = createStorageAdapter();

export async function storeFile(input: PutObjectInput) {
  const storageRow = await storageAdapter.put(input);
  const [row] = await db.insert(storedFiles).values(storageRow).returning();
  return row!;
}

export function resolveLocalObjectPath(objectKey: string) {
  const normalizedKey = normalize(objectKey).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(env.LOCAL_STORAGE_ROOT, normalizedKey);
}
