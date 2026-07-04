# Feature: visualizacion 3D de vehiculos con model-viewer

## Objetivo

Mostrar una representacion visual del vehiculo en la aplicacion administrativa
usando `<model-viewer>`, derivada de los datos vehiculares ya disponibles:

```txt
vehicle_type
color
make
model
plate
approval_status
status
```

La feature no cambia la autorizacion de acceso. Es una mejora operativa para que
el personal compare mas rapido el registro del sistema contra el vehiculo fisico
durante alta, aprobacion, permiso y escaneo.

## Decision recomendada

Usar `@google/model-viewer` como componente web dentro de Svelte.

Razonamiento:

- Encaja como componente visual aislado en `apps/web`.
- Renderiza modelos 3D `glb/gltf` sin construir un motor propio con Three.js.
- Soporta controles de camara, carga diferida, posters, fallback y AR opcional.
- Mantiene el backend vehicular actual intacto.

No se debe intentar generar un auto exacto por marca/modelo en v1. La v1 debe
usar modelos genericos por `vehicleType` y aplicar color/placa como metadatos
visuales. Marca/modelo siguen como texto de apoyo.

## Principio bugs-free

La visualizacion nunca debe ser parte de la decision de acceso. Si falla WebGL,
si falta un asset, si el navegador no soporta el componente o si el modelo tarda
en cargar, el flujo debe seguir funcionando con texto, placa, badges y fallback
2D.

Regla central:

```txt
autorizacion vehicular = backend + QR + permisos + estados
visualizacion vehicular = ayuda operativa no bloqueante
```

Esto evita que una mejora cosmetica rompa altas, aprobaciones, escaneo o
rechazos trazables.

## Alcance v1

### Incluido

- Agregar dependencia `@google/model-viewer` en `apps/web`.
- Crear componente `VehiclePreview3D.svelte`.
- Crear catalogo local de modelos por tipo de vehiculo.
- Mostrar preview compacto en:
  - formulario de registro vehicular;
  - tabla/listado de vehiculos como accion "Ver";
  - solicitudes pendientes;
  - visitante vehicular;
  - resultado de escaneo vehicular, si el payload trae `vehiclePlate`.
- Mostrar color como swatch/etiqueta siempre; tintar el modelo solo si el GLB lo
  soporta de forma controlada.
- Mostrar placa, tipo, color, marca/modelo y estado junto al modelo.
- Fallback 2D accesible si el navegador no carga WebGL/model-viewer.

### Excluido

- No generar geometria exacta por marca/modelo.
- No descargar assets 3D dinamicamente desde servicios externos.
- No guardar imagenes renderizadas en backend.
- No usar AR en flujo obligatorio de control de acceso.
- No modificar reglas de autorizacion vehicular.

## Dependencias y assets

### Paquete

```bash
bun add --cwd apps/web @google/model-viewer
bun add --cwd apps/web -d @types/three @types/webxr
```

Integracion sugerida:

```ts
import { browser } from "$app/environment";

if (browser) {
  await import("@google/model-viewer");
}
```

Ese import debe vivir en el componente cliente que renderiza el preview, no en
codigo compartido. No debe ejecutarse durante SSR.

Si `svelte-check` marca el custom element como desconocido, agregar una
declaracion local en `apps/web/src/app.d.ts` para `model-viewer`; no usar
`any` global en todo el proyecto.

### Modelos

Crear carpeta:

```txt
apps/web/static/models/vehicles/
```

Assets iniciales:

```txt
car.glb
motorcycle.glb
bicycle.glb
electric-scooter.glb
truck.glb
official.glb
university-transport.glb
visitor.glb
other.glb
placeholder.webp
```

Cada modelo debe ser:

- formato `glb`;
- licencia compatible con uso institucional;
- menos de 1 MB idealmente, maximo 3 MB por asset en v1;
- comprimido con texturas ligeras;
- sin logos comerciales salvo que exista licencia clara.

Restriccion operativa: no referenciar un `.glb` en codigo hasta que exista en
`static/models/vehicles`. Si un tipo todavia no tiene asset, mapearlo
explicitamente a `other.glb`.

## Componente propuesto

Archivo:

```txt
apps/web/src/lib/components/VehiclePreview3D.svelte
```

Props:

```ts
type VehiclePreview3DProps = {
  vehicleType: VehicleType | string;
  plate?: string | null;
  color?: string | null;
  make?: string | null;
  model?: string | null;
  status?: string | null;
  approvalStatus?: string | null;
  size?: "compact" | "card" | "scanner";
  interactive?: boolean;
};
```

Responsabilidades:

- Resolver `vehicleType -> model src`.
- Normalizar colores comunes en espanol/ingles a valores CSS seguros.
- Renderizar `<model-viewer>` solo en navegador y despues de importar el custom
  element.
- Usar `poster` mientras carga.
- Mostrar placa como overlay HTML, no como textura 3D en v1.
- Exponer fallback si ocurre error de carga.
- Emitir una vista textual equivalente cuando el 3D no este listo.
- No iniciar rotacion automatica salvo en vista `card` o `scanner`.

Ejemplo conceptual:

```svelte
<model-viewer
  src={modelSrc}
  poster="/models/vehicles/placeholder.webp"
  camera-controls={interactive}
  auto-rotate={interactive}
  interaction-prompt="none"
  loading="lazy"
  shadow-intensity="0.5"
  ar={false}
/>
```

Notas de implementacion:

- `auto-rotate` debe ser `false` en `compact`.
- `camera-controls` debe ser `false` dentro de tablas.
- `reveal="interaction"` puede usarse en vista grande si el rendimiento del
  dispositivo de caseta es limitado.
- El color debe representarse primero con overlay/swatch. Cambiar materiales del
  GLB queda fuera de v1 salvo que todos los assets tengan nombres de material
  estables y probados.

## Mapeo de tipos

```ts
const vehicleModelByType = {
  car: "/models/vehicles/car.glb",
  motorcycle: "/models/vehicles/motorcycle.glb",
  bicycle: "/models/vehicles/bicycle.glb",
  electric_scooter: "/models/vehicles/electric-scooter.glb",
  truck: "/models/vehicles/truck.glb",
  official: "/models/vehicles/official.glb",
  university_transport: "/models/vehicles/university-transport.glb",
  visitor: "/models/vehicles/visitor.glb",
  other: "/models/vehicles/other.glb"
};
```

Si falta el asset, usar `other.glb` y registrar el fallback solo en consola de
desarrollo.

La resolucion debe ser funcion pura y testeable:

```ts
resolveVehicleModelSrc(vehicleType: unknown): string
normalizeVehicleColor(color: unknown): { label: string; cssColor: string | null }
```

No debe leer DOM, `window` ni variables globales.

## Integracion UI

### `VehiclesTab.svelte`

Agregar preview en tres puntos:

1. Formulario "Registrar vehiculo":
   - preview lateral compacto que se actualiza con tipo/color/placa.
   - no debe ocupar el primer plano del formulario.

2. Tabla "Vehiculos":
   - accion "Ver" que abre modal con `VehiclePreview3D`;
   - evitar renderizar un `<model-viewer>` por cada fila;
   - en tabla solo mostrar placa/tipo/color con badges o mini fallback 2D.

3. "Visitantes vehiculares":
   - preview compacto en el formulario para validar placa/tipo/color antes de
     emitir Hot-QR vehicular.

### Scanner/acceso

Cuando el resultado de escaneo tenga:

```txt
accessMode = vehicle
vehiclePlate
```

mostrar el preview en modo `scanner`, priorizando legibilidad de placa y estado.
Si el payload no incluye `vehicleType` o `color`, usar `other` y texto plano.

Para mejorar esto en una fase posterior, extender `ScannerResultPayload` con:

```txt
vehicleType
vehicleColor
vehicleMake
vehicleModel
```

## Cambios API

### V1 estricta

Sin cambios API obligatorios. La UI ya tiene `vehicleType`, `plate`, `color`,
`make`, `model`, `status` y `approvalStatus` en listados vehiculares.

La v1 estricta debe implementarse primero. Es el camino con menor riesgo porque
no toca migraciones, `access_scan_v1`, eventos ni contratos del scanner.

### V1.1 recomendada

Extender el resultado de escaneo vehicular para que el operador vea el preview
tambien en el scanner:

```ts
ScannerResultPayload {
  vehiclePlate?: string | null;
  vehicleType?: VehicleType | null;
  vehicleColor?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
}
```

Esto requiere ajustar:

- `packages/shared/src/index.ts`
- `apps/api/src/modules/access/access.routes.ts`
- funcion SQL `access_scan_v1`, solo si aun no retorna esos campos
- UI de scanner/access tab

Regla de compatibilidad: los campos nuevos deben ser opcionales y nullable. Las
pantallas deben seguir funcionando con eventos viejos almacenados en
`sessionStorage` que solo tengan `vehiclePlate`.

## Matriz de fallos esperados

| Caso | Resultado esperado |
| --- | --- |
| Navegador sin WebGL | Fallback 2D/textual, flujo intacto |
| Asset `.glb` inexistente | `other.glb` o fallback 2D, sin error fatal |
| `vehicleType` desconocido | Label tecnico + `other.glb` |
| `color` libre no reconocido | Mostrar texto original, swatch neutro |
| Import de `@google/model-viewer` falla | Fallback 2D y error solo en consola |
| Tabla con muchas filas | No renderizar 3D por fila |
| Evento de scanner viejo | Mostrar placa y fallback sin romper pantalla |
| QR rechazado vehicular | Mostrar rechazo/reason code antes que visualizacion |

## Diseno visual

Mantener el estilo institucional actual:

- preview contenido, no hero ni tarjeta decorativa grande;
- fondo neutro claro;
- borde simple;
- placa visible con tipografia fuerte;
- estados usando badges existentes;
- no usar fondos oscuros o gradientes llamativos.

Tamano sugerido:

```txt
compact: 140-180 px ancho
card: 240-320 px ancho
scanner: 320-420 px ancho
```

## Accesibilidad y rendimiento

- El componente debe tener `aria-label` descriptivo.
- El fallback debe mostrar tipo, placa y color en texto.
- Usar `loading="lazy"` cuando no este en scanner.
- No activar `auto-rotate` en tablas densas.
- Evitar mas de un `<model-viewer>` activo por fila visible si afecta
  rendimiento; preferir abrir preview en modal para tablas grandes.
- Mantener assets locales para evitar fallos de red en caseta.
- Respetar `prefers-reduced-motion`: desactivar rotacion automatica si esta
  activo.
- Definir alto/ancho estables con `aspect-ratio` para evitar layout shift.
- No usar `innerHTML` ni interpolar placa/color como HTML.

## Archivos a tocar

### V1 estricta

```txt
apps/web/package.json
apps/web/src/app.d.ts
apps/web/src/lib/components/VehiclePreview3D.svelte
apps/web/src/lib/components/VehiclePreviewFallback.svelte
apps/web/src/lib/vehicles/vehicle-visuals.ts
apps/web/src/lib/vehicles/vehicle-visuals.test.ts
apps/web/src/lib/components/VehiclesTab.svelte
apps/web/src/app.css
apps/web/static/models/vehicles/other.glb
apps/web/static/models/vehicles/placeholder.webp
```

Los demas `.glb` pueden entrar en el mismo PR solo si ya hay assets ligeros y
licencia clara. Si no, la v1 debe mapear todos los tipos a `other.glb` y dejar
el catalogo especifico para una iteracion posterior.

### V1.1 scanner

```txt
packages/shared/src/index.ts
apps/api/src/modules/access/access.routes.ts
apps/api/drizzle/migrations/<next>_access_scan_vehicle_visual_payload.sql
apps/web/src/lib/components/ScannerResultDisplay.svelte
apps/api/tests/access-contract.test.ts
apps/api/tests/postgres-integration.test.ts
```

## Plan de implementacion

### Fase 1: base visual local

- Instalar `@google/model-viewer`.
- Agregar `other.glb` y `placeholder.webp` con licencia documentada.
- Crear `vehicle-visuals.ts` con funciones puras para mapeo y color.
- Crear `VehiclePreview3D.svelte`.
- Agregar fallback 2D.
- Agregar tests de `vehicle-visuals.ts`.
- Probar con `bun run check` y `bun run build` desde `apps/web`.

### Fase 2: integracion en vehiculos

- Integrar preview en formulario de registro.
- Agregar accion "Ver" con modal en tabla de vehiculos.
- Integrar preview en visitante vehicular.
- Ajustar CSS para desktop y movil.
- Verificar que no se rompan formularios ni paginacion.

### Fase 3: scanner

- Extender payload de escaneo con datos vehiculares suficientes.
- Mostrar preview en resultado de escaneo vehicular.
- Mantener fallback cuando el QR sea personal o visitante sin datos completos.
- Agregar prueba de contrato para nuevos campos opcionales.

### Fase 4: catalogo administrable posterior

Solo si se necesita precision mayor:

- Tabla `vehicle_visual_models`.
- Asociacion opcional por `vehicleType`, `make`, `model`.
- Upload controlado de `.glb`.
- Validacion de tamano/licencia/formato.

## Pruebas

### Unitarias/contrato

- Resolver asset correcto para cada `VehicleType`.
- Fallback a `other.glb` si el tipo es desconocido.
- Normalizacion segura de color.
- `null`, `undefined`, string vacio y color raro no rompen render.
- `prefers-reduced-motion` desactiva rotacion si se implementa helper testeable.
- `ScannerResultPayload` acepta nuevos campos opcionales si se implementa fase 3.

### UI

- `VehiclePreview3D` renderiza fallback sin WebGL.
- Formularios vehiculares actualizan preview al cambiar tipo/color/placa.
- Tabla de vehiculos no monta un 3D por fila.
- Modal "Ver" abre y cierra sin perder paginacion/filtros.
- Modo movil no genera overlap ni clipping.

### Sistema

- Alta de vehiculo pendiente muestra preview.
- Aprobacion/rechazo/bloqueo conserva preview y badges.
- Visitante vehicular muestra preview antes de emitir Hot-QR.
- Escaneo vehicular aceptado muestra placa y visualizacion.
- Escaneo vehicular rechazado mantiene reason code y no oculta el rechazo.

### Verificacion final

```bash
git diff --check
(cd apps/web && bun run check)
(cd apps/web && bun test)
(cd apps/web && bun run build)
bun run check
bun test
bun run build
```

Si se implementa V1.1 con scanner, repetir pruebas Postgres elevadas de
`access_scan_v1` porque se toca SQL de escaneo.

## Checklist anti-regresion

- La app compila con SSR activo.
- La dependencia no se importa desde `packages/shared`.
- La tabla de vehiculos mantiene acciones aprobar/rechazar/bloquear/eliminar.
- El formulario de visitante sigue emitiendo Hot-QR vehicular.
- El scanner sigue mostrando `reasonCode` aunque no haya datos visuales.
- Los assets quedan servidos desde `/models/vehicles/...`.
- No hay llamadas de red externas para cargar modelos.
- No se agregan migraciones en V1 estricta.
- No se bloquea alta/aprobacion/escaneo por errores de render.
- El PR documenta origen/licencia de cada asset 3D.

## Riesgos

- Modelos 3D pesados pueden hacer lenta la pestaña de vehiculos.
- Licencias de modelos externos pueden bloquear uso institucional.
- Colores textuales libres no siempre se pueden mapear a material real.
- `<model-viewer>` no convierte marca/modelo en geometria exacta.
- Safari/iOS y equipos de caseta pueden variar en soporte grafico.

Mitigacion v1:

- Assets locales y ligeros.
- Preview compacto con fallback 2D.
- Modal para vista grande.
- Sin dependencia de red.
- Sin hacer obligatoria la visualizacion para validar acceso.

## Referencias tecnicas

- `<model-viewer>`: https://modelviewer.dev/
- Documentacion y ejemplos: https://modelviewer.dev/docs/
- Repositorio oficial: https://github.com/google/model-viewer
