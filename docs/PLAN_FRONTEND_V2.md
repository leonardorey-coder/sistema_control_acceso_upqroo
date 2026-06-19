# Plan frontend v2

## Estado actual

El frontend actual debe considerarse una capa de compatibilidad operativa. Su objetivo inmediato es permitir probar el backend v2, validar login, scanner, tablas paginadas, QR, vehiculos y portal base sin cerrar todavia el diseno final.

No debe tratarse como ensamblado definitivo ni como referencia visual final completa.

## Stack fijo

El frontend final se mantiene sobre:

- SvelteKit.
- TypeScript.
- Tailwind CSS.
- Cliente API unico.
- Sesiones por cookies `httpOnly`.
- WebSocket nativo del backend Bun para refrescos operativos.

El frontend no debe guardar tokens sensibles en `localStorage`.

## Principios de diseno

- Mantener lenguaje institucional de la v1: header UPQROO, tabs superiores, tablas densas, formularios compactos y estados visibles.
- Evitar landing pages, hero marketing, sidebars genericos o composiciones decorativas.
- Priorizar operacion diaria: scanner, registros, asistencias, personas, Hot-QR, vehiculos, administradores y configuracion.
- Separar portal de usuario del panel administrativo.
- Mantener DOM accesible; usar canvas solo donde la libreria de QR/camara lo requiera.

## Arquitectura objetivo

Estructura recomendada:

```txt
apps/web/src/
  routes/
    login/
    scanner/
    admin/
      personas/
      registros/
      asistencias/
      hot-qr/
      vehiculos/
      administradores/
      configuracion/
    portal/
      login/
      qr/
      historial/

  lib/
    api/
    auth/
    components/
    forms/
    scanner/
    stores/
    styles/
    utils/
```

La ruta raiz puede redirigir al panel admin o conservar una pantalla puente durante la migracion, pero no debe concentrar toda la aplicacion.

## Fases de implementacion

### Fase 1: compatibilidad actual

- Mantener las pantallas existentes como superficie de prueba.
- No agregar nuevas vistas grandes salvo que desbloqueen backend.
- Corregir errores de sesion, wiring de API y build.
- Asegurar que `/scanner` exige sesion administrativa.
- Asegurar que `/portal` usa sesion de usuario separada.

### Fase 2: diseño funcional admin

- Crear layout admin dedicado.
- Mover tabs actuales a rutas reales bajo `/admin`.
- Implementar formularios con validaciones visibles.
- Implementar paginacion server-side en todas las tablas.
- Mantener WebSocket para refrescar registros, asistencias y Hot-QR.

### Fase 3: scanner final

- Scanner QR con camara.
- Entrada manual por matricula.
- Resultado visual con foto, nombre, tipo, carrera, vehiculo, estado y timestamp.
- Reintento configurable desde backend.
- Estados de error claros para QR expirado, revocado, persona inactiva y permiso vehicular invalido.

### Fase 4: portal usuario

- Login separado.
- QR personal en primera plana.
- Modo QR maximizado.
- Historial propio de accesos y asistencias.
- QR temporal diario si el backend lo permite.
- No mostrar datos de otros usuarios.

## Contratos de API que debe respetar

- Paginacion: `{ rows, total, page, pageSize, summary }`.
- Scanner: `{ accepted, action, reasonCode, registroId, personId, matricula, fullName, personType, career, vehiclePlate, credentialType, accessMode, timestamp }`.
- QR emitido/rotado: `{ credential, token }`, donde `token` solo se muestra una vez.
- Auth admin: `{ admin, expiresAt }`.
- Portal usuario: `{ user, expiresAt }`.

Nunca se deben renderizar ni almacenar `passwordHash`, `sessionHash` o `tokenHash`.

## Criterios para iniciar ensamblado final

Antes de construir el frontend final deben estar listos:

- Migraciones aplicadas en PostgreSQL local.
- Seed idempotente.
- Tests de integracion backend pasando.
- Scanner backend validado con QR personal, Hot-QR, QR temporal y QR vehicular.
- Wire shapes estabilizados.
- Permisos admin/super_admin cerrados en backend.

## Decision

El frontend queda por ahora en modo compatibilidad. La siguiente fase visual debe ser planificada y ejecutada como migracion ordenada a rutas SvelteKit por modulo, no como crecimiento del archivo raiz.
