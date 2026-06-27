# Feature: gestion de vehiculos del campus

## Objetivo

Extender la gestion vehicular para que el sistema controle no solo que persona
entra al campus, sino tambien que vehiculo ingresa, bajo que permiso, por que
puerta y con que vigencia.

Esta feature no reemplaza `FEAT_QR_VEHICULAR_FIRMADO.md`. La complementa:

- `FEAT_QR_VEHICULAR_FIRMADO.md` define la credencial segura para un permiso
  vehicular.
- Este documento define la gestion completa del dominio vehicular: tipos,
  estados, aprobaciones, visitantes, cupo, permisos especiales y relacion con
  gates.

## Problema que resuelve

El acceso peatonal responde:

```txt
quien entra
```

El acceso vehicular debe responder:

```txt
quien entra
con que vehiculo
con que permiso
por que puerta
con que resultado
```

Sin esta separacion, un alumno activo podria estar autorizado como persona pero
no necesariamente autorizado para entrar con un auto especifico.

## Match con lo que ya existe

El repo ya tiene una base vehicular importante:

- Tabla `vehicles`.
- Tabla `vehicle_permits`.
- Tabla `vehicle_permit_qr_tokens`.
- Enum `access_mode` con `vehicle`.
- Enum `credential_type` con `vehicle_permit_qr`.
- `registros_acceso.vehicle_id`.
- `registros_acceso.vehicle_permit_id`.
- `access_scan_events.vehicle_id`.
- Ruta API `/api/v1/vehicles`.
- Ruta API `/api/v1/vehicles/permits`.
- QR vehicular opaco y QR vehicular dinamico firmado.
- Validacion de `person_types.canHaveVehiclePermit`.
- Scanner/access scan capaz de registrar `access_mode = vehicle`.
- Listados admin de vehiculos y permisos con filtros basicos.

Esto significa que no hay que empezar desde cero. La feature debe ser una
evolucion aditiva sobre el modelo actual.

## Gaps actuales contra el canvas

### Tipo de vehiculo

El canvas distingue:

- Automovil.
- Motocicleta.
- Bicicleta.
- Scooter electrico.
- Camioneta.
- Vehiculo oficial.
- Transporte universitario.
- Vehiculo visitante.
- Otro.

Actualmente `vehicles` no tiene `vehicle_type`; solo tiene `plate`, `make`,
`model`, `color`, `status` y `notes`.

### Estados mas ricos

El canvas propone:

- Activo.
- Pendiente de aprobacion.
- Rechazado.
- Suspendido.
- Temporal.
- Eliminado.

Actualmente `vehicle_status` solo soporta:

```txt
active
inactive
blocked
```

Y `vehicle_permit_status` soporta:

```txt
active
expired
revoked
suspended
```

Falta representar aprobacion/rechazo y temporalidad a nivel de vehiculo o
solicitud.

### Visitantes con vehiculo temporal

El repo tiene `hot_qr_tokens` para visitantes, pero no hay relacion formal entre
un visitante temporal y un vehiculo temporal.

Si se necesita acceso vehicular visitante, no conviene mezclarlo con permisos
permanentes. Debe modelarse como permiso temporal o extension de Hot-QR con
datos vehiculares.

### Cupo de estacionamiento

El canvas menciona cupo disponible. Actualmente no hay:

- Estacionamientos.
- Zonas.
- Capacidad.
- Ocupacion.
- Reglas de cupo por gate o permiso.

Esto debe tratarse como fase posterior, no como requisito inicial de vehiculos.

### Relacion vehiculo-gate

El acceso vehicular debe validarse contra puertas vehiculares. Hoy el scan puede
recibir `scannerId`, pero no existe entidad `gates` ni reglas de puerta.

Por eso la validacion "vehiculo autorizado en esta puerta" depende de la feature
de gates.

## Critica de la propuesta

La propuesta es correcta en direccion, pero mezcla tres niveles que conviene
separar:

1. Vehiculo como objeto registrado.
2. Permiso vehicular como autorizacion persona-vehiculo.
3. Acceso vehicular como evento en una puerta especifica.

Si se guarda todo en `vehicles`, el modelo se vuelve rigido. Un mismo vehiculo
puede cambiar de responsable, tener permiso temporal, quedar bloqueado o entrar
como visitante. Por eso el permiso debe seguir siendo entidad propia.

Tambien conviene evitar que el QR personal "valide tambien su vehiculo" de forma
implicita. El modelo actual ya va en mejor direccion: el QR vehicular representa
el permiso vehicular. El QR personal debe seguir siendo agnostico para acceso
general.

## Decision recomendada

Mantener el modelo conceptual:

```txt
persona
+ vehiculo
+ permiso vehicular
+ QR vehicular firmado
+ gate vehicular
= acceso vehicular valido
```

No aceptar acceso vehicular solo con QR personal, salvo override manual
auditado.

## Modelo de datos propuesto

### Extender `vehicles`

Agregar de forma aditiva:

```txt
vehicle_type
approval_status
registered_by_admin_id
approved_by_admin_id
approved_at
rejected_by_admin_id
rejected_at
rejection_reason
deleted_at
```

Valores sugeridos para `vehicle_type`:

```txt
car
motorcycle
bicycle
electric_scooter
truck
official
university_transport
visitor
other
```

Valores sugeridos para `approval_status`:

```txt
pending
approved
rejected
```

### Mantener `vehicle_permits`

No mover la autorizacion a `vehicles`.

Extender permisos si se necesita:

```txt
permit_type
scope
allowed_gate_ids
allowed_days
allowed_time_ranges
parking_zone_id
max_daily_entries
```

Valores sugeridos para `permit_type`:

```txt
standard
temporary
official
visitor
provider
event
emergency
```

### Visitantes vehiculares

Primera version prudente:

- Reusar Hot-QR para identidad visitante.
- Crear permiso vehicular temporal asociado a datos de visitante o a un registro
  vehicular temporal.
- Marcar `access_mode = vehicle` y `credential_type = hot_qr` o
  `vehicle_permit_qr` segun el flujo elegido.

No crear vehiculos anonimos sin responsable.

## Flujos principales

### Alumno con vehiculo registrado

```txt
admin registra vehiculo
-> admin aprueba vehiculo
-> admin crea permiso persona-vehiculo
-> sistema emite QR vehicular
-> usuario presenta QR vehicular en gate vehicular
-> access_scan_v1 valida persona, vehiculo y permiso
-> registra entrada/salida vehicular
```

### Administrativo con permiso especial

```txt
admin crea permiso tipo official/standard
-> define vigencia y scope
-> gate valida si el permiso aplica a esa puerta y horario
```

### Visitante temporal con vehiculo

```txt
admin crea visitante/Hot-QR
-> captura placa, tipo, color y motivo
-> define vigencia corta
-> gate visitantes valida horario y puerta
-> registro queda marcado como visitante vehicular
```

### Vehiculo suspendido

```txt
vehiculo.status = blocked
-> cualquier permiso asociado queda rechazado en scan
-> se registra reasonCode claro
```

## API sugerida

Extender lo existente:

```txt
GET    /api/v1/vehicles
POST   /api/v1/vehicles
GET    /api/v1/vehicles/:id
PATCH  /api/v1/vehicles/:id
POST   /api/v1/vehicles/:id/approve
POST   /api/v1/vehicles/:id/reject
POST   /api/v1/vehicles/:id/block
POST   /api/v1/vehicles/:id/delete
```

Permisos:

```txt
GET    /api/v1/vehicles/permits
POST   /api/v1/vehicles/permits
PATCH  /api/v1/vehicles/permits/:id
POST   /api/v1/vehicles/permits/:id/revoke
POST   /api/v1/vehicles/permits/:id/qr/dynamic
```

Visitantes vehiculares:

```txt
POST /api/v1/vehicles/visitor-permits
GET  /api/v1/vehicles/visitor-permits
POST /api/v1/vehicles/visitor-permits/:id/revoke
```

## UI admin esperada

La tab `Vehiculos` debe evolucionar a:

- Vehiculos registrados.
- Permisos vehiculares.
- Solicitudes pendientes.
- Visitantes vehiculares.
- Filtros por placa, persona, estado, tipo y vigencia.
- Acciones de aprobar, rechazar, suspender y revocar.

La UI debe seguir el estilo legacy compacto: tablas densas, formularios
operativos, badges de estado y sin dashboard decorativo.

## Reglas de seguridad

- Un usuario activo no implica vehiculo autorizado.
- Un vehiculo activo no implica permiso activo.
- Un permiso activo no implica acceso por cualquier gate.
- Un QR vehicular no debe contener placa como secreto.
- El QR vehicular dinamico debe seguir usando firma, expiracion corta y `jti`.
- Toda accion manual debe auditarse.

## Auditoria

Auditar:

- `vehicle.created`
- `vehicle.updated`
- `vehicle.approved`
- `vehicle.rejected`
- `vehicle.blocked`
- `vehicle.deleted`
- `vehicle_permit.created`
- `vehicle_permit.updated`
- `vehicle_permit.revoked`
- `vehicle_permit_qr.dynamic_issued`
- `vehicle_access.rejected`

## Dependencias

Depende de:

- QR vehicular firmado.
- Entrada/salida auditable.
- Gates/puertas de acceso para reglas por puerta.
- Auditoria administrativa.

## Orden de implementacion recomendado

1. Agregar `vehicle_type` y estados de aprobacion.
2. Agregar acciones admin de aprobar/rechazar/bloquear.
3. Completar UI de solicitudes y filtros.
4. Agregar permisos temporales/visitantes vehiculares.
5. Conectar reglas por gate.
6. Evaluar cupo de estacionamiento como feature posterior.

## Criterios de aceptacion

- Un vehiculo puede registrarse con tipo y responsable.
- Un vehiculo pendiente no puede usarse para acceso vehicular.
- Un permiso vehicular solo se emite si persona, vehiculo y tipo son validos.
- Un QR vehicular firmado registra `access_mode = vehicle`.
- Un vehiculo bloqueado causa rechazo trazable.
- El listado permite filtrar por placa, persona, estado y tipo.
- Cada cambio critico queda en `audit_log`.
