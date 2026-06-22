# Feature: catalogo de recompensas de identidad

## Objetivo

Crear un sistema comun para definir, otorgar, revocar y mostrar recompensas de
identidad digital.

Este catalogo soporta:

- Insignias.
- Marcos.
- Colores de nombre.
- Hitos.
- Logros.
- Recompensas especiales de eventos.

## Problema que resuelve

Sin un catalogo comun, cada feature de gamificacion terminaria con tablas y
reglas propias.

Un catalogo unico permite:

- Reutilizar UI.
- Auditar otorgamientos.
- Centralizar visibilidad.
- Mantener tiers consistentes.
- Conectar eventos con recompensas.

## Modelo

```txt
reward_definitions
------------------
id
type
slug
name
tier
description
asset_key
style_metadata
requirements
active
created_by_admin_id
created_at
updated_at
```

```txt
person_rewards
--------------
id
person_id
reward_id
status
unlocked_at
revoked_at
source_type
source_id
granted_by_admin_id
revoked_by_admin_id
metadata
created_at
updated_at
```

Tipos:

```txt
badge
frame
name_color
achievement
```

Estados:

```txt
active
revoked
hidden
```

## Reglas

- `slug` debe ser unico.
- El usuario no puede auto-otorgarse recompensas.
- Otorgar recompensa requiere fuente o motivo.
- Revocar recompensa equipada debe aplicar fallback.
- Recompensas inactivas no pueden otorgarse nuevas.
- Recompensas ya otorgadas pueden seguir visibles si la institucion lo permite.

## API administrativa

```txt
GET   /api/v1/rewards
POST  /api/v1/rewards
GET   /api/v1/rewards/:id
PATCH /api/v1/rewards/:id
POST  /api/v1/rewards/:id/grant
POST  /api/v1/rewards/:id/revoke
```

## API portal

```txt
GET  /api/v1/portal/rewards
POST /api/v1/portal/rewards/equip
```

El equip solo aplica para:

- `frame`
- `name_color`

## UI administrativa

Tab recomendado:

```txt
Recompensas
```

Debe incluir:

- Tabla de recompensas.
- Filtro por tipo.
- Estado activo/inactivo.
- Formulario de creacion.
- Otorgar por busqueda de persona.
- Revocar con motivo.

## UI portal

Debe mostrar:

- Recompensas desbloqueadas.
- Recompensas equipadas.
- Origen de desbloqueo.
- Estado oculto/publico si aplica.

No debe mostrar recompensas no obtenidas como presion excesiva; si se muestran,
debe ser sobrio y opcional.

## Auditoria

Auditar:

- Creacion.
- Edicion.
- Activacion/desactivacion.
- Otorgamiento.
- Revocacion.
- Equipar.

## Criterios de aceptacion

- Un admin crea recompensa.
- Un admin otorga recompensa con motivo.
- El usuario la ve en portal.
- El usuario puede equipar frame/color desbloqueado.
- Revocar recompensa actualiza perfil.
- Todo cambio queda auditado.
