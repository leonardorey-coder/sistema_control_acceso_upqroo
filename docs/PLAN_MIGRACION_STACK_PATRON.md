# Plan de migracion de stack y patron de diseno

## Objetivo

Este documento define el stack tecnologico objetivo, el patron de diseno recomendado y una ruta de migracion gradual para el Sistema de Control de Acceso UPQROO.

La migracion no se plantea como un cambio de una sola vez. El proyecto actual ya funciona, por lo que el objetivo es evolucionarlo por modulos, reduciendo riesgo y manteniendo continuidad operativa.

Este plan no baja todavia a optimizaciones tecnicas finas. Su funcion es ordenar el criterio general: que stack usar, como dividir responsabilidades y en que orden conviene migrar cada parte.

## Diagnostico del proyecto actual

El sistema actual esta construido con:

- Backend en Node.js usando funciones serverless en `api/`.
- Frontend con HTML, CSS y JavaScript vanilla en `public/`.
- Base de datos PostgreSQL.
- SQL directo mediante `pg`.
- Procedimientos, funciones y vistas dentro de PostgreSQL para reglas importantes.
- Autenticacion con token de administrador guardado y enviado desde el frontend.
- Despliegue orientado a Vercel.

El stack actual es valido para un prototipo funcional y para una primera version institucional. Sin embargo, conforme crecen los modulos de acceso, asistencia, administracion, Hot-QR, reportes y seguridad, aparecen limites claros:

- Los endpoints mezclan HTTP, validacion, autenticacion, reglas de negocio y SQL.
- El frontend acumula estado global y logica de interfaz en archivos grandes.
- La base de datos contiene reglas utiles, pero no hay una estrategia clara para versionarlas.
- La autenticacion necesita una separacion mas fuerte entre sesion, credenciales y permisos.
- El SQL directo aumenta repeticion y dificulta mantener consultas.
- La arquitectura actual no facilita pruebas por modulo.

## Stack tecnologico objetivo

El stack recomendado para la migracion es:

- Lenguaje principal: TypeScript.
- Runtime backend: Bun.
- Framework backend: Hono.
- Base de datos: PostgreSQL.
- ORM ligero: Drizzle ORM.
- Migraciones: Drizzle Kit y SQL controlado para funciones avanzadas.
- Validacion: Zod o validadores compatibles con Hono.
- Autenticacion: sesiones con cookies `httpOnly`.
- Hash de passwords: modulos nativos de Bun, preferentemente Argon2id mediante `Bun.password`.
- Testing: `bun:test`.
- Frontend: mantener la interfaz actual y migrarla gradualmente, usando TypeScript solo si el modulo lo justifica.

La decision de usar TypeScript se mantiene porque ayuda a ordenar contratos entre rutas, servicios, repositorios, validadores y modelos de datos. En este proyecto, el costo de transpilacion no debe ser el criterio principal: el cuello de botella mas probable estara en consultas, conexiones, indices, validaciones, sesiones y operaciones de base de datos.

Bun reduce la friccion operativa de TypeScript porque lo soporta directamente dentro de su flujo de desarrollo. La migracion debe aprovechar ese soporte sin convertir el proyecto en una configuracion pesada.

## Razonamiento del stack

### Bun

Bun permite ejecutar TypeScript y JavaScript moderno con buen rendimiento, incluye herramientas nativas utiles y reduce dependencias externas.

Su valor para este proyecto esta en:

- Servidor backend rapido.
- Testing integrado con `bun:test`.
- APIs nativas utiles para hashing, archivos y ejecucion.
- Mejor experiencia de desarrollo que una configuracion tradicional de Node.js dispersa.

### Hono

Hono es conveniente porque es ligero, rapido y suficientemente estructurado para APIs.

Encaja mejor que un framework pesado porque el proyecto necesita orden, no sobreingenieria. Hono permite crear rutas, middlewares y controladores claros sin forzar una arquitectura grande.

### Drizzle ORM

Drizzle es preferible a Prisma para este caso porque es mas ligero y se mantiene cerca de PostgreSQL.

El objetivo no es ocultar completamente la base de datos, sino evitar boilerplate repetitivo y ganar una capa mas mantenible para consultas comunes.

Drizzle debe usarse para:

- Consultas CRUD.
- Relaciones frecuentes.
- Filtros y busquedas.
- Tablas principales como personas, administradores, carreras, registros y Hot-QR.

SQL manual debe conservarse para:

- Procedimientos complejos.
- Funciones PostgreSQL.
- Vistas.
- Reglas de asistencia que necesiten atomicidad o ejecucion cercana a la base de datos.

### PostgreSQL

PostgreSQL se conserva como base del sistema. Es una buena decision para este dominio porque el sistema depende de consistencia, relaciones, historial, auditoria y consultas por fecha.

La migracion no debe quitarle responsabilidad a PostgreSQL donde aporta valor. Debe ordenar que reglas viven en la aplicacion y cuales viven en la base de datos.

### Cookies `httpOnly` para autenticacion

La autenticacion debe migrar desde tokens manejados directamente por el frontend hacia sesiones mas seguras.

El modelo recomendado es:

- Login valida credenciales.
- Backend crea una sesion.
- La sesion se guarda en base de datos.
- El navegador recibe una cookie `httpOnly`.
- El frontend no lee ni manipula el token directamente.
- Cada request protegida pasa por middleware de sesion.

Este cambio mejora seguridad sin volver complejo el sistema.

## Patron de diseno recomendado

El patron recomendado es una arquitectura por capas orientada a casos de uso.

No se propone MVC puro como patron central, porque el sistema no se limita a vistas y controladores. El nucleo real son reglas de negocio:

- Procesar entrada.
- Procesar salida.
- Validar QR.
- Validar Hot-QR.
- Registrar asistencia.
- Consultar registros.
- Administrar personas.
- Proteger acciones administrativas.

La separacion recomendada es:

- Rutas: reciben requests HTTP.
- Middlewares: resuelven sesion, permisos, CORS y errores comunes.
- Servicios o casos de uso: contienen reglas de negocio.
- Repositorios: encapsulan acceso a base de datos.
- Esquemas de validacion: definen que datos entran y con que forma.
- SQL avanzado: conserva procedimientos, funciones y vistas cuando aporten atomicidad o claridad.

Una estructura objetivo podria ser:

```txt
src/
  app.js
  server.js

  db/
    client.js
    schema.js
    migrations/
    sql/

  modules/
    auth/
      auth.routes.js
      auth.service.js
      auth.repository.js
      auth.schemas.js
      session.middleware.js

    access/
      access.routes.js
      access.service.js
      access.repository.js
      qr-strategy.js

    people/
      people.routes.js
      people.service.js
      people.repository.js
      people.schemas.js

    attendance/
      attendance.routes.js
      attendance.service.js
      attendance.repository.js

    hot-qr/
      hotQr.routes.js
      hotQr.service.js
      hotQr.repository.js

  shared/
    errors.js
    response.js
    validation.js
```

Esta estructura no obliga a migrar todo al mismo tiempo. Permite mover un endpoint actual a un modulo nuevo, validarlo y despues continuar con el siguiente.

## Principios de migracion

La migracion debe seguir estos principios:

- Mantener el sistema funcionando durante todo el proceso.
- Migrar por modulo, no por capa global.
- Evitar reescribir el frontend y backend a la vez si no es necesario.
- Mantener PostgreSQL como fuente de verdad.
- No eliminar procedimientos SQL utiles sin entender su funcion.
- Introducir autenticacion nueva antes de ampliar funcionalidades administrativas.
- Crear pruebas por modulo conforme se migra cada bloque.
- Documentar decisiones de cada modulo antes de optimizarlo.

## Modulos de migracion

### 1. Modulo base del backend

Objetivo:

Crear la base del nuevo backend con Bun y Hono sin reemplazar todavia todo el sistema.

Bloques de implementacion:

- Inicializar estructura `src/`.
- Crear servidor Hono.
- Crear middleware base de errores.
- Crear respuesta JSON estandar.
- Crear conexion a PostgreSQL.
- Configurar variables de entorno.
- Preparar scripts de desarrollo y testing con Bun.

Resultado esperado:

Un backend nuevo ejecutandose de forma independiente, preparado para recibir modulos migrados.

### 2. Modulo de base de datos

Objetivo:

Ordenar el acceso a PostgreSQL y preparar una estrategia de migraciones.

Bloques de implementacion:

- Definir cliente de base de datos.
- Introducir Drizzle ORM.
- Modelar tablas principales.
- Separar SQL avanzado en una carpeta controlada.
- Definir estrategia para funciones y procedimientos existentes.
- Definir convencion de migraciones.

Resultado esperado:

La base de datos queda representada de forma mas clara en el codigo, sin abandonar SQL cuando sea necesario.

### 3. Modulo de autenticacion

Objetivo:

Reemplazar el uso de tokens manejados por el frontend por sesiones seguras.

Bloques de implementacion:

- Crear login en el nuevo backend.
- Crear tabla o modelo de sesiones.
- Guardar sesiones del administrador.
- Enviar cookie `httpOnly`.
- Crear middleware de sesion.
- Crear logout.
- Migrar verificacion de administrador.
- Definir expiracion y renovacion de sesion.

Resultado esperado:

Las rutas administrativas dejan de depender de tokens expuestos en `localStorage`.

### 4. Modulo de personas

Objetivo:

Migrar la administracion de personas a una estructura por servicio y repositorio.

Bloques de implementacion:

- Registrar persona.
- Editar persona.
- Verificar matricula.
- Consultar carreras.
- Validar CURP, matricula y tipo de persona.
- Definir manejo de foto de perfil.

Resultado esperado:

El modulo de personas queda separado de HTTP y de SQL directo repetido.

### 5. Modulo de control de acceso

Objetivo:

Migrar la logica principal de entrada y salida.

Bloques de implementacion:

- Procesar QR normal.
- Detectar si corresponde entrada o salida.
- Validar estado de la persona.
- Validar caducidad del QR.
- Registrar entrada.
- Registrar salida.
- Consultar ultimo registro.
- Conectar con asistencia cuando aplique.

Resultado esperado:

El flujo mas importante del sistema queda expresado como caso de uso claro, no como un endpoint monolitico.

### 6. Modulo Hot-QR

Objetivo:

Separar el manejo de QR temporales o de visitantes.

Bloques de implementacion:

- Crear Hot-QR.
- Validar Hot-QR.
- Marcar Hot-QR como usado.
- Validar expiracion.
- Registrar administrador creador y administrador que lo usa.
- Definir reglas de un solo uso.

Resultado esperado:

El Hot-QR queda como estrategia separada del QR normal, pero integrado al mismo flujo de acceso.

### 7. Modulo de asistencias

Objetivo:

Ordenar las reglas de asistencia y su relacion con entrada/salida.

Bloques de implementacion:

- Registrar asistencias potenciales.
- Actualizar asistencias al salir.
- Marcar asistencias asumidas.
- Consultar asistencias por clase.
- Mantener funciones PostgreSQL donde sean utiles.
- Definir que reglas viven en backend y que reglas viven en SQL.

Resultado esperado:

El sistema conserva la fuerza de PostgreSQL para reglas atomicas, pero el backend controla el flujo de negocio de forma clara.

### 8. Modulo de registros y reportes

Objetivo:

Migrar consultas de registros, reportes y vistas administrativas.

Bloques de implementacion:

- Obtener registros del dia.
- Filtrar por persona, carrera, fecha o tipo.
- Consultar historial.
- Preparar datos para tablas administrativas.
- Estandarizar respuestas para frontend.

Resultado esperado:

Los reportes dejan de depender de consultas dispersas y se vuelven una capa consultable y extensible.

### 9. Modulo frontend

Objetivo:

Reordenar el frontend sin cambiar necesariamente todo el diseno de inmediato.

Bloques de implementacion:

- Separar cliente API.
- Separar vistas principales.
- Reducir variables globales.
- Centralizar manejo de sesion.
- Migrar llamadas a la nueva API.
- Mantener HTML/CSS/JS si se busca bajo costo inicial.
- Evaluar despues si conviene pasar a una estructura mas modular o framework.

Resultado esperado:

El frontend conserva su funcionamiento actual, pero queda preparado para consumir el backend migrado y para crecer con menos desorden.

### 10. Modulo de pruebas

Objetivo:

Crear pruebas conforme cada modulo sea migrado.

Bloques de implementacion:

- Pruebas de servicios con `bun:test`.
- Pruebas de repositorios con base de datos de prueba.
- Pruebas de rutas Hono.
- Pruebas del flujo de login.
- Pruebas del flujo de procesar QR.
- Pruebas basicas del frontend para acciones criticas.

Resultado esperado:

La migracion avanza con evidencia minima de que los flujos principales siguen funcionando.

### 11. Modulo de despliegue

Objetivo:

Definir como se publicara el sistema despues de la migracion.

Bloques de implementacion:

- Decidir si el backend Bun correra en VPS, Railway, Fly.io, Render u otra plataforma.
- Definir si el frontend se mantiene en Vercel o se sirve desde el mismo backend.
- Separar variables de entorno.
- Preparar configuracion de produccion.
- Definir estrategia de logs.
- Definir estrategia de backups.

Resultado esperado:

El despliegue deja de depender implicitamente de la forma actual y queda alineado con el nuevo backend.

## Orden recomendado de migracion

El orden sugerido es:

1. Backend base con Bun y Hono.
2. Conexion a PostgreSQL y Drizzle.
3. Autenticacion con sesiones.
4. Personas y carreras.
5. Procesamiento de QR normal.
6. Hot-QR.
7. Asistencias.
8. Registros y reportes.
9. Frontend por partes.
10. Pruebas y despliegue final.

Este orden prioriza primero la base tecnica y la seguridad, despues los modulos de negocio.

## Estrategia de convivencia temporal

Durante la migracion pueden convivir dos sistemas:

- El sistema actual en `api/` y `public/`.
- El nuevo backend en `src/`.

La convivencia permite migrar endpoint por endpoint. Cuando un modulo nuevo este estable, el frontend puede empezar a consumirlo. Despues de validar el flujo, se puede retirar el endpoint viejo correspondiente.

Esta estrategia reduce el riesgo de detener el sistema por una reescritura completa.

## Criterios para considerar migrado un modulo

Un modulo se considera migrado cuando:

- Tiene rutas separadas.
- Tiene servicio o caso de uso.
- Tiene repositorio o acceso a datos encapsulado.
- Tiene validacion de entrada.
- Tiene manejo de errores coherente.
- Tiene pruebas minimas del flujo principal.
- El frontend puede consumirlo sin depender del endpoint viejo.
- La decision sobre SQL, ORM o procedimiento esta documentada.

## Riesgos principales

Los riesgos principales de la migracion son:

- Reescribir demasiado al mismo tiempo.
- Romper reglas ya implementadas en PostgreSQL.
- Duplicar logica entre backend y base de datos.
- Migrar el frontend antes de estabilizar la API.
- Cambiar autenticacion sin plan de sesiones y expiracion.
- No probar los flujos de entrada, salida y asistencia.

La forma de reducir estos riesgos es migrar por modulo y validar cada flujo antes de continuar.

## Decision final

El stack objetivo queda definido como:

```txt
TypeScript
Bun
Hono
PostgreSQL
Drizzle ORM
Drizzle Kit
SQL manual controlado para reglas avanzadas
Cookies httpOnly para sesiones
Bun.password para passwords
bun:test para pruebas
```

El patron de diseno queda definido como:

```txt
Rutas HTTP
Middlewares
Servicios / casos de uso
Repositorios
Validadores
SQL avanzado controlado
```

La migracion debe hacerse por modulos, empezando por backend base, base de datos y autenticacion. Despues se migran los modulos funcionales: personas, acceso, Hot-QR, asistencias, registros y frontend.

Este documento funciona como plan general. La siguiente fase sera crear una optimizacion tecnica detallada por modulo.
