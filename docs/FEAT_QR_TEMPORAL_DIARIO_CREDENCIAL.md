# Feature: QR temporal diario por falta de credencial

## Objetivo

Permitir que un usuario que no cuenta con su credencial de acceso pueda usar un QR temporal durante el dia operativo, con funciones equivalentes al QR real, pero claramente marcado como acceso por excepcion.

Esta feature debe cubrir casos donde el usuario no trae o no puede usar:

- QR principal.
- Credencial fisica.
- Matricula.
- Codigo de acceso requerido por el sistema.
- Otra credencial configurada por la institucion.

El QR temporal diario debe permitir entradas, salidas, reingresos, marcas relacionadas con horarios y registros de asistencia, siempre manteniendo trazabilidad, motivo, expiracion y auditoria.

## Nombre recomendado

```txt
QR temporal diario por falta de credencial
```

Nombres alternativos:

```txt
Credencial temporal diaria
QR de excepcion diaria
Acceso temporal por falta de credencial
```

No se recomienda llamarlo solo "QR temporal", porque el sistema podria tener otros QR temporales para visitantes, invitados o eventos.

## Problema que resuelve

Cuando una persona no cuenta con su credencial o QR, el sistema puede resolverlo con una excepcion manual. Sin embargo, si esa persona entra, sale y reingresa durante el mismo dia, pedir una excepcion en cada movimiento genera friccion operativa y registros inconsistentes.

El QR temporal diario resuelve esto:

- Se genera una sola vez.
- Sirve durante el dia operativo.
- Se comporta como credencial valida para entradas y salidas.
- Mantiene etiqueta de excepcion.
- Expira automaticamente.
- Puede revocarse.
- Queda auditado.

## Principio central

El QR temporal diario puede funcionar como el QR real durante su vigencia, pero no debe ser tratado como credencial normal.

Debe tener semantica propia:

```txt
tipo = qr_temporal_diario
origen = falta_de_credencial
motivo = qr | credencial | matricula | codigo | otro
vigencia = dia_operativo
estado = activo | usado | expirado | revocado
auditoria = obligatoria
```

## Alcance funcional

La primera version debe permitir:

- Registrar motivo por el cual el usuario no cuenta con credencial.
- Generar un QR temporal diario.
- Mostrar el QR al usuario.
- Escanearlo como credencial valida.
- Registrar entradas.
- Registrar salidas.
- Permitir reingresos durante el mismo dia.
- Marcar los registros como originados por QR temporal.
- Expirar el QR automaticamente.
- Revocar el QR manualmente.
- Auditar generacion, uso y revocacion.
- Reportar accesos por excepcion.

## Fuera de alcance inicial

No se recomienda incluir en la primera version:

- Generacion ilimitada por el usuario sin control.
- QR temporal multi-dia.
- QR temporal transferible.
- QR anonimo.
- QR sin usuario asociado.
- QR que reemplace permanentemente a la credencial real.
- Aprobaciones complejas multinivel si no son necesarias al inicio.

## Actores

### Usuario

Persona que necesita entrar o salir del plantel, pero no cuenta con su credencial normal.

Puede:

- Solicitar QR temporal si el sistema lo permite.
- Ver QR temporal activo en su portal.
- Maximizar QR para escaneo.
- Consultar estado y expiracion.
- Ver historial de codigos temporales propios.

### Administrador u operador

Persona autorizada para generar o validar el QR temporal.

Puede:

- Buscar al usuario.
- Validar que esta activo.
- Registrar tipo de credencial faltante.
- Registrar motivo.
- Generar QR temporal diario.
- Revocar QR temporal.
- Consultar historial.

### Sistema

Debe:

- Validar reglas.
- Impedir duplicados indebidos.
- Firmar o generar token seguro.
- Expirar automaticamente.
- Auditar eventos.
- Marcar registros de acceso.

## Flujo recomendado inicial

Primera version prudente:

```txt
Usuario llega sin credencial/QR
-> admin busca al usuario
-> sistema valida que el usuario existe y esta activo
-> admin selecciona credencial faltante
-> admin selecciona motivo
-> admin escribe detalle si aplica
-> sistema verifica si ya existe QR temporal activo para ese dia
-> si existe, muestra/reemite el mismo
-> si no existe, genera QR temporal diario
-> usuario lo usa durante el dia
-> cada scan registra entrada/salida/reingreso con etiqueta temporal
-> QR expira al cierre operativo
```

## Flujo futuro opcional

Version posterior:

```txt
Usuario entra al portal
-> solicita QR temporal diario
-> selecciona credencial faltante y motivo
-> sistema valida limites
-> si cumple reglas, genera QR
-> si excede limites, requiere aprobacion admin
-> usuario lo usa durante el dia
```

## Datos capturados

### Credencial faltante

Campo recomendado:

```txt
missing_credential_type
```

Valores:

```txt
qr
credencial_fisica
matricula
codigo_acceso
otra
```

### Motivo principal

Campo recomendado:

```txt
reason_code
```

Valores sugeridos:

```txt
olvido
extravido
reposicion
qr_vencido
qr_no_disponible
celular_sin_bateria
sin_acceso_portal
falla_sistema
nuevo_ingreso
credencial_danada
codigo_no_recibido
otro
```

### Detalle libre

Campo recomendado:

```txt
reason_text
```

Reglas:

- Opcional en motivos normales.
- Obligatorio cuando `reason_code = otro`.
- Limite recomendado: 250 o 500 caracteres.
- No debe permitir HTML.
- Debe sanitizarse al mostrarse.
- No debe usarse como autorizacion automatica.

## Modelo de datos sugerido

Tabla conceptual:

```txt
daily_temporary_qr
```

Campos:

```txt
id
user_id
person_id
matricula

token_hash
token_jti
token_version

status
scope
credential_type
origin

missing_credential_type
reason_code
reason_text

valid_from
valid_until
operational_date
expires_at

created_by_admin_id
requested_by_user_id
approved_by_admin_id
revoked_by_admin_id

created_at
approved_at
revoked_at
last_used_at

revocation_reason
metadata
```

## Significado de campos clave

### `status`

Estados sugeridos:

```txt
pending
active
used
expired
revoked
rejected
```

Uso:

- `pending`: solicitud hecha por usuario, pendiente de autorizacion.
- `active`: QR vigente y utilizable.
- `used`: QR ya fue usado al menos una vez, pero puede seguir activo durante el dia.
- `expired`: vencio automaticamente.
- `revoked`: fue cancelado manualmente.
- `rejected`: solicitud rechazada.

### `scope`

Define alcance funcional.

Valores:

```txt
full_day_access
entry_only
exit_only
restricted
```

Para esta feature, el valor normal sera:

```txt
full_day_access
```

### `credential_type`

Valor recomendado:

```txt
temporary_daily_qr
```

### `origin`

Valor recomendado:

```txt
missing_credential
```

### `operational_date`

Fecha operativa para la cual el QR es valido.

No siempre debe asumirse igual a la fecha calendario si la institucion define un cierre operativo diferente.

### `valid_until` / `expires_at`

Debe expirar al final del dia operativo.

Opciones:

```txt
23:59:59 hora local
cierre configurado por institucion
hora fija de cierre operativo
```

## Datos en registros de acceso

Cada entrada/salida realizada con QR temporal debe guardar referencia.

Campos sugeridos en `registros_acceso` o tabla relacionada:

```txt
credential_type
credential_origin
temporary_qr_id
missing_credential_type
exception_reason_code
exception_reason_text
is_exception_access
scanned_token_jti
```

Valores esperados:

```txt
credential_type = temporary_daily_qr
credential_origin = missing_credential
is_exception_access = true
```

Esto permite reportes, auditoria y deteccion de abuso sin perder funcionalidad de entrada/salida.

## Comportamiento como QR real

Durante su vigencia, el QR temporal diario debe permitir:

- Entrada inicial.
- Salida.
- Reingreso.
- Nueva salida.
- Asociacion con registros de asistencia.
- Marcas relacionadas con horario.
- Validacion de estado activo/inactivo del usuario.

Pero debe diferenciarse en auditoria:

```txt
registro normal -> credential_type = permanent_qr
registro temporal -> credential_type = temporary_daily_qr
```

## Reglas de negocio

### Generacion

- Solo se puede generar para usuarios existentes.
- El usuario debe estar activo.
- Debe registrarse credencial faltante.
- Debe registrarse motivo.
- Si el motivo es `otro`, el detalle es obligatorio.
- Solo debe existir un QR temporal diario activo por usuario y dia operativo.
- Si ya existe uno activo, el sistema debe mostrar/reemitir el existente.
- Debe tener expiracion automatica.
- Debe poder revocarse manualmente.

### Uso

- Debe validarse en backend en cada escaneo.
- Debe pertenecer al usuario correcto.
- Debe estar activo.
- Debe estar dentro de vigencia.
- Debe no estar revocado.
- Debe registrar `last_used_at`.
- Debe marcar cada registro como acceso por excepcion.

### Limites

Limites sugeridos:

```txt
1 QR temporal activo por dia
3 a 5 QR temporales por mes sin autorizacion especial
limite configurable por tipo de usuario
alerta si hay uso recurrente
```

Si se excede el limite:

```txt
requiere aprobacion admin
se marca para revision
se genera alerta
```

### Revocacion

Un QR puede revocarse por:

- Credencial recuperada.
- Sospecha de abuso.
- Error de captura.
- Usuario equivocado.
- Solicitud del usuario.
- Decision administrativa.

Debe guardarse:

```txt
revoked_by_admin_id
revoked_at
revocation_reason
```

## Seguridad

Reglas obligatorias:

- El token del QR no debe ser la matricula.
- El QR debe usar token aleatorio o firmado.
- En base de datos debe guardarse hash del token, no el token plano.
- Debe tener expiracion.
- Debe poder revocarse.
- Debe estar asociado a usuario/persona.
- Debe auditarse generacion, uso y revocacion.
- No debe generarse para usuarios inactivos.
- No debe conceder permisos administrativos.
- No debe permitir cambiar identidad.
- No debe exponerse publicamente sin sesion.

## Token recomendado

Contenido conceptual si se usa token firmado:

```txt
jti
sub
type = temporary_daily_qr
origin = missing_credential
operational_date
iat
exp
signature
```

Contenido que no debe exponerse directamente:

```txt
password
datos sensibles
matricula como unico secreto
permisos administrativos
```

## Auditoria

Eventos a registrar:

```txt
temporary_qr.requested
temporary_qr.created
temporary_qr.approved
temporary_qr.reissued
temporary_qr.scanned
temporary_qr.used_for_entry
temporary_qr.used_for_exit
temporary_qr.revoked
temporary_qr.expired
temporary_qr.rejected
temporary_qr.limit_exceeded
```

Campos de auditoria:

```txt
event_type
temporary_qr_id
person_id
matricula
admin_id
user_id
ip_address
user_agent
created_at
metadata
```

## Reportes y metricas

Metricas utiles:

- QR temporales generados por dia.
- QR temporales por usuario.
- QR temporales por carrera o grupo.
- Motivos mas frecuentes.
- Credencial faltante mas frecuente.
- Usuarios con uso recurrente.
- Porcentaje de accesos por excepcion.
- Registros de entrada/salida usando QR temporal.
- QR revocados.
- QR expirados sin uso.

Estas metricas pueden alimentar:

- Panel administrativo.
- Reportes de seguridad.
- Portal de usuario.
- Alertas de abuso.

## API sugerida

### Admin

```txt
POST /api/v1/admin/temporary-daily-qr
GET  /api/v1/admin/temporary-daily-qr
GET  /api/v1/admin/temporary-daily-qr/:id
POST /api/v1/admin/temporary-daily-qr/:id/revoke
```

### Usuario

```txt
GET  /api/v1/user/temporary-daily-qr/current
POST /api/v1/user/temporary-daily-qr/request
GET  /api/v1/user/temporary-daily-qr/history
```

### Scanner

```txt
POST /api/v1/access/scan
```

El scanner no necesita un endpoint separado si `access/scan` puede identificar el tipo de QR.

## Validaciones de entrada

Para crear QR temporal:

```txt
person_id o matricula: requerido
missing_credential_type: requerido
reason_code: requerido
reason_text: requerido si reason_code = otro
operational_date: opcional, default hoy
scope: opcional, default full_day_access
```

Para revocar:

```txt
temporary_qr_id: requerido
revocation_reason: requerido
```

## Integracion con portal de usuario

En el portal de usuario debe mostrarse:

- QR temporal activo si existe.
- Estado: activo, expirado o revocado.
- Tiempo restante de vigencia.
- Motivo registrado.
- Boton para maximizar QR.
- Historial de QR temporales.
- Aviso de que es una credencial temporal por falta de credencial.

Texto sugerido:

```txt
QR temporal diario
Emitido por falta de credencial
Valido hasta: 23:59
```

## Integracion con panel administrativo

El panel administrativo debe permitir:

- Crear QR temporal diario.
- Buscar usuario por matricula/nombre.
- Ver si ya tiene QR activo.
- Ver motivo y credencial faltante.
- Revocar QR.
- Ver historial de uso.
- Filtrar reportes por QR temporal.

## Integracion con scanner

Cuando se escanee un QR temporal diario, la respuesta debe indicar:

```txt
success
tipo_registro: entrada | salida
credential_type: temporary_daily_qr
credential_origin: missing_credential
missing_credential_type
reason_code
persona
mensaje_visible
```

Mensaje sugerido para operador:

```txt
Entrada registrada con QR temporal diario por falta de credencial.
```

## UX recomendada

### Para admin

Formulario compacto:

```txt
Buscar usuario
Credencial faltante
Motivo
Detalle
[Generar QR temporal diario]
```

Si ya existe QR activo:

```txt
Este usuario ya tiene un QR temporal activo para hoy.
[Ver QR] [Revocar] [Ver historial]
```

### Para usuario

Vista en portal:

```txt
[QR temporal grande]
QR temporal diario por falta de credencial
Valido hasta 23:59
Motivo: Credencial fisica extraviada
[Maximizar]
```

## Relacion con asistencia

El QR temporal diario debe alimentar las mismas funciones de asistencia que el QR normal.

Regla:

```txt
Si el QR temporal registra entrada/salida, las asistencias se calculan igual.
```

Diferencia:

```txt
Las asistencias deben poder rastrearse como derivadas de acceso por excepcion.
```

## Relacion con salidas automaticas

Si el usuario entra con QR temporal y no registra salida, las salidas automaticas deben funcionar igual que con QR normal.

El registro debe conservar:

```txt
salida_automatica = true
credential_type = temporary_daily_qr
```

## Estados visuales

Estados recomendados:

```txt
Activo
Expira pronto
Expirado
Revocado
Pendiente de aprobacion
Rechazado
Limite excedido
```

Colores sugeridos:

- Activo: verde.
- Expira pronto: amarillo.
- Expirado: gris.
- Revocado: rojo.
- Pendiente: azul.
- Limite excedido: naranja/rojo.

## Criterios de aceptacion

La feature esta lista cuando:

- Un admin puede generar QR temporal diario para usuario activo.
- El sistema exige credencial faltante y motivo.
- El sistema exige detalle cuando el motivo es `otro`.
- El sistema evita mas de un QR activo por usuario por dia operativo.
- El QR temporal permite entrada.
- El QR temporal permite salida.
- El QR temporal permite reingreso durante el mismo dia.
- El scanner identifica que el QR es temporal.
- Los registros quedan marcados como acceso por excepcion.
- Las asistencias se calculan normalmente.
- El QR expira automaticamente.
- Un admin puede revocarlo.
- El usuario puede verlo en su portal si esta activo.
- Los eventos se auditan.
- Hay reportes basicos de uso.
- No se puede generar para usuarios inactivos.
- No se guarda token plano en base de datos.

## Riesgos

- Convertir la excepcion en una credencial normal permanente.
- Generar QR sin auditoria.
- Permitir multiples QR activos para el mismo usuario.
- Usar matricula como token.
- No diferenciar registros normales y temporales.
- Permitir generacion ilimitada.
- No revocar QR emitidos por error.
- No limitar solicitudes recurrentes.
- Exponer el QR temporal sin sesion.

## Decision recomendada

Implementar la feature como una credencial temporal diaria con funciones completas de acceso, pero con trazabilidad reforzada.

Decision inicial:

```txt
solo admin puede generar QR temporal diario
usuario puede verlo en su portal
sirve para entrada/salida/reingreso durante el dia
queda marcado como acceso por excepcion
expira automaticamente
puede revocarse
```

Decision futura:

```txt
usuario puede solicitarlo desde portal
reglas automaticas pueden aprobarlo
exceso de uso requiere aprobacion administrativa
```

El QR temporal diario mejora la operacion sin perder control, siempre que se trate como excepcion auditable y no como reemplazo permanente de la credencial real.
