# Feature: marcos de perfil

## Objetivo

Permitir que usuarios desbloqueen y equipen marcos visuales para su foto de
perfil.

Los marcos son recompensas esteticas visibles en perfil, scanner y eventos.

## Valor de producto

Los marcos dan sensacion de progreso sin tocar la seguridad del acceso.

Funcionan como recompensa visible para:

- Eventos.
- Hackathons.
- Clubes.
- Participacion institucional.
- Roles especiales.
- Reconocimientos.

## Modelo de recompensa

Los marcos deben vivir en el catalogo general:

```txt
reward_definitions
------------------
id
type = frame
slug
name
tier
description
asset_key
style_metadata
requirements
active
created_at
updated_at
```

Asignacion:

```txt
person_rewards
--------------
person_id
reward_id
unlocked_at
source_type
source_id
granted_by_admin_id
metadata
```

Seleccion:

```txt
digital_profiles.selected_frame_reward_id
```

## Tiers sugeridos

```txt
default
bronze
silver
gold
platinum
diamond
special
event
founder
```

## Defaults

Todo usuario debe iniciar con un marco default institucional:

- Gris.
- Sobrio.
- Legible.
- Sin parecer error o perfil incompleto.

Este marco puede no requerir registro en `person_rewards`, pero conviene tenerlo
como reward default para consistencia visual.

## Reglas

- El usuario solo puede equipar marcos que posee.
- Un admin puede otorgar o revocar marcos.
- Revocar un marco equipado debe volver al default.
- Marcos especiales deben tener fecha o fuente de otorgamiento.
- No usar animaciones pesadas en scanner.

## API sugerida

```txt
GET  /api/v1/portal/rewards?type=frame
POST /api/v1/portal/rewards/equip
POST /api/v1/rewards/:id/grant
POST /api/v1/rewards/:id/revoke
```

Payload de equip:

```json
{
  "type": "frame",
  "rewardId": "uuid"
}
```

## UI

Portal:

- Grid compacto de marcos desbloqueados.
- Preview con foto real.
- Estado equipado.

Admin:

- Catalogo de marcos.
- Otorgar a persona por busqueda.
- Motivo obligatorio.

Scanner:

- Mostrar marco alrededor de foto.
- Fallback a default si falta asset.

## Criterios de aceptacion

- Un usuario ve sus marcos desbloqueados.
- Un usuario no puede equipar un marco no otorgado.
- Un admin puede otorgar marco con auditoria.
- Revocar marco equipado vuelve al default.
- Scanner y perfil renderizan el mismo marco.
