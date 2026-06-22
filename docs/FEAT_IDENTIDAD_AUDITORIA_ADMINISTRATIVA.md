# Feature: auditoria administrativa de identidad

## Objetivo

Registrar toda accion sensible relacionada con identidad digital, perfiles,
recompensas, eventos y cambios manuales.

La auditoria es la garantia institucional de confianza.

## Eventos auditables

Identidad:

- Creacion de perfil.
- Edicion de perfil.
- Cambio de privacidad.
- Cambio de username.
- Override de username.
- Cambio de foto.

Recompensas:

- Creacion de recompensa.
- Edicion de recompensa.
- Otorgamiento.
- Revocacion.
- Equipar marco/color.

Eventos:

- Creacion de evento.
- Edicion de evento.
- Alta de participante.
- Baja de participante.
- Cambio de resultado.
- Otorgamiento desde evento.

Administracion:

- Suspension/reactivacion.
- Cambio de rol.
- Acceso manual.
- Correccion de datos.

## Modelo

Usar tabla existente:

```txt
audit_log
---------
id
actor_admin_id
actor_account_id
action
entity_type
entity_id
ip_address
user_agent
metadata
created_at
```

Para identidad, estandarizar `action`:

```txt
identity.profile_updated
identity.username_changed
identity.username_overridden
identity.privacy_updated
identity.reward_created
identity.reward_granted
identity.reward_revoked
identity.event_created
identity.event_participant_added
identity.event_reward_granted
```

## Metadata sugerida

```json
{
  "reason": "Correccion solicitada por control escolar",
  "old": {
    "username": "oldname"
  },
  "new": {
    "username": "newname"
  }
}
```

## Reglas

- Ninguna mutacion admin sensible sin motivo.
- Auditoria best-effort solo para acciones no criticas.
- Para cambios criticos, si no se puede auditar, debe fallar la accion.
- No guardar secretos en metadata.
- No guardar tokens QR completos.
- No guardar password hashes.

## Consultas necesarias

El panel admin debe poder filtrar por:

- Actor.
- Entidad.
- Tipo de accion.
- Fecha.
- Persona afectada.
- Modulo.

## UI

Agregar o extender tab de auditoria:

- Tabla densa.
- Filtros simples.
- Modal de metadata.
- Badges por tipo de accion.
- Enlace a persona/perfil cuando aplique.

## Retencion

Primera version:

- No borrar auditoria desde UI.
- Definir retencion operativa en politica institucional futura.

## Criterios de aceptacion

- Cada accion sensible genera registro.
- El registro incluye actor y entidad.
- Los cambios admin requieren motivo.
- No se guardan secretos.
- El panel permite revisar auditoria por persona o modulo.
