# Plan integrador: stack, features y correccion de bugs

> Estado del documento: historico. Este plan conserva la auditoria original,
> pero varios puntos ya fueron implementados o cambiaron durante el cierre v2.
> Para levantar y verificar el proyecto usa primero `README.md`. Para pendientes
> vivos de GUI/cierre usa `docs/PLAN_GUI_FRONTEND_FALTANTE_V2.md`.

## Proposito

Este documento consolida el estado real del Sistema de Control de Acceso UPQROO
v2 despues de implementar la base del QR dinamico firmado, y define un plan
unico para:

- Cerrar la integracion del stack (API Bun/Hono, web SvelteKit, Postgres/Drizzle).
- Terminar las features ya iniciadas (QR firmado, portal usuario, vehicular,
  temporal diario, administradores).
- Corregir los bugs y gaps detectados en una auditoria del codigo.

No reemplaza los documentos por feature. Los integra y prioriza. Cuando haya
conflicto, este plan manda sobre el orden de ejecucion, y los docs de feature
mandan sobre el detalle funcional.

## Metodo de verificacion usado

Estado capturado el 2026-06-20 con evidencia directa:

- `bun test --cwd apps/api`: 14 pass, 0 fail (incluye integracion Postgres real:
  alta de persona, scan entrada/salida, cadena de integridad, rechazo de persona
  inactiva, ciclo de worker).
- `bun build src/app.ts --target bun`: compila sin error tras los cambios de QR
  firmado.
- Lectura directa de modulos API, esquema Drizzle, migraciones SQL, rutas web y
  componentes Svelte.

## Estado actual del stack

### Backend (`apps/api`)

- Runtime Bun + Hono, TypeScript, Postgres via `postgres` + Drizzle ORM.
- Migraciones en `drizzle/migrations` con journal versionado:
  - `0000_curly_lyja` esquema base.
  - `0001_access_atomic` funciones SQL `access_scan_v1`, `auto_close_access_v1`,
    `verify_access_chain_v1`.
  - `0002_schema_alignment` alineacion de versiones de QR y unicidad temporal.
  - `0003_signed_dynamic_qr` (nuevo) claves de firma, anti-replay por `jti`,
    columnas de firma en `access_scan_events`, config `signed_qr` y
    `access_scan_v1` con ruta de QR firmado pre-verificado.
- Modulos: `auth`, `people`, `person-types`, `careers`, `access`, `attendance`,
  `hot-qr`, `vehicles`, `credentials`, `config`, `integrity`, `admin-management`,
  `user-portal`, `events`, `qr-signing` (nuevo).
- Sesiones admin y usuario en DB con cookies `httpOnly`, hash de sesion con
  secreto.
- Worker (`worker.ts`) cierra accesos abiertos y expira tokens y sesiones.
- WebSocket server-driven en `/api/v1/events`.

### Frontend (`apps/web`)

- SvelteKit 5 (runes), Tailwind 4, Vite 6.
- Panel admin en `routes/+page.svelte` con tabs legacy (generar, editar,
  registros, asistencias, hot-qr, vehiculos, administradores, config).
- Scanner en `routes/scanner` con `html5-qrcode` y entrada manual.
- Portal usuario en `routes/portal` (login, inicio, qr, historial).
- Cliente API unico en `lib/api/client.ts` con `credentials: include`.
- `QrPreview` ya renderiza QR real con `qrcode`.

### Shared (`packages/shared`)

- Contratos minimos (`ApiHealth`, `ApiError`). Subutilizado: los wire shapes de
  scan, paginacion y credenciales no estan centralizados aqui.

## Bugs y gaps detectados

Clasificados por severidad. Cada uno incluye evidencia y correccion propuesta.

### B1. `.env.example` incompleto y con secreto invalido (alta)

`config/env.ts` exige y usa variables que `.env.example` no documenta:
`NODE_ENV`, `USER_SESSION_COOKIE_NAME`, `TOKEN_SIGNING_SECRET`,
`INITIAL_ADMIN_USERNAME`, `INITIAL_ADMIN_PASSWORD`, `STORAGE_DRIVER`,
`LOCAL_STORAGE_ROOT`, y las nuevas `QR_SIGNING_PRIVATE_KEY`,
`QR_SIGNING_PUBLIC_KEY`, `QR_SIGNING_ALG`, `QR_SIGNING_KID`.

Ademas `.env.example` define `SESSION_SECRET=change-me` (9 caracteres), pero el
schema exige `min(12)`. Copiar el ejemplo tal cual rompe el arranque.

Correccion: reescribir `.env.example` completo con valores validos y comentarios
de produccion vs desarrollo.

### B2. El worker no limpia `qr_jti_consumptions` (alta)

`FEAT_QR_DINAMICO_FIRMADO_CLIENTE` indica que el worker debe limpiar consumos de
`jti` vencidos segun ventana configurable. La tabla existe (migracion 0003) pero
`worker.ts` no la purga, lo que la haria crecer sin limite.

Correccion: agregar al ciclo del worker el borrado de `qr_jti_consumptions` con
`expires_at` anterior a una ventana de gracia, y expirar claves de firma
`rotated` pasado su periodo de gracia.

### B3. El scanner no envia `signedQr` (alta)

`ScannerView.svelte` solo maneja `token` y `manualMatricula`. El backend ya
acepta `signedQr`, pero el scanner nunca lo usa, asi que el QR dinamico firmado
no se puede validar end-to-end.

Correccion: al decodificar el QR, detectar formato JWT (tres segmentos separados
por punto) y enviarlo como `signedQr`; si no, enviarlo como `token`.

### B4. El portal usa QR estatico rotado, no dinamico (alta)

`routes/portal/qr/+page.svelte` llama `POST /portal/qr/rotate` (token opaco) y no
usa el nuevo `POST /portal/qr/dynamic`. No hay countdown ni auto-refresh, que es
el corazon de la feature.

Correccion: cambiar la vista para pedir QR dinamico, renderizar el JWT en el QR,
mostrar contador de expiracion y refrescar antes de `refreshAfterMs`. No persistir
el token en `localStorage`.

### B5. El flag `signed_qr.enabled` no se respeta (media)

La migracion 0003 crea la config `signed_qr` con `enabled:false`, pero ni
`/access/scan` ni `/portal/qr/dynamic` consultan ese flag. La feature queda
siempre activa una vez que el frontend la use, sin control operativo.

Correccion: en `/portal/qr/dynamic`, si `enabled=false`, responder con fallback al
QR opaco o 409 controlado. En `/access/scan`, si llega `signedQr` con
`enabled=false`, rechazar con `SIGNED_QR_DISABLED` salvo modo compatibilidad.

### B6. QR firmado solo resuelve `person_qr` (media)

La ruta pre-verificada de `access_scan_v1` asume `credential_type=person_qr`. El
feat contempla `temporary_daily_qr` y `vehicle_permit_qr` firmados, y menciona
endpoints `/portal/temporary-daily-qr/dynamic`,
`/credentials/temporary-daily/:id/dynamic` y vehicular dinamico que no existen.

Correccion: incluir `typ` en el JWT y, en la ruta pre-verificada, derivar el tipo
de credencial y resolver persona/vehiculo/temporal segun `typ`. Agregar los
endpoints de emision dinamica faltantes.

### B7. Sin flujo de cambio de password obligatorio (media)

Admins y usuarios se crean con `mustChangePassword:true` (seed y alta de admin),
pero no existe endpoint para que el propio actor cambie su password. El flag se
expone pero no se puede resolver.

Correccion: agregar `POST /auth/change-password` (admin) y
`POST /portal/auth/change-password` (usuario), validando password actual,
reglas minimas, y limpiando el flag e invalidando otras sesiones.

### B8. Login sin proteccion de fuerza bruta (parcialmente resuelto)

Actualizacion 2026-06-21: login admin y portal ya tienen bloqueo temporal por
IP+identidad. Se agrego `RATE_LIMIT_DRIVER=postgres` y la migracion
`0006_durable_rate_limit.sql` para persistir contadores en despliegues
multi-proceso.

`auth.routes.ts` y el login de portal limitan intentos fallidos y registran
auditoria. Para despliegues distribuidos debe usarse el driver Postgres.

Pendiente: exponer ventana/maximos como configuracion operativa si se requiere
ajuste sin redeploy.

### B9. Cobertura de pruebas del QR firmado ausente (media)

No hay tests para `qr-signing` (firma/verificacion), ni para la ruta `signedQr`
del scan, ni para anti-replay de `jti`. El feat exige estas pruebas como criterio
de aceptacion.

Correccion: agregar unit tests (firma valida, firma invalida, exp vencido, nbf
futuro, aud incorrecto, jti duplicado, no fuga de clave privada) e integracion
(emision dinamica + scan + replay rechazado).

### B10. 2FA por correo y device binding no implementados (baja, futuro)

Fases 4 y 5 del feat (device binding con WebCrypto y OTP por correo) no existen.
No bloquean la operacion actual pero deben quedar planificadas.

### B11. Contratos no centralizados en `packages/shared` (baja)

Los wire shapes de scan, credenciales y paginacion se repiten como `Record` en el
frontend. El doc de frontend pide respetar wire shapes estables.

Correccion: mover tipos compartidos a `packages/shared` y consumirlos en web y
API.

### B12. Falta endpoint para servir archivos (`/api/v1/files`) (alta)

`shared/storage.ts` genera `signedUrl` apuntando a `/api/v1/files/:key`, y la
foto de perfil se guarda en `stored_files`, pero no existe ninguna ruta de
archivos registrada en `app.ts`. Las fotos se almacenan pero no se pueden servir,
asi que el scanner y el panel no pueden mostrar la foto del usuario, que es la
mitigacion humana clave del feat de QR firmado.

Correccion: crear modulo `files` con `GET /api/v1/files/:key` que valide sesion,
resuelva el `stored_file`, respete `visibility` y devuelva el binario o una URL
firmada real. Considerar que el scanner necesita la foto en el resultado del scan.

### B13. Subida de foto sin validacion de tipo ni tamano (media)

`people.routes.ts` `/:id/photo` acepta cualquier `File` sin lista blanca de MIME
ni limite de bytes. Riesgo de subir ejecutables, SVG con script, o archivos
enormes.

Correccion: validar MIME contra `image/png|jpeg|webp`, limitar tamano (p. ej. 5
MB), y opcionalmente re-encodear la imagen para descartar metadatos peligrosos.

### B14. Permiso vehicular no valida `canHaveVehiclePermit` (media)

`vehicles.routes.ts` crea permisos sin verificar `person_types.canHaveVehiclePermit`
ni el estado activo de la persona, pese a que el catalogo de tipos ya define esa
bandera. Se pueden emitir permisos a tipos que no deberian tenerlos.

Correccion: validar el tipo de persona y su estado antes de crear el permiso, y
opcionalmente impedir mas de un permiso activo por par persona+vehiculo.

### B15. Inconsistencia de zona horaria entre filtros y SQL (alta)

`shared/date-range.ts` calcula el "dia operativo" en UTC
(`T00:00:00.000Z`..`T23:59:59.999Z`), pero `access_scan_v1` y
`auto_close_access_v1` usan `now()` y `current_setting('TIMEZONE')` del servidor,
y la asistencia guarda `fecha_clase = v_now::date` en hora local. En zona horaria
de Quintana Roo (UTC-5), los accesos cercanos a medianoche caen en el dia UTC
equivocado, descuadrando registros del dia y asistencias.

Correccion: definir una zona horaria operativa unica (config o env, p. ej.
`America/Cancun`) y calcular el rango del dia con esa zona tanto en el backend
como en el SQL. Agregar pruebas alrededor del cambio de dia.

### B16. CORS de origen unico bloquea scanner en LAN/movil (media)

`app.ts` usa `cors({ origin: env.WEB_ORIGIN })` con `WEB_ORIGIN` fijo a
`localhost:5173`. El web corre con `vite --host 0.0.0.0` para acceso movil, pero
un telefono que entra por IP de LAN sera bloqueado por CORS, justo el caso de uso
del scanner.

Correccion: permitir una lista de origenes (`WEB_ORIGINS` separado por comas) o
validar contra patron de LAN configurable, manteniendo `credentials: true`.

### B17. Catalogos sin paginacion y asistencia sin ajuste manual (baja)

`listSubjects` no pagina y `listSchedules` corta en 200; crecen sin control.
Ademas no hay endpoint para confirmar o ajustar manualmente una asistencia
(`asistencias_potenciales` solo cambia por scan), aunque el feat contempla estados
como `assumed`/`unverified` que en la practica requieren correccion manual.

Correccion: paginar catalogos y agregar endpoint de ajuste manual de asistencia
con auditoria.

### B18. WebSocket de eventos sin autenticacion (alta)

`server.ts` hace `server.upgrade(request)` en `/api/v1/events` sin validar
sesion. Cualquier cliente puede conectarse y recibir los broadcasts, que incluyen
`access.scan` con datos personales (nombre, matricula, tipo, carrera). Es una fuga
de PII a clientes no autenticados.

Correccion: validar la cookie de sesion admin antes del upgrade; rechazar el
upgrade si no hay sesion valida. Opcionalmente, separar topics publicos de
sensibles y no enviar PII por el socket (enviar solo "refresca" y que el cliente
pida los datos autenticado).

### B19. `EventTopic` incompleto: tablas que no auto-refrescan (baja)

`access`, `hot-qr` y `attendance` emiten broadcasts, pero `vehicles`,
`credentials` y `temporary-daily` no emiten ninguno, asi que esas tablas del panel
no se actualizan en vivo tras crear/revocar. Inconsistencia de experiencia.

Correccion: emitir eventos en esos modulos y ampliar el tipo `EventTopic`.

### B20. WebSocket del frontend sin cierre ni reconexion (baja)

`+page.svelte` y `scanner/+page.svelte` abren el socket en `onMount` pero nunca lo
cierran en `onDestroy` ni reconectan si se cae. Provoca conexiones colgadas y
perdida de actualizaciones tras una caida de red.

Correccion: cerrar en `onDestroy`, reconectar con backoff y reflejar estado de
conexion en la UI.

### B21. Listas de credenciales sin filtro ni paginacion (baja)

`listTemporaryDailyQr` y `listPersonQrTokens` devuelven hasta 100/20 filas sin
filtro de fecha ni estado. Con volumen real, la pestaña de credenciales muestra
datos truncados sin control.

Correccion: paginar y filtrar por estado/fecha/persona.

### B22. Violacion de indice unico devuelve 500 generico (media)

El `error-handler` solo mapea `HttpError` y `ZodError`. Una violacion de unicidad
de Postgres (matricula duplicada, placa duplicada, segundo QR temporal activo del
mismo dia por el indice parcial `temporary_daily_qr_unique`) cae en
`INTERNAL_ERROR` 500. El feat de QR temporal exige reemitir el existente, no
fallar. Ademas el panel muestra un 500 opaco en vez de "ya existe".

Correccion: mapear errores de Postgres (`23505` unique, `23503` FK) a respuestas
`409`/`400` con codigo claro; en QR temporal diario, detectar el activo existente
y reemitirlo.

### B23. `recordAudit` no es best-effort (baja)

Las rutas hacen `await recordAudit(...)` despues de la operacion principal. Si la
insercion de auditoria falla (p. ej. FK de `actorAdminId`), la respuesta se
convierte en 500 aunque la accion de negocio ya se completo.

Correccion: envolver `recordAudit` para que registre el fallo sin romper el flujo
principal.

### B24. Token plano persistido en `access_scan_events.metadata` (media)

En `access_scan_v1`, cada evento guarda `metadata = payload`, y para el flujo de
token opaco el `payload` contiene el `token` en claro (y para el firmado, el JWT
completo). Eso contradice la regla de no almacenar secretos: el token deberia
guardarse solo como hash o no guardarse.

Correccion: depurar el `payload` antes de persistirlo (quitar `token` y
`signedQr`), guardando a lo sumo su hash o el `jti`.

### B25. Modo "Registrar/Solo Generar" desconectado del handler (media)

`GeneratorTab.svelte` tiene un switch visual `register`/`generate` que solo
muestra u oculta campos, pero `createPersonAndQr` en `+page.svelte` decide si crea
o busca persona segun si `nombres && apellidos` estan llenos, no segun el modo.
Resultado: en "Solo Generar" con nombres residuales intentaria crear, y en
"Registrar" sin apellidos haria una busqueda silenciosa. La interaccion no
coincide con la intencion del operador (y con la GUI legacy del plan frontend).

Correccion: pasar el `mode` al handler y ramificar explicitamente crear vs buscar.

### B26. PATCH de persona falla con campos nulos (media)

`EditPersonTab` guarda con `JSON.stringify(editPerson)`, enviando el objeto
completo (incluye `curp`, `carreraId`, `createdAt`, etc.). El `personPatchSchema`
define `curp: z.string().length(18).optional()` y `carreraId: uuid().optional()`,
pero `.optional()` acepta `undefined`, no `null`. Una persona sin CURP o sin
carrera tiene esos campos en `null` en la DB, asi que editarla dispara
`VALIDATION_ERROR`. Es un bug que rompe la edicion de buena parte del padron.

Correccion: aceptar `null` en el schema (`.nullable().optional()`) o enviar solo
los campos editables y normalizar `null`/"" antes de mandar.

### B27. QR temporal pide UUID de persona crudo (baja)

`GeneratorTab` exige pegar el `ID persona` (UUID) para el QR temporal diario, en
vez de buscar por matricula como pide el feat. Poco usable para el operador.

Correccion: reusar la busqueda por matricula y resolver el `personId` internamente.

### B28. Sin responsive de tablas como cards en movil (baja)

`app.css` no tiene ninguna `@media` query; las tablas solo hacen scroll horizontal
en `table-wrap`. El `PLAN_FRONTEND_V2` exige explicitamente conservar el responsive
legacy "tablas como cards en movil". El scanner y el portal se usan en telefono,
asi que importa.

Correccion: agregar breakpoints y el patron de tabla-a-tarjeta en movil del
diseno legacy.

## Plan de ejecucion por fases

Cada fase termina con `bun test` y build verdes antes de avanzar. Se respeta el
principio de migracion por modulo de `PLAN_MIGRACION_STACK_PATRON`.

### Fase 0: Saneamiento de base (desbloquea todo)

Objetivo: que el proyecto arranque limpio desde cero con un `.env` valido.

- B1: reescribir `.env.example` completo (incluye `QR_SIGNING_*`, zona horaria y
  origenes CORS).
- B15: definir zona horaria operativa unica y alinear `date-range` con el SQL.
- B16: soportar lista de origenes CORS para scanner en LAN/movil.
- Documentar en README los comandos `db:migrate`, `db:seed`, `dev:api`,
  `dev:web`, `worker`.
- Verificar `db:migrate` aplica `0003` y `db:seed` corre sin error.

Criterio: clon limpio + `cp .env.example .env` + migrate + seed + arranque sin
fallar validacion de env; un dispositivo en LAN puede llamar la API; los registros
del dia coinciden en backend y SQL alrededor de medianoche local.

### Fase 1: Cerrar QR dinamico firmado end-to-end (nucleo)

Objetivo: que un QR dinamico firmado funcione del portal al scanner, con la foto
visible como mitigacion humana.

- B5: respetar `signed_qr.enabled` en `/portal/qr/dynamic` y `/access/scan`.
- B3: scanner detecta JWT y envia `signedQr`.
- B4: portal `/portal/qr` consume `/qr/dynamic`, renderiza QR, countdown y
  auto-refresh.
- B12: modulo `files` con `GET /api/v1/files/:key` para servir la foto del
  usuario en el resultado del scan.
- B18: autenticar el upgrade WebSocket y dejar de enviar PII por el socket.
- B24: depurar `token`/`signedQr` del `payload` antes de persistir eventos.
- B22: mapear violaciones de unicidad/FK de Postgres a 409/400 con codigo claro.
- B25: conectar el modo Registrar/Generar al handler de creacion de persona/QR.
- B26: arreglar el PATCH de persona para aceptar campos nulos.
- B2: worker limpia `qr_jti_consumptions` y claves rotadas vencidas.
- B9 (parcial): tests de firma/verificacion y de anti-replay basico.

Criterio: emitir QR dinamico, escanear entrada, reintentar mismo `jti` y obtener
`JTI_ALREADY_CONSUMED`; QR vencido rechazado; token opaco sigue funcionando; el
scanner muestra la foto del usuario.

### Fase 2: Extender QR firmado a temporal y vehicular

Objetivo: cubrir B6, B14 y los endpoints dinamicos faltantes.

- Incluir `typ` y resolver tipo en la ruta pre-verificada de `access_scan_v1`.
- Agregar `POST /portal/temporary-daily-qr/dynamic`,
  `POST /credentials/temporary-daily/:id/dynamic` y emision dinamica vehicular.
- B14: validar `canHaveVehiclePermit` y estado de persona al emitir permisos.
- Marcar correctamente `access_mode`, `subject_type`, `is_exception_access`.
- Tests de integracion para temporal diario firmado y vehicular firmado.

Criterio: cada tipo de QR firmado registra acceso con el modo y credencial
correctos y respeta vigencia/revocacion; no se emiten permisos a tipos no
autorizados.

### Fase 3: Endurecer autenticacion y entradas

Objetivo: cerrar B7, B8 y B13.

- B7: endpoints de cambio de password admin y usuario, con invalidacion de
  sesiones.
- B8: rate limit y bloqueo temporal por intentos fallidos.
- B13: validacion de MIME y tamano en subida de foto.
- Tests de cambio de password, bloqueo por intentos y proteccion de ultimo
  super admin (ya existe, agregar prueba).

Criterio: un admin con `mustChangePassword` puede resolverlo; tras N fallos el
login se bloquea temporalmente; subir un archivo no-imagen es rechazado.

### Fase 4: Calidad, contratos y observabilidad

Objetivo: B9 completo, B11 y B17.

- B11: centralizar wire shapes en `packages/shared` y consumirlos.
- B17: paginar catalogos (subjects/schedules) y agregar ajuste manual de
  asistencia con auditoria.
- B19: emitir eventos en vehicles/credentials/temporal y ampliar `EventTopic`.
- B20: cierre y reconexion del WebSocket en el frontend.
- B21: paginar y filtrar listas de credenciales.
- B23: hacer `recordAudit` best-effort.
- B27: QR temporal por busqueda de matricula en vez de UUID crudo.
- B28: responsive de tablas como cards en movil (paridad con GUI legacy).
- Completar matriz de pruebas del feat (todas las filas de la seccion Pruebas).
- Agregar metricas/auditoria de uso firmado vs opaco y de replays.

Criterio: cobertura de los criterios de aceptacion del feat; frontend tipado con
contratos compartidos.

### Fase 5: Capacidades avanzadas (futuro)

Objetivo: B10.

- Device binding con WebCrypto (clave privada no exportable, challenge/nonce).
- 2FA por correo con tabla `user_email_otp_challenges`.
- Portal de administracion de administradores avanzado (roles granulares) segun
  `FEAT_PORTAL_ADMINISTRACION_ADMINS`.

Criterio: emision sensible exige 2FA cuando el flag institucional este activo;
dispositivos no registrados detectables.

## Resumen de bugs por severidad y fase

| ID | Severidad | Resumen | Fase |
| --- | --- | --- | --- |
| B1 | Alta | `.env.example` incompleto y `SESSION_SECRET` invalido | 0 |
| B15 | Alta | Inconsistencia de zona horaria UTC vs SQL local | 0 |
| B16 | Media | CORS de origen unico bloquea scanner en LAN/movil | 0 |
| B2 | Alta | Worker no purga `qr_jti_consumptions` | 1 |
| B3 | Alta | Scanner no envia `signedQr` | 1 |
| B4 | Alta | Portal usa QR opaco, no dinamico | 1 |
| B5 | Media | Flag `signed_qr.enabled` ignorado | 1 |
| B12 | Alta | Falta `GET /api/v1/files/:key` (fotos no servibles) | 1 |
| B18 | Alta | WebSocket de eventos sin autenticacion (fuga de PII) | 1 |
| B22 | Media | Violacion de indice unico devuelve 500 generico | 1 |
| B24 | Media | Token plano persistido en `access_scan_events.metadata` | 1 |
| B9 | Media | Sin pruebas de QR firmado/anti-replay | 1 y 4 |
| B6 | Media | QR firmado solo resuelve `person_qr` | 2 |
| B14 | Media | Permiso vehicular no valida `canHaveVehiclePermit` | 2 |
| B25 | Media | Modo Registrar/Generar desconectado del handler | 1 |
| B26 | Media | PATCH de persona falla con `curp`/`carreraId` nulos | 1 |
| B7 | Media | Sin flujo de cambio de password obligatorio | 3 |
| B8 | Media | Login sin proteccion de fuerza bruta | 3 |
| B13 | Media | Subida de foto sin validar MIME/tamano | 3 |
| B11 | Baja | Contratos no centralizados en `packages/shared` | 4 |
| B17 | Baja | Catalogos sin paginacion; asistencia sin ajuste manual | 4 |
| B19 | Baja | `EventTopic` incompleto: tablas que no auto-refrescan | 4 |
| B20 | Baja | WebSocket del frontend sin cierre ni reconexion | 4 |
| B21 | Baja | Listas de credenciales sin filtro ni paginacion | 4 |
| B23 | Baja | `recordAudit` no es best-effort | 4 |
| B27 | Baja | QR temporal pide UUID crudo en vez de matricula | 4 |
| B28 | Baja | Sin responsive de tablas como cards en movil | 4 |
| B10 | Baja | 2FA correo y device binding no implementados | 5 |

## Matriz feature vs estado vs fase

| Feature | Estado actual | Fase que cierra |
| --- | --- | --- |
| QR firmado servidor (Fase 1 feat) | Backend listo, frontend pendiente | Fase 1 |
| Anti-replay `jti` (Fase 2 feat) | SQL listo, worker pendiente | Fase 1 |
| Compatibilidad token opaco (Fase 3 feat) | Listo | Fase 1 (verificacion) |
| Portal usuario QR | Estatico rotado | Fase 1 |
| QR temporal diario | Opaco, sin dinamico firmado | Fase 2 |
| QR vehicular firmado | Permiso+token opaco, sin dinamico | Fase 2 |
| Administradores GUI | CRUD listo, sin cambio password | Fase 3 |
| Device binding (Fase 4 feat) | No iniciado | Fase 5 |
| 2FA correo (Fase 5 feat) | No iniciado | Fase 5 |

## Riesgos y mitigaciones

- Reescribir demasiado a la vez: se migra por fase y modulo, con tests verdes
  como compuerta.
- Romper el scan actual: el token opaco se mantiene como fallback hasta terminar
  Fase 2; pruebas de regresion en cada fase.
- Clave privada expuesta: nunca en frontend ni en DB; solo `QR_SIGNING_*` en env
  o KMS; JWKS publica solo claves publicas.
- Crecimiento de `qr_jti_consumptions`: worker de limpieza en Fase 1.

## Definicion de hecho global

- `bun test` y build verdes en cada fase.
- Ningun QR nuevo usa matricula como secreto.
- QR dinamico expira en 15-30 s, siempre incluye `jti`, y un `jti` no abre dos
  accesos.
- Scanner verifica firma sin clave privada y mantiene respuesta visual completa.
- `.env.example` reproducible desde cero.
- Sin secretos (`passwordHash`, `sessionHash`, `tokenHash`, clave privada) en
  respuestas API ni en el bundle web.
