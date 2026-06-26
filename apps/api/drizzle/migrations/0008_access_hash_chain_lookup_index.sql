-- Accelerate the global hash-chain predecessor lookup used by
-- access_hash_chain_assign_v1(). Without this partial index, large datasets with
-- mostly historical rows lacking hash_registro force a sequential scan.

CREATE INDEX IF NOT EXISTS registros_acceso_hash_chain_latest_idx
ON registros_acceso (entrada_at DESC, id DESC)
INCLUDE (hash_registro)
WHERE hash_registro IS NOT NULL;
