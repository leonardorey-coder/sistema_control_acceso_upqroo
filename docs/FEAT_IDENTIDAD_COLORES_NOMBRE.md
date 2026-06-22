# Feature: colores personalizados de nombre

## Objetivo

Permitir que usuarios desbloqueen y equipen colores para su nombre visible.

Es una recompensa estetica barata de implementar, pero debe mantener contraste,
legibilidad y tono institucional.

## Alcance inicial

La primera version debe soportar:

- Colores solidos.
- Paleta institucional controlada.
- Tiers simples.
- Equipar un color desbloqueado.
- Mostrar color en perfil y scanner.

No incluir al inicio:

- Gradientes animados.
- Efectos brillantes.
- Sombras fuertes.
- Colores personalizados libres por usuario.

## Modelo

Usar `reward_definitions`:

```txt
type = name_color
slug
name
tier
style_metadata
```

Ejemplo `style_metadata`:

```json
{
  "color": "#1D4ED8",
  "contrastOnLight": true,
  "contrastOnDark": true
}
```

Seleccion:

```txt
digital_profiles.selected_name_color_reward_id
```

## Accesibilidad

Cada color debe cumplir contraste suficiente sobre los fondos usados en:

- Perfil publico.
- Portal usuario.
- Scanner.
- Panel admin.

No permitir colores si:

- Dificultan lectura.
- Se confunden con estados de error/exito.
- Rompen el contraste en mobile.

## Paleta inicial recomendada

```txt
default
azul institucional
verde accesible
morado sobrio
dorado oscuro
gris premium
```

Evitar una paleta dominada por un solo tono. La UI general debe seguir la linea
institucional existente, no una estetica de videojuego.

## API

Reutilizar endpoints de rewards:

```txt
GET  /api/v1/portal/rewards?type=name_color
POST /api/v1/portal/rewards/equip
```

## UI

- Swatches de color.
- Nombre de color.
- Indicador equipado.
- Preview con nombre del usuario.
- Tooltip o texto corto si no cumple contraste.

## Auditoria

Auditar:

- Otorgamiento.
- Revocacion.
- Equipar color.
- Cambio administrativo de color.

## Criterios de aceptacion

- El usuario solo equipa colores desbloqueados.
- Los colores cumplen contraste.
- El scanner no rompe layout con nombres largos.
- El default se usa si el color fue revocado.
- La seleccion se refleja en perfil y scanner.
