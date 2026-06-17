# Plan del stack tecnologico nuevo

## Objetivo

Este documento define el stack tecnologico objetivo para una migracion total del Sistema de Control de Acceso UPQROO.

Su enfoque es exclusivamente tecnologico: que herramientas conviene usar, por que encajan con el tipo de sistema y que limites deben respetarse. El patron de diseno general se mantiene en el documento de arquitectura y migracion; este archivo se concentra en el stack.

## Criterio principal

El sistema no debe migrarse solo para cambiar herramientas. El stack nuevo debe resolver problemas concretos del proyecto actual:

- Frontend administrativo que crece en pantallas, formularios, tablas y estados.
- Scanner QR que necesita una experiencia rapida y estable.
- Backend con reglas de acceso, sesiones, asistencia y Hot-QR.
- Base de datos relacional con reglas importantes en PostgreSQL.
- Necesidad de pruebas por modulo.
- Necesidad de manejar archivos/fotos sin quedar amarrados a un proveedor.
- Despliegue mas controlado que el modelo actual de funciones sueltas.

## Stack final propuesto

```txt
Frontend:
SvelteKit
TypeScript
Tailwind CSS
Vite

Backend:
Bun
TypeScript
Hono

API:
REST versionada
Hono middlewares
Validacion con Zod

Base de datos:
PostgreSQL
Drizzle ORM
Drizzle Kit
SQL manual versionado para funciones/procedimientos/vistas

Autenticacion:
Sesiones en base de datos
Cookies httpOnly
Bun.password para hash de passwords

Almacenamiento:
Storage agnostico por interfaz
Adaptador local
Adaptador S3
Adaptador Cloudflare R2

Testing:
bun:test
Pruebas de integracion por modulo
Playwright para flujos criticos del frontend

Deploy:
Backend persistente con Bun
Frontend como build estatico
PostgreSQL administrado o VPS
Storage externo compatible con S3 cuando sea necesario
```

## Frontend

### Decision

El frontend final debe migrarse a:

```txt
SvelteKit + TypeScript + Tailwind CSS
```

El frontend actual en HTML, CSS y JavaScript nativo puede mantenerse durante la transicion, pero no debe ser el destino final si se busca una aplicacion mantenible.

### Razonamiento

El sistema ya tiene caracteristicas tipicas de una SPA administrativa:

- Login.
- Sesion protegida.
- Scanner QR.
- Panel administrativo.
- Registro y edicion de personas.
- Gestion de Hot-QR.
- Asistencias.
- Registros.
- Reportes.
- Formularios con validaciones.
- Tablas con filtros.
- Estados de carga, error y exito.

Con HTML/CSS/JS nativo todo esto se puede hacer, pero el costo crece porque el proyecto termina creando manualmente su propio sistema de componentes, estado, navegacion, validacion y renderizado.

SvelteKit es conveniente porque ofrece modularidad y buen rendimiento sin la carga mental de un framework mas pesado. Permite componentes claros, rutas ordenadas, layouts y una experiencia SPA suficiente para este software.

### Por que no dejar solo HTML/CSS/JS nativo

HTML/CSS/JS nativo es bueno para:

- Prototipo.
- Pantallas simples.
- Scanner aislado.
- Bajo costo inicial.

Pero se vuelve debil para:

- Panel administrativo grande.
- Multiples formularios.
- Tablas con filtros.
- Estado compartido.
- Rutas protegidas.
- Reutilizacion de componentes.
- Pruebas de interfaz.
- Mantenimiento a mediano plazo.

Por eso debe conservarse solo como etapa temporal.

### Por que SvelteKit

SvelteKit conviene por:

- Buen rendimiento percibido.
- Componentes simples.
- Menos boilerplate que React.
- Integracion natural con Vite.
- Soporte fuerte para TypeScript.
- Rutas y layouts incluidos.
- Build estatico posible.
- Buena experiencia para SPA administrativa.

### Tailwind CSS

Tailwind debe agregarse al frontend porque el sistema necesita consistencia visual y velocidad de construccion.

Su funcion no es decorar la aplicacion, sino ordenar el diseno:

- Espaciados consistentes.
- Colores controlados.
- Estados visuales reutilizables.
- Responsive mas facil.
- Menos CSS global dificil de mantener.
- Componentes administrativos mas compactos.

La recomendacion es usar Tailwind con una configuracion controlada:

- Paleta institucional.
- Escala de espaciado limitada.
- Componentes reutilizables para botones, inputs, cards, tablas y alertas.
- Evitar clases improvisadas sin criterio visual.

### Estructura frontend sugerida

```txt
frontend/
  src/
    routes/
      login/
      scanner/
      admin/
      admin/personas/
      admin/hot-qr/
      admin/asistencias/
      admin/registros/

    lib/
      api/
      auth/
      components/
      forms/
      scanner/
      stores/
      styles/
      utils/
```

### Scanner QR

El scanner debe ser un modulo propio del frontend.

Debe separar:

- Captura de camara.
- Lectura del QR.
- Estado del scanner.
- Resultado visual.
- Envio del codigo al backend.
- Reintento o auto-escaneo.

La UI del scanner debe ser DOM normal con componentes Svelte. El uso de `canvas` debe limitarse a lo que requiera la libreria de QR o el procesamiento de imagen.

## Backend

### Decision

El backend final debe migrarse a:

```txt
Bun + TypeScript + Hono
```

### Razonamiento

Bun aporta un runtime rapido, herramientas integradas y buen soporte para TypeScript. Hono aporta una capa HTTP ligera y ordenada sin imponer una arquitectura pesada.

Este stack encaja porque el proyecto necesita:

- APIs rapidas.
- Middlewares claros.
- Validacion de requests.
- Sesiones.
- Separacion por modulos.
- Testing integrado.
- Menos dependencias innecesarias.

### Modulos backend esperados

```txt
backend/
  src/
    app.ts
    server.ts

    modules/
      auth/
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

## API

### Decision

La API debe ser REST versionada.

```txt
/api/v1/auth
/api/v1/people
/api/v1/access
/api/v1/hot-qr
/api/v1/attendance
/api/v1/reports
/api/v1/files
```

### Razonamiento

REST es suficiente para este sistema. No conviene introducir GraphQL ni RPC complejo porque el dominio es claro y las operaciones principales son concretas:

- Login/logout.
- Registrar persona.
- Editar persona.
- Escanear QR.
- Crear Hot-QR.
- Consultar asistencias.
- Consultar registros.
- Subir/consultar fotos.

Versionar desde `/api/v1` permite convivir temporalmente con endpoints antiguos y evita romper el frontend durante la migracion.

## Base de datos

### Decision

Se conserva PostgreSQL como base principal.

```txt
PostgreSQL + Drizzle ORM + Drizzle Kit + SQL manual versionado
```

### Razonamiento

PostgreSQL es correcto para el proyecto porque maneja bien:

- Relaciones.
- Historial.
- Consultas por fecha.
- Auditoria.
- Integridad.
- Procedimientos.
- Vistas.
- Transacciones.

No conviene reemplazarlo por una base NoSQL. El sistema es naturalmente relacional.

### Drizzle ORM

Drizzle debe usarse para:

- CRUD.
- Consultas comunes.
- Relaciones.
- Filtros.
- Tipado de tablas.
- Repositorios.

SQL manual debe conservarse para:

- Procedimientos de entrada/salida.
- Funciones de asistencia.
- Vistas complejas.
- Reportes pesados.
- Operaciones donde PostgreSQL deba garantizar atomicidad.

## Migraciones

### Decision

Usar:

```txt
Drizzle Kit + carpeta de SQL manual versionado
```

### Razonamiento

Drizzle Kit ordena cambios normales de schema, pero el proyecto ya tiene funciones y procedimientos PostgreSQL relevantes. Esas piezas deben versionarse como SQL explicito.

La estrategia recomendada:

```txt
db/
  migrations/
    drizzle/
    sql/
      001_access_functions.sql
      002_attendance_functions.sql
      003_views.sql
```

## Autenticacion

### Decision

Migrar a:

```txt
Sesiones en DB + cookies httpOnly + Bun.password
```

### Razonamiento

El frontend no debe guardar tokens sensibles en `localStorage`.

Flujo recomendado:

```txt
POST /api/v1/auth/login
-> validar usuario/password
-> verificar password con Bun.password
-> crear session en DB
-> enviar cookie httpOnly
-> middleware valida session en rutas protegidas
```

La cookie debe usar:

- `httpOnly`.
- `secure` en produccion.
- `sameSite`.
- Expiracion definida.

## Almacenamiento de archivos

### Decision

Agregar una capa de almacenamiento agnostica.

```txt
StorageService
LocalStorageAdapter
S3StorageAdapter
R2StorageAdapter
```

### Razonamiento

El proyecto maneja fotos de perfil y podria crecer hacia archivos administrativos, evidencias, reportes exportados o codigos QR generados. No conviene amarrar el backend a una sola opcion.

La aplicacion debe depender de una interfaz, no de un proveedor.

### Interfaz conceptual

```txt
StorageAdapter
  putObject()
  getObject()
  deleteObject()
  getPublicUrl()
  getSignedUrl()
```

### Adaptadores recomendados

#### Local

Uso:

- Desarrollo.
- Pruebas.
- Instalaciones pequenas.

Ventajas:

- Simple.
- Barato.
- Sin dependencia externa.

Limites:

- No escala bien entre multiples servidores.
- Requiere estrategia de backup.
- No es ideal para despliegues serverless.

#### S3

Uso:

- Produccion con AWS o proveedores compatibles.

Ventajas:

- Estandar ampliamente soportado.
- Buen ecosistema.
- URLs firmadas.
- Politicas de acceso maduras.

Limites:

- Configuracion mas extensa.
- Costos variables.

#### Cloudflare R2

Uso:

- Produccion con bajo costo de egreso.
- Alternativa compatible con API S3.

Ventajas:

- Compatible con S3 en muchos flujos.
- Bueno para servir fotos y archivos.
- Costos competitivos.

Limites:

- Requiere configurar credenciales, buckets y politicas.
- Hay que evitar usar APIs exclusivas si se quiere mantener portabilidad.

### Regla de portabilidad

El codigo de negocio nunca debe importar directamente el SDK de S3, R2 o filesystem. Solo debe usar `StorageService`.

Ejemplo de dependencia correcta:

```txt
people.service -> storageService.saveProfilePhoto()
```

Ejemplo a evitar:

```txt
people.service -> s3Client.putObject()
```

## HTML-in-Canvas y Canvas

### Decision

No conviene basar el proyecto en HTML-in-Canvas ni usar Canvas como tecnologia principal de UI.

Canvas puede usarse como apoyo para:

- Scanner QR.
- Procesamiento de video.
- Previsualizaciones visuales.
- Recortes o composicion de imagen.

Pero no debe usarse para:

- Formularios.
- Botones.
- Tablas.
- Panel administrativo.
- Navegacion.
- UI accesible principal.

### Razonamiento

El sistema requiere una interfaz administrativa normal, accesible, testeable y mantenible. La UI debe vivir en DOM con componentes Svelte.

Canvas es una superficie de dibujo. Es util para graficos, imagen, video y procesamiento visual, pero dificulta accesibilidad, eventos semanticos, pruebas y mantenimiento cuando se usa para UI general.

La documentacion de MDN advierte que el contenido dibujado dentro de `<canvas>` no expone informacion semantica como HTML normal y recomienda evitarlo como base de interfaces accesibles. Por eso, aunque aparezcan propuestas nuevas para mezclar HTML y Canvas, no deben ser una dependencia arquitectonica del sistema.

### Uso correcto en este proyecto

Uso recomendado:

```txt
DOM/Svelte:
formularios, tablas, layouts, botones, paneles, estados

Canvas:
scanner QR, procesamiento visual, overlays de camara si la libreria lo necesita
```

## Testing

### Decision

Usar:

```txt
bun:test
Playwright para flujos criticos
```

### Razonamiento

`bun:test` es suficiente para:

- Servicios.
- Repositorios.
- Validadores.
- Middlewares.
- Rutas Hono.

Playwright debe reservarse para:

- Login.
- Escaneo o simulacion de QR.
- Alta de persona.
- Consulta de registros.
- Flujo admin critico.

## Deploy

### Decision

El despliegue debe separar frontend, backend, DB y storage.

Opcion recomendada:

```txt
Frontend:
build estatico de SvelteKit

Backend:
Bun persistente

DB:
PostgreSQL administrado o VPS

Storage:
Local en desarrollo
R2/S3 en produccion
```

### Razonamiento

El backend Bun no deberia pensarse como un conjunto de funciones sueltas. El sistema tiene sesiones, conexiones, archivos, logs y procesos de negocio que se benefician de un backend persistente.

## Stack final consolidado

```txt
Frontend:
SvelteKit
TypeScript
Tailwind CSS
Vite

Backend:
Bun
TypeScript
Hono

API:
REST /api/v1
Zod
Middlewares Hono

DB:
PostgreSQL
Drizzle ORM
Drizzle Kit
SQL manual versionado

Auth:
DB sessions
httpOnly cookies
Bun.password

Storage:
StorageService
Local adapter
S3 adapter
R2 adapter

Testing:
bun:test
Playwright

Deploy:
Frontend estatico
Backend Bun persistente
PostgreSQL
Storage compatible S3
```

## Decision final

El stack tecnologico nuevo recomendado es:

```txt
SvelteKit + TypeScript + Tailwind CSS
Bun + TypeScript + Hono
PostgreSQL + Drizzle ORM
Drizzle Kit + SQL manual versionado
Sesiones con cookies httpOnly
Storage agnostico local/S3/R2
bun:test + Playwright
```

HTML-in-Canvas no debe agregarse como pieza central del stack. Para este software de QR, Canvas solo conviene como herramienta puntual del scanner o procesamiento visual. La interfaz principal debe seguir siendo DOM accesible mediante SvelteKit.

## Referencias

- Svelte: https://svelte.dev/docs/svelte/overview
- Tailwind CSS: https://tailwindcss.com/docs
- Hono: https://hono.dev/docs
- Bun: https://bun.sh/docs
- Drizzle ORM: https://orm.drizzle.team/docs/overview
- MDN Canvas: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/canvas
