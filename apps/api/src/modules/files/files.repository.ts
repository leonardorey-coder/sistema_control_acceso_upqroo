import { eq } from "drizzle-orm";
import { db } from "../../db/client";
import { storedFiles } from "../../db/schema";

export function findStoredFileByObjectKey(objectKey: string) {
  return db.query.storedFiles.findFirst({
    where: eq(storedFiles.objectKey, objectKey)
  });
}
