# Sistema de Control de Acceso UPQROO v2

Proyecto v2 inicializado desde cero.

## Stack

- Frontend: SvelteKit, TypeScript y Tailwind.
- Backend: Bun, TypeScript y Hono.
- Base de datos: PostgreSQL con Drizzle ORM y SQL manual versionado para reglas criticas.
- Arquitectura: rutas HTTP, middlewares, servicios/casos de uso, repositorios, validadores y SQL avanzado controlado.

## Estructura

```txt
apps/
  api/   Backend Bun + Hono + Drizzle
  web/   Frontend SvelteKit + Tailwind
packages/
  shared/ Contratos compartidos
```

## Comandos

```sh
bun install
cp .env.example .env
bun run dev:api
bun run dev:web
```

## Estado inicial

Esta base deja listos:

- Servidor Hono con `/health`.
- Configuracion centralizada por entorno.
- Cliente Drizzle para PostgreSQL.
- Schema inicial para personas, sesiones, QR, registros de acceso, auditoria y archivos.
- Frontend SvelteKit con consulta de salud de API.

La migracion de datos historicos debe hacerse de forma aditiva y validada antes de retirar campos legacy.
