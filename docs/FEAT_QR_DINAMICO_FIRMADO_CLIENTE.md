# Feature: QR dinamico firmado con prueba de cliente

## Objetivo

Elevar la seguridad del QR del portal de usuario y de credenciales v2 mediante:

- QR dinamico de expiracion corta.
- Token firmado por servidor.
- `jti` unico con control anti-replay.
- Verificacion rapida por scanner.
- Prueba opcional de posesion firmada en cliente para reducir copia por screenshot.

Esta feature no reemplaza el modelo actual de tokens opacos con hash en base de
datos. Lo mejora. El estado actual ya evita el QR legacy basado solo en
matricula; el riesgo pendiente es que un token valido copiado pueda usarse
mientras no expire o no sea revocado.

## Problema

Un QR estatico o de larga vida funciona como bearer token:

```txt
quien lo presenta = quien puede usarlo
```

Aunque el token no sea predecible, sigue teniendo riesgos:

- Screenshot o foto del QR.
- Reenvio por chat.
- Uso antes que el propietario real.
- Reutilizacion si no existe consumo por `jti`.
- Scanner comprometido que intenta simular credenciales.

La matricula nunca debe volver a ser secreto. Puede ser dato visual, pero no
factor de autenticacion.

## Decision de seguridad

El QR seguro debe ser dinamico y firmado, pero la firma principal debe seguir
siendo del servidor.

No se debe guardar una clave privada institucional dentro del frontend. Si la
clave privada queda en JavaScript, storage del navegador o app instalable, deja
de ser privada.

La firma en cliente se usara solo como prueba de posesion de dispositivo o
sesion, no como firma institucional.

Modelo recomendado:

```txt
Servidor firma credencial efimera
+ Cliente puede firmar un nonce con clave local no exportable
+ Scanner verifica firma y jti
+ Backend confirma consumo anti-replay
```

## Token QR recomendado

Formato recomendado: JWT/JWS compacto o CBOR firmado si se quiere reducir
tamanio. Para la primera version, JWT/JWS es suficiente.

Payload base:

```json
{
  "typ": "person_qr",
  "sub": "person_id",
  "uid": "202300120",
  "iat": 1718890000,
  "nbf": 1718890000,
  "exp": 1718890030,
  "jti": "uuid-unico",
  "ver": 3,
  "sid": "portal_session_id",
  "aud": "access_scanner",
  "iss": "control-acceso-upqroo"
}
```

Campos:

- `typ`: tipo de credencial, por ejemplo `person_qr`, `temporary_daily_qr`,
  `vehicle_permit_qr` o `hot_qr`.
- `sub`: identidad interna estable, preferentemente `person_id`.
- `uid`: matricula o identificador visible; no es secreto.
- `iat`: fecha de emision.
- `nbf`: no valido antes de este instante.
- `exp`: expiracion corta, idealmente 15 a 30 segundos.
- `jti`: identificador unico para anti-replay.
- `ver`: version de credencial/token.
- `sid`: sesion o device binding opcional.
- `aud`: scanner o grupo de scanners autorizados.
- `iss`: emisor institucional.

Nunca incluir:

- `passwordHash`.
- `sessionHash`.
- `tokenHash`.
- secretos de firma.
- datos personales innecesarios.

## Firma asimetrica

### Firma institucional

Servidor:

- Tiene clave privada.
- Firma tokens efimeros.
- Rota claves con `kid`.
- Publica claves publicas por endpoint interno o configuracion de scanner.

Scanner:

- Tiene solo clave publica.
- Verifica firma y expiracion.
- No puede generar QRs validos.

Algoritmos recomendados:

- `EdDSA` con Ed25519 si las librerias elegidas lo soportan bien en Bun y el
  runtime del scanner.
- `ES256` con P-256 si se prioriza compatibilidad WebCrypto.
- Evitar `HS256` para scanners distribuidos, porque obligaria a compartir un
  secreto simetrico.

### Firma en cliente

La firma en cliente debe ser una prueba adicional, no la fuente de confianza
principal.

Flujo recomendado:

```txt
Usuario inicia sesion en portal
-> backend registra o recupera una device key publica
-> browser guarda clave privada no exportable con WebCrypto
-> backend emite challenge/nonce
-> cliente firma challenge localmente
-> backend emite QR firmado con referencia a esa prueba
```

Uso:

- Reduce robo simple de token si se combina con sesiones cortas y device
  binding.
- Permite detectar QRs generados desde dispositivos no registrados.
- Puede desactivarse al inicio si complica soporte institucional.

No usar:

- Clave privada institucional en cliente.
- Secretos persistidos en `localStorage`.
- Tokens firmados solo por cliente.

## Flujo de usuario

```txt
Usuario abre /portal/qr
-> sesion httpOnly valida
-> si aplica, verifica 2FA por correo institucional
-> cliente solicita QR dinamico
-> backend emite token firmado con exp corta y jti unico
-> frontend renderiza QR
-> frontend refresca cada 15-30 segundos
```

El QR maximizado debe mostrar:

- QR grande.
- contador de expiracion.
- nombre y matricula como datos visuales.
- estado de sesion.
- aviso si no pudo refrescar.

Si el usuario pierde conexion:

- Mantener visible el ultimo QR solo hasta `exp`.
- Despues mostrar estado vencido.
- No extender vigencia localmente.

## Flujo de scanner

```txt
Scanner lee QR
-> verifica estructura
-> verifica firma con clave publica
-> verifica iss/aud/typ
-> verifica nbf/exp con tolerancia de reloj minima
-> manda jti al backend o usa cache sincronizada
-> backend consume jti de forma atomica
-> access_scan_v1 decide entrada/salida/asistencia
-> scanner muestra foto, nombre, tipo, carrera/vehiculo y timestamp
```

La verificacion local en scanner sirve para rechazo rapido, pero el consumo del
`jti` debe ser atomico en backend cuando haya conexion.

## Anti-replay

Agregar tabla o registro especializado para consumo de `jti`.

Nombre sugerido:

```txt
qr_jti_consumptions
```

Campos minimos:

```txt
jti
credential_type
person_id nullable
vehicle_permit_id nullable
hot_qr_id nullable
temporary_daily_qr_id nullable
scanner_id
access_record_id nullable
issued_at
expires_at
consumed_at
rejected_reason nullable
metadata jsonb
```

Regla critica:

```txt
UNIQUE(jti)
```

El consumo debe ocurrir dentro de la funcion atomica de acceso o en una funcion
SQL llamada por ella. Si dos scanners intentan usar el mismo QR, solo uno debe
ganar.

Estados recomendados:

- `accepted`.
- `already_used`.
- `expired`.
- `invalid_signature`.
- `wrong_audience`.
- `revoked_credential`.
- `inactive_person`.

## APIs propuestas

### Claves publicas de verificacion

```txt
GET /api/v1/qr-keys/current
GET /api/v1/qr-keys/jwks
POST /api/v1/qr-keys/rotate
```

`POST /rotate` solo para `super_admin` o proceso interno.

### QR dinamico de portal

```txt
POST /api/v1/portal/qr/dynamic
```

Respuesta:

```json
{
  "token": "jwt-firmado",
  "expiresAt": "2026-06-20T12:00:30.000Z",
  "refreshAfterMs": 15000
}
```

### QR temporal dinamico

```txt
POST /api/v1/portal/temporary-daily-qr/dynamic
POST /api/v1/credentials/temporary-daily/:id/dynamic
```

### Scanner

Mantener:

```txt
POST /api/v1/access/scan
```

Aceptar:

```json
{
  "signedQr": "jwt-firmado",
  "scannerId": "puerta-principal"
}
```

Compatibilidad temporal:

```json
{
  "token": "token-opaco-actual"
}
```

El backend debe soportar ambos durante migracion:

- `signedQr`: preferido.
- `token`: compatibilidad v2 actual.
- `manualMatricula`: excepcion controlada.

## Cambios en base de datos

Agregar migracion nueva:

```txt
0003_signed_dynamic_qr.sql
```

Cambios sugeridos:

- `qr_signing_keys`: metadatos de claves, `kid`, algoritmo, estado, fechas.
- `qr_jti_consumptions`: consumo anti-replay.
- `qr_tokens`: relacion opcional con `current_kid` o `token_version` si se
  requiere trazabilidad.
- `access_scan_events`: guardar `jti`, `kid`, `signature_alg`,
  `signature_verified`, `replay_status`.
- Indices por `jti`, `expires_at`, `person_id`, `scanner_id`, `consumed_at`.

No guardar claves privadas en PostgreSQL si no hay KMS. En desarrollo pueden
vivir en variables de entorno; en produccion deben estar en KMS, secret manager
o archivo protegido fuera del repo.

## Cambios backend

Modulo sugerido:

```txt
qr-signing
```

Responsabilidades:

- Cargar clave privada activa.
- Firmar QR dinamico.
- Exponer JWKS/public keys.
- Verificar firmas si el scanner delega al backend.
- Gestionar `kid` y rotacion.

Modulo `access`:

- Parsear `signedQr`.
- Validar `typ`, `aud`, `iss`, `exp`, `nbf`, `jti`.
- Consumir `jti` atomicamente.
- Resolver persona/vehiculo/temporal/hot-qr.
- Mantener respuesta visual actual.

Modulo `worker`:

- Limpiar consumos `jti` vencidos segun ventana configurable.
- Expirar claves antiguas despues de periodo de gracia.

## Cambios frontend

Portal usuario:

- Reemplazar QR estatico visible por QR dinamico.
- Refrescar automaticamente antes de expirar.
- Mostrar countdown.
- Marcar QR como vencido si falla refresh.
- No guardar token firmado en `localStorage`.

Scanner:

- Aceptar QR firmado.
- Mostrar rechazo claro por expirado/reutilizado.
- Mantener foto y datos visuales para mitigacion humana.

Configuracion admin:

- Agregar parametros:
  - duracion QR dinamico: 15, 20 o 30 segundos.
  - tolerancia reloj scanner: 3 a 5 segundos.
  - modo compatibilidad tokens opacos.
  - alertas por replay.

## 2FA por correo

El QR dinamico puede funcionar sin 2FA, pero la emision desde portal debe
fortalecerse con 2FA cuando la institucion lo habilite.

Flujo:

```txt
login usuario
-> si dispositivo nuevo o sesion sensible, enviar codigo correo
-> verificar codigo
-> permitir /portal/qr/dynamic
```

Tabla sugerida:

```txt
user_email_otp_challenges
```

Campos:

- `account_id`.
- `code_hash`.
- `expires_at`.
- `consumed_at`.
- `attempts`.
- `ip_address`.
- `user_agent`.

No guardar codigo plano.

## Ataques mitigados

| Ataque | Mitigacion |
| --- | --- |
| Adivinar matricula | El QR ya no depende de matricula como secreto |
| QR falsificado | Firma asimetrica |
| Modificar payload | Firma invalida |
| Copiar QR viejo | `exp` corto |
| Reutilizar QR | `jti` unico consumido |
| Scanner comprometido | Scanner no tiene clave privada |
| Screenshot en tiempo real | Reducido por expiracion y anti-replay |
| Usuario comparte QR | Foto, auditoria, alertas y expiracion corta |

## Riesgo residual

Sigue existiendo un riesgo acotado:

```txt
alguien copia el QR y lo usa dentro de 15-30 segundos antes que el dueño
```

Mitigaciones:

- Expiracion corta.
- Consumo unico de `jti`.
- Foto visible al operador.
- Puerta/scanner/hora en auditoria.
- Alerta cuando hay replays frecuentes.
- Posible device binding con firma cliente.

## Plan de implementacion recomendado

### Fase 1: Firma servidor + expiracion corta

- Agregar `qr-signing`.
- Crear endpoint `/api/v1/portal/qr/dynamic`.
- Renderizar QR dinamico en `/portal/qr`.
- Scanner envia `signedQr`.
- Backend verifica firma y exp.

### Fase 2: Anti-replay atomico

- Crear `qr_jti_consumptions`.
- Integrar consumo en `access_scan_v1` o funcion SQL auxiliar.
- Rechazar `jti` repetido.
- Agregar pruebas de carrera/concurrencia.

### Fase 3: Compatibilidad y migracion

- Mantener tokens opacos actuales como fallback.
- Agregar flag operacional `signedQrEnabled`.
- Registrar metricas de uso firmado vs opaco.
- Rotar gradualmente QR del portal usuario primero.

### Fase 4: Firma cliente/device binding

- Registrar clave publica del dispositivo.
- Generar clave privada no exportable con WebCrypto.
- Firmar challenge antes de emitir QR dinamico.
- Revocar dispositivos desde portal/admin.

### Fase 5: 2FA por correo

- Agregar OTP por correo institucional.
- Requerir 2FA en dispositivo nuevo o antes de emitir QR.
- Auditar desafios fallidos.

## Pruebas

Backend unit:

- Token firmado valido.
- Firma invalida rechazada.
- `exp` vencido rechazado.
- `nbf` futuro rechazado.
- `aud` incorrecto rechazado.
- `jti` duplicado rechazado.
- No se devuelve clave privada ni `tokenHash`.

Backend integracion:

- Portal emite QR dinamico.
- Scanner registra entrada con `signedQr`.
- Segundo scan del mismo `jti` rechaza replay.
- QR expirado no registra acceso.
- QR opaco actual sigue funcionando con flag de compatibilidad.
- QR temporal diario firmado registra acceso de excepcion.
- QR vehicular firmado respeta permiso activo/revocado.

Frontend:

- `/portal/qr` refresca QR antes de expirar.
- Countdown se actualiza.
- QR vencido deja de mostrarse como valido.
- No hay token persistido en `localStorage`.
- Scanner muestra error por expirado/replay.

Seguridad:

- Clave privada no aparece en bundle frontend.
- Clave privada no aparece en repo.
- JWKS solo publica claves publicas.
- Rotacion por `kid` mantiene periodo de gracia.

## Criterios de aceptacion

- Ningun QR nuevo usa matricula como secreto.
- QR dinamico expira en 15-30 segundos.
- Todo QR dinamico incluye `jti`.
- Un mismo `jti` no puede abrir dos accesos.
- Scanner puede verificar firma sin clave privada.
- Backend mantiene compatibilidad con tokens opacos hasta completar migracion.
- Portal usuario muestra QR dinamico con countdown.
- La respuesta visual del scanner mantiene foto, nombre, tipo, estado y hora.

## Decision final

La mejor evolucion para el sistema es:

```txt
token opaco actual
-> QR dinamico firmado por servidor
-> anti-replay por jti
-> device binding con firma cliente opcional
-> 2FA por correo para emision sensible
```

Esto conserva lo ya implementado en v2, evita volver al modelo de matricula como
secreto y mejora de forma incremental contra copia, falsificacion y replay.
