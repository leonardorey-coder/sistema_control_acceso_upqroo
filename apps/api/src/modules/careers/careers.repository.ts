import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { carreras } from "../../db/schema";

export function listCareers(includeInactive = false) {
  return db
    .select()
    .from(carreras)
    .where(includeInactive ? undefined : eq(carreras.active, true))
    .orderBy(asc(carreras.nombre));
}
