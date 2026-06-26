import { sql } from "drizzle-orm";

async function repairAccessHashChain() {
  const { db, closeDb } = await import("../db/client");

  await db.execute(sql`ALTER TABLE registros_acceso DISABLE TRIGGER registros_acceso_hash_chain_assign`);
  try {
    await db.execute(sql`
      DO $$
      DECLARE
        v_row record;
        v_previous text := NULL;
      BEGIN
        FOR v_row IN
          SELECT id, person_id, vehicle_id, entrada_at
          FROM registros_acceso
          WHERE hash_registro IS NOT NULL
          ORDER BY entrada_at ASC, id ASC
        LOOP
          UPDATE registros_acceso
          SET
            hash_anterior = v_previous,
            hash_registro = encode(digest(concat_ws(
              '|',
              v_row.id::text,
              coalesce(v_row.person_id::text, ''),
              coalesce(v_row.vehicle_id::text, ''),
              v_row.entrada_at::text,
              coalesce(v_previous, '')
            ), 'sha256'), 'hex')
          WHERE id = v_row.id;

          SELECT hash_registro
          INTO v_previous
          FROM registros_acceso
          WHERE id = v_row.id;
        END LOOP;
      END;
      $$
    `);
  } finally {
    await db.execute(sql`ALTER TABLE registros_acceso ENABLE TRIGGER registros_acceso_hash_chain_assign`);
    const [verification] = await db.execute<{ result: unknown }>(sql`select verify_access_chain_v1() as result`);
    console.info(JSON.stringify(verification?.result ?? null));
    await closeDb();
  }
}

repairAccessHashChain().catch(async (error) => {
  console.error(error);
  const { closeDb } = await import("../db/client");
  await closeDb();
  process.exit(1);
});
