# Feature: username social personalizado

## Objetivo

Permitir que cada usuario tenga un identificador social unico tipo `@usuario`
para usarlo en perfil publico, eventos, clubes, reconocimientos e insignias.

El `@usuario` no reemplaza la matricula. La matricula sigue siendo identificador
institucional; el username es identidad social.

## Problema que resuelve

La matricula no debe usarse como identidad publica porque:

- Es dato administrativo.
- No es memorable socialmente.
- Puede exponer informacion innecesaria.
- No representa identidad de comunidad.

El username crea una identidad reutilizable y segura para la capa social.

## Reglas de formato

Reglas recomendadas:

```txt
longitud: 3 a 24 caracteres
regex: ^[a-z0-9._]+$
normalizacion: lowercase
```

No permitir:

- Espacios.
- Acentos.
- Emojis.
- Guiones medios.
- Caracteres invisibles.
- HTML.
- Username que empiece con punto.
- Username que termine con punto.
- Secuencias ambiguas excesivas.

## Usernames reservados

Crear tabla:

```txt
reserved_usernames
------------------
username
reason
active
created_at
```

Seed inicial:

```txt
admin
soporte
rector
universidad
upqroo
control
seguridad
scanner
portal
root
system
```

## Historial

Crear tabla:

```txt
username_history
----------------
id
person_id
old_username
new_username
changed_by_account_id
changed_by_admin_id
reason
created_at
```

El historial evita perder trazabilidad cuando una persona cambia de identidad
social.

## Politica de cambios

Regla inicial recomendada:

- El usuario puede cambiar username una vez cada 90 dias.
- El superadmin puede cambiarlo antes del plazo solo con motivo obligatorio.
- El username anterior no queda reservado automaticamente para siempre.
- El sistema puede bloquear reutilizacion inmediata por una ventana operativa si
  se necesita evitar suplantacion.

## API sugerida

```txt
GET  /api/v1/portal/profile/username/check?value=leondev
POST /api/v1/portal/profile/username
POST /api/v1/profiles/:personId/username
```

Payload usuario:

```json
{
  "username": "leondev"
}
```

Payload admin:

```json
{
  "username": "leondev",
  "reason": "Correccion solicitada por el usuario"
}
```

## Validaciones de abuso

Rechazar:

- Reservados.
- Username ya usado.
- Username ofensivo segun lista institucional.
- Username que suplante areas institucionales.
- Cambios antes del cooldown.
- Intentos repetidos con rate limit si se abusa del endpoint.

## UI esperada

En `/portal/perfil`:

- Campo `@usuario`.
- Indicador de disponibilidad.
- Mensaje claro de cooldown.
- Confirmacion antes de cambiar.
- Texto breve indicando que sera visible en perfil/eventos.

En admin:

- Buscar por matricula, nombre o username.
- Ver historial de username.
- Override con motivo obligatorio.

## Auditoria

Auditar:

- Cambio normal por usuario.
- Cambio forzado por admin.
- Intento rechazado por reservado.
- Intento rechazado por cooldown.

## Criterios de aceptacion

- Dos personas no pueden tener el mismo username.
- Un username reservado no puede asignarse.
- Un usuario no puede cambiar antes de 90 dias.
- Un superadmin puede cambiar con motivo.
- El historial conserva old/new username.
- El perfil publico resuelve por username actual.
