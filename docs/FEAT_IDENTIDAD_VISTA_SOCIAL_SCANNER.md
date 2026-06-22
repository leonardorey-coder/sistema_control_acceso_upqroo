# Feature: vista social durante el acceso

## Objetivo

Mostrar una credencial visual segura cuando una persona escanea su QR, combinando
validacion institucional con identidad social controlada.

La vista debe ayudar al operador y al mismo tiempo permitir reconocimiento social
dentro del campus sin exponer datos sensibles.

## Problema que resuelve

El scanner no debe limitarse a decir "acceso concedido". Debe ayudar a validar
visualmente a la persona:

- Foto.
- Nombre visible.
- Tipo de persona.
- Carrera o rol si aplica.
- Estado de acceso.
- `@usuario`.
- Insignias publicas.
- Marco o color desbloqueado.

## Principio de seguridad

La vista social no autentica.

El orden correcto es:

```txt
QR firmado valido
-> expiracion valida
-> jti no consumido
-> persona/credencial vigente
-> access_scan_v1 decide entrada/salida
-> scanner muestra visual profile
```

Nunca se debe aceptar acceso por username, marco, badge o apariencia.

## Datos mostrables

Permitidos:

- Foto institucional.
- Nombre visible.
- `@usuario`.
- Tipo de persona.
- Carrera si privacidad/institucion lo permite.
- Resultado de acceso.
- Badge publico destacado.
- Marco/color equipado.
- Placa si es acceso vehicular y el operador la necesita.

No permitidos en display social:

- Correo.
- Telefono.
- CURP.
- Historial de accesos.
- Estado disciplinario.
- Motivos administrativos internos.
- Sesiones o tokens.

## Contrato sugerido

Extender `ScannerResultPayload`:

```ts
type ScannerVisualProfilePayload = {
  username?: string | null;
  displayName: string;
  publicSubtitle?: string | null;
  frame?: {
    slug: string;
    name: string;
    tier: string;
    style: Record<string, unknown>;
  } | null;
  nameColor?: {
    slug: string;
    name: string;
    style: Record<string, unknown>;
  } | null;
  featuredBadges: Array<{
    slug: string;
    name: string;
    tier: string;
  }>;
};
```

El payload operativo existente puede conservar `matricula`, `personId`,
`credentialType` y `accessMode` para el operador.

## Backend

Actualizar el modulo de access para:

- Resolver perfil social despues del scan.
- Aplicar privacidad.
- Adjuntar `visualProfile`.
- Limitar badges mostrados, recomendado maximo 2.
- No enviar datos privados por WebSocket.

La consulta debe ser eficiente y no romper el flujo de scan.

## Frontend

Actualizar `ScannerView` para mostrar:

- Estado grande: concedido/rechazado.
- Foto redonda con marco si existe.
- Nombre visible con color permitido.
- `@usuario`.
- Badge destacado.
- Datos operativos debajo en menor jerarquia.

La UI debe seguir la pantalla de scanner legacy, no convertirse en dashboard.

## Estados

La vista debe cubrir:

- Acceso concedido.
- Salida registrada.
- QR expirado.
- Replay detectado.
- Persona suspendida.
- Foto no disponible.
- Perfil social no configurado.
- QR vehicular.
- QR temporal diario.

## Privacidad

Si el usuario oculta carrera, eventos o badges, el scanner debe respetarlo para
display social. El operador puede seguir viendo datos operativos necesarios si
el rol de scanner lo permite.

## Auditoria

No auditar cada render visual por separado. El scan ya se audita como
`access.scan`.

Si un operador abre un detalle ampliado con datos privados, eso si debe poder
auditarse en una fase posterior.

## Criterios de aceptacion

- El scanner muestra foto y perfil social cuando existen.
- Si no hay perfil, muestra defaults institucionales.
- Un QR invalido no muestra datos sociales.
- El WebSocket no transmite PII sensible.
- La vista no muestra correo, telefono ni historial.
- La respuesta mantiene compatibilidad con el resultado operativo existente.
