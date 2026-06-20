# Plan frontend v2 gui legacy-identica

## Estado actual

El frontend actual de `apps/web` sigue siendo una capa de compatibilidad
operativa para probar backend v2. No es el ensamblado visual definitivo.

La version final no debe partir de un rediseño libre. Debe clonar la GUI legacy
de la rama `feature/mejoras-sistema-acceso` y migrarla a:

- SvelteKit.
- TypeScript.
- Tailwind CSS.
- Cliente API unico.
- Sesiones por cookies `httpOnly`.
- WebSocket nativo del backend Bun.

La palabra clave para esta fase es compatibilidad visual: misma experiencia v1,
contratos backend v2.

## Fuentes revisadas

Legacy v1 revisada en `feature/mejoras-sistema-acceso`:

- `public/login.html`.
- `public/index.html`.
- `public/client.js`.
- `public/admin.html`.
- `public/admin.js`.
- `public/style.css`.

Documentacion v2 revisada:

- `docs/PLAN_STACK_TECNOLOGICO_NUEVO.md`.
- `docs/PLAN_MIGRACION_STACK_PATRON.md`.
- `docs/FEAT_PORTAL_USUARIO_QR.md`.
- `docs/FEAT_PORTAL_ADMINISTRACION_ADMINS.md`.
- `docs/FEAT_QR_TEMPORAL_DIARIO_CREDENCIAL.md`.
- `docs/FEAT_QR_VEHICULAR_FIRMADO.md`.

## Decision principal

La GUI final debe ser identica a la legacy en estructura y lenguaje visual:

- Header institucional sticky.
- Logo real de UPQROO a la izquierda.
- Divisor vertical.
- Titulo corto.
- Boton de cambio de vista en la derecha.
- Bloque de admin en pill.
- Tabs superiores sticky.
- Formularios en tarjeta centrada.
- Tablas densas con encabezado, buscador, contador y boton actualizar.
- Scanner en vista separada.
- Resultado visual de scan con foto/placeholder, estado, datos y timestamp.
- Footer institucional en el panel admin.

SvelteKit no debe cambiar la experiencia. Solo debe convertir esa GUI en
componentes mantenibles.

## Lo que no debe pasar

- No sidebar generico.
- No dashboard tipo SaaS con cards decorativas como pantalla principal.
- No landing.
- No hero.
- No paleta verde nueva como destino final.
- No reemplazar el flujo de tabs por una navegacion totalmente distinta.
- No guardar sesiones o tokens sensibles en `localStorage`.
- No concentrar toda la aplicacion en `+page.svelte`.
- No cargar datasets completos para tablas.

## Analisis legacy

### Login

La v1 usa una pantalla simple y centrada:

- Fondo gris claro.
- Tarjeta blanca de ancho aproximado 400px.
- Logo arriba.
- Titulo `Acceso Administrativo`.
- Campos `Usuario` y `Contraseña`.
- Boton naranja ancho completo.
- Error rojo dentro de la tarjeta.

En v2 debe conservarse la misma forma visual, pero el login debe usar
`POST /api/v1/auth/login` y cookie `httpOnly`.

### Scanner

La v1 separa scanner y admin:

- `index.html` es vista de escaneo.
- Header con logo y titulo `Escaner de Acceso`.
- Contenedor centrado `scanner-container`.
- Titulo `Escanear Codigo QR`.
- Instruccion corta.
- `#reader` para camara.
- `#result` con texto inicial `Esperando escanear codigo QR...`.
- Boton `Continuar Escaneando`.

`client.js` agrega comportamiento clave:

- Camara con `html5-qrcode`.
- `fps: 10`.
- `qrbox` al 75% del borde menor.
- Pausa al detectar QR.
- Resultado de carga mientras procesa.
- Resultado exitoso con tipo entrada/salida.
- Foto redonda o placeholder.
- Nombre, tipo de persona, estado, matricula, carrera y timestamp.
- Sonido success/error.
- Auto-escaneo configurable con contador.

En v2 se mantiene la misma vista, pero el scanner debe mandar:

```txt
POST /api/v1/access/scan
```

El payload puede venir de:

- QR personal seguro.
- QR vehicular.
- Hot-QR.
- QR temporal diario.
- Matricula manual controlada.

El resultado debe respetar el wire shape del backend:

```txt
accepted
action
reasonCode
registroId
personId
matricula
fullName
personType
career
vehiclePlate
credentialType
accessMode
timestamp
```

### Panel admin

La v1 usa `admin.html` como panel principal con tabs superiores:

```txt
Generar QR
Editar
Registros
Configuracion
```

El header del panel admin tiene:

- Logo UPQROO.
- Titulo `Sistema de Control de Acceso`.
- Boton `Vista Escaneo`.
- Bloque de admin a la derecha.

El cuerpo usa:

- `main` centrado.
- Formularios en `qr-generator-container`.
- Encabezado de seccion con `h2` y descripcion.
- Inputs con icono.
- Botones con icono.
- Switch tipo iOS.
- Alertas flotantes.
- Footer institucional.

En v2 se agregan tabs, pero no se cambia la forma visual:

```txt
Generar QR
Editar
Registros
Asistencias
Hot-QR
Vehiculos
Administradores
Configuracion
```

`Administradores` solo debe mostrarse o habilitarse para `super_admin`.

### Generar QR

La v1 tiene dos modos:

```txt
Registrar y Generar
Solo Generar
```

Debe conservarse la misma interaccion:

- Switch entre los dos modos.
- En modo registrar: matricula, nombres, apellidos, CURP, tipo persona,
  carrera condicional, foto, notas y expiracion.
- En modo solo generar: se ocultan campos no necesarios.
- QR generado se muestra abajo con datos.
- Boton descargar QR.

Ajuste v2 obligatorio:

- El QR ya no debe ser la matricula como secreto.
- El backend genera token seguro.
- El frontend solo muestra el token una vez al crear/rotar.
- La matricula puede seguir apareciendo como dato visual.
- La carrera se exige segun `person_types.requires_career`, no por if rigido
  solo `estudiante`.

### Editar

La v1 busca por matricula y muestra formulario oculto al encontrar persona.

Se conserva:

- Busqueda por matricula.
- Boton buscar ancho completo.
- Formulario aparece debajo con borde superior.
- Campos equivalentes a registro.
- Estado activo/inactivo.
- Notas.
- Fecha de caducidad QR.
- Foto actual redonda con borde naranja.
- Botones guardar/cancelar.

Ajuste v2:

- La busqueda debe usar endpoint v2.
- Guardar debe respetar soft-state, no borrado fisico.
- QR se rota/revoca desde endpoints de credenciales, no escribiendo hash desde UI.

### Registros

La v1 muestra tabla con:

```txt
Matricula
Nombre Completo
Tipo
Carrera
Entrada
Salida
Estado
```

Encima tiene:

- Titulo `Registros del dia`.
- Buscador por matricula/nombre.
- Boton `Actualizar`.
- Contador `N registros`.
- Texto de filtrados.

La v1 filtraba en cliente. V2 debe mantener la misma experiencia visual, pero
la busqueda, filtros y paginacion deben ir al servidor:

```txt
GET /api/v1/access/today?page&pageSize&q&personType&accessMode&status&date
```

Columnas v2 minimas:

```txt
matricula
nombre
tipo
carrera
entrada
salida
admin entrada
admin salida
estado
modo acceso
```

La tabla debe conservar:

- Badges por tipo.
- Badges de estado: en curso, completado, salida auto.
- Nombre de admin debajo de hora cuando exista.
- Responsive tipo cards en movil, como v1.

### Configuracion

La v1 solo configuraba auto-escaneo y lo guardaba en `localStorage`.

La GUI se conserva:

- Tarjeta `Configuracion del Sistema`.
- Seccion `Auto-escaneo QR`.
- Input numerico con sufijo `segundos`.
- Boton `Aplicar`.
- Toggle `Auto-escaneo: Activado/Desactivado`.
- Caja informativa.

Ajuste v2:

- La fuente de verdad es `GET/PATCH /api/v1/config/operational`.
- `localStorage` solo puede ser cache temporal no autoritativa.
- Agregar campos sin romper layout:
  - delay entre escaneos.
  - auto retry.
  - sonido.
  - modo camara/manual.
  - auto-exit.

## Features v2 agregadas sin romper la GUI

### Asistencias

Debe ser un tab superior igual a `Registros`.

Visualmente:

- Misma tabla densa.
- Mismo header con buscador, filtros y actualizar.
- Badges de estado.
- Paginacion server-side.

Columnas:

```txt
matricula
nombre
materia
aula
horario
minutos asistidos
minutos totales
porcentaje
estado
carrera
```

Estados:

```txt
in_progress
confirmed
partial
unverified
assumed
```

### Hot-QR

Debe ser un tab superior.

Debe seguir el patron de `Generar QR`:

- Formulario compacto en tarjeta.
- Motivo.
- Duracion rapida.
- QR visible.
- Descargar/compartir.
- Tabla de Hot-QR del dia abajo o en panel contiguo.
- Accion revocar.

Estados:

```txt
active
used
expired
revoked
disabled
```

### Vehiculos

Debe ser un tab superior, no un modulo lateral.

Debe agrupar:

- Registrar vehiculo.
- Asociar permiso persona + vehiculo.
- Generar o rotar QR vehicular.
- Revocar permiso.
- Tabla de vehiculos/permisos.

El resultado de QR vehicular debe mostrar:

```txt
persona
matricula
tipo persona
placa
marca/modelo
color
vigencia
estado permiso
```

### Administradores

Debe ser un tab superior protegido por rol.

Solo `super_admin` puede:

- Ver lista.
- Crear admin.
- Activar/desactivar.
- Resetear password.
- Revocar sesiones.
- Ver auditoria basica.

La GUI debe seguir el patron de formularios y tablas de v1. No debe parecer un
panel RBAC nuevo ni complejo.

### Portal usuario

El portal de usuario no debe contaminar el panel admin.

Debe ser una ruta separada:

```txt
/portal/login
/portal
/portal/qr
/portal/historial
```

Visualmente puede tomar el header institucional de v1, pero su prioridad es el
QR personal grande, no las tabs administrativas.

Primera pantalla movil:

```txt
QR personal grande
Boton Maximizar
Estado
Acciones rapidas
Historial reciente
```

## Tokens visuales obligatorios

La GUI final debe usar la paleta legacy como fuente primaria:

```txt
--orange: #FF8C00
--white: #ffffff
--light-orange: #FFE4B5
--dark-gray: #333333
--medium-gray: #666666
--light-gray: #f8f9fa
--border-gray: #dee2e6
```

Tipografia legacy:

```txt
'Segoe UI', Tahoma, Geneva, Verdana, sans-serif
```

Geometria legacy:

```txt
header height: 64px
logo height: 36px
admin form card max-width: 400px
card radius: 10px
input radius: 5px
button radius: 5px o pill donde v1 lo usa
tabs border-bottom: 3px naranja
scanner card max-width: 600px
table min-width amplia en desktop
```

Tailwind debe configurarse para reproducir estos tokens, no para introducir un
tema nuevo.

## Componentes Svelte objetivo

La migracion debe mapear componentes a piezas v1, no a abstracciones genericas:

```txt
LegacyHeader.svelte
LegacyTabs.svelte
LoginCard.svelte
GeneratorQrTab.svelte
EditPersonTab.svelte
AccessRecordsTab.svelte
AttendanceRecordsTab.svelte
HotQrTab.svelte
VehiclesTab.svelte
AdminsTab.svelte
ScannerPage.svelte
ScannerResult.svelte
OperationalConfigTab.svelte
LegacyDataTable.svelte
StatusBadge.svelte
QrPreview.svelte
FloatingAlert.svelte
LegacyFooter.svelte
```

`AdminShell.svelte` puede existir, pero su salida visual debe coincidir con
`admin.html`.

## Rutas recomendadas

La UI visible puede comportarse como tabs legacy aunque internamente use rutas:

```txt
/login
/scanner
/admin
/admin/generar-qr
/admin/editar
/admin/registros
/admin/asistencias
/admin/hot-qr
/admin/vehiculos
/admin/administradores
/admin/configuracion
/portal/login
/portal
```

Si se decide mantener `/admin` con tabs internas al inicio, debe conservar deep
link por query o hash:

```txt
/admin?tab=registros
/admin?tab=vehiculos
```

## API y wire shape

Respuestas paginadas:

```txt
{ rows, total, page, pageSize, summary }
```

Scanner:

```txt
{ accepted, action, reasonCode, registroId, personId, matricula, fullName,
  personType, career, vehiclePlate, credentialType, accessMode, timestamp }
```

QR create/rotate:

```txt
{ credential, token }
```

Auth admin:

```txt
{ admin, expiresAt }
```

Portal usuario:

```txt
{ user, expiresAt }
```

Nunca renderizar ni almacenar:

```txt
passwordHash
sessionHash
tokenHash
```

## Plan de implementacion frontend

### Fase 0: conservar compatibilidad

- Mantener el frontend actual como superficie de prueba.
- No ensamblar todavia la GUI final.
- No agregar vistas grandes si no desbloquean pruebas backend.
- Seguir usando las rutas actuales para smoke tests.

### Fase 1: portar shell legacy exacto

- Copiar el contrato visual de `admin.html` y `style.css`.
- Sustituir `logo-mark` por el logo real.
- Cambiar tokens actuales verdes por tokens naranja/gris legacy.
- Crear `LegacyHeader`, `LegacyTabs` y `LegacyFooter`.
- Mantener `Vista Escaneo` como boton derecho del header.
- Mantener admin pill.

### Fase 2: portar login y scanner

- `LoginCard` identico a `login.html`.
- `/scanner` identico a `index.html`.
- Integrar `html5-qrcode`.
- Agregar entrada manual sin romper scanner visual.
- Mostrar resultado con la misma jerarquia visual de v1.
- Leer configuracion operacional desde backend.

### Fase 3: portar tabs legacy

- `Generar QR`.
- `Editar`.
- `Registros`.
- `Configuracion`.

La meta de esta fase es que un usuario de v1 no note cambio visual relevante.

### Fase 4: agregar tabs v2 con patron legacy

- `Asistencias` como tabla hermana de `Registros`.
- `Hot-QR` como generador QR hermano de `Generar QR`.
- `Vehiculos` como formulario + tabla.
- `Administradores` como formulario + tabla protegido.

Cada tab nuevo debe parecer parte natural del `admin.html` legacy.

### Fase 5: portal usuario

- Separar del admin.
- Implementar login usuario.
- Mostrar QR grande.
- Modo maximizado.
- Historial propio.
- QR temporal diario si backend lo permite.

## Criterios de aceptacion visual

Antes de considerar terminado el frontend:

- Header desktop coincide con v1 en altura, logo, titulo y acciones.
- Tabs coinciden con v1 en posicion, color activo y comportamiento sticky.
- Login coincide con v1 en composicion.
- Scanner coincide con v1 antes de agregar extensiones.
- Generador QR conserva modo registrar/generar y solo generar.
- Editar conserva busqueda por matricula y formulario revelado.
- Registros conserva tabla, contador, buscador y badges.
- Configuracion conserva la tarjeta de auto-escaneo.
- Nuevos tabs no introducen layout lateral ni dashboard ajeno.
- Mobile conserva el responsive tipo v1, especialmente tablas como cards.

## Pruebas esperadas

- `bun run --cwd apps/web check`.
- `bun run --cwd apps/web test`.
- `bun run --cwd apps/web build`.
- Smoke browser:
  - login admin.
  - abrir panel admin.
  - cambiar tabs.
  - scanner manual.
  - tabla registros paginada.
  - generar QR y ver preview.
  - Hot-QR.
  - vehiculo.
  - admin tab visible solo para `super_admin`.

## Decision final

El frontend sigue en modo compatibilidad hasta que backend y contratos esten
cerrados. Cuando se ensamble la GUI final, el objetivo no sera "modernizar la
apariencia", sino portar la GUI legacy de forma identica sobre SvelteKit,
TypeScript y Tailwind, agregando features v2 como extensiones del mismo sistema
visual.
