# Feature: entrada y salida auditable

## Objetivo

Registrar entradas, salidas, reingresos y rechazos de forma consistente,
auditada y compatible con QR personal, QR temporal diario, QR vehicular, Hot-QR
y override manual.

## Decision

No usar un QR de salida derivado del QR de entrada.

Entrada y salida deben validarse con credenciales vigentes en el momento del
scan:

```txt
entrada -> QR dinamico firmado
salida  -> QR dinamico firmado
```

La relacion entrada/salida se decide en backend y PostgreSQL, no en el QR.

## Problema que resuelve

El sistema necesita saber:

- Quien entro.
- Quien salio.
- Si hay acceso abierto.
- Si la salida fue automatica.
- Que scanner se uso.
- Que credencial se presento.
- Que admin u operador estaba autenticado.
- Por que se rechazo un intento.

## Modelo existente

La base actual ya contiene entidades relacionadas:

- `registros_acceso`.
- `access_scan_events`.
- `qr_jti_consumptions`.
- `temporary_daily_qr_tokens`.
- `vehicle_permit_qr_tokens`.
- `hot_qr_tokens`.

La funcion SQL `access_scan_v1` debe seguir siendo el punto atomico para decidir
entrada/salida y mantener consistencia.

## Datos por scan

Cada evento debe conservar:

```txt
person_id
vehicle_id
vehicle_permit_id
credential_type
access_mode
accepted
reason_code
jti
kid
signature_alg
scanner_id
admin_id
created_at
```

No guardar:

- Token QR completo.
- `signedQr` completo.
- Password/session/token hashes.
- Clave privada.

Guardar solo hash, `jti` o metadata segura cuando sea necesario.

## Flujos

### Entrada peatonal

```txt
QR personal valido
-> no hay acceso abierto
-> crear registro con entrada_at
-> responder action = entry
```

### Salida peatonal

```txt
QR personal valido
-> hay acceso abierto
-> completar salida_at
-> responder action = exit
```

### QR temporal diario

```txt
QR temporal firmado
-> validar persona y vigencia del temporal
-> marcar credential_type = temporary_daily_qr
-> marcar is_exception_access = true
```

### QR vehicular

```txt
QR vehicular firmado
-> validar permiso, persona y vehiculo
-> access_mode = vehicle
-> vincular vehicle_permit_id
```

### Rechazo

```txt
credencial invalida o estado no permitido
-> no crear acceso abierto
-> registrar evento de rechazo
-> responder reasonCode claro
```

## Auditoria

Cada scan aceptado o rechazado debe generar:

- Evento tecnico en `access_scan_events`.
- Auditoria administrativa `access.scan`.
- Broadcast sin PII sensible para refresco de tablas.

## Reportes

Debe poder filtrarse por:

- Fecha operativa.
- Tipo de persona.
- Tipo de credencial.
- Modo de acceso.
- Estado.
- Scanner.
- Rechazos.
- Excepciones.

## Criterios de aceptacion

- Un scan abre entrada si no hay registro abierto.
- Un segundo scan cierra salida.
- Un replay de `jti` se rechaza.
- QR temporal marca excepcion.
- QR vehicular marca modo vehicular.
- Rechazos quedan trazados.
- No se persiste el token completo en metadata.
