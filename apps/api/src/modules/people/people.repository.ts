import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { personas } from "../../db/schema";

export function listPeople() {
  return db.select().from(personas).orderBy(asc(personas.nombre)).limit(50);
}

export function findPersonByMatricula(matricula: string) {
  return db.query.personas.findFirst({
    where: eq(personas.matricula, matricula)
  });
}
