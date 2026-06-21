import { readFile } from "node:fs/promises";
import { Hono } from "hono";
import { HttpError } from "../../shared/http-error";
import { resolveLocalObjectPath } from "../../shared/storage";
import { findStoredFileByObjectKey } from "./files.repository";

export const filesRoutes = new Hono();

filesRoutes.get("/:key", async (c) => {
  const objectKey = decodeURIComponent(c.req.param("key"));
  const file = await findStoredFileByObjectKey(objectKey);

  if (!file) {
    throw new HttpError(404, "FILE_NOT_FOUND", "File not found.");
  }

  if (file.driver !== "local") {
    throw new HttpError(501, "STORAGE_DRIVER_NOT_SERVABLE", "The configured storage driver is not directly servable by this route.");
  }

  const bytes = await readFile(resolveLocalObjectPath(file.objectKey));

  return new Response(bytes, {
    headers: {
      "content-type": file.mimeType,
      "content-length": String(file.byteSize),
      "cache-control": file.visibility === "public" ? "public, max-age=3600" : "private, max-age=300"
    }
  });
});
