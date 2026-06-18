# Feature futura: Portal de administracion de administradores

## Objetivo

Crear una interfaz administrativa para gestionar administradores del sistema desde GUI, reemplazando gradualmente la dependencia de scripts manuales para crear, activar, desactivar o administrar cuentas administrativas.

Esta feature no forma parte del flujo inicial del QR temporal diario. El flujo inicial ya puede funcionar con administradores existentes creados por script.

## Estado actual

Actualmente el sistema cuenta con autenticacion de administrador, pero la gestion de administradores no existe como panel visual.

El modelo actual es:

```txt
admin creado por script
-> admin inicia sesion
-> admin usa funciones del sistema
```

Esto es suficiente para la primera etapa de features operativas como:

```txt
Admin autenticado existente
+ usuario activo
+ motivo obligatorio
+ QR temporal diario
+ entrada/salida/reingreso
+ expiracion automatica
+ revocacion por admin
+ auditoria basica
```

Pero no es suficiente para una operacion institucional madura, donde se necesita controlar quien administra el sistema, que permisos tiene, cuando se activo, cuando se desactivo y que acciones realizo.

## Problema que resuelve

Sin un portal de administracion de administradores:

- Crear un admin depende de ejecutar scripts.
- No hay flujo visual para activar o desactivar administradores.
- No hay gestion de roles o permisos desde UI.
- No hay visibilidad clara de cuentas administrativas activas.
- Es mas dificil auditar cambios de permisos.
- Un cambio operativo menor requiere acceso tecnico al servidor o repositorio.

El portal busca separar la operacion diaria de la intervencion tecnica.

## Nombre recomendado

```txt
Portal de administracion de administradores
```

Tambien puede aparecer como:

```txt
Gestion de administradores
Administradores del sistema
Control de operadores
Gestion de usuarios administrativos
```

No debe confundirse con:

- Panel administrativo operativo.
- Portal de usuario.
- Modulo de QR temporal.

## Alcance inicial recomendado

La primera version de esta feature futura debe permitir:

- Ver lista de administradores.
- Crear administrador.
- Editar nombre y usuario.
- Activar administrador.
- Desactivar administrador.
- Cambiar o resetear password.
- Ver ultimo acceso.
- Ver estado de la cuenta.
- Ver acciones administrativas basicas.
- Registrar auditoria de cambios.

No debe iniciar con un sistema complejo de roles si todavia no hay necesidad real. Primero debe resolver gestion basica y seguridad.

## Alcance futuro avanzado

En una segunda etapa puede incluir:

- Roles.
- Permisos granulares.
- Politicas de password.
- Expiracion de cuentas.
- Invitaciones por email.
- 2FA.
- Revision de sesiones activas.
- Revocacion de sesiones.
- Historial detallado de acciones.
- Aprobaciones para acciones sensibles.

## Fuera de alcance inicial

No se recomienda incluir al inicio:

- Jerarquias complejas de administradores.
- Aprobaciones multinivel.
- Permisos por pantalla altamente detallados.
- Configuracion visual completa de RBAC.
- Integracion con SSO institucional.
- Recuperacion de password por email si no existe infraestructura de correo.

Estas capacidades pueden agregarse despues de estabilizar la gestion basica.

## Actores

### Super administrador

Administrador con capacidad para gestionar otros administradores.

Puede:

- Crear administradores.
- Desactivar administradores.
- Resetear password.
- Asignar rol si existe el modulo de roles.
- Revocar sesiones.
- Consultar auditoria.

### Administrador operativo

Administrador que usa el sistema para operaciones diarias.

Puede:

- Escanear QR.
- Registrar personas.
- Generar QR temporales si el sistema lo permite.
- Consultar registros.

No necesariamente puede crear o modificar otros administradores.

### Sistema

Debe:

- Validar permisos.
- Registrar auditoria.
- Proteger acciones sensibles.
- Evitar que el ultimo super administrador se desactive accidentalmente.
- Mantener sesiones seguras.

## Modelo de permisos recomendado

### Fase inicial

Modelo simple:

```txt
admin
super_admin
```

Reglas:

- `admin`: opera el sistema.
- `super_admin`: administra cuentas administrativas.

Esto evita introducir RBAC completo antes de necesitarlo.

### Fase futura

Modelo granular:

```txt
admin.manage
admin.create
admin.update
admin.disable
admin.reset_password
admin.sessions.revoke
admin.audit.view
```

Este modelo debe agregarse solo cuando ya exista una necesidad real de separar responsabilidades.

## Modelo de datos sugerido

Tabla existente o futura:

```txt
administradores
```

Campos sugeridos:

```txt
id
usuario
nombre
password_hash
estado
role
ultimo_acceso
created_at
updated_at
created_by_admin_id
updated_by_admin_id
disabled_at
disabled_by_admin_id
```

Estados:

```txt
activo
inactivo
suspendido
pendiente
```

## Sesiones administrativas

Tabla sugerida:

```txt
admin_sessions
```

Campos:

```txt
id
admin_id
session_hash
created_at
expires_at
revoked_at
ip_address
user_agent
```

Uso:

- Mantener sesiones con cookies `httpOnly`.
- Permitir revocar sesiones.
- Auditar accesos.
- Evitar depender de token plano guardado en la tabla de administradores.

## Auditoria

Toda accion sensible debe quedar registrada.

Eventos sugeridos:

```txt
admin.created
admin.updated
admin.disabled
admin.enabled
admin.password_reset
admin.role_changed
admin.session_revoked
admin.login_success
admin.login_failed
```

Campos:

```txt
event_type
actor_admin_id
target_admin_id
ip_address
user_agent
created_at
metadata
```

## Funciones principales

### Listar administradores

Debe mostrar:

- Nombre.
- Usuario.
- Rol.
- Estado.
- Ultimo acceso.
- Fecha de creacion.

### Crear administrador

Debe pedir:

- Nombre.
- Usuario.
- Password temporal o generado.
- Rol inicial.

Reglas:

- Usuario unico.
- Password segura.
- Creacion solo por `super_admin`.
- Auditoria obligatoria.

### Editar administrador

Debe permitir:

- Cambiar nombre.
- Cambiar usuario si no colisiona.
- Cambiar rol si existe permiso.
- Activar/desactivar.

No debe permitir:

- Que un admin se quite a si mismo el unico rol de super administrador si es el ultimo.
- Desactivar al ultimo super administrador activo.

### Resetear password

Debe:

- Requerir confirmacion.
- Registrar auditoria.
- Invalidar sesiones activas si aplica.
- No mostrar password actual.

### Revocar sesiones

Debe permitir:

- Revocar todas las sesiones de un administrador.
- Revocar una sesion especifica si se muestran sesiones activas.

## API sugerida

```txt
GET    /api/v1/admins
POST   /api/v1/admins
GET    /api/v1/admins/:id
PATCH  /api/v1/admins/:id
POST   /api/v1/admins/:id/disable
POST   /api/v1/admins/:id/enable
POST   /api/v1/admins/:id/reset-password
GET    /api/v1/admins/:id/sessions
POST   /api/v1/admins/:id/sessions/revoke
GET    /api/v1/admins/:id/audit
```

## Estructura backend sugerida

```txt
backend/src/modules/admin-management/
  adminManagement.routes.ts
  adminManagement.schemas.ts
  adminManagement.service.ts
  adminManagement.repository.ts
  adminManagement.permissions.ts
  adminManagement.test.ts
```

## Estructura frontend sugerida

```txt
frontend/src/routes/admin/administradores/
  +page.svelte

frontend/src/lib/admin-management/
  AdminList.svelte
  AdminForm.svelte
  AdminStatusBadge.svelte
  AdminSessionsPanel.svelte
  AdminAuditTable.svelte
```

## Relacion con QR temporal diario

El QR temporal diario no debe depender de esta feature para su version inicial.

Version inicial del QR temporal:

```txt
admin autenticado existente
-> genera QR temporal
-> sistema registra created_by_admin_id
```

Version futura con portal de administradores:

```txt
admin autenticado
-> sistema valida permiso temporary_qr.create
-> genera QR temporal
-> auditoria registra accion y permisos
```

Esto permite que el QR temporal avance sin esperar a que exista gestion visual de administradores.

## Seguridad

Reglas obligatorias:

- Solo un `super_admin` puede crear otros administradores.
- No permitir desactivar al ultimo `super_admin` activo.
- No guardar passwords en texto plano.
- Usar `Bun.password` para hash.
- Usar cookies `httpOnly` para sesiones.
- Auditar acciones sensibles.
- Confirmar acciones destructivas.
- Invalidar sesiones si cambia password o se desactiva cuenta.
- No exponer hashes ni tokens en respuestas API.

## UX recomendada

Pantalla principal:

```txt
[Administradores]
[Crear administrador]

Tabla:
Nombre | Usuario | Rol | Estado | Ultimo acceso | Acciones
```

Acciones:

```txt
Editar
Desactivar
Resetear password
Ver sesiones
Ver auditoria
```

Estados visuales:

```txt
Activo
Inactivo
Suspendido
Pendiente
```

## Criterios de aceptacion

La feature esta lista cuando:

- Un `super_admin` puede ver administradores.
- Un `super_admin` puede crear administrador.
- Un `super_admin` puede desactivar administrador.
- Un `super_admin` puede reactivar administrador.
- Un `super_admin` puede resetear password.
- El sistema impide desactivar al ultimo `super_admin`.
- Las acciones quedan auditadas.
- Las sesiones se mantienen con cookies `httpOnly`.
- Los passwords se guardan hasheados.
- Las respuestas API no exponen secretos.
- El panel administrativo operativo puede seguir funcionando sin cambios.

## Riesgos

- Crear una gestion de roles demasiado compleja antes de necesitarla.
- Permitir que cualquier admin cree otros admins.
- Desactivar accidentalmente al ultimo super administrador.
- No revocar sesiones tras desactivar una cuenta.
- Exponer datos sensibles de sesiones.
- Mezclar esta feature con el portal de usuario.
- Bloquear features operativas esperando esta GUI.

## Decision recomendada

Implementar esta feature como fase futura independiente.

La version inicial debe ser simple:

```txt
super_admin
+ crear admin
+ editar admin
+ activar/desactivar
+ resetear password
+ auditoria basica
+ sesiones seguras
```

La version avanzada puede agregar:

```txt
roles granulares
permisos por modulo
revocacion detallada de sesiones
2FA
SSO institucional
aprobaciones para acciones sensibles
```

Esta feature debe mejorar la operacion administrativa sin bloquear features actuales que ya pueden funcionar con administradores existentes creados por script.
