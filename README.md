# Sistema de Control de Acceso UPQROO v2

Monorepo para control de acceso institucional con panel administrativo,
scanner, portal de usuario, QR dinamico firmado, permisos vehiculares,
asistencias, auditoria y worker operativo.

## Stack

- Frontend: SvelteKit 5, TypeScript, Tailwind CSS y Vite.
- Backend: Bun, TypeScript, Hono y Zod.
- Base de datos: PostgreSQL con Drizzle ORM para schema tipado y migraciones SQL
  manuales para reglas atomicas.
- Seguridad: cookies `httpOnly`, sesiones hasheadas, `Bun.password`,
  rate-limit de login en memoria o Postgres, auditoria best-effort y QR firmado
  ES256.
- Tests: `bun:test` para contratos, seguridad e integracion habilitable con
  Postgres real.

## Estructura

```txt
apps/
  api/      API Bun + Hono + Drizzle
  web/      App SvelteKit, scanner y portal
packages/
  shared/   Contratos compartidos TypeScript
docs/        Planes y especificaciones por feature
```

## Configuracion

```sh
bun install
cp .env.example .env
```

Variables principales:

- `DATABASE_URL`: conexion PostgreSQL.
- `POSTGRES_POOL_MAX`: maximo de conexiones del pool PostgreSQL por proceso
  API/worker; default `10`.
- `EVENT_COALESCE_MS`: ventana para agrupar eventos de tablas por WebSocket;
  default `300`.
- `WORKER_INTERVAL_MS`: intervalo del worker operativo; default `60000`.
- `OPERATING_TIMEZONE`: zona operativa; default recomendado `America/Cancun`.
- `WEB_ORIGIN` / `WEB_ORIGINS`: origenes permitidos con cookies.
- `SESSION_COOKIE_NAME` y `USER_SESSION_COOKIE_NAME`: cookies admin y portal.
- `SESSION_SECRET` y `TOKEN_SIGNING_SECRET`: secretos largos para sesiones y
  tokens opacos.
- `RATE_LIMIT_DRIVER`: `memory` en desarrollo/test y `postgres` por defecto en
  produccion. Usa la tabla `login_rate_limits`.
- `STORAGE_DRIVER`: `local`, `r2` o `s3`. `r2` es el recomendado para
  produccion si se usara Cloudflare R2.
- `LOCAL_STORAGE_ROOT`: carpeta local para archivos.
- `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`,
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`,
  `STORAGE_FORCE_PATH_STYLE`, `STORAGE_SIGNED_URL_TTL_SECONDS`: configuracion
  del adapter S3-compatible usado por S3/R2.
- `QR_SIGNING_PRIVATE_KEY`, `QR_SIGNING_PUBLIC_KEY`, `QR_SIGNING_KID`: llaves
  productivas opcionales para QR dinamico firmado.

En desarrollo, si no se configuran llaves QR, la API genera una llave ES256
temporal y publica su JWKS en `/api/v1/qr-keys/jwks`.

## Comandos

```sh
bun run dev:api
bun run dev:web
bun run dev:worker
bun run check
bun test
```

## Performance

El arnes de rendimiento vive en `apps/api/src/performance` y escribe resultados
en `docs/performance`.

```sh
bun run perf:seed
bun run perf:http
bun run perf:sql
bun run perf:worker
bun run perf:report
bun run perf:repair-chain
```

Variables principales:

- `PERF_DATASET`: `small`, `medium` o `large`.
- `PERF_DATABASE_URL`: conexion usada por seed, SQL y worker.
- `PERF_BASE_URL`: URL de la API para pruebas HTTP.
- `PERF_CONCURRENCY` y `PERF_DURATION_SECONDS`: carga sostenida para HTTP.
- `PERF_MANUAL_POOL`: cantidad de matriculas `PERF-*` usadas para distribuir
  scans manuales; usa `1` para medir contencion sobre una sola persona.
- `PERF_OUTPUT`: archivo JSON de salida cuando se quiere comparar fases.
- `PERF_INCLUDE_SAMPLES=true`: incluye muestras crudas HTTP; por defecto solo
  se guarda resumen para evitar artefactos grandes.

`perf:sql` no ejecuta `EXPLAIN ANALYZE` sobre operaciones mutantes por defecto.
Para medir `access_scan_v1` ejecutandose realmente, usa
`PERF_ALLOW_MUTATING_SQL_ANALYZE=true` sobre una base de pruebas.

`perf:repair-chain` recompone `hash_anterior`/`hash_registro` en orden
cronologico y desactiva temporalmente el trigger de cadena. Usalo solo en bases
de benchmark o verificacion despues de resets destructivos; no es una operacion
normal de produccion.

Las pruebas de integracion usan la misma configuracion de la API, especialmente
`DATABASE_URL`. Si no hay Postgres disponible, esos casos se saltan
explicitamente; si `DATABASE_URL` apunta a una base migrada, `bun test` ejecuta
la suite completa.

## Migraciones

Las migraciones viven en `apps/api/drizzle/migrations`.

- Drizzle define tablas, enums e indices tipados.
- Las reglas atomicas de scan, entrada/salida, asistencia, integridad y replay
  de QR viven en SQL manual versionado.
- La funcion vigente `access_scan_v1` usa la zona operativa para fecha local,
  QR temporal diario y asistencia.

## Modulos Implementados

- Admin auth y sesiones.
- Portal de usuario con login, cambio de password, historial y QR dinamico.
- Device binding WebCrypto para QR dinamico cuando la configuracion lo exige.
- Scanner admin con lectura de QR firmado y fallback manual.
- Personas, carreras y tipos de persona.
- QR personales, QR temporales diarios, Hot-QR y QR vehicular.
- Vehiculos y permisos vehiculares.
- Registros de acceso, salidas automaticas y asistencias.
- Archivos locales protegidos por sesion admin.
- Storage externo S3/R2 mediante URLs firmadas.
- Auditoria y eventos live para refresco de tablas.
- Worker para expiraciones, limpieza y cierres automaticos.

## Operacion

En produccion deben correr tres procesos:

```sh
bun run --cwd apps/api start
bun run --cwd apps/web build
bun run --cwd apps/web preview
bun run --cwd apps/api worker
```

El worker es obligatorio para expiraciones y mantenimiento. Si se despliega con
varios procesos API, configura `RATE_LIMIT_DRIVER=postgres` y aplica la
migracion `0006_durable_rate_limit.sql` para que los bloqueos de login se
compartan entre procesos. `RATE_LIMIT_DRIVER=memory` queda solo para desarrollo,
tests locales o despliegues de un unico proceso.

Para rotar llaves QR productivas por variables de entorno, cambia el par de
llaves y tambien `QR_SIGNING_KID`. Reutilizar un `kid` ya rotado o con otra
llave es rechazado para evitar reactivar llaves antiguas.

Para R2, configura `STORAGE_DRIVER=r2`, `STORAGE_ENDPOINT` con el endpoint S3 de
la cuenta, `STORAGE_REGION=auto`, bucket y credenciales. `/api/v1/files/:key`
redirige a una URL firmada temporal para objetos externos.

## Verificacion Actual

Estado validado localmente:

```sh
bun run check
bun test
```

Ambos comandos pasan desde la raiz del monorepo. Las pruebas de integracion con
Postgres quedan marcadas como `skip` cuando `DATABASE_URL` no esta disponible
desde la sesion de pruebas.

## Documentacion

- `docs/PLAN_GUI_FRONTEND_FALTANTE_V2.md`: checklist vivo de cierre v2.
- `docs/PLAN_INTEGRADOR_STACK_FEATS_BUGS.md`: documento historico de auditoria;
  revisar contra codigo actual antes de tratar un punto como pendiente.
- `docs/FEAT_*.md`: especificaciones por feature.
