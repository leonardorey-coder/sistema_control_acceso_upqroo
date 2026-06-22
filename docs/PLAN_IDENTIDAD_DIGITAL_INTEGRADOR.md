# Plan integrador: plataforma de identidad digital universitaria

## Proposito

Este documento integra las features nuevas del canvas de identidad digital sobre
el sistema de control de acceso v2.

No reemplaza los documentos existentes de QR, portal, administradores,
credenciales temporales o vehiculares. Los usa como base y define la capa nueva
de identidad social universitaria:

- Perfil universitario.
- `@usuario` publico.
- Vista social segura durante el acceso.
- Perfil publico interno.
- Marcos, colores, defaults, insignias, hitos y logros.
- Eventos del campus.
- Controles de privacidad.
- Auditoria y superadmin como garantias institucionales.

## Documentos dedicados

Este plan se apoya en los siguientes documentos de feature:

- `FEAT_ACCESO_ENTRADA_SALIDA_AUDITABLE.md`
- `FEAT_ACCESO_VALIDACION_VISUAL_FOTO.md`
- `FEAT_IDENTIDAD_PERFIL_USUARIO.md`
- `FEAT_IDENTIDAD_USERNAME_PERSONALIZADO.md`
- `FEAT_IDENTIDAD_VISTA_SOCIAL_SCANNER.md`
- `FEAT_IDENTIDAD_PERFIL_PUBLICO.md`
- `FEAT_IDENTIDAD_RECOMPENSAS_CATALOGO.md`
- `FEAT_IDENTIDAD_MARCOS_PERFIL.md`
- `FEAT_IDENTIDAD_COLORES_NOMBRE.md`
- `FEAT_IDENTIDAD_DEFAULTS_PROGRESION.md`
- `FEAT_IDENTIDAD_HITOS_LOGROS.md`
- `FEAT_IDENTIDAD_INSIGNIAS.md`
- `FEAT_IDENTIDAD_EVENTOS_CAMPUS.md`
- `FEAT_IDENTIDAD_SUPERADMIN_CONTROL_MANUAL.md`
- `FEAT_IDENTIDAD_AUDITORIA_ADMINISTRATIVA.md`

## Decision central

La capa social nunca debe decidir si una persona entra o sale.

El acceso sigue dependiendo de:

- QR dinamico firmado.
- Expiracion corta.
- Anti-replay por `jti`.
- Estado institucional de la persona.
- Reglas atomicas en PostgreSQL.
- Auditoria administrativa.

La identidad social solo presenta informacion segura y estetica despues de que
la credencial ya fue validada.

## Stack y limites tecnicos

Se conserva el stack ya definido:

- Frontend: SvelteKit, TypeScript, Tailwind CSS y Vite.
- Backend: Bun, TypeScript, Hono y Zod.
- Base de datos: PostgreSQL.
- ORM: Drizzle para schema tipado, CRUD y relaciones.
- SQL manual versionado para funciones atomicas de acceso, asistencia,
  anti-replay e integridad.
- Auth: sesiones en base de datos con cookies `httpOnly`.
- Testing: `bun:test` y Playwright para flujos criticos.

No se debe migrar a SQLite para esta etapa. El crecimiento esperado incluye
escrituras frecuentes, perfiles, auditoria, recompensas, eventos y consultas
administrativas, por lo que PostgreSQL se mantiene como base real.

## Estado base del sistema

El proyecto v2 ya cuenta con:

- Monorepo `apps/api`, `apps/web`, `packages/shared`.
- Portal usuario con QR dinamico.
- Scanner separado.
- Panel administrativo.
- QR personal, temporal diario y vehicular.
- Sesiones admin y usuario.
- Storage local protegido para fotos.
- Auditoria best-effort.
- Configuracion operativa.
- Worker para expiraciones y mantenimiento.

Por eso la implementacion de identidad digital debe ser aditiva:

- No recrear `users`.
- No reemplazar `personas`.
- No mover reglas atomicas de acceso fuera de SQL.
- No duplicar credenciales existentes.
- No exponer datos privados por la capa social.

## Modelo conceptual integrado

### Identidad institucional

Se conserva en tablas existentes:

- `personas`
- `user_accounts`
- `person_types`
- `carreras`
- `registros_acceso`
- `access_scan_events`
- `audit_log`

La matricula pertenece a esta capa. Puede mostrarse al operador cuando sea
operativamente necesario, pero no debe convertirse en identidad social publica.

### Identidad social

Se agrega una capa nueva vinculada a `personas`:

- `digital_profiles`
- `username_history`
- `reserved_usernames`
- `reward_definitions`
- `person_rewards`
- `campus_events`
- `event_participants`

El `@usuario` pertenece a esta capa. Sirve para eventos, perfiles publicos,
insignias y reconocimiento social.

## Roadmap recomendado

### Fase 0: cerrar y verificar seguridad v2

Objetivo: no construir identidad social sobre una base insegura.

- Verificar QR dinamico firmado end-to-end.
- Verificar anti-replay por `jti`.
- Verificar foto real en scanner.
- Verificar QR temporal y vehicular firmados.
- Verificar que auditoria, sesiones y worker funcionen.
- Ejecutar `bun run check` y `bun test`.

Criterio: el sistema de acceso sigue funcionando antes de agregar identidad.

### Fase 1: perfil y username

Objetivo: crear la identidad social minima.

- Crear `digital_profiles`.
- Crear `username_history`.
- Crear `reserved_usernames`.
- Agregar API de perfil del portal.
- Agregar API publica interna por username.
- Agregar validacion fuerte de username.
- Agregar privacidad por defecto.

Criterio: una persona con cuenta de portal puede tener perfil, `@usuario` y URL
interna sin exponer datos sensibles.

### Fase 2: vista social durante acceso

Objetivo: transformar el resultado del scanner en una credencial visual segura.

- Extender resultado de scan con `visualProfile`.
- Mostrar foto, nombre visible, `@usuario`, rol/carrera y badges publicos.
- Mantener datos operativos para el guardia sin convertirlos en display social.
- Aplicar privacidad y defaults.

Criterio: el scanner muestra identidad social sin filtrar correo, telefono,
historial, estado disciplinario ni datos privados.

### Fase 3: recompensas esteticas

Objetivo: permitir progresion visible sin afectar seguridad.

- Crear catalogo de recompensas.
- Soportar marcos.
- Soportar colores de nombre.
- Soportar insignias.
- Soportar defaults de bajo rango.
- Permitir equipar elementos desbloqueados.

Criterio: un usuario puede ver y equipar elementos que posee; no puede usar
recompensas no desbloqueadas.

### Fase 4: hitos y eventos

Objetivo: que las recompensas tengan significado institucional.

- Registrar eventos del campus.
- Registrar participantes.
- Otorgar insignias por evento, club, deporte, hackathon o rol.
- Mantener logros automaticos solo para hitos basicos.

Criterio: los logros de alto valor vienen de fuentes auditables, no solo de
entrar muchas veces al campus.

### Fase 5: operacion institucional madura

Objetivo: administrar la plataforma como sistema institucional.

- Panel admin para perfiles.
- Panel admin para recompensas.
- Panel admin para eventos.
- Revision de auditoria.
- Reportes de adopcion.
- Politicas futuras de moderacion y privacidad.

## Contratos API sugeridos

### Portal usuario

```txt
GET   /api/v1/portal/profile
PATCH /api/v1/portal/profile
POST  /api/v1/portal/profile/username
GET   /api/v1/portal/rewards
POST  /api/v1/portal/rewards/equip
```

### Publico interno

```txt
GET /api/v1/public/profiles/:username
```

Debe devolver solo campos permitidos por privacidad.

### Administracion

```txt
GET   /api/v1/profiles
GET   /api/v1/profiles/:personId
PATCH /api/v1/profiles/:personId
GET   /api/v1/rewards
POST  /api/v1/rewards
PATCH /api/v1/rewards/:id
POST  /api/v1/rewards/:id/grant
POST  /api/v1/rewards/:id/revoke
GET   /api/v1/campus-events
POST  /api/v1/campus-events
PATCH /api/v1/campus-events/:id
POST  /api/v1/campus-events/:id/participants
```

Todas las mutaciones administrativas deben auditarse.

## Contratos compartidos sugeridos

Agregar en `packages/shared`:

```ts
export type DigitalProfilePayload = {
  personId: string;
  username: string | null;
  displayName: string;
  bio?: string | null;
  visibility: "internal" | "private";
  privacy: ProfilePrivacyPayload;
  appearance: ProfileAppearancePayload;
};

export type PublicProfilePayload = {
  username: string;
  displayName: string;
  photoUrl?: string | null;
  personType?: string | null;
  career?: string | null;
  bio?: string | null;
  badges: PublicBadgePayload[];
  events: PublicEventPayload[];
};

export type ScannerVisualProfilePayload = {
  username?: string | null;
  displayName: string;
  frame?: RewardAppearancePayload | null;
  nameColor?: RewardAppearancePayload | null;
  featuredBadges: PublicBadgePayload[];
};
```

## Privacidad por defecto

Defaults recomendados:

- Perfil interno visible solo si el usuario tiene cuenta activa.
- Nombre visible: nombre institucional normalizado.
- Carrera visible: desactivada hasta que el usuario la habilite o la institucion
  lo defina.
- Eventos visibles: desactivados.
- Insignias visibles: activadas solo si son publicas.
- Matricula completa: no visible en perfil publico.
- Correo, telefono, historial y estado administrativo: nunca visibles.

## Auditoria requerida

Auditar:

- Cambio de username.
- Override de username por admin.
- Cambio de privacidad.
- Cambio de foto.
- Otorgamiento o revocacion de recompensa.
- Equipar marco o color.
- Alta o baja de participante en evento.
- Cambio manual de perfil por superadmin.

## Riesgos y mitigaciones

- Gamificacion infantil: usar tono institucional, insignias con significado y
  estetica sobria.
- Exposicion de datos: privacidad por defecto y contrato publico separado.
- Abuso de username: reservados, validacion, cooldown e historial.
- Admin malicioso: motivo obligatorio y auditoria.
- Logros triviales: limitar automatismos y priorizar eventos/comunidad.
- Reescritura excesiva: migraciones aditivas y modulos nuevos.

## Definicion global de hecho

- `bun run check` y `bun test` pasan.
- El scanner sigue validando acceso por QR seguro, no por perfil social.
- Toda mutacion sensible queda en `audit_log`.
- El perfil publico nunca expone secretos ni datos privados.
- Los contratos compartidos son usados por API y frontend.
- El frontend mantiene el estilo institucional legacy definido para v2.
