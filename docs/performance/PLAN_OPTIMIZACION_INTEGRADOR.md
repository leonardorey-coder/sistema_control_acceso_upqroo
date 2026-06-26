# Reporte Integrador De Performance

Generado: 2026-06-26T20:38:48.892Z

## Archivos Analizados

| file | kind | generatedAt |
| --- | --- | --- |
| medium-distributed-baseline.json | http | 2026-06-25T06:00:19.580Z |
| medium-worker-results.json | worker | 2026-06-25T05:57:08.498Z |
| pool-10-c25-worker-results.json | http | 2026-06-25T06:27:45.112Z |
| sql-summary.json | sql | 2026-06-26T20:30:40.389Z |
| medium-baseline.json | http | 2026-06-25T05:56:45.788Z |
| pool-10-c25-results.json | http | 2026-06-25T06:26:08.198Z |
| worker-after-sustained-results.json | worker | 2026-06-26T20:10:25.003Z |
| pool-10-c50-results.json | http | 2026-06-25T06:26:51.604Z |
| baseline.json | http | 2026-06-25T05:42:08.133Z |
| pool-10-c50-worker-10m-results.json | http | 2026-06-26T20:10:00.999Z |
| perf-seed-summary.json | unknown |  |
| worker-results.json | worker | 2026-06-25T05:39:33.945Z |
| pool-10-c50-worker-results.json | http | 2026-06-25T06:28:31.531Z |
| phase-1-hash-chain-results.json | http | 2026-06-25T06:12:50.512Z |
| pool-10-results.json | http | 2026-06-25T06:16:10.748Z |
| large-pool-10-c10-hash-index-results.json | http | 2026-06-26T20:37:07.432Z |
| large-pool-10-c10-results.json | http | 2026-06-26T20:32:25.172Z |
| pool-5-results.json | http | 2026-06-25T06:15:11.723Z |
| large-pool-10-c25-hash-index-results.json | http | 2026-06-26T20:38:23.530Z |
| pool-20-results.json | http | 2026-06-25T06:17:10.883Z |

## medium-distributed-baseline.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access-scan-manual | 9681 | 9681 | 0 | 0 | 20.02 | 95.29 | 217.44 | 265.77 | 433.83 |
| people-search | 9680 | 9680 | 0 | 0 | 20.79 | 72.69 | 116.06 | 151.24 | 306.29 |
| vehicles | 9680 | 9680 | 0 | 0 | 12.69 | 51.12 | 92.2 | 121.13 | 272.64 |
| access-today | 9681 | 9681 | 0 | 0 | 9.96 | 36.62 | 71.39 | 94.39 | 225.8 |
| attendance-today | 9681 | 9681 | 0 | 0 | 8.84 | 34.67 | 69.05 | 92.04 | 231.3 |
| health-metrics | 9680 | 9680 | 0 | 0 | 0.11 | 0.39 | 2.21 | 5.95 | 16.01 |

## medium-worker-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| worker-cycle | 5 | 5 | 0 | 0 | 2.79 | 3.95 | 52.37 | 52.37 | 52.37 |

## pool-10-c25-worker-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 3964 | 3964 | 0 | 0 | 22.67 | 45.45 | 99.45 | 116.8 | 161.27 |
| access-scan-manual | 3965 | 3965 | 0 | 0 | 22.18 | 41.73 | 79.82 | 95.19 | 123.43 |
| vehicles | 3964 | 3964 | 0 | 0 | 15.94 | 29.22 | 61.13 | 73.22 | 115.46 |
| access-today | 3964 | 3964 | 0 | 0 | 12.72 | 24.78 | 58.45 | 72.85 | 154.96 |
| attendance-today | 3964 | 3964 | 0 | 0 | 10.1 | 19.37 | 45.6 | 54.99 | 91.09 |
| health-metrics | 3964 | 3964 | 0 | 0 | 0.09 | 0.24 | 1.19 | 2.32 | 7.04 |

## sql-summary.json

| name | durationMs | path |
| --- | --- | --- |
| access-today | 55.34 | /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo/docs/performance/sql-plans/access-today.json |
| access-search | 5.5 | /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo/docs/performance/sql-plans/access-search.json |
| attendance-today | 8.61 | /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo/docs/performance/sql-plans/attendance-today.json |
| people-search | 46.52 | /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo/docs/performance/sql-plans/people-search.json |
| vehicle-search | 0.55 | /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo/docs/performance/sql-plans/vehicle-search.json |
| access-scan-manual-plan-only | 5.24 | /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo/docs/performance/sql-plans/access-scan-manual-plan-only.json |

## medium-baseline.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access-scan-manual | 6215 | 6215 | 0 | 0 | 93.23 | 241.4 | 313.92 | 492.02 | 919.17 |
| people-search | 6215 | 6215 | 0 | 0 | 33.31 | 72.06 | 99.4 | 169.79 | 402.01 |
| vehicles | 6214 | 6214 | 0 | 0 | 25.2 | 66.97 | 92.62 | 153.59 | 383.2 |
| access-today | 6215 | 6215 | 0 | 0 | 17.66 | 43.56 | 64.47 | 109.53 | 330.89 |
| attendance-today | 6215 | 6215 | 0 | 0 | 16.54 | 43.16 | 63.87 | 111.39 | 329.93 |
| health-metrics | 6214 | 6214 | 0 | 0 | 0.09 | 0.36 | 2.19 | 4.86 | 245.34 |

## pool-10-c25-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 4115 | 4115 | 0 | 0 | 21.72 | 44.95 | 86.21 | 108.76 | 163.82 |
| access-scan-manual | 4115 | 4115 | 0 | 0 | 15.69 | 44.08 | 75.2 | 93.06 | 169.84 |
| vehicles | 4114 | 4114 | 0 | 0 | 14.69 | 31.21 | 54.83 | 65.97 | 134.58 |
| access-today | 4115 | 4115 | 0 | 0 | 11.59 | 24.93 | 48.2 | 63.26 | 104.04 |
| attendance-today | 4115 | 4115 | 0 | 0 | 9.7 | 20.56 | 39.27 | 48.72 | 108.7 |
| health-metrics | 4114 | 4114 | 0 | 0 | 0.1 | 0.29 | 1.44 | 2.63 | 11.09 |

## worker-after-sustained-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| worker-cycle | 5 | 5 | 0 | 0 | 1.3 | 2.2 | 62.38 | 62.38 | 62.38 |

## pool-10-c50-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access-scan-manual | 3880 | 3880 | 0 | 0 | 50.13 | 105.16 | 149.94 | 165.91 | 285.73 |
| people-search | 3880 | 3880 | 0 | 0 | 44.65 | 94.79 | 145.93 | 164.93 | 271.65 |
| vehicles | 3880 | 3880 | 0 | 0 | 36.2 | 74.74 | 118.73 | 138.63 | 244.64 |
| access-today | 3880 | 3880 | 0 | 0 | 25.87 | 53.22 | 97.92 | 119.17 | 222.04 |
| attendance-today | 3880 | 3880 | 0 | 0 | 23.91 | 47.11 | 88.29 | 105.71 | 215.08 |
| health-metrics | 3879 | 3879 | 0 | 0 | 0.08 | 0.22 | 1.22 | 2.94 | 11.12 |

## baseline.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access-scan-manual | 12508 | 12508 | 0 | 0 | 2.99 | 9.93 | 22.93 | 33.24 | 158.32 |
| access-today | 12508 | 12508 | 0 | 0 | 3.94 | 8.43 | 21.46 | 32.96 | 124.71 |
| people-search | 12508 | 12508 | 0 | 0 | 2.44 | 8.44 | 17.55 | 26.02 | 149.52 |
| vehicles | 12508 | 12508 | 0 | 0 | 1.21 | 7.37 | 15.9 | 23.74 | 145.36 |
| attendance-today | 12508 | 12508 | 0 | 0 | 1.67 | 5.27 | 12.11 | 18.55 | 107.6 |
| health-metrics | 12507 | 12507 | 0 | 0 | 0.08 | 0.66 | 1.94 | 3.76 | 59.2 |

## pool-10-c50-worker-10m-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access-scan-manual | 70471 | 70471 | 0 | 0 | 50.25 | 112.71 | 161.08 | 212.25 | 655.14 |
| people-search | 70470 | 70470 | 0 | 0 | 44.11 | 102.47 | 152.08 | 187.04 | 615.26 |
| vehicles | 70470 | 70470 | 0 | 0 | 35.55 | 82.69 | 125.74 | 159.89 | 599.13 |
| access-today | 70471 | 70471 | 0 | 0 | 24.45 | 63.46 | 109.59 | 136.26 | 422 |
| attendance-today | 70471 | 70471 | 0 | 0 | 23.38 | 55.55 | 91.32 | 118.3 | 403.12 |
| health-metrics | 70470 | 70470 | 0 | 0 | 0.07 | 0.22 | 1.44 | 3.37 | 80.17 |

## perf-seed-summary.json

_Sin datos._

## worker-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| worker-cycle | 5 | 5 | 0 | 0 | 2.51 | 3.05 | 35.62 | 35.62 | 35.62 |

## pool-10-c50-worker-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access-scan-manual | 3909 | 3909 | 0 | 0 | 53.76 | 104.08 | 152.03 | 166.19 | 206.04 |
| people-search | 3908 | 3908 | 0 | 0 | 44.89 | 94.24 | 147.7 | 161.9 | 195.01 |
| vehicles | 3908 | 3908 | 0 | 0 | 37.3 | 73.61 | 119.68 | 133.7 | 157.97 |
| access-today | 3908 | 3908 | 0 | 0 | 28.07 | 54.5 | 99.48 | 117.69 | 160.89 |
| attendance-today | 3908 | 3908 | 0 | 0 | 23.29 | 45.58 | 86.35 | 101.63 | 139.51 |
| health-metrics | 3908 | 3908 | 0 | 0 | 0.09 | 0.22 | 1.04 | 2.27 | 19.07 |

## phase-1-hash-chain-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 7967 | 7967 | 0 | 0 | 7.48 | 20.9 | 66.52 | 92.22 | 167.52 |
| access-scan-manual | 7968 | 7968 | 0 | 0 | 2.76 | 11.69 | 37.12 | 55.64 | 139.98 |
| vehicles | 7967 | 7967 | 0 | 0 | 1.65 | 8.33 | 25.02 | 36.62 | 136.19 |
| access-today | 7967 | 7967 | 0 | 0 | 2.52 | 7.15 | 21.92 | 35.36 | 132.85 |
| attendance-today | 7967 | 7967 | 0 | 0 | 1.27 | 6.26 | 20.52 | 33.23 | 82.86 |
| health-metrics | 7967 | 7967 | 0 | 0 | 0.1 | 0.4 | 1.82 | 4.68 | 26.6 |

## pool-10-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 4325 | 4325 | 0 | 0 | 9.42 | 19.19 | 63.67 | 85.26 | 150.16 |
| access-scan-manual | 4326 | 4326 | 0 | 0 | 3.47 | 11.12 | 32.03 | 43.43 | 98.73 |
| vehicles | 4325 | 4325 | 0 | 0 | 1.84 | 8.18 | 21.98 | 32.77 | 85.06 |
| access-today | 4326 | 4326 | 0 | 0 | 3.52 | 8.09 | 20.42 | 32.98 | 97.12 |
| attendance-today | 4325 | 4325 | 0 | 0 | 1.88 | 5.89 | 16.53 | 29.82 | 66.94 |
| health-metrics | 4325 | 4325 | 0 | 0 | 0.09 | 0.29 | 1.58 | 2.91 | 8.37 |

## large-pool-10-c10-hash-index-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 1494 | 1494 | 0 | 0 | 56.01 | 197.18 | 265.4 | 303.57 | 334.3 |
| access-today | 1495 | 1495 | 0 | 0 | 15.93 | 71.49 | 131.35 | 163.55 | 239.04 |
| access-scan-manual | 1495 | 1495 | 0 | 0 | 6.33 | 48.25 | 117.66 | 137.05 | 172.96 |
| vehicles | 1494 | 1494 | 0 | 0 | 3.37 | 36.08 | 100.78 | 122.03 | 171.74 |
| attendance-today | 1494 | 1494 | 0 | 0 | 3.56 | 24.73 | 86.5 | 116 | 146.76 |
| health-metrics | 1494 | 1494 | 0 | 0 | 0.11 | 0.29 | 1.73 | 6.34 | 13.95 |

## large-pool-10-c10-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| access-scan-manual | 243 | 243 | 0 | 0 | 3.68 | 3297.13 | 5025.92 | 5591.41 | 6246.19 |
| people-search | 242 | 242 | 0 | 0 | 43.84 | 79.16 | 125.23 | 170.24 | 176.26 |
| access-today | 242 | 242 | 0 | 0 | 11.54 | 17.72 | 58.44 | 981.65 | 1046.65 |
| vehicles | 242 | 242 | 0 | 0 | 1.89 | 5.53 | 39.06 | 67.18 | 81.56 |
| attendance-today | 242 | 242 | 0 | 0 | 2.1 | 6.53 | 25.53 | 64.48 | 76.97 |
| health-metrics | 242 | 242 | 0 | 0 | 0.12 | 0.32 | 0.99 | 3.01 | 4.71 |

## pool-5-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 3739 | 3739 | 0 | 0 | 12.84 | 19.85 | 41.01 | 53.23 | 161.62 |
| access-scan-manual | 3740 | 3740 | 0 | 0 | 9.69 | 16.23 | 36.95 | 55.18 | 186.47 |
| vehicles | 3739 | 3739 | 0 | 0 | 6.54 | 11.09 | 25.88 | 36.6 | 143.44 |
| access-today | 3740 | 3740 | 0 | 0 | 5.29 | 9.34 | 22.7 | 32.11 | 135.46 |
| attendance-today | 3740 | 3740 | 0 | 0 | 3.92 | 8.32 | 20.2 | 30.43 | 131.21 |
| health-metrics | 3739 | 3739 | 0 | 0 | 0.09 | 0.25 | 1.18 | 2.18 | 9.98 |

## large-pool-10-c25-hash-index-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 1523 | 1523 | 0 | 0 | 122.69 | 333.93 | 402.05 | 429.5 | 504.5 |
| access-scan-manual | 1524 | 1524 | 0 | 0 | 62.31 | 231.73 | 302.42 | 329.56 | 371.69 |
| vehicles | 1523 | 1523 | 0 | 0 | 40.75 | 177.08 | 237.23 | 268.59 | 344.65 |
| access-today | 1524 | 1524 | 0 | 0 | 36.83 | 156.26 | 223.03 | 257.61 | 287.67 |
| attendance-today | 1524 | 1524 | 0 | 0 | 15.38 | 115.44 | 174.52 | 200.73 | 250.06 |
| health-metrics | 1523 | 1523 | 0 | 0 | 0.11 | 0.31 | 1.97 | 7.75 | 19.44 |

## pool-20-results.json

| target | samples | ok | errors | errorRate | minMs | p50Ms | p95Ms | p99Ms | maxMs |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| people-search | 3781 | 3781 | 0 | 0 | 9.12 | 21.14 | 67.08 | 99.83 | 409.3 |
| access-scan-manual | 3782 | 3782 | 0 | 0 | 2.35 | 13.32 | 40.23 | 71.82 | 352.25 |
| access-today | 3782 | 3782 | 0 | 0 | 3.43 | 9.58 | 27.38 | 50.5 | 209.68 |
| vehicles | 3781 | 3781 | 0 | 0 | 1.24 | 9.16 | 25.16 | 47.85 | 269.5 |
| attendance-today | 3782 | 3782 | 0 | 0 | 1.46 | 6.7 | 19.31 | 42.34 | 203.38 |
| health-metrics | 3781 | 3781 | 0 | 0 | 0.1 | 0.37 | 2.08 | 4.13 | 10.82 |

## Decision Operativa

- Aplicar cambios solo cuando el resultado antes/despues supere el umbral definido en el plan.
- Posponer optimizaciones con mejora menor al 10% salvo que reduzcan deuda operacional clara.
- Revertir cualquier cambio que aumente errores o degrade p95 de escaneo.

## Decision Fase 1: Cadena Hash Concurrente

Problema observado:

- La corrida medium distribuida anterior mostro que `verify_access_chain_v1()` podia quedar invalido despues de scans concurrentes sobre personas distintas.
- La causa no era latencia sino integridad: `access_scan_v1` serializaba por persona/vehiculo, pero `hash_anterior` se calculaba contra una cadena global sin bloqueo global.

Cambio aplicado:

- Se agrego `0007_access_hash_chain_serialization.sql`.
- La asignacion inicial de `hash_registro` ahora pasa por un trigger `BEFORE UPDATE OF hash_registro`.
- El trigger toma `pg_advisory_xact_lock(hashtext('access:hash-chain'))`, recalcula `hash_anterior`, ajusta `entrada_at` al orden serializado y recalcula `hash_registro`.
- No reescribe hashes historicos; solo protege registros nuevos cuando pasan de `hash_registro IS NULL` a `hash_registro IS NOT NULL`.

Evidencia:

| Medicion | Antes | Despues | Decision |
| --- | ---: | ---: | --- |
| Test concurrente de cadena | No existia | 50 scans simultaneos validos | Aplicado |
| `verify_access_chain_v1()` post-benchmarks | podia fallar | `valid=true`, `checked=53211` | Aplicado |
| `access-scan-manual` medium distribuido p95 | 217.44 ms | 37.12 ms | Sin degradacion |
| `access-scan-manual` medium distribuido p99 | 265.77 ms | 55.64 ms | Sin degradacion |
| Error rate | 0% | 0% | Aceptado |

Interpretacion:

- Este cambio se acepta por integridad funcional, no porque el benchmark original exigiera una optimizacion de latencia.
- El lock global se limita a la asignacion de hash, no al flujo completo de scan.
- En esta medicion no aumento el p95 de `/api/v1/access/scan`; quedo por debajo del umbral medio de 250 ms.

Riesgo restante:

- En datasets grandes, una tasa muy alta de entradas nuevas puede convertir la cadena global en punto de serializacion. Si eso aparece en `large`, las alternativas son cadena por dia, cadena por sede/scanner o lote auditable con raiz diaria.

## Decision Fase 4: Pool Y Backpressure

Condiciones base:

- Dataset medium: 10k personas y 250k accesos.
- `PERF_MANUAL_POOL=100`.
- `POSTGRES_POOL_MAX=10` como candidato principal.
- Corridas cortas de 30 segundos por punto para descartar degradaciones claras.
- Corrida sostenida de 10 minutos para confirmar c50 con worker activo.

Matriz corta por tamano de pool con concurrencia 10:

| `POSTGRES_POOL_MAX` | Scan p50 | Scan p95 | Scan p99 | Error rate | Decision |
| ---: | ---: | ---: | ---: | ---: | --- |
| 5 | 16.23 ms | 36.95 ms | 55.18 ms | 0% | Viable, menor throughput |
| 10 | 11.12 ms | 32.03 ms | 43.43 ms | 0% | Mantener como default |
| 20 | 13.32 ms | 40.23 ms | 71.82 ms | 0% | Posponer, mas variabilidad |

Matriz de concurrencia con pool 10:

| Escenario | Scan p50 | Scan p95 | Scan p99 | Error rate | Decision |
| --- | ---: | ---: | ---: | ---: | --- |
| c10 sin worker | 11.12 ms | 32.03 ms | 43.43 ms | 0% | Bajo umbral |
| c25 sin worker | 44.08 ms | 75.20 ms | 93.06 ms | 0% | Bajo umbral |
| c50 sin worker | 105.16 ms | 149.94 ms | 165.91 ms | 0% | Bajo umbral |
| c25 con worker 1s | 41.73 ms | 79.82 ms | 95.19 ms | 0% | Degradacion p95 aprox. 6.1% |
| c50 con worker 1s | 104.08 ms | 152.03 ms | 166.19 ms | 0% | Degradacion p95 aprox. 1.4% |
| c50 con worker 1s durante 10m | 112.71 ms | 161.08 ms | 212.25 ms | 0% | Bajo umbral sostenido |

Decision:

- Mantener `POSTGRES_POOL_MAX=10` como default.
- No subir a 20 con esta evidencia: aumento p95/p99 y maximos sin mejorar throughput.
- Pool 5 queda como opcion conservadora para hardware limitado, pero no desplaza al default.
- Worker activo no degrado scan mas de 15% en c25/c50; cumple el criterio de Fase 5 para dataset medium.
- Concurrencia 50 sigue debajo del umbral medio de scan p95 menor a 250 ms y con error rate 0%, incluso en una corrida sostenida de 10 minutos.
- `worker-cycle` dedicado post-carga quedo en p95 62.38 ms, muy por debajo del umbral de 5 s.

Siguiente paso:

- Posponer `pg_trgm`, nuevos indices y cursor pagination hasta que `large` o una busqueda real supere umbrales.

## Decision Fase 2 Large: Indice De Cadena Hash

Condiciones:

- Dataset large: 100k personas y 2M accesos.
- Seed large con `PERF_RESET=true`: 2026-06-26T20:23:08.426Z a 2026-06-26T20:30:25.026Z.
- El seed large fue I/O-bound durante la insercion masiva de accesos.

Problema observado:

- Antes del indice, `access-scan-manual` en large c10 tuvo p95 `5025.92 ms`, p99 `5591.41 ms` y p50 `3297.13 ms`.
- El plan directo del lookup de predecessor de cadena hash mostro `Parallel Seq Scan` sobre `registros_acceso`, removiendo ~2M filas no encadenadas para encontrar el ultimo `hash_registro`.
- `EXPLAIN ANALYZE` del lookup antes del indice: `Execution Time 1170.293 ms`, `Shared Read Blocks 28746`.

Cambio aplicado:

- Se agrego `0008_access_hash_chain_lookup_index.sql`.
- Indice parcial:
  `registros_acceso_hash_chain_latest_idx ON registros_acceso (entrada_at DESC, id DESC) INCLUDE (hash_registro) WHERE hash_registro IS NOT NULL`.

Evidencia:

| Medicion | Antes | Despues | Mejora | Decision |
| --- | ---: | ---: | ---: | --- |
| Lookup ultimo hash SQL | 1170.293 ms | 0.266 ms | >99% | Aplicado |
| Scan large c10 p95 | 5025.92 ms | 117.66 ms | 97.7% | Aplicado |
| Scan large c10 p99 | 5591.41 ms | 137.05 ms | 97.5% | Aplicado |
| Scan large c25 p95 | No medido pre-indice | 302.42 ms | Bajo umbral large | Aceptado |
| Scan large c25 p99 | No medido pre-indice | 329.56 ms | Bajo umbral large | Aceptado |
| Error rate large c10/c25 | 0% | 0% | Sin regresion | Aceptado |

Costo:

- Escritura: solo registros con `hash_registro IS NOT NULL` entran al indice.
- Tamano: acotado a filas encadenadas; los 2M accesos sinteticos de seed no tienen hash y no inflan este indice.
- Riesgo: bajo, porque el indice corresponde exactamente al `ORDER BY entrada_at DESC, id DESC LIMIT 1` del trigger de cadena.

Decision:

- Mantener el indice.
- No aplicar `pg_trgm` todavia: `people-search` large c25 p95 quedo en `402.05 ms`, bajo el umbral large de 1s.
- No aplicar cursor pagination todavia: listados large c25 quedaron bajo umbral (`access-today` p95 `223.03 ms`, `attendance-today` p95 `174.52 ms`).

Nota de integridad del entorno de benchmarks:

- `PERF_RESET=true` borra registros `PERF-*`. Como la cadena hash es global, borrar registros de en medio puede invalidar hashes restantes no-PERF.
- Se agrego `perf:repair-chain` y `perf:seed` ahora reencadena hashes restantes despues de reset.
- Se ejecuto `perf:repair-chain` sobre la DB local de desarrollo con autorizacion explicita del usuario.
- Resultado posterior: `verify_access_chain_v1()` devolvio `valid=true`, `checked=1813`.
- Despues de reparar, `bun test` paso sobre la DB de desarrollo con `64 pass`.
- Tambien se verifico previamente en una DB aislada `control_acceso_v2_verify_20260626`, con migraciones limpias y `bun test` en `64 pass`.
