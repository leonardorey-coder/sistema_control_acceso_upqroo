# Sistema de Control de Acceso UPQROO - Nueva version

## Estado del documento

Este README describe la version objetivo del Sistema de Control de Acceso UPQROO despues de la migracion tecnologica.

No representa todavia el estado actual completo del codigo. Funciona como guia de producto, arquitectura y stack para construir la nueva version de forma gradual, por modulos y sin detener el sistema actual.

## Vision general

El sistema sera una plataforma web para control de acceso, asistencia y gestion de codigos QR dentro de la UPQROO.

La nueva version busca convertir el proyecto actual en una aplicacion mas modular, segura y mantenible, con frontend SPA, backend persistente, sesiones seguras, almacenamiento agnostico y una base de datos PostgreSQL bien versionada.

## Objetivos principales

- Registrar entradas y salidas mediante QR.
- Gestionar personas, carreras, administradores y estados de acceso.
- Validar QR normales, QR temporales y Hot-QR.
- Registrar asistencias y horas de permanencia.
- Ofrecer un panel administrativo para operacion y consulta.
- Ofrecer un portal de usuario con QR personal y metricas.
- Mejorar seguridad con sesiones y cookies `httpOnly`.
- Reducir SQL repetido mediante ORM ligero.
- Mantener PostgreSQL como fuente fuerte de verdad.
- Permitir almacenamiento local, S3 o Cloudflare R2 sin acoplar el negocio al proveedor.

## Stack tecnologico

### Frontend

```txt
SvelteKit
TypeScript
Tailwind CSS
Vite
Playwright para flujos criticos
```

SvelteKit se usara para construir una SPA administrativa y un portal de usuario modular. Tailwind CSS se usara para mantener consistencia visual, velocidad de construccion y componentes reutilizables.

### Backend

```txt
Bun
TypeScript
Hono
Zod
bun:test
```

Bun sera el runtime principal del backend. Hono se usara para rutas, middlewares y composicion de API. Zod validara entradas y contratos. `bun:test` se usara para pruebas unitarias e integracion ligera.

### Base de datos

```txt
PostgreSQL
Drizzle ORM
Drizzle Kit
SQL manual versionado
```

PostgreSQL se mantiene como base central. Drizzle ORM se usara para consultas comunes y repositorios. Drizzle Kit gestionara migraciones normales de schema. Las funciones, procedimientos y vistas complejas se mantendran como SQL versionado.

### Autenticacion

```txt
Sesiones en base de datos
Cookies httpOnly
Bun.password
```

La nueva version no debe depender de tokens sensibles en `localStorage`. El backend creara sesiones, las guardara en base de datos y enviara cookies `httpOnly`.

### Almacenamiento

```txt
StorageService
LocalStorageAdapter
S3StorageAdapter
R2StorageAdapter
```

El sistema no debe depender directamente de un proveedor de archivos. La aplicacion usara una interfaz comun de almacenamiento para poder cambiar entre local, S3 o Cloudflare R2.

## Modulos funcionales

## 1. Portal de usuario

El portal de usuario sera una ruta publica de acceso, pero no debe exponer informacion sensible sin autenticacion.

La idea funcional es:

- El usuario entra al portal.
- Inicia sesion o accede mediante enlace seguro.
- Ve su QR personal en primera plana.
- Puede maximizar el QR para que sea escaneado.
- Consulta metricas personales de asistencia, horas y registros.
- Puede generar QR temporales o codigos de acceso segun permisos.
- Puede consultar historial de codigos emitidos y revocarlos si aplica.

### Pantalla principal del usuario

```txt
[QR personal grande]
[Boton maximizar QR]
[Estado: activo, inactivo, expirado o dentro/fuera]

[Metricas rapidas]
- Porcentaje de asistencia
- Horas acumuladas
- Entradas del mes
- Ultima entrada/salida

[Graficas BI-like]
- Asistencia semanal
- Horas por periodo
- Tendencia mensual
- Materias o bloques con mayor ausencia

[Acciones]
- Generar QR temporal
- Generar codigo temporal
- Ver historial
- Revocar codigos
```

### Consideraciones de seguridad

El QR del usuario no debe ser simplemente una matricula expuesta si el sistema controla acceso fisico o asistencia real.

La recomendacion es evolucionar hacia QR revocable o dinamico:

```txt
QR firmado
expiracion corta
asociado al usuario
validado por backend
revocable
auditado
```

Si se mantiene un QR estatico, el sistema debe documentar el riesgo de capturas, enlaces compartidos o uso indebido.

## 2. Panel administrativo

El panel administrativo sera para usuarios con permisos de operacion.

Funciones principales:

- Login de administrador.
- Escaneo de QR.
- Registro de entradas y salidas.
- Alta y edicion de personas.
- Gestion de carreras.
- Gestion de administradores.
- Gestion de Hot-QR.
- Consulta de registros.
- Consulta de asistencias.
- Reportes operativos.
- Auditoria basica de acciones.

El panel administrativo debe estar separado del portal de usuario. No deben compartir permisos ni rutas protegidas.

## 3. Control de acceso QR

Modulo responsable de procesar codigos escaneados.

Debe soportar:

- QR de usuario.
- QR temporal.
- Hot-QR.
- Validacion de estado activo/inactivo.
- Validacion de caducidad.
- Registro de entrada.
- Registro de salida.
- Registro de administrador que escanea.
- Respuesta visual clara para el frontend.

Flujo esperado:

```txt
Scanner lee QR
-> frontend envia codigo a API
-> backend valida sesion del operador
-> backend identifica tipo de QR
-> backend valida reglas de negocio
-> backend registra entrada/salida
-> backend actualiza asistencias si aplica
-> frontend muestra resultado
```

## 4. Hot-QR y codigos temporales

Los Hot-QR y codigos temporales deben tener reglas estrictas:

- Fecha de expiracion.
- Un solo uso o uso limitado.
- Motivo.
- Usuario creador.
- Usuario que lo usa.
- Estado activo/inactivo.
- Revocacion.
- Auditoria.

Este modulo debe evitar convertirse en una puerta trasera de acceso.

## 5. Personas y perfiles

Modulo responsable de:

- Registrar personas.
- Editar datos.
- Validar matricula.
- Validar CURP.
- Asociar carrera.
- Manejar estado de acceso.
- Manejar foto de perfil.
- Consultar informacion para escaneo.

Las fotos no deben acoplarse a PostgreSQL como unica opcion. La nueva version debe guardar metadatos en DB y el archivo en el storage configurado.

## 6. Asistencias

Modulo responsable de:

- Registrar asistencias potenciales.
- Confirmar asistencias al registrar salida.
- Marcar asistencias asumidas cuando no hay salida manual.
- Consultar asistencias por usuario, materia, fecha o periodo.
- Alimentar metricas del panel admin y del portal de usuario.

PostgreSQL puede conservar funciones y procedimientos para operaciones atomicas de asistencia.

## 7. Registros y reportes

Modulo responsable de:

- Consultar registros de entrada/salida.
- Filtrar por fecha, carrera, persona o tipo.
- Generar metricas administrativas.
- Alimentar graficas BI-like.
- Exportar reportes si se requiere.

Los reportes pesados deben apoyarse en vistas o consultas optimizadas de PostgreSQL.

## Arquitectura propuesta

La nueva version se organizara por modulos y capas.

```txt
apps/
  frontend/
    src/
      routes/
      lib/
        api/
        auth/
        components/
        scanner/
        charts/
        stores/
        styles/

  backend/
    src/
      app.ts
      server.ts
      modules/
        auth/
        users/
        people/
        access/
        hot-qr/
        attendance/
        reports/
        storage/
      db/
        schema/
        migrations/
        sql/
      shared/
        errors/
        http/
        validation/
```

Cada modulo del backend debe separar:

```txt
routes
schemas
services
repositories
tests
```

Ejemplo:

```txt
modules/access/
  access.routes.ts
  access.schemas.ts
  access.service.ts
  access.repository.ts
  access.test.ts
```

## API objetivo

La API debe versionarse desde el inicio.

```txt
/api/v1/auth/login
/api/v1/auth/logout
/api/v1/auth/session

/api/v1/user/me
/api/v1/user/qr
/api/v1/user/metrics
/api/v1/user/temp-codes

/api/v1/access/scan
/api/v1/access/status

/api/v1/people
/api/v1/people/:id

/api/v1/hot-qr
/api/v1/hot-qr/:id/revoke

/api/v1/attendance
/api/v1/reports
/api/v1/files
```

## Seguridad

Reglas base:

- No guardar tokens sensibles en `localStorage`.
- Usar cookies `httpOnly`.
- Usar `secure` en produccion.
- Usar `sameSite`.
- Hashear passwords con `Bun.password`.
- Validar todas las entradas con schemas.
- Auditar acciones sensibles.
- Revocar sesiones y codigos temporales.
- Separar permisos de usuario y administrador.
- Evitar QR permanentes no revocables para acceso sensible.

## Almacenamiento agnostico

El negocio no debe depender de S3, R2 ni filesystem directamente.

Interfaz conceptual:

```txt
StorageAdapter
  putObject()
  getObject()
  deleteObject()
  getPublicUrl()
  getSignedUrl()
```

Uso correcto:

```txt
people.service -> storageService.saveProfilePhoto()
```

Uso a evitar:

```txt
people.service -> s3Client.putObject()
```

Adaptadores:

- Local: desarrollo y pruebas.
- S3: produccion compatible con AWS u otros proveedores.
- R2: produccion con Cloudflare R2 y compatibilidad S3.

## Frontend y Canvas

La interfaz principal debe ser DOM normal con SvelteKit.

Canvas puede usarse para:

- Scanner QR.
- Procesamiento visual.
- Overlays de camara si la libreria lo requiere.

Canvas no debe usarse para:

- Formularios.
- Tablas.
- Botones.
- Navegacion.
- Panel administrativo.
- Portal de usuario.

El proyecto no debe depender de HTML-in-Canvas como base de UI. Para este sistema, la accesibilidad, el testing y la mantenibilidad son mas importantes que una API experimental.

## Variables de entorno esperadas

Ejemplo conceptual:

```env
NODE_ENV=development
APP_URL=http://localhost:5173
API_URL=http://localhost:3000

DATABASE_URL=postgres://user:password@localhost:5432/control_acceso

SESSION_COOKIE_NAME=sid
SESSION_SECRET=change-me
SESSION_TTL_DAYS=7

STORAGE_DRIVER=local
STORAGE_LOCAL_DIR=./storage

S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_FORCE_PATH_STYLE=true
```

## Scripts objetivo

Estos scripts representan la meta de la nueva version:

```bash
bun install
bun run dev
bun run dev:frontend
bun run dev:backend
bun run db:migrate
bun test
bun run test:e2e
bun run build
```

## Estrategia de migracion

La migracion debe hacerse por fases:

1. Crear base del monorepo o estructura `apps/frontend` y `apps/backend`.
2. Crear backend Bun + Hono.
3. Conectar PostgreSQL con Drizzle.
4. Crear sesiones seguras.
5. Migrar personas y carreras.
6. Migrar control de acceso QR.
7. Migrar Hot-QR y codigos temporales.
8. Migrar asistencias.
9. Crear frontend SvelteKit.
10. Crear portal de usuario.
11. Crear panel administrativo nuevo.
12. Migrar reportes y graficas.
13. Preparar deploy final.

## Criterios de aceptacion de la nueva version

La nueva version se considera lista cuando:

- El usuario puede iniciar sesion y ver su QR personal.
- El usuario puede maximizar su QR para escaneo.
- El usuario puede consultar metricas personales.
- El administrador puede iniciar sesion.
- El administrador puede escanear QR y registrar entrada/salida.
- El administrador puede gestionar personas.
- El sistema puede generar y revocar codigos temporales.
- Las asistencias se registran correctamente.
- Las fotos se guardan mediante `StorageService`.
- Las rutas protegidas usan cookies `httpOnly`.
- Las migraciones de DB estan versionadas.
- Existen pruebas para los flujos criticos.
- El deploy separa frontend, backend, DB y storage.

## Riesgos principales

- Intentar reescribir todo de una sola vez.
- Exponer QR personales sin autenticacion.
- Mantener QR estaticos sin revocacion.
- Duplicar reglas entre backend y PostgreSQL.
- Acoplar archivos a un proveedor especifico.
- Migrar UI antes de estabilizar la API.
- No probar flujos de entrada/salida/asistencia.

## Decision final

La nueva version debe construirse con:

```txt
SvelteKit + TypeScript + Tailwind CSS
Bun + TypeScript + Hono
PostgreSQL + Drizzle ORM
Drizzle Kit + SQL manual versionado
Sesiones con cookies httpOnly
Storage agnostico local/S3/R2
bun:test + Playwright
```

El sistema debe evolucionar hacia dos experiencias principales:

- Panel administrativo para operacion, escaneo, gestion y reportes.
- Portal de usuario para QR personal, metricas y codigos temporales.

El QR del usuario debe tratarse como una credencial sensible. La version final debe preferir QR firmados, temporales o revocables antes que QR estaticos basados solo en matricula.
