# Feature: Portal de usuario con QR personal

## Objetivo

Crear un portal de usuario donde cada persona pueda consultar su QR personal, maximizarlo para escaneo, revisar metricas propias de asistencia/acceso y generar codigos temporales cuando sus permisos lo permitan.

Esta feature complementa el panel administrativo. No lo reemplaza.

## Nombre recomendado

El nombre recomendado es:

```txt
Portal de usuario
```

Tambien puede aparecer como:

```txt
Mi QR
Credencial digital
Panel personal
```

No se recomienda llamarlo "panel administrativo de usuario", porque puede confundirse con el panel de administradores. El portal de usuario debe tener permisos, rutas y alcance separados.

## Problema que resuelve

Actualmente el sistema gira principalmente alrededor del administrador que registra, escanea o consulta informacion.

El portal de usuario agrega una experiencia autoservicio:

- El usuario puede mostrar su QR sin depender de un administrador.
- El usuario puede consultar su estado y metricas.
- El usuario puede generar codigos temporales si la institucion lo permite.
- El sistema puede reducir friccion operativa en accesos, asistencias y credenciales.

## Usuarios objetivo

### Usuario normal

Puede ser:

- Estudiante.
- Docente.
- Administrativo.
- Invitado recurrente.

Acciones esperadas:

- Ver su QR.
- Maximizar su QR.
- Consultar metricas personales.
- Consultar historial propio.
- Generar codigos temporales si tiene permiso.
- Revocar codigos propios si aplica.

### Administrador

No usa este portal como panel principal, pero puede:

- Auditar codigos generados.
- Revocar codigos.
- Ver historial desde el panel administrativo.
- Configurar permisos para generar codigos.

## Alcance funcional

La primera version del portal debe incluir:

- Autenticacion de usuario.
- Visualizacion de QR personal.
- Modo de QR maximizado.
- Estado del usuario.
- Metricas personales basicas.
- Historial reciente de entrada/salida.
- Generacion de QR temporal o codigo temporal si esta permitido.
- Historial de codigos temporales.
- Revocacion de codigos temporales propios.

## Fuera de alcance inicial

No se recomienda incluir en la primera version:

- Ranking entre estudiantes.
- Comparativas publicas entre usuarios.
- Chat o mensajeria.
- Justificacion formal de faltas.
- Firma digital avanzada.
- Credencial offline completamente independiente del backend.
- Acceso publico sin sesion a datos sensibles.

## Experiencia principal

### Entrada al portal

El usuario entra a una URL publica, por ejemplo:

```txt
/usuario
/mi-qr
/portal
```

La URL puede ser publica, pero el contenido sensible no debe ser publico.

Flujo recomendado:

```txt
Usuario abre URL publica
-> si no tiene sesion, ve login
-> inicia sesion o usa enlace seguro
-> entra al portal
-> ve su QR y metricas
```

## Pantalla principal

La pantalla principal debe priorizar el QR.

En movil:

```txt
[QR personal grande]
[Boton Maximizar]
[Estado de acceso]
[Acciones rapidas]
[Metricas resumidas]
[Graficas]
[Historial reciente]
```

En escritorio:

```txt
[QR personal]       [Metricas rapidas]
[Acciones]          [Graficas BI-like]
[Historial reciente en tabla]
```

## QR personal

El QR debe mostrarse en primera plana.

Debe permitir:

- Ver QR actual.
- Maximizar QR.
- Ajustar contraste visual.
- Mostrar estado de vigencia.
- Refrescar si es dinamico.
- Indicar si el QR esta vencido, revocado o inactivo.

### Modo maximizado

El modo maximizado debe:

- Ocultar distracciones.
- Mostrar QR grande.
- Aumentar contraste.
- Evitar scroll accidental.
- Mostrar identificador minimo del usuario.
- Mostrar expiracion si aplica.
- Incluir boton para cerrar.

Ejemplo:

```txt
---------------------------------
|                               |
|           QR GRANDE           |
|                               |
|  Juan Perez - Estudiante      |
|  Expira en 00:45              |
|                               |
|  [Cerrar]                     |
---------------------------------
```

## Modelo de QR

### Opcion minima

QR estatico asociado a la matricula o identificador.

Ventajas:

- Simple.
- Compatible con el sistema actual.
- Facil de implementar.

Riesgos:

- Puede capturarse en screenshot.
- Puede compartirse.
- No expira.
- Es dificil de revocar si el identificador es permanente.

### Opcion recomendada

QR firmado, temporal y revocable.

Contenido conceptual:

```txt
qr_token
user_id
issued_at
expires_at
nonce
signature
```

Reglas:

- Expira en segundos o minutos.
- Se valida en backend.
- Puede revocarse.
- Se audita su uso.
- No expone directamente la matricula.

### Decision recomendada

Para primera migracion puede aceptarse QR estatico si se necesita compatibilidad.

Para version final, el QR del portal debe ser:

```txt
firmado
temporal
revocable
auditado
```

## Metricas personales

El portal debe mostrar metricas tipo BI, pero limitadas al usuario autenticado.

Metricas recomendadas:

- Porcentaje de asistencia.
- Horas acumuladas.
- Entradas del mes.
- Ultima entrada.
- Ultima salida.
- Estado actual: dentro/fuera.
- Asistencias por semana.
- Horas por periodo.
- Tendencia mensual.
- Faltas o asistencias no confirmadas.
- Materias o bloques con menor asistencia.

## Graficas

Graficas recomendadas:

- Linea: asistencia por semana.
- Barras: horas por mes.
- Donut o indicador: porcentaje de asistencia.
- Tabla: historial reciente.
- Tarjetas: estado actual y resumen rapido.

Las graficas deben ser utiles, no decorativas. El usuario debe poder entender rapidamente su situacion.

## Codigos temporales

El portal puede permitir generar codigos temporales.

Tipos posibles:

### QR temporal propio

Uso:

- Cuando el usuario necesita un QR de corta duracion.
- Cuando se quiere evitar usar un QR permanente.

Reglas:

- Expira rapido.
- Puede revocarse.
- Se registra su uso.

### Codigo de acceso temporal

Uso:

- Acceso excepcional.
- Invitado autorizado.
- Recuperacion o contingencia.

Reglas recomendadas:

- Motivo obligatorio.
- Expiracion obligatoria.
- Uso unico por defecto.
- Limite diario.
- Auditoria.
- Posible aprobacion administrativa.

## Seguridad

Reglas obligatorias:

- El portal puede tener URL publica, pero el QR y metricas requieren sesion.
- No exponer matricula si no es necesario.
- No guardar secretos del usuario en `localStorage`.
- Usar cookies `httpOnly`.
- Separar permisos de usuario y administrador.
- Auditar creacion, uso y revocacion de codigos temporales.
- Permitir revocacion.
- Evitar QR permanentes para accesos sensibles.

## Permisos

Permisos sugeridos:

```txt
user.qr.view
user.qr.refresh
user.metrics.view
user.temp_code.create
user.temp_code.revoke
user.temp_code.history
```

Los administradores tendrian permisos separados:

```txt
admin.temp_code.audit
admin.temp_code.revoke_any
admin.user.portal_status
```

## API sugerida

```txt
GET  /api/v1/user/me
GET  /api/v1/user/qr
POST /api/v1/user/qr/refresh

GET  /api/v1/user/metrics
GET  /api/v1/user/access-history

GET  /api/v1/user/temp-codes
POST /api/v1/user/temp-codes
POST /api/v1/user/temp-codes/:id/revoke
```

## Estructura frontend sugerida

```txt
frontend/src/routes/portal/
  +layout.svelte
  +page.svelte

frontend/src/lib/user-portal/
  UserQrCard.svelte
  UserQrFullscreen.svelte
  UserMetricsGrid.svelte
  UserCharts.svelte
  TemporaryCodeActions.svelte
  TemporaryCodeHistory.svelte
```

## Estructura backend sugerida

```txt
backend/src/modules/user-portal/
  userPortal.routes.ts
  userPortal.schemas.ts
  userPortal.service.ts
  userPortal.repository.ts
  userPortal.test.ts

backend/src/modules/qr-token/
  qrToken.service.ts
  qrToken.repository.ts
```

## Datos necesarios

Tablas o modelos relacionados:

- `personas`
- `usuarios`
- `user_sessions`
- `qr_tokens`
- `temporary_access_codes`
- `registros_acceso`
- `asistencias_potenciales`
- `audit_log`

Algunos nombres pueden cambiar durante el diseno tecnico.

## Estados relevantes

Estado del usuario:

```txt
activo
inactivo
suspendido
qr_expirado
qr_revocado
```

Estado de presencia:

```txt
dentro
fuera
sin_registro_hoy
salida_pendiente
```

Estado de codigo temporal:

```txt
activo
usado
expirado
revocado
rechazado
```

## Criterios de aceptacion

La feature se considera lista cuando:

- El usuario puede iniciar sesion.
- El usuario puede ver su QR.
- El usuario puede maximizar el QR.
- El QR se muestra con contraste suficiente para escaneo.
- El usuario ve su estado actual.
- El usuario ve metricas personales basicas.
- El usuario ve historial reciente.
- El usuario puede generar codigo temporal si tiene permiso.
- El usuario puede revocar codigos propios activos.
- El backend audita la creacion y uso de codigos.
- El administrador puede auditar estos codigos desde su panel.
- Las rutas del portal no aceptan sesion de administrador como usuario normal sin control explicito.

## Riesgos

- Exponer QR sin autenticacion.
- Permitir que capturas del QR funcionen indefinidamente.
- Crear codigos temporales sin limites.
- Mezclar permisos de usuario con permisos de administrador.
- Mostrar metricas sensibles de otros usuarios.
- Sobrecargar la primera pantalla con demasiadas graficas.
- Hacer el QR dificil de escanear por baja resolucion, poco contraste o demasiada UI alrededor.

## Decision recomendada

La feature debe implementarse como:

```txt
Portal de usuario autenticado
QR personal en primera plana
Modo QR maximizado
Metricas personales BI-like
Codigos temporales con permisos y auditoria
QR final firmado, temporal y revocable
```

La primera version puede iniciar con QR compatible con el sistema actual, pero la arquitectura debe prepararse desde el inicio para QR dinamicos o revocables.
