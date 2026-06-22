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
- `OPERATING_TIMEZONE`: zona operativa; default recomendado `America/Cancun`.
- `WEB_ORIGIN` / `WEB_ORIGINS`: origenes permitidos con cookies.
- `SESSION_COOKIE_NAME` y `USER_SESSION_COOKIE_NAME`: cookies admin y portal.
- `SESSION_SECRET` y `TOKEN_SIGNING_SECRET`: secretos largos para sesiones y
  tokens opacos.
- `RATE_LIMIT_DRIVER`: `memory` en desarrollo/test y `postgres` por defecto en
  produccion. Usa la tabla `login_rate_limits`.
- `STORAGE_DRIVER`: `local` soportado por defecto.
- `LOCAL_STORAGE_ROOT`: carpeta local para archivos.
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
