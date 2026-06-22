# Feature: defaults y progresion de identidad

## Objetivo

Definir una experiencia inicial completa para usuarios sin recompensas, y una
progresion clara conforme desbloquean elementos.

El perfil inicial debe verse basico, no roto.

## Problema que resuelve

Si la capa social arranca vacia, el usuario puede sentir que el sistema esta
incompleto. Los defaults permiten:

- Tener identidad visual desde el primer dia.
- Mostrar que existe progreso posible.
- Evitar espacios vacios.
- Mantener consistencia en scanner y perfil.

## Defaults iniciales

Todo perfil debe tener:

- Foto institucional o placeholder sobrio.
- Nombre visible.
- `@usuario` pendiente o asignado.
- Marco default gris.
- Color de nombre default.
- Sin badges destacados.
- Mensaje neutro si no hay eventos/logros.

## Progresion sugerida

```txt
Default
-> Bronce
-> Plata
-> Oro
-> Especial
```

La progresion no debe depender solo de numero de accesos.

Fuentes recomendadas:

- Primer acceso.
- Participacion en evento.
- Clubes.
- Hackathons.
- Deportes.
- Voluntariado.
- Reconocimientos institucionales.

## Modelo

Seed inicial de `reward_definitions`:

```txt
frame.default
name_color.default
badge.first_access
```

Los defaults pueden asignarse implicitamente. Si se asignan explicitamente,
facilitan consultas y consistencia.

## Reglas

- Siempre hay un frame renderizable.
- Siempre hay un name color renderizable.
- Si una recompensa equipada desaparece, fallback a default.
- El scanner nunca debe fallar por falta de perfil social.
- El perfil publico nunca debe mostrar areas vacias sin tratamiento visual.

## UI

Portal:

- Mostrar progreso sin exagerar.
- Separar "Desbloqueado" de "Por desbloquear".
- No convertir la pantalla principal de QR en ranking.

Scanner:

- Mostrar solo lo equipado o destacado.
- Evitar saturacion visual.

## Criterios de aceptacion

- Un usuario nuevo tiene perfil visual completo.
- Si no tiene username, se muestra nombre institucional y CTA en portal.
- Si no tiene recompensas, se muestra default.
- Si se revoca una recompensa equipada, se ve default.
- No hay nulls visibles en UI.
