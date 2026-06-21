# Plan compacto de cierre faltante v2

## Resumen

El proyecto ya no esta en fase de scaffolding. Backend, BD, migraciones,
worker, portal, scanner, admin shell y QR dinamico firmado ya existen.

## Avance aplicado

- WebSocket `/api/v1/events` autenticado con sesion admin antes del upgrade.
- Modulo `files` registrado para servir fotos desde storage local con sesion.
- Validacion de foto de persona por MIME y tamano maximo.
- Mapeo de errores PostgreSQL `23505` y `23503`.
- Cambio de password para admin y portal usuario.
- Proteccion basica contra fuerza bruta en login admin y portal.
- Zona horaria operativa configurable con default `America/Cancun`.
- Soporte de `WEB_ORIGINS` para origenes multiples.
- Auditoria best-effort.
- Eventos live ampliados para credentials, QR temporal, vehiculos, permisos,
  admins, sesiones, auditoria y config.
- Ajuste manual auditado de asistencias desde API y GUI.
- Scanner con foto real cuando el backend devuelve `profilePhotoUrl`.
- Tablas responsive como cards en movil.
- Contratos compartidos para paginacion, scanner, auth, asistencias,
  administradores, sesiones admin, auditoria, personas, tipos de persona,
  carreras, credenciales personales, QR temporal, Hot-QR, vehiculos, permisos
  vehiculares y configuracion operativa.
- Portal admin con edicion basica de administradores, sesiones visibles y
  auditoria filtrable con modal de metadata.

Lo pendiente para cerrar v2 no es mas CRUD basico, sino:

- Endurecimiento de seguridad.
- Consistencia operativa.
- Pruebas reales end-to-end.
- Paridad fina de GUI legacy.
- Cierre de portal usuario y portal administracion.

## Estado actual

### Backend

- Bun + Hono + TypeScript.
- PostgreSQL + Drizzle + migraciones SQL manuales.
- Worker operativo.
- Sesiones por cookies `httpOnly`.
- QR dinamico firmado personal, temporal y vehicular.
- Portal usuario.
- Admin shell.
- Scanner.

### Frontend

El frontend v2 ya tiene base operativa en SvelteKit/Tailwind:

- `/` como panel administrativo compatible.
- `/scanner` como vista de escaneo separada.
- `/portal`, `/portal/qr`, `/portal/historial` como portal de usuario.
- Tabs admin para generar QR, editar personas, registros, asistencias, Hot-QR,
  vehiculos, administradores y configuracion.

Lo pendiente no es crear una app nueva, sino cerrar la experiencia completa con
paridad visual legacy v1 y con las features nuevas de portal de usuario y portal
de administracion.

## Backend: aplicado y pendiente real

Los puntos de seguridad base ya fueron implementados y se mantienen abajo como
criterios verificables. Lo que sigue en backend es profundizar pruebas E2E,
robustecer edge cases y completar reportes/operacion avanzada.

### Seguridad aplicada

- Autenticar el WebSocket `/api/v1/events`.
  - Actualmente el upgrade debe validar sesion antes de registrar el socket.
  - Evitar fuga de PII en eventos de acceso.
  - Ideal: enviar eventos de refresco y que el cliente autenticado consulte los
    datos por API.
- Crear modulo `files` para servir `/api/v1/files/:key`.
  - `StorageService` ya genera esa URL.
  - Falta ruta registrada para entregar fotos/documentos.
  - Scanner y panel necesitan foto real del usuario.
- Validar subida de foto:
  - MIME permitido: `image/png`, `image/jpeg`, `image/webp`.
  - Tamano maximo configurable.
  - Rechazar SVG, ejecutables y binarios no imagen.
- Mapear errores Postgres:
  - `23505` a `409 CONFLICT`.
  - `23503` a `400 BAD_REQUEST` o `409 CONFLICT`.
  - Evitar `500 INTERNAL_ERROR` para matricula, placa o QR temporal duplicado.
- Agregar cambio obligatorio de password:
  - admin,
  - usuario portal.
- Agregar proteccion contra fuerza bruta:
  - login admin,
  - login portal,
  - bloqueo temporal por IP + identidad,
  - auditoria de fallos.

### Consistencia operativa aplicada

- Definir zona horaria operativa unica.
  - Recomendado: `America/Cancun`.
  - Alinear filtros del dia, asistencia y SQL atomico.
  - Evitar diferencias UTC vs horario local cerca de medianoche.
- Soportar varios origenes web.
  - Reemplazar origen unico por `WEB_ORIGINS`.
  - Permitir scanner en LAN/movil sin abrir CORS de forma insegura.
- Hacer auditoria best-effort.
  - Una falla en `recordAudit` no debe romper una accion de negocio ya
    completada.
- Completar eventos por modulo:
  - vehicles,
  - credentials,
  - QR temporal,
  - cambios de config,
  - cambios de sesiones/admins.

### Archivos y storage aplicado

- Registrar ruta de archivos en `app.ts`.
- Resolver `stored_files` por key.
- Validar visibilidad y permisos.
- Para fotos de scanner:
  - permitir lectura autenticada por admin/scanner,
  - no exponer archivos privados sin sesion.

### Password y sesiones aplicado

- Implementar:
  - `POST /api/v1/auth/change-password`,
  - `POST /api/v1/portal/auth/change-password`.
- Al cambiar password:
  - limpiar `mustChangePassword`,
  - revocar otras sesiones si aplica,
  - auditar evento.

### Asistencias y catalogos pendiente parcial

- Ajuste manual auditado de asistencia ya aplicado.
- Paginar y filtrar materias/horarios.
- Paginar y filtrar credenciales:
  - QR personal,
  - QR temporal,
  - QR vehicular.

## Principio visual

La GUI final debe seguir la experiencia legacy:

- Header institucional UPQROO.
- Tabs superiores, no sidebar.
- Scanner en pantalla separada.
- Formularios compactos.
- Tablas densas.
- Badges de estado.
- Footer institucional.
- Responsive tipo v1.

No se debe convertir en landing page, dashboard SaaS generico ni rediseño libre.

## Portal de usuario pendiente

### Login y sesion

- Mantener sesion separada de admin.
- Agregar flujo visual para `mustChangePassword`.
- Mostrar errores de credenciales, sesion expirada y permisos sin mensajes
  genericos.

### QR personal

- Pulir `/portal/qr` como experiencia principal movil:
  - QR dinamico grande.
  - Modo pantalla completa.
  - Countdown claro.
  - Estado `refrescando`, `expirado`, `error`, `offline`.
  - Fallback opaco solo si backend/config lo permite.
- Evitar persistir tokens en storage del navegador.
- Mostrar vigencia, tipo de persona y estado de cuenta.

### QR temporal diario

- Mostrar QR temporal activo si existe.
- Permitir solicitar QR temporal cuando el tipo de persona lo permita.
- Mostrar:
  - credencial faltante,
  - motivo,
  - vigencia,
  - usos restantes,
  - estado.
- Agregar historial de QR temporales.
- Usar QR dinamico temporal cuando este habilitado.

### Historial propio

- Separar accesos y asistencias.
- Agregar filtros simples por fecha, estado y tipo.
- Mostrar estados legibles:
  - entrada,
  - salida,
  - salida automatica,
  - asistencia confirmada,
  - parcial,
  - asumida,
  - no verificada.

### Device binding futuro

- Si se activa la feature:
  - registrar dispositivo,
  - mostrar dispositivo actual,
  - revocar dispositivo,
  - volver a vincular.

## Portal de administracion pendiente

### Administradores aplicado y pendiente

- Tab `Administradores` ya permite:
  - listar administradores,
  - crear admin,
  - editar datos basicos,
  - habilitar/deshabilitar,
  - resetear password,
  - consultar sesiones,
  - revocar sesiones,
  - filtrar auditoria.
- Pendiente: pulir detalles visuales finos y pruebas E2E.
- Ocultar visualmente acciones no permitidas para `admin`.
- Mantener validacion final en backend.

### Sesiones admin aplicado y pendiente

- Sesiones activas/revocadas y revocacion ya estan en GUI.
- Mostrar:
  - admin,
  - IP,
  - user-agent,
  - expiracion,
  - revocacion.

### Auditoria aplicada y pendiente

- Vista filtrable ya agregada por:
  - actor,
  - accion,
  - entidad,
  - fecha,
  - IP/user-agent.
- Metadata ya se muestra en modal legible.
- No mostrar hashes ni secretos.

### Cambio de password

- Agregar pantalla o modal para `mustChangePassword`.
- Permitir cambio voluntario de password.
- Forzar relogin o invalidar sesiones segun respuesta del backend.

## Scanner pendiente

- Asegurar que el resultado visual replique v1:
  - foto o placeholder,
  - nombre,
  - matricula,
  - tipo de persona,
  - carrera,
  - placa/vehiculo si aplica,
  - entrada/salida,
  - timestamp,
  - motivo de rechazo.
- Detectar JWT y enviarlo como `signedQr`; token opaco como `token`.
- Mostrar estados de conexion con WebSocket.
- Cerrar WebSocket en destroy.
- Reconectar con backoff.
- Mantener entrada manual por matricula/codigo.

## Tabs admin pendientes

### Generar QR

- Hacer que el modo `Registrar y generar` vs `Solo generar` controle el handler
  explicitamente.
- Carrera condicional segun `person_types.requires_career`.
- QR temporal por busqueda de matricula, no por UUID crudo.
- Mostrar token/QR solo una vez al crear o rotar.

### Editar persona

- Enviar solo campos editables.
- Normalizar `null` y cadenas vacias antes de PATCH.
- Mostrar preview real de foto cuando exista endpoint de archivos.
- Mostrar historial de credenciales.
- Rotar/revocar QR desde la misma vista.

### Registros

- Mantener paginacion server-side.
- Agregar filtros completos:
  - busqueda,
  - fecha,
  - tipo de persona,
  - modo de acceso,
  - estado.
- Mostrar resumen del dia.
- Refrescar por WebSocket sin cargar dataset completo.

### Asistencias

- Mantener tabla paginada.
- Mostrar materia, aula, horario, porcentaje y estado descriptivo.
- Agregar ajuste manual auditado cuando backend lo exponga.
- Integrar subpanel de materias y horarios sin romper estilo legacy.

### Hot-QR

- Formulario compacto.
- QR visible solo al emitir.
- Descargar/compartir.
- Tabla del dia con filtros y revocacion.

### Vehiculos

- Flujo guiado:
  - buscar persona,
  - crear vehiculo,
  - crear permiso,
  - emitir QR,
  - rotar/revocar.
- Buscar por matricula y placa.
- Mostrar estado de vehiculo, permiso y QR.
- QR vehicular dinamico cuando este habilitado.

### Configuracion

- Reemplazar JSON crudo por controles:
  - reintento automatico,
  - delay,
  - camara,
  - entrada manual,
  - sonidos,
  - auto-exit,
  - QR dinamico,
  - TTL QR,
  - compatibilidad token opaco,
  - device binding,
  - origenes LAN/movil si aplica.

## Infra frontend pendiente

- Mover wire shapes a `packages/shared`:
  - paginacion,
  - scanner result,
  - auth session,
  - credenciales,
  - personas,
  - tipos de persona,
  - carreras,
  - portal.
- Reducir `Record<string, unknown>` en componentes. Avance: admin, auditoria,
  asistencias, personas, tipos, carreras, credenciales, Hot-QR, vehiculos,
  permisos vehiculares y config ya tienen contratos compartidos; quedan tablas
  auxiliares y reportes avanzados.
- Manejar errores API con codigos estables.
- WebSocket compartido con:
  - cierre,
  - reconexion,
  - estado visible,
  - refresh selectivo por topic.
- Agregar pruebas:
  - login admin,
  - portal usuario,
  - QR dinamico,
  - scanner manual y QR,
  - tablas paginadas,
  - permisos de `admin` vs `super_admin`.

## Pruebas faltantes

### Backend unitario

- `qr-signing`:
  - firma valida,
  - firma invalida,
  - expirado,
  - `nbf` futuro,
  - audiencia incorrecta,
  - `jti` duplicado,
  - no fuga de clave privada.
- Sanitizacion de respuestas:
  - no `passwordHash`,
  - no `sessionHash`,
  - no `tokenHash`,
  - no claves privadas.
- Rate limit y bloqueo temporal.
- Cambio de password.
- Validacion de foto.

### Backend integracion con Postgres

- QR dinamico personal:
  - emitir,
  - escanear entrada,
  - reintentar mismo `jti`,
  - rechazar replay.
- QR temporal diario dinamico:
  - activo,
  - expirado,
  - revocado,
  - usos permitidos.
- QR vehicular dinamico:
  - permiso activo,
  - permiso revocado,
  - vehiculo bloqueado.
- WebSocket autenticado.
- Error `23505` mapeado a `409`.
- Zona horaria alrededor de medianoche local.
- Worker:
  - auto-exits,
  - expiraciones,
  - limpieza de consumos `jti`,
  - sesiones expiradas.

### Frontend y smoke browser

- Login admin.
- Portal usuario.
- QR dinamico con countdown.
- Scanner manual.
- Scanner con QR firmado.
- Tablas paginadas.
- Hot-QR.
- Vehiculos.
- Permisos visuales `admin` vs `super_admin`.
- Responsive movil.
- No renderizar secretos en UI.

## Responsive pendiente

- Convertir tablas a cards en movil como v1.
- Mantener scanner usable en telefono.
- Portal usuario mobile-first.
- Botones y tabs sin overflow.
- QR maximizado sin que lo tape el header.

## Prioridad recomendada

1. Seguridad backend critica:
   - WebSocket autenticado,
   - archivos/fotos,
   - errores Postgres,
   - password,
   - fuerza bruta.
2. Consistencia operativa:
   - zona horaria,
   - CORS LAN/movil,
   - auditoria best-effort,
   - eventos por modulo.
3. Portal usuario QR + scanner firmado end-to-end.
4. Portal admin:
   - administradores,
   - sesiones,
   - auditoria,
   - password.
5. Tabs operativos:
   - generar,
   - editar,
   - registros,
   - asistencias,
   - hot-qr,
   - vehiculos.
6. Responsive legacy y pulido visual.
7. Tipos compartidos, WebSocket robusto y pruebas E2E.

## Features futuras

- Device binding completo con WebCrypto:
  - clave privada no exportable,
  - challenge firmado,
  - revocacion de dispositivos.
- 2FA por correo institucional.
- Portal avanzado de administracion:
  - roles granulares,
  - permisos por modulo,
  - auditoria avanzada.
- Ajuste manual de asistencias con flujo de aprobacion.
- Reportes operativos avanzados:
  - asistencia por carrera,
  - accesos por puerta,
  - uso sospechoso de QR,
  - replays detectados.

## Criterio de cierre

- WebSocket no filtra PII sin sesion.
- Fotos se pueden subir, validar y servir con permisos.
- Login admin y portal tienen proteccion contra fuerza bruta.
- Password obligatorio puede resolverse desde UI.
- El dia operativo coincide entre API, SQL y frontend.
- Un usuario de v1 reconoce la misma GUI y flujo operativo.
- El portal usuario permite consultar QR, QR temporal e historial propio.
- El portal admin permite administrar usuarios, sesiones y auditoria sin tocar BD.
- Las tablas nunca cargan datasets completos.
- No se muestran secretos, hashes ni tokens persistentes.
- QR dinamico personal, temporal y vehicular tienen pruebas de replay.
- `bun run --cwd apps/api check`, `test` y migraciones pasan.
- `bun run --cwd apps/web check`, `test` y `build` pasan.
- Smoke browser cubre admin, scanner y portal.
