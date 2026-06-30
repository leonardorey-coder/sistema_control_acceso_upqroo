# PRD: Sistema de Control de Acceso UPQROO

Fecha: 2026-06-29
Estado: documento integrador de producto
Base analizada: codigo actual de `control-acceso-v2`, documentacion en `docs/`,
migraciones SQL, contratos compartidos, frontend SvelteKit y funciones legacy
recuperadas desde Git.

## 1. Resumen ejecutivo

El Sistema de Control de Acceso UPQROO es una plataforma institucional para
controlar entradas, salidas, asistencia, credenciales QR, visitantes, vehiculos,
administradores y auditoria operativa del campus.

La version v2 ya no es un prototipo de scaffold. El repo actual contiene:

- API Bun + Hono + TypeScript.
- Frontend SvelteKit + TypeScript + Tailwind.
- PostgreSQL con Drizzle ORM y SQL manual versionado para reglas atomicas.
- Panel administrativo con GUI basada en la experiencia legacy.
- Scanner separado.
- Portal de usuario con QR personal, historial y dispositivos.
- QR dinamico firmado personal, temporal diario y vehicular.
- Hot-QR para visitantes.
- Vehiculos y permisos vehiculares.
- Asistencias, materias y horarios.
- Auditoria, sesiones, archivos/fotos, WebSocket de eventos y worker operativo.
- Arnes de performance y evidencia de optimizacion.

El objetivo de producto no es rehacer la app, sino consolidarla como sistema
institucional: conservar el flujo operativo legacy que ya funciona para guardias
y administradores, mientras se elevan seguridad, auditabilidad, escalabilidad,
portal de usuario, gestion vehicular, gates fisicos e identidad digital.

## 2. Problema

La universidad necesita controlar acceso de personas, visitantes y vehiculos con
evidencia confiable. El sistema legacy resolvia flujos operativos basicos, pero
tenia limites relevantes:

- QR basado en matricula o token de baja proteccion.
- Sesiones y tokens manejados en cliente.
- Logica mezclada en endpoints serverless.
- Validaciones distribuidas entre frontend, API y SQL.
- Poca separacion entre persona, credencial, vehiculo, visitante y registro.
- Escasa trazabilidad granular para acciones administrativas.
- UI funcional pero dificil de mantener.

La v2 corrige la base tecnica y agrega nuevas capacidades, pero todavia debe
cerrarse como producto completo:

- Paridad fina con la GUI legacy.
- Pruebas E2E de flujos criticos.
- Reportes institucionales avanzados.
- Gates/puertas fisicas.
- Identidad digital y recompensas.
- Operacion productiva documentada.

## 3. Vision de producto

Construir una plataforma de control de acceso universitaria donde:

- El guardia escanea rapidamente y ve una respuesta clara: aceptado, rechazado,
  entrada, salida, foto, persona, vehiculo, motivo y hora.
- El administrador gestiona personas, QR, asistencias, Hot-QR, vehiculos,
  permisos, administradores, sesiones y configuracion sin tocar la base de datos.
- El usuario consulta su QR dinamico, historial, dispositivos y credenciales
  temporales desde un portal movil.
- La institucion puede auditar quien entro, salio, por donde, con que credencial,
  que administrador intervino y si hubo excepciones.
- Las reglas criticas de acceso se mantienen atomicas en PostgreSQL.
- Las futuras capas sociales o de identidad nunca sustituyen las reglas de
  seguridad de acceso.

## 4. Principios de producto

1. Seguridad primero: la matricula no debe volver a ser secreto.
2. Operacion rapida: el scanner debe responder con baja friccion.
3. Paridad legacy: los operadores actuales deben reconocer el flujo visual.
4. Auditabilidad: toda accion sensible debe dejar rastro.
5. Atomicidad en base de datos: entrada/salida, anti-replay, asistencia e
   integridad se resuelven en SQL versionado.
6. Migracion incremental: no romper compatibilidad mientras se cierran features.
7. Privacidad por defecto: mostrar solo datos necesarios para cada actor.
8. Contratos estables: frontend y backend comparten tipos cuando el wire shape
   es critico.
9. Worker obligatorio: expiraciones, limpiezas y cierres automaticos no son
   tareas manuales.
10. Escalabilidad pragmatica: optimizar hot paths antes de proponer reescrituras.

## 5. Actores

### 5.1 Guardia / operador de scanner

Responsable de validar entradas y salidas en el punto fisico de acceso.

Necesita:

- Iniciar sesion administrativa.
- Abrir vista `/scanner`.
- Escanear QR con camara o capturar matricula/codigo manual.
- Ver respuesta inmediata y legible.
- Confirmar identidad visual con foto.
- Distinguir entrada, salida, visitante, temporal y vehicular.
- Entender por que se rechazo un acceso.

### 5.2 Administrador operativo

Gestiona padron, QR, Hot-QR, registros, asistencias, vehiculos y configuracion
basica.

Necesita:

- CRUD operativo sin SQL.
- Busqueda por matricula, nombre, placa y estado.
- Paginacion server-side.
- Formularios compactos.
- Acciones de rotacion/revocacion.
- Ajustes auditados.

### 5.3 Super administrador

Administra administradores, sesiones, auditoria y futuras acciones sensibles de
identidad.

Necesita:

- Crear, editar, habilitar y deshabilitar administradores.
- Resetear passwords.
- Revocar sesiones.
- Ver auditoria filtrable.
- Proteger ultimo superadmin.
- Ejecutar overrides con motivo obligatorio en futuras capas.

### 5.4 Usuario del portal

Alumno, docente, administrativo u otro perfil autorizado para portal.

Necesita:

- Iniciar sesion con cookie `httpOnly`.
- Resolver cambio obligatorio de password.
- Ver QR personal dinamico.
- Consultar historial de accesos/asistencias.
- Solicitar o consultar QR temporal diario.
- Gestionar dispositivos vinculados cuando aplique.

### 5.5 Visitante

Persona externa con acceso temporal mediante Hot-QR o futura credencial temporal.

Necesita:

- Recibir QR/codigo temporal.
- Acceder dentro de vigencia y usos permitidos.
- Ser registrado con motivo y creador.

### 5.6 Personal institucional de analitica / direccion

Consume reportes de asistencia, accesos, uso por puerta, excepciones, seguridad
y adopcion.

Necesita:

- Datos confiables.
- Filtros por fecha, carrera, tipo, gate, modo, estado y credencial.
- Evidencia de integridad.

## 6. Alcance actual verificado

### 6.1 Backend

Stack actual:

- Bun.
- Hono.
- TypeScript.
- Zod.
- PostgreSQL.
- Drizzle ORM.
- Migraciones Drizzle + SQL manual versionado.
- `bun:test`.

Modulos API actuales:

- `auth`: login, logout, sesion, refresh, cambio de password admin.
- `user-portal`: login de usuario, QR, dispositivos, historial, QR temporal.
- `people`: personas, importacion CSV, foto, alta, edicion, habilitado.
- `person-types`: catalogo de tipos de persona.
- `careers`: carreras.
- `access`: scan, registros del dia, salidas automaticas.
- `attendance`: asistencias, materias, horarios, ajuste manual.
- `hot-qr`: visitantes temporales.
- `vehicles`: vehiculos, permisos, QR vehicular opaco y dinamico.
- `credentials`: QR personal, temporal diario, rotacion/revocacion.
- `config`: configuracion operativa y QR firmado.
- `integrity`: verificacion de cadena de integridad.
- `admin-management`: administradores, sesiones, auditoria.
- `files`: entrega de archivos/fotos protegidas.
- `qr-signing`: JWKS, clave actual y rotacion.
- `events`: WebSocket server-driven.

### 6.2 Frontend

Stack actual:

- SvelteKit 5.
- TypeScript.
- Tailwind CSS.
- Vite.
- Cliente API con `credentials: include`.
- Componentes legacy-style.

Rutas actuales:

- `/`: panel administrativo.
- `/scanner`: vista de escaneo.
- `/portal/login`: login portal usuario.
- `/portal`: inicio portal.
- `/portal/qr`: QR dinamico y device binding.
- `/portal/historial`: historial propio.

Tabs actuales del panel:

- Generar QR.
- Editar persona.
- Registros.
- Asistencias.
- Hot-QR.
- Vehiculos.
- Administradores.
- Configuracion.

### 6.3 Base de datos actual

Entidades principales:

- `personas`.
- `person_types`.
- `carreras`.
- `administradores`.
- `admin_sessions`.
- `user_accounts`.
- `user_sessions`.
- `user_device_keys`.
- `user_device_challenges`.
- `login_rate_limits`.
- `stored_files`.
- `qr_tokens`.
- `temporary_daily_qr_tokens`.
- `vehicle_permit_qr_tokens`.
- `hot_qr_tokens`.
- `vehicles`.
- `vehicle_permits`.
- `registros_acceso`.
- `access_scan_events`.
- `asistencias_potenciales`.
- `subjects`.
- `schedules`.
- `operational_config`.
- `audit_log`.
- `qr_signing_keys`.
- `qr_jti_consumptions`.

Enums relevantes:

- Estado persona: `activo`, `inactivo`, `suspendido`, `egresado`, `baja`.
- Tipo credencial: `legacy_static_qr`, `person_qr`, `vehicle_permit_qr`,
  `hot_qr`, `temporary_daily_qr`, `manual_override`.
- Modo acceso: `pedestrian`, `vehicle`, `visitor`, `manual`.
- Sujeto acceso: `person`, `vehicle_permit`, `visitor`, `exception`.
- Estado acceso: `in_progress`, `completed`, `auto_closed`, `rejected`.
- Estado asistencia: `in_progress`, `confirmed`, `partial`, `unverified`,
  `assumed`.
- Roles admin: `admin`, `super_admin`.

### 6.4 SQL atomico

La base mantiene reglas criticas en funciones SQL:

- `access_scan_v1(payload jsonb)`: decide entrada/salida/rechazo, resuelve
  credenciales, consume `jti`, registra eventos y crea/actualiza asistencia.
- `auto_close_access_v1(...)`: cierra accesos abiertos y ajusta asistencias.
- `verify_access_chain_v1(...)`: verifica cadena hash de registros.
- `access_hash_chain_assign_v1()`: serializa la asignacion de cadena hash global
  para evitar corrupcion concurrente.

Decision: Drizzle modela tablas, tipos, indices y CRUD; SQL versionado conserva
las reglas atomicas de dominio.

## 7. Funciones legacy que deben preservarse

La revision de legacy muestra capacidades y lenguaje visual que siguen siendo
requisitos de producto, aunque su implementacion v2 cambie.

### 7.1 Login administrativo legacy

Requisitos a preservar:

- Pantalla simple centrada.
- Logo UPQROO.
- Titulo `Acceso Administrativo`.
- Campos usuario/password.
- Error visible en tarjeta.
- Boton principal naranja.

Cambio v2:

- Usar `POST /api/v1/auth/login`.
- Guardar sesion solo en cookie `httpOnly`.
- No persistir token admin en `localStorage`.

### 7.2 Scanner legacy

Requisitos a preservar:

- Vista separada del panel admin.
- Camara con `html5-qrcode`.
- Resultado inicial de espera.
- Pausa al detectar QR.
- Resultado de carga.
- Resultado exitoso con entrada/salida.
- Foto redonda o placeholder.
- Nombre, matricula, tipo, carrera, estado y timestamp.
- Sonido de exito/error.
- Autoescaneo configurable.
- Boton para continuar escaneando.

Cambio v2:

- Enviar JWT firmado como `signedQr`.
- Enviar token opaco como `token`.
- Enviar captura manual como `manualMatricula`.
- Mostrar `profilePhotoUrl` protegido por sesion.
- Soportar QR personal, temporal, vehicular y Hot-QR.

### 7.3 Panel administrativo legacy

Requisitos a preservar:

- Header institucional sticky.
- Logo real de UPQROO.
- Titulo corto.
- Boton para ir a vista scanner.
- Bloque de usuario admin.
- Tabs superiores.
- Formularios compactos.
- Tablas densas.
- Badges de estado.
- Footer institucional.
- Responsive tipo cards en movil.

Cambio v2:

- Agregar tabs nuevas sin convertir la app en dashboard generico.
- Paginacion/filtros server-side.
- Contratos compartidos.
- Acciones auditadas.

### 7.4 Generar QR legacy

Requisitos a preservar:

- Modo `Registrar y Generar`.
- Modo `Solo Generar`.
- Validaciones de matricula, CURP, tipo y carrera.
- Subida de foto.
- Fecha de caducidad opcional.
- QR visible con datos.
- Descarga de QR como imagen.

Cambio v2:

- QR no debe contener matricula como secreto.
- Backend genera credencial segura.
- Token/QR se muestra solo al crear o rotar.
- Carrera depende de `person_types.requiresCareer`.

### 7.5 Editar persona legacy

Requisitos a preservar:

- Busqueda por matricula.
- Formulario aparece al encontrar persona.
- Editar datos personales.
- Estado activo/inactivo equivalente.
- Foto actual.
- Guardar/cancelar.

Cambio v2:

- Usar UUID internamente, matricula en UX.
- Soft state, no borrado fisico por defecto.
- Rotacion/revocacion de credenciales desde endpoints dedicados.

### 7.6 Registros legacy

Requisitos a preservar:

- Tabla del dia.
- Buscador.
- Boton actualizar.
- Contador.
- Columnas matricula, nombre, tipo, carrera, entrada, salida, estado.
- Badges.

Cambio v2:

- Filtros y paginacion en servidor.
- Incluir admin entrada/salida, modo de acceso, credential type, vehiculo,
  excepcion y estado de salida automatica.

### 7.7 Hot-QR legacy

Requisitos a preservar:

- Crear QR de visitante con nombre, motivo y duracion.
- Mostrar QR inmediatamente.
- Descargar/compartir.
- Listar Hot-QR del dia.
- Revocar/desactivar.
- Estados activo, usado, expirado, revocado/deshabilitado.

Cambio v2:

- Token hasheado.
- Uso maximo.
- Auditoria.
- Eventos live.
- Integracion con `access_scan_v1`.

## 8. Requisitos funcionales actuales

### 8.1 Autenticacion admin

El sistema debe:

- Permitir login admin por username/password.
- Usar cookies `httpOnly`.
- Hashear passwords con `Bun.password`.
- Guardar sesiones en `admin_sessions`.
- Hashear tokens de sesion.
- Soportar logout, refresh, `me` y cambio de password.
- Bloquear fuerza bruta por IP + identidad.
- Usar rate limit en memoria para dev/test o Postgres para produccion.
- Auditar logins fallidos y cambios relevantes.
- No devolver `passwordHash`, `sessionHash` ni secretos.

### 8.2 Autenticacion portal usuario

El sistema debe:

- Permitir login de usuario con sesion separada de admin.
- Usar `USER_SESSION_COOKIE_NAME`.
- Mostrar `mustChangePassword`.
- Permitir cambio de password.
- Exponer `GET /api/v1/portal/me`.
- Revocar sesiones vencidas mediante worker.

### 8.3 Personas

El sistema debe:

- Crear personas con matricula unica.
- Buscar por matricula, nombre, apellidos y filtros.
- Editar campos permitidos.
- Habilitar/deshabilitar por estado.
- Importar CSV.
- Subir foto validando MIME y tamano.
- Servir foto por `/api/v1/files/:key` con permisos.
- Relacionar persona con tipo, carrera, cuenta de portal, credenciales, vehiculos
  y registros.

### 8.4 Tipos de persona

El sistema debe permitir administrar catalogos que definan:

- Si requiere carrera.
- Si genera asistencia.
- Si puede tener portal.
- Si puede tener permiso vehicular.
- Si es temporal.
- Estado activo/inactivo.

Estos flags deben controlar UX y reglas backend, no solo documentacion.

### 8.5 Carreras

El sistema debe:

- Listar carreras activas.
- Asociarlas a personas cuando aplique.
- Usarlas como filtro de registros, asistencias y reportes.

### 8.6 QR personal

El sistema debe:

- Emitir QR personal opaco hasheado para compatibilidad.
- Rotar/revocar QR personal.
- Emitir QR personal dinamico firmado cuando `signed_qr.enabled` este activo.
- Usar expiracion corta.
- Incluir `jti` unico.
- Consumir `jti` atomicamente.
- Rechazar replay con codigo estable.
- Mantener fallback opaco solo si configuracion lo permite.

### 8.7 QR dinamico firmado

El sistema debe:

- Firmar tokens efimeros con clave privada servidor.
- Publicar JWKS de claves publicas.
- Soportar `kid` y rotacion.
- Validar `iss`, `aud`, `typ`, `iat`, `nbf`, `exp`, `jti`.
- Nunca exponer clave privada al frontend.
- Nunca guardar token completo como secreto persistente.
- Depurar metadata antes de guardar eventos.
- Soportar tipos `person_qr`, `temporary_daily_qr`, `vehicle_permit_qr` y en
  futuro `hot_qr` si se decide firmarlo.

### 8.8 Device binding

Estado actual:

- Existen tablas `user_device_keys` y `user_device_challenges`.
- El portal tiene helpers WebCrypto/IndexedDB.
- El backend permite registrar/revocar dispositivos y emitir challenges.
- Configuracion firmada puede exigir device binding.

El sistema debe:

- Registrar clave publica por dispositivo.
- Guardar clave privada no exportable en browser.
- Permitir revocar dispositivo.
- Permitir recuperar flujo cuando IndexedDB se pierde.
- Tratar device binding como factor adicional, no como firma institucional.

Futuro:

- Exigir challenge firmado para emitir QR dinamico si la institucion lo activa.
- Agregar politicas por tipo de usuario/riesgo.

### 8.9 Scanner

El scanner debe:

- Leer QR por camara.
- Permitir captura manual.
- Detectar JWT y enviar `signedQr`.
- Detectar token/codigo opaco y enviar `token`.
- Enviar `manualMatricula` solo para override permitido.
- Mostrar estado accepted/rejected.
- Mostrar `entry`, `exit` o `rejected`.
- Mostrar foto, nombre, matricula, tipo, carrera, placa si aplica.
- Mostrar motivo de rechazo.
- Manejar WebSocket con cierre y reconexion.
- Evitar duplicados por debounce/estado de procesamiento.
- Mantener UX movil.

### 8.10 Access scan

La API debe:

- Exponer `POST /api/v1/access/scan`.
- Derivar admin desde sesion, no desde payload cliente.
- Validar schema.
- Pasar payload seguro a `access_scan_v1`.
- Registrar evento `access.scan`.
- Responder con contrato `ScannerResultPayload`.
- Mantener codigos estables de rechazo.

La base debe:

- Resolver credencial.
- Validar persona/vehiculo/visitante.
- Decidir entrada/salida.
- Evitar dos accesos abiertos por persona o vehiculo.
- Actualizar `lastUsedAt` y usos.
- Registrar `registros_acceso`.
- Registrar `access_scan_events`.
- Crear o actualizar asistencia si aplica.
- Mantener cadena hash.

### 8.11 Registros de acceso

El sistema debe:

- Listar registros del dia.
- Filtrar por texto, fecha, tipo, modo y estado.
- Paginar server-side.
- Mostrar admin de entrada/salida.
- Distinguir peatonal, vehicular, visitante y manual.
- Distinguir credencial personal, temporal, vehicular, Hot-QR y override.
- Marcar salida automatica.
- Exponer resumen diario.
- Verificar integridad con `verify_access_chain_v1`.

### 8.12 Asistencias

El sistema debe:

- Generar asistencias potenciales para tipos que generen asistencia.
- Relacionar horarios, materias, aula y fecha.
- Calcular minutos asistidos, total y porcentaje.
- Manejar estados `in_progress`, `confirmed`, `partial`, `unverified`,
  `assumed`.
- Listar asistencias del dia y por persona.
- Permitir ajuste manual auditado.
- Administrar materias y horarios con paginacion/filtros.
- Cerrar/actualizar asistencias al salir o por worker.

### 8.13 QR temporal diario

El sistema debe:

- Permitir QR temporal por falta de credencial.
- Capturar credencial faltante, motivo, detalle, fecha operativa y vigencia.
- Limitar uno activo por persona y dia operativo.
- Permitir solicitud desde portal cuando el tipo lo permita.
- Permitir emision por admin.
- Soportar QR opaco y QR dinamico firmado.
- Revocar y expirar.
- Mostrar historial.
- Marcar acceso como excepcion cuando corresponda.
- Auditar generacion, uso y revocacion.

### 8.14 Hot-QR

El sistema debe:

- Crear credencial temporal de visitante.
- Capturar visitante, motivo, max uses y vigencia.
- Mostrar QR solo al emitir.
- Permitir descargar/compartir.
- Listar con paginacion.
- Revocar.
- Expirar por worker.
- Registrar acceso de visitante.

### 8.15 Vehiculos y permisos vehiculares

El sistema debe:

- Registrar vehiculos con placa unica, marca, modelo, color, estado y notas.
- Asociar vehiculo a persona propietaria.
- Crear permiso persona + vehiculo.
- Validar `person_types.canHaveVehiclePermit`.
- Validar estado activo de persona y vehiculo.
- Rotar/revocar QR vehicular.
- Emitir QR vehicular dinamico firmado.
- Registrar acceso vehicular con `vehicle_id`, `vehicle_permit_id` y placa.
- Filtrar vehiculos y permisos por persona, placa, texto y estado.

### 8.16 Administradores

El sistema debe:

- Listar administradores.
- Crear admin.
- Editar datos basicos.
- Habilitar/deshabilitar.
- Resetear password.
- Forzar cambio de password.
- Consultar sesiones.
- Revocar sesiones.
- Consultar auditoria.
- Proteger acciones solo para `super_admin`.
- Proteger ultimo superadmin.

### 8.17 Configuracion operativa

El sistema debe:

- Exponer `GET/PATCH /api/v1/config/operational`.
- Exponer `GET/PATCH /api/v1/config/signed-qr`.
- Configurar retry, delay, camara, entrada manual, sonidos y auto-exit.
- Configurar QR dinamico: enabled, ttl, tolerancia, compatibilidad opaca y
  device binding.
- Guardar cambios en `operational_config`.
- Auditar cambios.
- Usar UI con controles, no JSON crudo.

### 8.18 Archivos y storage

El sistema debe:

- Guardar metadata en `stored_files`.
- Soportar storage local, S3 y R2.
- Servir archivos privados solo con sesion valida.
- Generar URLs firmadas para S3/R2.
- Validar fotos.
- No exponer rutas internas.

### 8.19 Auditoria

El sistema debe:

- Registrar actor admin o cuenta de usuario.
- Registrar accion, entidad, id, IP, user-agent y metadata.
- Ser best-effort para no romper una accion ya completada.
- No registrar secretos.
- Mostrar auditoria filtrable.
- Mostrar metadata en modal legible.
- Ser extensible para identidad digital y overrides.

### 8.20 Eventos live

El sistema debe:

- Exponer WebSocket `/api/v1/events`.
- Autenticar sesion admin antes del upgrade.
- Enviar eventos por topic:
  - `access.scan`.
  - `access.table`.
  - `attendance.table`.
  - `hot-qr.table`.
  - `credentials.table`.
  - `temporary-daily-qr.table`.
  - `vehicles.table`.
  - `vehicle-permits.table`.
  - `admins.table`.
  - `admin-sessions.table`.
  - `audit.table`.
  - `config.table`.
- Coalescer eventos de tabla con `EVENT_COALESCE_MS`.
- Evitar fuga de PII innecesaria.

### 8.21 Worker operativo

El worker debe:

- Ejecutar salidas automaticas.
- Expirar Hot-QR.
- Expirar QR temporal.
- Expirar QR vehicular.
- Expirar QR personal.
- Revocar sesiones vencidas.
- Limpiar `qr_jti_consumptions` expirados.
- Expirar claves QR rotadas.
- Limpiar challenges de dispositivo usados/vencidos.
- Evitar ciclos solapados.
- Exponer metricas internas de ciclo.

### 8.22 Performance

El sistema debe:

- Mantener arnes de performance en `apps/api/src/performance`.
- Medir HTTP, SQL, worker y reportes.
- Versionar evidencia compacta en `docs/performance`.
- Tratar `access_scan_v1`, registros, asistencias, portal QR y worker como hot
  paths.
- Usar pool Postgres configurable.
- Mantener indices para busquedas y cadena hash.
- Ejecutar reparacion de cadena solo en benchmark/verificacion, no como rutina
  productiva.

## 9. Features futuras

### 9.1 Gates y puertas de acceso

Objetivo:

Registrar por que puerta, caseta, pluma, torniquete o punto fisico ocurrio cada
scan.

Requisitos:

- Crear `gates`.
- Crear `gate_scanners`.
- Agregar `gate_id` a registros, eventos y consumos JTI.
- Resolver `scannerId` contra scanner registrado.
- Validar estado de gate.
- Validar direccion permitida.
- Validar compatibilidad de modo:
  - peatonal.
  - vehicular.
  - visitantes.
  - proveedores/eventos futuros.
- Reportar accesos por gate.
- En fase futura, asignar guardias a gates.

No debe:

- Confiar permanentemente en `scannerId` libre del frontend.
- Mezclar reglas de puerta complejas en la primera fase.
- Romper el hot path del scan.

### 9.2 Gestion vehicular avanzada

Objetivo:

Evolucionar de vehiculo + permiso hacia gestion completa de dominio vehicular.

Requisitos futuros:

- `vehicle_type`: car, motorcycle, bicycle, electric_scooter, truck, official,
  university_transport, visitor, other.
- `approval_status`: pending, approved, rejected.
- Aprobacion/rechazo con actor, fecha y motivo.
- Vehiculos visitantes temporales.
- Permisos por tipo: standard, temporary, official, visitor, provider, event,
  emergency.
- Scope por gate, dias, horarios, zona de estacionamiento y entradas maximas.
- Relacion con gates vehiculares.
- Reportes por placa, persona, gate y estado.

Principio:

El QR personal no autoriza implicitamente vehiculo. El acceso vehicular requiere
permiso vehicular y QR vehicular, salvo override manual auditado.

### 9.3 Portal de usuario completo

Requisitos futuros:

- Pulir `/portal/qr` como experiencia movil primaria.
- QR grande y pantalla completa.
- Countdown claro.
- Estados refrescando, expirado, error, offline.
- Mostrar QR temporal activo.
- Solicitar QR temporal con motivo.
- Historial de QR temporales.
- Historial de accesos y asistencias con filtros.
- Gestion completa de dispositivos.
- Avisos claros de sesion expirada y password obligatorio.

### 9.4 Portal de administracion avanzado

Requisitos futuros:

- Roles granulares.
- Permisos por modulo.
- Politicas de sesiones.
- Auditoria avanzada.
- UI para acciones sensibles.
- Motivo obligatorio en overrides.
- Reportes de administracion.

Fase inicial mantiene solo:

- `admin`.
- `super_admin`.

### 9.5 Identidad digital universitaria

Objetivo:

Agregar una capa social/institucional sobre `personas` sin afectar la decision
de acceso.

Requisitos futuros:

- `digital_profiles`.
- `username_history`.
- `reserved_usernames`.
- Perfil universitario.
- `@usuario` interno.
- Perfil publico interno.
- Privacidad por defecto.
- Vista social segura durante el scan.
- Marcos de perfil.
- Colores de nombre.
- Insignias.
- Hitos/logros.
- Recompensas.
- Eventos del campus.
- Auditoria de identidad.

Regla critica:

La identidad social nunca decide si alguien entra o sale. Solo presenta datos
seguros despues de validar la credencial.

### 9.6 Recompensas y progresion

Requisitos futuros:

- Catalogo de recompensas.
- Recompensas equipables.
- Validar propiedad antes de equipar.
- Defaults iniciales.
- Tiers.
- Otorgamiento por eventos, roles o hitos auditables.
- Revocacion auditada.
- UI portal y UI admin.

### 9.7 Eventos del campus

Requisitos futuros:

- Crear eventos.
- Registrar participantes.
- Asociar recompensas o insignias.
- Administrar asistencia a eventos.
- Mantener privacidad.
- Auditar cambios.

### 9.8 Superadmin y control manual institucional

Requisitos futuros:

- Forzar cambio de username.
- Ocultar perfil.
- Revocar marco/color/badge.
- Otorgar recompensa manual.
- Corregir participacion en evento.
- Registrar motivo obligatorio.
- Guardar old/new en auditoria.

### 9.9 2FA por correo institucional

Requisitos futuros:

- Desafio OTP por correo.
- Politicas por accion sensible.
- TTL corto.
- Reintentos limitados.
- Auditoria.
- No bloquear operacion de scanner si no es necesario.

### 9.10 Reportes avanzados

Requisitos futuros:

- Accesos por gate.
- Accesos por modo.
- Uso de QR temporal.
- Uso de Hot-QR.
- Replays detectados.
- Entradas vehiculares por placa/persona.
- Asistencia por materia, carrera y periodo.
- Salidas automaticas.
- Administradores con mayor actividad.
- Eventos de seguridad.
- Integridad de cadena.

## 10. Requisitos no funcionales

### 10.1 Seguridad

- Cookies `httpOnly`.
- No secretos en `localStorage`.
- No hashes en respuestas API.
- No clave privada QR en frontend.
- Rate limit en login.
- CORS por lista de origenes.
- WebSocket autenticado.
- Fotos protegidas por sesion.
- Tokens QR hasheados si son opacos.
- JWT efimeros con `jti`.
- Anti-replay atomico.
- Auditoria para mutaciones.
- Proteccion de ultimo superadmin.
- Sanitizacion de metadata.

### 10.2 Privacidad

- Mostrar solo datos necesarios por actor.
- El scanner puede ver foto/nombre/matricula/carrera/placa por necesidad
  operativa.
- El portal usuario solo ve sus datos.
- Perfiles publicos futuros deben respetar controles de privacidad.
- Eventos WebSocket no deben transmitir datos personales innecesarios.

### 10.3 Rendimiento

- Scan debe ser rapido y tolerar concurrencia.
- Paginacion obligatoria en tablas grandes.
- Busqueda server-side.
- Worker sin solapamientos.
- Pool configurable.
- Indices para hot paths.
- Pruebas de carga sobre datasets small/medium/large.

### 10.4 Disponibilidad operativa

- API, web y worker deben correr como procesos separados.
- Worker obligatorio en produccion.
- Modo dev debe arrancar con `.env.example`.
- Integraciones Postgres deben saltarse explicitamente si no hay DB en tests.

### 10.5 Mantenibilidad

- Modulos por dominio.
- Contratos compartidos en `packages/shared`.
- SQL manual versionado para reglas atomicas.
- Evitar `Record<string, unknown>` en wire shapes principales.
- Documentar decisiones por feature.

### 10.6 UX

- GUI admin legacy-identica.
- Scanner mobile-friendly.
- Portal usuario mobile-first.
- Tablas densas en desktop, cards en movil.
- Errores claros por codigo.
- No landing page como pantalla principal.

## 11. Contratos principales

### 11.1 Scanner result

Debe respetar el contrato compartido:

```txt
accepted
action
reasonCode
registroId
personId
matricula
fullName
personType
career
vehiclePlate
profilePhotoUrl
credentialType
accessMode
timestamp
```

### 11.2 Paginacion

Las listas grandes deben responder:

```txt
rows
total
page
pageSize
summary?
```

### 11.3 Error API

Los errores deben mantener:

```txt
error.code
error.message
error.details?
```

Codigos importantes:

- `VALIDATION_ERROR`.
- `UNAUTHORIZED`.
- `FORBIDDEN`.
- `NOT_FOUND`.
- `CONFLICT`.
- `INVALID_JSON`.
- `SIGNED_QR_DISABLED`.
- `JTI_ALREADY_CONSUMED`.
- `QR_EXPIRED`.
- `ACCESS_DENIED`.
- `INTERNAL_ERROR`.

## 12. Roadmap recomendado

### Fase 0: Cierre v2 verificable

Objetivo:

Confirmar que la base actual funciona de punta a punta.

Incluye:

- `bun run check`.
- `bun test`.
- Verificar migraciones.
- Smoke admin.
- Smoke scanner.
- Smoke portal.
- Verificar worker.
- Verificar QR personal, temporal y vehicular firmado.
- Verificar replay `jti`.
- Verificar fotos.
- Verificar WebSocket autenticado.

Criterio:

La version actual es demostrable sin tocar SQL manualmente.

### Fase 1: Pulido operativo legacy

Objetivo:

Cerrar paridad visual y usabilidad diaria.

Incluye:

- Login admin visual.
- Scanner con todos los estados.
- Tablas como cards en movil.
- Formularios compactos.
- Configuracion sin JSON crudo.
- Errores por codigo traducidos a texto operativo.
- Confirmaciones para acciones sensibles.

Criterio:

Un usuario de v1 reconoce el flujo y puede operar v2 sin capacitacion tecnica.

### Fase 2: Reportes y observabilidad institucional

Objetivo:

Convertir registros en informacion accionable.

Incluye:

- Resumen diario.
- Reportes por tipo, carrera, modo, credencial y estado.
- Reporte de asistencias.
- Reporte de replays.
- Reporte de QR temporales/Hot-QR.
- Panel de worker/eventos.
- Export CSV.

Criterio:

Direccion puede responder preguntas operativas sin consultar la base.

### Fase 3: Gates y contexto fisico

Objetivo:

Asociar cada scan a una puerta fisica confiable.

Incluye:

- `gates`.
- `gate_scanners`.
- `gate_id` en registros/eventos/consumos.
- Resolucion de scanner.
- Reportes por gate.
- Reglas simples por gate.

Criterio:

Cada acceso nuevo puede responder por donde ocurrio.

### Fase 4: Vehiculos avanzados

Objetivo:

Completar dominio vehicular institucional.

Incluye:

- Tipo de vehiculo.
- Aprobacion.
- Permisos temporales/especiales.
- Visitantes vehiculares.
- Scope por gate/horario.
- Reportes vehiculares.

Criterio:

El acceso vehicular se valida como persona + vehiculo + permiso + gate.

### Fase 5: Identidad digital

Objetivo:

Agregar perfil universitario y recompensas sin afectar seguridad de acceso.

Incluye:

- Perfil.
- Username.
- Vista social scanner.
- Perfil publico interno.
- Recompensas.
- Eventos.
- Superadmin de identidad.

Criterio:

La capa social mejora reconocimiento y pertenencia, pero no decide acceso.

### Fase 6: Seguridad avanzada

Objetivo:

Elevar protecciones para ambientes productivos maduros.

Incluye:

- 2FA por correo.
- Politicas por riesgo.
- Device binding obligatorio por configuracion.
- Auditoria reforzada.
- Rotacion operacional de claves.
- Alertas por abuso/replay.

Criterio:

Acciones sensibles requieren validacion adicional y todo abuso queda detectable.

## 13. Metricas de exito

### Operacion

- Tiempo mediano de scan aceptado.
- Tiempo p95 de scan.
- Porcentaje de scans rechazados por motivo.
- Replays detectados.
- Salidas automaticas por dia.
- Accesos manuales vs QR.

### Seguridad

- Replays bloqueados.
- Logins bloqueados por rate limit.
- Sesiones revocadas.
- Eventos sin actor auditado.
- Mutaciones con motivo cuando aplica.

### Usabilidad

- Tiempo para crear persona + QR.
- Tiempo para encontrar persona.
- Tiempo para emitir Hot-QR.
- Errores de operador por formulario.
- Uso movil del portal.

### Administracion

- Administradores activos.
- Sesiones activas.
- Cambios de config.
- Revocaciones de QR.
- Ajustes manuales de asistencia.

### Futuro identidad

- Usuarios con perfil.
- Usuarios con username.
- Recompensas otorgadas.
- Eventos registrados.
- Perfiles ocultos/moderados.

## 14. Riesgos

### 14.1 Romper el hot path de scan

Mitigacion:

- Mantener SQL atomico.
- Agregar gates/vehiculos avanzados por fases.
- Probar con `bun test` y arnes performance.

### 14.2 Reintroducir QR inseguro

Mitigacion:

- Matricula solo como dato visual.
- Token opaco hasheado.
- QR firmado con expiracion y `jti`.

### 14.3 UI demasiado distinta al legacy

Mitigacion:

- Mantener header, tabs, formularios, tablas y paleta legacy.
- Evitar dashboard/landing generico.

### 14.4 Auditoria incompleta

Mitigacion:

- Usar `recordAudit` en mutaciones.
- Motivo obligatorio para overrides.
- No permitir acciones sensibles anonimas.

### 14.5 Crecimiento de datos

Mitigacion:

- Paginacion.
- Indices.
- Worker de limpieza.
- Reportes agregados.

### 14.6 Privacidad en identidad digital

Mitigacion:

- Privacidad por defecto.
- Separar identidad institucional de social.
- Scanner muestra solo datos necesarios.

## 15. Dependencias tecnicas

- PostgreSQL disponible y migrado.
- Worker desplegado.
- Variables de entorno productivas:
  - `DATABASE_URL`.
  - `SESSION_SECRET`.
  - `TOKEN_SIGNING_SECRET`.
  - `WEB_ORIGINS`.
  - `OPERATING_TIMEZONE`.
  - `RATE_LIMIT_DRIVER`.
  - `STORAGE_DRIVER`.
  - `QR_SIGNING_PRIVATE_KEY`.
  - `QR_SIGNING_PUBLIC_KEY`.
  - `QR_SIGNING_KID`.
- Storage local/S3/R2 configurado.
- Browser compatible con camara y WebCrypto.
- HTTPS en produccion para cookies/device binding/camara.

## 16. Fuera de alcance inmediato

- SSO institucional.
- Reconocimiento facial.
- Control fisico directo de torniquetes/plumas.
- App movil nativa.
- Workflows formales de tickets.
- RBAC granular completo en la primera fase.
- Cupo de estacionamiento en fase inicial de vehiculos.
- Offline scanner con cache de autorizaciones.

Estos puntos pueden evaluarse despues de cerrar gates, reportes y operacion
productiva.

## 17. Definicion de hecho global

Una entrega de esta plataforma se considera lista cuando:

- `bun run check` pasa.
- `bun test` pasa.
- Migraciones aplican en una base limpia.
- Admin puede iniciar sesion.
- Usuario portal puede iniciar sesion.
- Scanner procesa QR personal dinamico.
- Scanner procesa QR temporal dinamico.
- Scanner procesa QR vehicular dinamico.
- Replay de `jti` se rechaza.
- Token opaco funciona solo si config lo permite.
- Foto se muestra con permisos correctos.
- Registros y asistencias paginan.
- Worker ejecuta ciclo sin error.
- Auditoria registra mutaciones sensibles.
- No hay secretos en respuestas.
- UI admin conserva experiencia legacy.
- Portal usuario es usable en movil.
- Documentacion de env y operacion esta actualizada.

## 18. Fuentes internas analizadas

Codigo:

- `README.md`.
- `apps/api/src/app.ts`.
- `apps/api/src/server.ts`.
- `apps/api/src/worker.ts`.
- `apps/api/src/db/schema.ts`.
- `apps/api/src/modules/**`.
- `apps/api/drizzle/migrations/*.sql`.
- `apps/web/src/routes/**`.
- `apps/web/src/lib/components/**`.
- `apps/web/src/lib/portal/**`.
- `packages/shared/src/index.ts`.

Documentacion:

- `docs/PLAN_MIGRACION_STACK_PATRON.md`.
- `docs/PLAN_STACK_TECNOLOGICO_NUEVO.md`.
- `docs/PLAN_FRONTEND_V2.md`.
- `docs/PLAN_GUI_FRONTEND_FALTANTE_V2.md`.
- `docs/PLAN_INTEGRADOR_STACK_FEATS_BUGS.md`.
- `docs/PLAN_IDENTIDAD_DIGITAL_INTEGRADOR.md`.
- `docs/FEAT_*.md`.
- `docs/performance/PLAN_OPTIMIZACION_INTEGRADOR.md`.

Legacy recuperado desde Git:

- `api/procesar_qr.js`.
- `public/admin.js`.
- `public/client.js`.
- `public/login.html`.
- `public/index.html`.
- `public/admin.html`.
- `public/style.css`.

