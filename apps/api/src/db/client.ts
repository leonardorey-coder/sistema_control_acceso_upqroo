import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

const queryClient = postgres(env.DATABASE_URL, {
  prepare: false,
  max: 10
});

export const db = drizzle(queryClient, { schema });

export async function closeDb() {
  await queryClient.end();
}
