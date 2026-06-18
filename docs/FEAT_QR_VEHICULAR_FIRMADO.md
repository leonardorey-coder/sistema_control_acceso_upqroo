# Feature: QR vehicular firmado para carnet de vehiculo

## Objetivo

Crear un QR vehicular para el carnet del vehiculo que represente un permiso firmado o tokenizado de acceso vehicular.

Este QR no reemplaza el QR personal actual. El QR personal se mantiene agnostico para acceso general, mientras que el QR vehicular se usa especificamente cuando el usuario entra o sale en vehiculo.

## Principio central

El QR vehicular debe representar:

```txt
usuario autorizado
+ vehiculo autorizado
+ permiso vehicular vigente
+ token seguro
```

No debe contener datos sensibles en texto plano.

El QR vehicular debe contener una firma, token o identificador seguro que el backend pueda resolver y validar.

## Diferencia con el QR actual

### QR personal actual

Uso:

```txt
identificar persona
registrar entrada/salida general
funcionar sin importar si entra a pie o en vehiculo
```

Este QR se mantiene agnostico.

### QR vehicular

Uso:

```txt
identificar permiso de acceso vehicular
vincular persona + vehiculo
validar carnet vehicular
registrar acceso como vehicular
```

Este QR no es generico. Su contexto es el acceso en vehiculo.

## Razonamiento

La institucion solicita carnet del vehiculo aparte de la credencial del usuario. Si el sistema solo escanea el QR personal, no puede validar:

- Si el vehiculo esta registrado.
- Si la placa corresponde.
- Si el carnet vehicular esta vigente.
- Si el usuario esta autorizado para ese vehiculo.
- Si la entrada fue a pie o en vehiculo.

Un QR vehicular firmado permite resolver todo eso sin romper el QR personal actual.

## Decision recomendada

Implementar:

```txt
personal_qr
vehicle_permit_qr
```

El `personal_qr` sigue como credencial de persona.

El `vehicle_permit_qr` representa una relacion:

```txt
persona + vehiculo + permiso vehicular
```

## Contenido del QR

El QR no debe contener:

```txt
matricula en claro como unico secreto
placa en claro como unico secreto
passwords
datos sensibles completos
permisos administrativos
```

El QR debe contener algo como:

```txt
vehicle_permit_token
```

O un payload firmado:

```txt
jti
type = vehicle_permit_qr
permit_id
issued_at
expires_at
signature
```

## Validacion en backend

Al escanear el QR vehicular:

```txt
scanner lee token
-> backend valida firma/token
-> backend busca permiso vehicular
-> backend obtiene usuario
-> backend obtiene vehiculo
-> backend valida usuario activo
-> backend valida vehiculo activo
-> backend valida permiso vigente
-> backend valida que no este revocado
-> backend registra entrada/salida vehicular
```

## Informacion mostrada al operador

Despues de escanear el QR vehicular, el sistema debe mostrar:

```txt
Nombre del usuario
Matricula o identificador
Foto del usuario
Tipo de persona
Placa del vehiculo
Marca/modelo
Color
Estado del permiso
Vigencia del carnet
Tipo de registro: entrada/salida
```

Esto permite que el operador compare visualmente el vehiculo real con el carnet escaneado.

## Modelo de datos sugerido

### Vehiculos

Tabla conceptual:

```txt
vehicles
```

Campos:

```txt
id
plate_number
vehicle_type
brand
model
color
status
created_at
updated_at
```

Estados:

```txt
active
inactive
revoked
pending
```

### Permisos vehiculares

Tabla conceptual:

```txt
vehicle_permits
```

Campos:

```txt
id
person_id
vehicle_id
permit_type
status
valid_from
valid_until
issued_by_admin_id
revoked_by_admin_id
revocation_reason
created_at
updated_at
```

Estados:

```txt
active
expired
revoked
pending
rejected
```

### Tokens QR vehiculares

Tabla conceptual:

```txt
vehicle_permit_qr_tokens
```

Campos:

```txt
id
vehicle_permit_id
token_hash
jti
status
issued_at
expires_at
last_used_at
created_at
revoked_at
revoked_by_admin_id
```

Estados:

```txt
active
expired
revoked
rotated
```

## Relacion usuario-vehiculo

La relacion recomendada es:

```txt
usuario + vehiculo = permiso vehicular
```

Esto permite saber que usuario entra con que vehiculo.

Ejemplo:

```txt
Vehiculo ABC-123
Usuario A -> permiso vehicular A + QR vehicular A
Usuario B -> permiso vehicular B + QR vehicular B
```

No se recomienda un unico QR por vehiculo si varios usuarios pueden conducirlo, porque se perderia trazabilidad del usuario que entro.

## Acceso vehicular

Cuando se usa QR vehicular, el registro debe quedar marcado como:

```txt
access_mode = vehicle
credential_type = vehicle_permit_qr
vehicle_id = ...
vehicle_permit_id = ...
person_id = ...
```

Esto permite distinguir:

```txt
entrada a pie
entrada en vehiculo
salida a pie
salida en vehiculo
```

## Flujo de entrada

```txt
Usuario llega en vehiculo
-> operador escanea QR vehicular
-> sistema valida permiso
-> sistema muestra usuario + vehiculo + placa
-> operador compara placa visualmente
-> sistema registra entrada vehicular
```

## Flujo de salida

```txt
Usuario sale en vehiculo
-> operador escanea QR vehicular
-> sistema encuentra registro vehicular abierto
-> sistema registra salida vehicular
```

## Reingresos

El QR vehicular debe permitir reingresos si el permiso sigue vigente.

Regla:

```txt
si hay registro abierto -> registrar salida
si no hay registro abierto -> registrar entrada
```

El comportamiento puede seguir la misma logica actual de entrada/salida, pero marcando el modo como vehicular.

## Seguridad

Reglas obligatorias:

- No usar placa o matricula como secreto.
- No guardar token plano en base de datos.
- Guardar hash del token.
- Permitir revocacion.
- Validar vigencia.
- Validar usuario activo.
- Validar vehiculo activo.
- Validar permiso activo.
- Auditar cada escaneo.
- Mostrar placa al operador.
- No conceder permisos administrativos mediante QR vehicular.

## Token recomendado

Contenido conceptual:

```txt
jti
type = vehicle_permit_qr
permit_id
iat
exp
signature
```

El backend debe poder:

- Validar firma.
- Buscar `jti`.
- Comparar hash/token.
- Validar estado del permiso.
- Validar vigencia.
- Revocar si aplica.

## Auditoria

Eventos sugeridos:

```txt
vehicle.created
vehicle.updated
vehicle.disabled
vehicle_permit.created
vehicle_permit.revoked
vehicle_permit.expired
vehicle_qr.issued
vehicle_qr.scanned
vehicle_qr.revoked
vehicle_access.entry
vehicle_access.exit
vehicle_access.rejected
```

Campos:

```txt
event_type
person_id
vehicle_id
vehicle_permit_id
admin_id
plate_number
created_at
metadata
```

## API sugerida

### Vehiculos

```txt
GET    /api/v1/vehicles
POST   /api/v1/vehicles
GET    /api/v1/vehicles/:id
PATCH  /api/v1/vehicles/:id
POST   /api/v1/vehicles/:id/disable
```

### Permisos vehiculares

```txt
GET    /api/v1/vehicle-permits
POST   /api/v1/vehicle-permits
GET    /api/v1/vehicle-permits/:id
POST   /api/v1/vehicle-permits/:id/revoke
POST   /api/v1/vehicle-permits/:id/qr/rotate
```

### Scanner

```txt
POST /api/v1/access/scan
```

El scanner puede seguir usando un endpoint unico si el backend identifica el tipo de token:

```txt
personal_qr
hot_qr
temporary_daily_qr
vehicle_permit_qr
```

## Respuesta del scanner

Respuesta conceptual:

```txt
{
  "success": true,
  "credential_type": "vehicle_permit_qr",
  "access_mode": "vehicle",
  "tipo_registro": "entrada",
  "person": {
    "name": "Juan Perez",
    "matricula": "123456789"
  },
  "vehicle": {
    "plate_number": "ABC-123",
    "brand": "Nissan",
    "model": "Versa",
    "color": "Gris"
  },
  "permit": {
    "status": "active",
    "valid_until": "2026-12-31"
  }
}
```

## UX recomendada

### Al escanear

Mostrar en pantalla:

```txt
Acceso vehicular autorizado

Usuario:
Juan Perez
Matricula: 123456789

Vehiculo:
Nissan Versa gris
Placa: ABC-123

Registro:
Entrada registrada
```

### Si falla

Mostrar razon clara:

```txt
Permiso vehicular vencido
Vehiculo inactivo
Usuario inactivo
QR vehicular revocado
QR no corresponde a permiso vehicular
```

## Portal de usuario

El portal de usuario puede mostrar:

- Vehiculos asociados.
- Estado del permiso vehicular.
- Vigencia del carnet.
- QR vehicular si esta permitido.
- Historial de accesos vehiculares.
- Solicitud de renovacion.

Primera version puede dejar esto fuera si la gestion sera solo administrativa.

## Panel administrativo

El panel administrativo debe permitir:

- Registrar vehiculo.
- Asociar vehiculo a usuario.
- Emitir carnet vehicular.
- Ver QR vehicular.
- Revocar permiso.
- Renovar vigencia.
- Ver historial de accesos vehiculares.

## Casos especiales

### Vehiculo compartido

Generar un permiso por relacion usuario-vehiculo.

### Vehiculo visitante

Debe usar flujo separado de visitante o pase temporal vehicular.

### Taxi o transporte externo

No deberia usar carnet vehicular permanente.

### Motocicleta

Puede usar el mismo modelo con `vehicle_type = motorcycle`.

### Vehiculo oficial

Puede tener `permit_type = official`.

## Reportes

Metricas utiles:

- Entradas vehiculares por dia.
- Salidas vehiculares por dia.
- Vehiculos dentro del plantel.
- Permisos vencidos.
- Permisos revocados.
- Usuarios con mas accesos vehiculares.
- Vehiculos mas usados.
- Intentos rechazados.
- Entradas vehiculares vs peatonales.

## Criterios de aceptacion

La feature esta lista cuando:

- Se puede registrar un vehiculo.
- Se puede asociar vehiculo a usuario.
- Se puede emitir un permiso vehicular.
- El permiso genera QR vehicular.
- El QR no contiene datos sensibles como unico secreto.
- El backend valida token/firma.
- El scanner identifica el QR vehicular.
- El sistema muestra usuario y vehiculo.
- El operador puede comparar placa.
- El sistema registra entrada vehicular.
- El sistema registra salida vehicular.
- El registro queda marcado con `access_mode = vehicle`.
- El permiso puede revocarse.
- El QR revocado deja de funcionar.
- Los eventos quedan auditados.

## Riesgos

- Usar la placa como token secreto.
- Crear un unico QR por vehiculo y perder trazabilidad del usuario.
- Permitir que QR vehicular sustituya cualquier credencial.
- No mostrar placa al operador.
- No revocar permisos vencidos.
- Mezclar vehiculos visitantes con permisos permanentes.
- No distinguir acceso peatonal y vehicular en reportes.

## Decision recomendada

Implementar el QR vehicular como un token firmado o identificador seguro de un permiso `usuario + vehiculo`.

Mantener:

```txt
QR personal = persona / acceso general
QR vehicular = persona + vehiculo / acceso vehicular
```

El backend debe resolver y validar el permiso completo. El frontend/scanner debe mostrar la informacion necesaria para verificacion visual. El registro debe quedar marcado como acceso vehicular.
