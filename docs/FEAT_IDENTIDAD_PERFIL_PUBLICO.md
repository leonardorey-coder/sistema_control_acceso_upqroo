# Feature: perfil publico universitario

## Objetivo

Crear una pagina publica interna por username, por ejemplo:

```txt
/u/leondev
```

El perfil sirve como credencial social universitaria para eventos, clubes,
reconocimientos e identidad dentro del campus.

## Alcance inicial

Mostrar:

- Foto institucional si esta permitida.
- Nombre visible.
- `@usuario`.
- Tipo de persona o rol publico.
- Carrera si el usuario lo permite.
- Bio corta.
- Insignias publicas.
- Eventos publicos permitidos.
- Marco y color equipados.

## Fuera de alcance inicial

No incluir:

- Historial de entradas/salidas.
- Asistencias.
- Datos de contacto.
- Feed social.
- Comentarios.
- Mensajes privados.
- Ranking publico global.

## Privacidad

El perfil publico debe respetar campos de `digital_profiles`:

```txt
show_full_name
show_career
show_badges
show_events
visibility
```

Reglas:

- Si `visibility = private`, responder 404 o perfil no visible.
- Si `show_career = false`, ocultar carrera.
- Si `show_events = false`, ocultar eventos.
- Si `show_badges = false`, ocultar insignias.
- Nunca exponer matricula completa.

## API sugerida

```txt
GET /api/v1/public/profiles/:username
```

Respuesta:

```json
{
  "data": {
    "username": "leondev",
    "displayName": "Leonardo Cruz",
    "photoUrl": "/api/v1/files/...",
    "personType": "Estudiante",
    "career": "Ingenieria de Software",
    "bio": "Dev y participante de hackathons.",
    "badges": [],
    "events": [],
    "appearance": {}
  }
}
```

## Frontend

Ruta recomendada:

```txt
apps/web/src/routes/u/[username]/+page.svelte
```

Principios visuales:

- Institucional.
- Compacto.
- Mobile-first.
- Sin landing.
- Sin datos administrativos.
- Con defaults cuando no hay recompensas.

## SEO y exposicion

Para primera version, tratarlo como perfil publico interno:

- No optimizar como pagina publica de internet.
- No indexar si la institucion no lo autoriza.
- Agregar `noindex` por defecto si se despliega en dominio publico.

## Moderacion

El admin debe poder:

- Ocultar perfil.
- Forzar cambio de username.
- Editar nombre visible si incumple reglas.
- Retirar bio ofensiva.
- Revocar insignias.

Todo cambio debe auditarse.

## Criterios de aceptacion

- `/u/:username` carga solo datos permitidos.
- Perfil privado no expone datos.
- Cambios de privacidad se reflejan inmediatamente.
- Username inexistente responde 404.
- El perfil conserva apariencia equipada.
- No se filtra matricula, email, CURP ni historial.
