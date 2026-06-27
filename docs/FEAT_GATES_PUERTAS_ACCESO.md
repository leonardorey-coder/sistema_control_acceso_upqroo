# Feature: gates y puertas de acceso

## Objetivo

Registrar y controlar el acceso segun la puerta fisica, pluma, torniquete,
caseta o punto de revision donde ocurre el scan.

Esta feature agrega contexto fisico al acceso:

```txt
usuario + credencial + gate + scanner + guardia + hora + resultado
```

## Problema que resuelve

Hoy el sistema puede registrar acceso con un `scannerId` enviado por el cliente,
pero no existe una entidad formal que represente:

- Puerta fisica.
- Tipo de puerta.
- Scanner asignado.
- Guardia asignado.
- Horario permitido.
- Reglas por puerta.
- Estado operativo de la puerta.

Sin gates, el sistema sabe que alguien entro, pero no puede afirmar con rigor
por donde entro ni que reglas de acceso aplicaban en ese punto.

## Match con lo que ya existe

El repo ya tiene piezas compatibles:

- `access_scan_v1` recibe `scannerId` dentro del payload.
- `qr_jti_consumptions.scanner_id` guarda el scanner que consumio un `jti`.
- `access_scan_events.metadata` puede guardar metadata del scanner.
- `registros_acceso` registra entrada/salida, persona, vehiculo y modo.
- `access_mode` ya distingue `pedestrian`, `vehicle`, `visitor`, `manual`.
- El scanner frontend ya envia scans a `/api/v1/access/scan`.
- El admin autenticado se deriva de la sesion, funcionando como guardia/operador
  del scan.

Estas piezas permiten una migracion incremental: primero registrar gates y
scanners, despues hacer que el scan resuelva `gate_id` desde `scannerId`, y solo
despues aplicar reglas por gate.

## Gaps actuales

No existe todavia:

- Tabla `gates`.
- Tabla `gate_scanners`.
- `gate_id` en `registros_acceso`.
- `gate_id` en `access_scan_events`.
- Validacion de estado de puerta.
- Validacion de direccion permitida.
- Reglas por puerta.
- Horarios por puerta.
- Asignacion explicita guardia-gate.
- Reportes por puerta.

## Critica de la propuesta

La feature es de alta prioridad, pero no debe empezar por reglas complejas.

El canvas mezcla:

1. Ubicacion fisica.
2. Dispositivo scanner.
3. Guardia asignado.
4. Reglas de acceso.
5. Disponibilidad de cupo.
6. Modos entrada/salida.

Si todo se implementa de golpe, se corre el riesgo de romper el hot path de
scan. La ruta correcta es incremental:

1. Registrar gate y scanner.
2. Asociar cada scan a un gate.
3. Reportar por gate.
4. Aplicar reglas simples.
5. Agregar reglas avanzadas.

Tambien conviene no confiar ciegamente en un `scannerId` libre enviado por el
frontend. Debe resolverse contra una tabla de scanners registrados y, en una
fase futura, vincularse a dispositivo/sesion.

## Decision recomendada

Crear gates como entidad propia.

No usar `scannerId` como sustituto permanente de gate.

Modelo recomendado:

```txt
gate
-> tiene uno o mas scanners
-> tiene tipo, estado y reglas
-> access_scan_v1 registra gate_id resuelto
```

## Tipos de gate

Valores sugeridos:

```txt
pedestrian
vehicle
mixed
visitors
staff
providers
emergency
events
```

## Estados de gate

Valores sugeridos:

```txt
active
inactive
maintenance
entry_only
exit_only
blocked
emergency
```

## Modelo de datos propuesto

### Gates

```txt
gates
-----
id
code
name
type
location
status
allowed_directions
schedule
rules
notes
created_at
updated_at
```

`code` debe ser estable y legible:

```txt
puerta-norte
caseta-principal
acceso-biblioteca
```

### Gate scanners

```txt
gate_scanners
-------------
id
gate_id
scanner_id
label
status
last_seen_at
metadata
created_at
updated_at
```

`scanner_id` debe ser unico.

### Access records

Agregar de forma aditiva:

```txt
registros_acceso.gate_id
access_scan_events.gate_id
qr_jti_consumptions.gate_id
```

Mantener `scanner_id` para trazabilidad tecnica.

### Gate assignments futura

Para guardias asignados:

```txt
gate_assignments
----------------
id
gate_id
admin_id
starts_at
ends_at
status
created_at
```

No es necesaria en la primera fase si el admin autenticado ya queda en
`adminEntradaId`/`adminSalidaId`.

## Reglas por gate

Primera version recomendada:

- Validar que gate exista.
- Validar que gate este `active`, `entry_only`, `exit_only` o `emergency`.
- Validar tipo compatible:
  - QR vehicular solo en gate `vehicle` o `mixed`.
  - QR peatonal en gate `pedestrian` o `mixed`.
  - visitantes en gate `visitors`, `mixed` o gates permitidos.
- Validar direccion:
  - `entry_only` no permite salida.
  - `exit_only` no permite entrada.
  - `blocked` rechaza todo salvo superadmin/emergencia.

Fase posterior:

- Horarios por gate.
- Reglas por tipo de persona.
- Reglas por evento.
- Proveedores.
- Emergencia.
- Cupo de estacionamiento.

## Flujo de scan con gate

```txt
scanner envia scannerId
-> backend busca gate_scanners.scanner_id
-> resuelve gate_id
-> valida estado del gate
-> verifica QR
-> access_scan_v1 decide entrada/salida
-> valida compatibilidad gate + access_mode + direccion
-> registra gate_id, scanner_id y admin_id
-> responde resultado visual
```

## Reason codes sugeridos

```txt
GATE_NOT_FOUND
GATE_INACTIVE
GATE_BLOCKED
GATE_MAINTENANCE
GATE_ENTRY_ONLY
GATE_EXIT_ONLY
GATE_MODE_NOT_ALLOWED
GATE_SCHEDULE_CLOSED
GATE_VEHICLE_REQUIRED
GATE_VEHICLE_NOT_ALLOWED
```

## API sugerida

```txt
GET    /api/v1/gates
POST   /api/v1/gates
GET    /api/v1/gates/:id
PATCH  /api/v1/gates/:id
POST   /api/v1/gates/:id/disable
POST   /api/v1/gates/:id/block
POST   /api/v1/gates/:id/emergency
```

Scanners:

```txt
GET    /api/v1/gates/:id/scanners
POST   /api/v1/gates/:id/scanners
PATCH  /api/v1/gates/:id/scanners/:scannerId
POST   /api/v1/gates/:id/scanners/:scannerId/revoke
```

Reportes:

```txt
GET /api/v1/access/today?gateId=...
GET /api/v1/access/gates/summary?date=...
```

## UI admin esperada

Agregar tab o seccion:

```txt
Puertas
```

Debe incluir:

- Tabla de gates.
- Estado operativo.
- Tipo de puerta.
- Scanners asociados.
- Ultimo uso.
- Acciones rapidas: activar, bloquear, mantenimiento.
- Formulario compacto de reglas basicas.

En el listado de accesos:

- Filtro por gate.
- Columna gate.
- Columna scanner.
- Modo de acceso.
- Resultado.

## Cambios en scanner

El scanner debe tener un `scannerId` estable.

Opciones:

- Configurado por URL: `/scanner?scannerId=caseta-norte-01`.
- Configurado por local storage con pantalla de vinculacion.
- Vinculado por admin a un gate.

Primera version puede usar URL/config local. La version segura debe requerir
registro del scanner y asociacion a gate.

## Auditoria

Auditar:

- `gate.created`
- `gate.updated`
- `gate.disabled`
- `gate.blocked`
- `gate.emergency_enabled`
- `gate_scanner.created`
- `gate_scanner.revoked`
- `access.scan` con `gateId`

## Riesgos

- Confiar en `scannerId` manipulable.
- Romper el flujo de scan con reglas demasiado complejas.
- Bloquear salidas por mala configuracion.
- No tener modo emergencia.
- Mezclar gate fisico con dispositivo scanner.

## Mitigaciones

- Resolver scanner contra tabla registrada.
- Mantener fallback operativo controlado para gates no configurados durante
  migracion.
- Agregar estado `emergency`.
- Auditar cambios de estado.
- Empezar con reglas simples y tests.

## Dependencias

Depende de:

- Entrada/salida auditable.
- QR dinamico firmado.
- Gestion vehicular para gates vehiculares.
- Auditoria administrativa.

## Orden de implementacion recomendado

1. Crear tablas `gates` y `gate_scanners`.
2. Agregar `gate_id` nullable a registros/eventos/JTI.
3. Crear CRUD admin de gates.
4. Hacer que `/access/scan` resuelva gate desde `scannerId`.
5. Mostrar gate en listados de acceso.
6. Aplicar reglas simples de tipo y estado.
7. Agregar reglas de horario y visitantes.
8. Evaluar cupo de estacionamiento.

## Criterios de aceptacion

- Cada scanner registrado pertenece a un gate.
- Un scan con scanner registrado guarda `gate_id`.
- Un gate bloqueado rechaza accesos con reasonCode claro.
- Un QR vehicular no entra por gate peatonal.
- Un QR peatonal no entra por gate vehicular exclusivo.
- Los listados permiten filtrar por gate.
- Los cambios de estado de gate quedan en `audit_log`.
