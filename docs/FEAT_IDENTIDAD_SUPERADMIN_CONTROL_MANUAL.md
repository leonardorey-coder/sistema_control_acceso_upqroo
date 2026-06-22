# Feature: superadmin y control manual institucional

## Objetivo

Dar al superadmin capacidad de corregir casos especiales de identidad, acceso y
perfil sin romper trazabilidad.

Esta feature complementa el portal de administracion de administradores y aplica
a la capa nueva de identidad digital.

## Problema que resuelve

En una universidad existen excepciones:

- Alumno dado de baja por error.
- Cambio de carrera.
- Foto incorrecta.
- Username abusivo.
- Perfil que viola reglas.
- Badge otorgado por error.
- Evento mal capturado.
- Acceso temporal excepcional.

El sistema debe permitir corregir, pero nunca sin rastro.

## Alcance inicial

El superadmin puede:

- Editar perfil social.
- Forzar cambio de username.
- Ocultar perfil.
- Revocar marco/color/badge.
- Otorgar recompensa manual.
- Corregir participacion en evento.
- Suspender o reactivar usuario segun permisos existentes.
- Registrar motivo obligatorio.

## Fuera de alcance inicial

No incluir al inicio:

- Aprobaciones multinivel.
- RBAC granular por cada campo.
- SSO institucional.
- Workflow formal de tickets.

## Permisos

Fase inicial:

```txt
admin
super_admin
```

Reglas:

- `admin`: opera el sistema.
- `super_admin`: puede corregir identidad y administradores.

Fase futura:

```txt
identity.profile.update
identity.username.override
identity.reward.grant
identity.reward.revoke
identity.event.manage
identity.audit.view
```

## Auditoria obligatoria

Toda accion manual sensible requiere:

- Actor.
- Entidad afectada.
- Campo o accion.
- Valor anterior.
- Valor nuevo.
- Motivo.
- IP.
- User agent.
- Fecha.

Usar `audit_log.metadata` para capturar old/new cuando no exista tabla dedicada.

## API sugerida

```txt
PATCH /api/v1/profiles/:personId
POST  /api/v1/profiles/:personId/username
POST  /api/v1/rewards/:id/grant
POST  /api/v1/rewards/:id/revoke
PATCH /api/v1/campus-events/:id/participants/:participantId
```

Todas las mutaciones administrativas deben validar `reason`.

## UI

Panel admin:

- Mostrar acciones peligrosas separadas.
- Confirmacion antes de aplicar.
- Campo motivo obligatorio.
- Mostrar ultimo cambio y actor cuando sea relevante.
- No esconder auditoria detras de interfaces ambiguas.

## Riesgos

- Abuso de poder administrativo.
- Correcciones sin contexto.
- Ocultar evidencia.
- Revocar logros legitimos.

## Mitigaciones

- Auditoria inmutable.
- Motivo obligatorio.
- Proteccion de ultimo superadmin.
- Filtros de auditoria por entidad.
- Reglas de UI para acciones destructivas.

## Criterios de aceptacion

- Un admin normal no puede hacer override de username.
- Un superadmin puede corregir con motivo.
- La accion queda en `audit_log`.
- El usuario ve el resultado actualizado.
- El sistema conserva historial cuando aplica.
