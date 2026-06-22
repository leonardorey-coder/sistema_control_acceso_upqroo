# Feature: eventos del campus

## Objetivo

Registrar eventos institucionales y vincularlos con perfiles, participantes,
equipos, roles e insignias.

Esta feature crea la base del ecosistema universitario sin construir una red
social completa.

## Casos de uso

- Hackathon con equipos y ganadores.
- Torneo deportivo.
- Conferencia.
- Club estudiantil.
- Voluntariado.
- Taller.
- Reconocimiento institucional.

## Alcance inicial

Permitir:

- Crear evento.
- Editar evento.
- Activar/desactivar evento.
- Registrar participantes.
- Registrar rol del participante.
- Registrar equipo o resultado simple.
- Otorgar insignias asociadas.
- Mostrar eventos publicos en perfil si privacidad lo permite.

## Fuera de alcance inicial

No incluir:

- Venta de boletos.
- Check-in masivo por evento.
- Chat de evento.
- Publicaciones.
- Ranking global.
- Certificados PDF.
- Integracion externa.

## Modelo de datos

```txt
campus_events
-------------
id
slug
title
type
description
starts_at
ends_at
visibility
status
created_by_admin_id
created_at
updated_at
```

```txt
event_participants
------------------
id
event_id
person_id
role
team_name
result
public
metadata
created_by_admin_id
created_at
updated_at
```

Tipos sugeridos:

```txt
hackathon
sport
club
conference
workshop
volunteer
recognition
other
```

## Relacion con recompensas

Un evento puede otorgar:

- Badge.
- Marco especial.
- Color especial.
- Achievement.

El otorgamiento debe crear `person_rewards` con `source_type = campus_event`.

## API

```txt
GET   /api/v1/campus-events
POST  /api/v1/campus-events
GET   /api/v1/campus-events/:id
PATCH /api/v1/campus-events/:id
POST  /api/v1/campus-events/:id/participants
PATCH /api/v1/campus-events/:id/participants/:participantId
DELETE /api/v1/campus-events/:id/participants/:participantId
POST  /api/v1/campus-events/:id/grant-reward
```

## UI

Admin:

- Tab `Eventos`.
- Tabla compacta.
- Formulario de alta.
- Participantes por busqueda de persona.
- Accion para otorgar badge/recompensa.

Perfil:

- Mostrar eventos publicos permitidos.
- Mostrar rol o resultado si es publico.

## Privacidad

- Participacion puede ser publica o privada.
- Usuario puede ocultar eventos desde perfil.
- Eventos internos no deben aparecer en perfil publico.

## Auditoria

Auditar:

- Alta/edicion de evento.
- Alta/baja de participante.
- Cambio de resultado.
- Otorgamiento de recompensa.
- Cambio de visibilidad.

## Criterios de aceptacion

- Un admin crea evento.
- Un admin registra participantes.
- Un participante puede aparecer en perfil publico si lo permite.
- Otorgar badge desde evento crea trazabilidad.
- Ocultar eventos en privacidad los elimina del perfil publico.
