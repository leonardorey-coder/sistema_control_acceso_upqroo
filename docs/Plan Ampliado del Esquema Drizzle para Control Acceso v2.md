# Plan Ampliado del Esquema Drizzle para Control Acceso v2

## Resumen y Razonamiento

El ORM debe resolver tipado, relaciones, CRUD, repositorios y migraciones normales, pero no debe absorber reglas que hoy PostgreSQL ya ejecuta mejor con atomicidad: entrada/salida, salida automática, hash de registros y asistencia híbrida. Por eso el diseño queda dividido en dos capas: **Drizzle para el modelo relacional principal** y **SQL manual versionado para funciones, procedimientos, vistas y reportes pesados**.

Decisiones bloqueadas:
- Stack: `SvelteKit + TypeScript + Tailwind`, `Bun + TypeScript + Hono`, `PostgreSQL + Drizzle ORM`.
- Migración: preservar todo el historial de acceso/asistencia.
- QR: usar QR dinámico/revocable desde el schema inicial, con compatibilidad temporal para matrícula/QR estático.
- Identidad: agregar `personas.id` interno y conservar `matricula` única.
- Convención: compatibilidad mixta; no renombrar tablas existentes sin necesidad.

## Esquema Drizzle Objetivo

- **Core institucional:** `personas`, `carreras`, `materias`, `horarios_estudiante`, `administradores`.
  - `personas` agrega `id uuid`, `profile_file_id`, `estado` ampliado y mantiene `matricula`, `curp`, `tipo_persona`.
  - `tipo_persona` debe incluir `estudiante`, `docente`, `administrativo`, `invitado`, `aspirante`, `otro`.
  - `foto_perfil BYTEA` queda como campo legacy; nuevas fotos van por `stored_files`.

- **Autenticación y permisos:** `user_accounts`, `admin_sessions`, `user_sessions`, `roles`, `permissions`, `role_permissions`, `admin_roles`, `user_roles`.
  - Las sesiones admin y usuario deben estar separadas para evitar mezclar portal de usuario con panel administrativo.
  - Guardar hash de sesión, expiración, revocación, IP/user-agent y último uso.
  - `administradores.token` queda deprecado y solo se mantiene durante transición.

- **QR y credenciales:** `qr_tokens`, `temporary_access_credentials`, `hot_qr_codes`.
  - `qr_tokens`: QR personal firmado/revocable con `token_hash`, `jti`, `person_id`, `issued_at`, `expires_at`, `status`, `last_used_at`.
  - `temporary_access_credentials`: QR temporal diario y códigos excepcionales con `missing_credential_type`, `reason_code`, `reason_text`, `operational_date`, `valid_until`, `scope`, aprobador/revocador y límites.
  - `hot_qr_codes` se mantiene por compatibilidad, pero debe evolucionar a hash de código en lugar de depender de código plano persistente.

- **Acceso y auditoría:** `registros_acceso`, `access_scan_events`, `audit_log`.
  - `registros_acceso` sigue representando una estancia: entrada, salida, admins, hash, salida automática.
  - Agregar `person_id`, `credential_type`, `credential_origin`, `qr_token_id`, `temporary_credential_id`, `is_exception_access`, `scanned_token_jti`.
  - `access_scan_events` guarda cada intento de escaneo, exitoso o rechazado, sin contaminar `registros_acceso`.
  - `audit_log` registra acciones sensibles: login, creación/revocación/uso de QR, cambios de persona, permisos y accesos excepcionales.

- **Asistencias y reportes:** `asistencias_potenciales`, vistas SQL y agregados.
  - Mantener estados `confirmed`, `in_progress`, `assumed`, `partial`, `unverified`.
  - Agregar índices por `person_id`, `fecha_clase`, `estado`, `id_registro`.
  - Reportes BI-like deben usar vistas/materializaciones SQL cuando sean pesados.

- **Storage:** `stored_files`.
  - Metadatos: driver, bucket, key, mime, tamaño, checksum, visibilidad, dueño lógico.
  - El negocio solo usa `StorageService`; no importa SDK de S3/R2/filesystem desde módulos de dominio.

## Reglas de Integridad y Seguridad

- Usar `timestamptz` para eventos nuevos; `date` para `operational_date`; `time` para horarios de clase.
- Evitar `DATE(columna)` en consultas críticas; usar rangos indexables.
- Un solo registro abierto por persona: índice parcial sobre `registros_acceso(person_id)` cuando `hora_salida IS NULL`.
- Un solo QR temporal diario activo/usado por persona y fecha operativa.
- Nunca guardar token QR plano; guardar `token_hash` y mostrar el token solo al crearlo/refrescarlo.
- No borrar personas/admins usados por historial; usar `estado` o soft-delete.
- Las tablas de auditoría deben ser append-only desde la aplicación.
- Las funciones SQL deben ejecutarse dentro de transacciones controladas desde repositorios/servicios.

## Migración Segura

1. Sincronizar primero el branch local, porque está detrás de `origin/control-acceso-v2`.
2. Crear schema Drizzle equivalente al estado actual sin cambiar comportamiento.
3. Agregar columnas nuevas de forma aditiva: `personas.id`, `registros_acceso.person_id`, campos de credencial y referencias.
4. Backfill de `person_id` desde `matricula`; validar conteos y FKs.
5. Crear sesiones DB y migrar login a cookies `httpOnly`, manteniendo token legacy solo durante coexistencia.
6. Crear `qr_tokens`, `temporary_access_credentials`, `access_scan_events`, `audit_log`, `stored_files`.
7. Adaptar procedimientos SQL para devolver/usar `person_id` sin romper compatibilidad con `matricula`.
8. Migrar endpoints por módulo: auth, people, access, hot-qr, attendance, reports, user portal.
9. Migrar fotos de `BYTEA` a storage con lectura dual temporal.
10. Retirar campos legacy solo después de pruebas, respaldo y validación de producción.

## Tests y Aceptación

- Migración: conteos antes/después, `person_id` poblado, historial preservado, FKs válidas.
- Auth: login admin, login usuario, cookie `httpOnly`, revocación de sesión, separación de permisos.
- QR: QR estático legacy, QR dinámico, QR revocado, expirado, Hot-QR, QR temporal diario, reingreso.
- Acceso: entrada, salida, salida automática, rechazo por persona inactiva, rechazo por QR vencido.
- Asistencia: estados `confirmed`, `partial`, `assumed`, `unverified`; cálculo con salida manual y automática.
- Seguridad: no token plano en DB, límite de QR temporales, auditoría de creación/uso/revocación.
- Reportes: filtros por fecha, persona, carrera, credencial temporal, excepción y asistencia.
- Performance: `EXPLAIN ANALYZE` en consultas de día actual, historial, asistencia y reportes.

## Supuestos

- No se modela multi-campus todavía; queda preparado mediante configuración futura.
- La fecha operativa por defecto cierra a `23:59:59` hora local, configurable después.
- El frontend viejo puede coexistir mientras el backend nuevo expone `/api/v1`.
- Drizzle no sustituye las funciones PostgreSQL existentes; las versiona alrededor del schema.
