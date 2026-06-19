import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import { personTypes } from "../../db/schema";

export function listPersonTypes() {
  return db.select().from(personTypes).orderBy(asc(personTypes.label));
}

export function findPersonType(code: string) {
  return db.query.personTypes.findFirst({
    where: eq(personTypes.code, code)
  });
}

export async function createPersonType(input: typeof personTypes.$inferInsert) {
  const [row] = await db.insert(personTypes).values(input).returning();
  return row;
}

export async function updatePersonType(code: string, input: Partial<typeof personTypes.$inferInsert>) {
  const [row] = await db
    .update(personTypes)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(personTypes.code, code))
    .returning();

  return row;
}
