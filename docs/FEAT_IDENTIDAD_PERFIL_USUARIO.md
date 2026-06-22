# Feature: Perfil de identidad universitaria

## Objetivo

Crear un perfil personal para cada usuario con cuenta de portal, separado del
registro administrativo de acceso.

El perfil representa la identidad visible del usuario dentro del ecosistema
universitario. No reemplaza `personas`, `user_accounts` ni las credenciales QR.

## Problema que resuelve

El sistema actual identifica a las personas principalmente por datos
administrativos:

- Matricula.
- Nombre institucional.
- Tipo de persona.
- Carrera.
- Foto.
- Estado de acceso.

Eso funciona para seguridad, pero no crea una identidad digital reutilizable en
eventos, clubes, reconocimientos o perfiles publicos internos.

## Alcance inicial

La primera version debe permitir:

- Ver perfil propio desde el portal.
- Editar nombre visible.
- Editar bio corta.
- Configurar privacidad.
- Ver foto institucional.
- Ver `@usuario` si existe.
- Ver insignias publicas desbloqueadas.
- Ver marco y color equipados.
- Ver historial basico de identidad, no historial de acceso.

## Fuera de alcance inicial

No incluir al inicio:

- Chat.
- Publicaciones.
- Seguidores.
- Comentarios.
- Ranking global.
- Likes.
- Muro social.
- Edicion libre de foto si la institucion requiere control administrativo.

## Modelo de datos sugerido

```txt
digital_profiles
----------------
id
person_id
username
display_name
bio
visibility
show_full_name
show_career
show_badges
show_events
selected_frame_reward_id
selected_name_color_reward_id
username_changed_at
created_at
updated_at
```

Reglas:

- `person_id` debe ser unico.
- `username` puede ser nulo al inicio.
- `display_name` inicia desde `personas.nombres + apellidos`.
- `bio` debe tener limite corto, recomendado 160 o 280 caracteres.
- `visibility` inicial recomendado: `internal`.

## Relacion con tablas existentes

- `personas`: fuente de identidad institucional.
- `user_accounts`: habilita acceso al portal.
- `stored_files`: fuente de foto de perfil institucional.
- `reward_definitions`: catalogo de elementos visuales.
- `person_rewards`: recompensas desbloqueadas por la persona.

No crear una tabla `users` paralela. En este repo la entidad base ya es
`personas`.

## API sugerida

```txt
GET   /api/v1/portal/profile
PATCH /api/v1/portal/profile
GET   /api/v1/profiles/:personId
PATCH /api/v1/profiles/:personId
```

El portal solo puede editar campos propios permitidos.

El admin puede editar campos institucionales del perfil con auditoria.

## Validaciones

- `display_name`: 2 a 80 caracteres.
- `bio`: maximo 280 caracteres.
- No permitir HTML.
- Sanitizar espacios repetidos.
- Rechazar contenido vacio en cambios obligatorios.
- Rechazar seleccion de marco/color no desbloqueado.

## Privacidad

El perfil debe separar:

- Datos operativos del guardia.
- Datos publicos internos.
- Datos privados administrativos.

Nunca mostrar en perfil publico:

- Correo.
- Telefono.
- CURP.
- Historial de accesos.
- Estado disciplinario.
- Password/session/token hashes.
- Matricula completa como identificador social.

## UI esperada

Ruta recomendada:

```txt
/portal/perfil
```

Debe mantener el estilo institucional:

- Header UPQROO.
- Contenido compacto.
- Foto visible.
- Campo de `@usuario`.
- Bio corta.
- Switches de privacidad.
- Selector de marco/color si existen recompensas.

## Auditoria

Auditar:

- Cambio de nombre visible.
- Cambio de bio.
- Cambio de privacidad.
- Cambio de apariencia equipada.
- Edicion administrativa del perfil.

## Criterios de aceptacion

- Un usuario con sesion puede consultar su perfil.
- Un usuario puede actualizar campos permitidos.
- Un usuario no puede modificar perfil de otra persona.
- Un admin autorizado puede actualizar perfil con motivo.
- El perfil publico respeta privacidad.
- Los cambios sensibles quedan en `audit_log`.
