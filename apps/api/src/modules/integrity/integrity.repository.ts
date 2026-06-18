import { sql } from "drizzle-orm";
import { db } from "../../db/client";

export async function verifyAccessChain(fromAt?: string, toAt?: string) {
  const [row] = await db.execute<{ result: unknown }>(
    sql`select verify_access_chain_v1(${fromAt ?? null}::timestamptz, ${toAt ?? null}::timestamptz) as result`
  );

  return row?.result;
}
