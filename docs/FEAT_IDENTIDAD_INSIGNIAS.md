# Feature: insignias

## Objetivo

Representar roles, participacion y reconocimientos mediante badges visibles en
perfil, scanner, eventos y listas internas.

Las insignias comunican reputacion, no solo estetica.

## Valor

Una insignia puede indicar:

- Ganador Hackathon.
- Tutor.
- Embajador.
- Voluntario.
- Fundador.
- Club de IA.
- Equipo deportivo.
- Ponente.
- Organizador.

## Modelo

Usar `reward_definitions`:

```txt
type = badge
slug
name
tier
description
asset_key
style_metadata
requirements
active
```

Y `person_rewards` para asignacion.

Campos utiles en `style_metadata`:

```json
{
  "icon": "trophy",
  "color": "#B45309",
  "publicDefault": true
}
```

## Tiers sugeridos

```txt
standard
bronze
silver
gold
special
institutional
```

## Reglas de visibilidad

- Algunas insignias pueden ser publicas por defecto.
- El usuario puede ocultar badges si privacidad lo permite.
- Insignias institucionales criticas pueden requerir politica especial.
- Scanner debe mostrar maximo 1 o 2 badges destacados.

## Otorgamiento

Fuentes:

- Admin manual con motivo.
- Evento del campus.
- Club o equipo.
- Logro automatico basico.

No permitir que el usuario se auto-asigne insignias.

## API

```txt
GET  /api/v1/portal/rewards?type=badge
GET  /api/v1/rewards?type=badge
POST /api/v1/rewards
POST /api/v1/rewards/:id/grant
POST /api/v1/rewards/:id/revoke
```

## UI

Portal:

- Lista de insignias.
- Estado visible/oculta si aplica.
- Descripcion y fuente.

Scanner:

- Badge destacado compacto.
- No saturar pantalla de acceso.

Perfil publico:

- Badges publicas agrupadas.
- Mostrar fuente si existe.

## Auditoria

Auditar:

- Creacion de badge.
- Edicion.
- Otorgamiento.
- Revocacion.
- Cambio de visibilidad destacada.

## Criterios de aceptacion

- Un badge otorgado aparece en portal.
- Un badge publico aparece en perfil publico.
- Scanner muestra badges destacados sin romper layout.
- Revocar badge lo elimina de perfil y scanner.
- Todo otorgamiento tiene fuente o motivo.
