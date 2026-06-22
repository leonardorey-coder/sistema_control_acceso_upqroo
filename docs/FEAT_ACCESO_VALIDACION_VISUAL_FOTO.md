# Feature: validacion visual con foto en scanner

## Objetivo

Mostrar la foto institucional y datos minimos de la persona despues de validar
un QR para que el operador pueda comparar visualmente a la persona presente.

Esta feature es una capa humana de seguridad. No reemplaza firma, expiracion ni
anti-replay.

## Problema que resuelve

Aunque el QR sea dinamico y firmado, todavia puede existir riesgo de ataque en
tiempo real:

```txt
atacante obtiene QR valido
-> lo usa antes que el propietario
```

La foto permite que el operador detecte si la persona no coincide.

## Alcance inicial

Mostrar en scanner:

- Foto institucional.
- Nombre.
- Tipo de persona.
- Carrera o rol si aplica.
- Estado de acceso.
- Tipo de credencial.
- Timestamp.
- Placa y vehiculo si es QR vehicular.

## Fuera de alcance inicial

No incluir:

- Reconocimiento facial automatico.
- Biometria.
- Comparacion automatica de rostro.
- Almacenamiento de capturas de camara.
- Decisiones de acceso basadas en IA.

## Flujo

```txt
scanner lee QR
-> backend valida credencial
-> backend registra entrada/salida o rechazo
-> backend resuelve foto
-> scanner muestra resultado visual
-> operador confirma visualmente
```

## Backend

El resultado de `/api/v1/access/scan` debe incluir:

```txt
profilePhotoUrl
fullName
matricula
personType
career
credentialType
accessMode
vehiclePlate
timestamp
```

La foto debe servirse desde storage protegido:

```txt
GET /api/v1/files/:key
```

Reglas:

- Requiere sesion admin/scanner.
- Respeta visibilidad.
- No expone archivos privados sin autorizacion.
- Rechaza MIME no permitido al subir foto.

## Frontend

El scanner debe:

- Mostrar foto grande y redonda.
- Mostrar placeholder sobrio si no hay foto.
- Diferenciar exito y rechazo.
- Mantener datos operativos legibles.
- No saturar la pantalla.
- Funcionar en mobile y desktop.

## Privacidad

La foto se muestra al operador autenticado dentro del flujo de acceso.

No debe exponerse en:

- WebSocket publico.
- Perfil publico si el usuario/institucion no lo permite.
- Respuestas no autenticadas.

## Auditoria

El scan ya debe quedar auditado como `access.scan`.

No auditar cada render de foto para no generar ruido, salvo que en una fase
posterior exista una accion de "ver detalle privado".

## Criterios de aceptacion

- Un scan valido muestra foto si existe.
- Un scan valido sin foto muestra placeholder.
- Un QR rechazado no filtra datos innecesarios.
- El archivo de foto no es accesible sin sesion valida.
- La subida de foto valida MIME y tamano.
- La UI funciona en telefono usado como scanner.
