# Aplicar Migración v3 - Sistema Híbrido de Asistencias

Este documento guía los pasos para aplicar la migración v3 a tu base de datos PostgreSQL.

## Requisitos

- PostgreSQL 12 o superior en ejecución
- Acceso administrativo a la base de datos `control_acceso_upqroo`
- Node.js 16 o superior (si ejecutas desde Node.js)

## Opción 1: Ejecutar desde Node.js (Recomendado)

### Paso 1: Asegurar conexión a base de datos

Verifica que tu archivo `.env` o configuración tenga credenciales correctas:

```bash
# Revisar lib/db.js para ver configuración de conexión
cat lib/db.js
```

### Paso 2: Ejecutar script de migración

```bash
node temp/migrar_v3_hibrido.js
```

El script mostrará:
- Columnas agregadas
- Funciones creadas
- Procedimientos actualizados
- Cantidad de registros migrados
- Estados disponibles

### Ejemplo de salida exitosa:

```
Iniciando migración a v3 (Sistema Híbrido de Asistencias)...

1. Aplicando cambios a la base de datos...
   ✓ Cambios aplicados exitosamente

2. Verificando estructura de tabla asistencias_potenciales...
   ✓ Columnas agregadas correctamente:
     - estado (character varying)
     - hora_salida_registro (timestamp without time zone)

3. Verificando funciones creadas...
   ✓ 3 funciones actualizadas/creadas

4. Verificando procedimientos...
   ✓ 2 procedimientos actualizados/creados

5. Migrando datos existentes...
   ✓ 125 registros actualizados con estado inicial

6. Verificando vista creada...
   ✓ Vista vista_asistencias_con_estado creada

========================================
MIGRACIÓN COMPLETADA EXITOSAMENTE
========================================
```

## Opción 2: Ejecutar directamente en PostgreSQL

### Paso 1: Hacer backup previo (MUY RECOMENDADO)

```bash
pg_dump -U postgres -d control_acceso_upqroo > backup_antes_v3.sql
```

### Paso 2: Aplicar schema v3

```bash
psql -U postgres -d control_acceso_upqroo -f temp/control_acceso_postgres_v3_hibrido.sql
```

O desde la consola psql:

```sql
\c control_acceso_upqroo
\i temp/control_acceso_postgres_v3_hibrido.sql
```

## Verificar Migración

Después de aplicar, verifica que todo se actualizó correctamente:

```sql
-- Ver estructura de asistencias_potenciales
\d asistencias_potenciales

-- Ver estados disponibles
SELECT DISTINCT estado FROM asistencias_potenciales;

-- Contar registros por estado
SELECT estado, COUNT(*) FROM asistencias_potenciales GROUP BY estado;

-- Ver nueva vista
SELECT * FROM vista_asistencias_con_estado LIMIT 5;
```

## Problemas Comunes

### Error: "Constraint already exists"

Si ves este error:
```
ERROR: constraint "asistencias_estado_check" for relation "asistencias_potenciales" already exists
```

Significa que ya existe el constraint. Puedes:

1. Eliminar y recrear:
```sql
ALTER TABLE asistencias_potenciales DROP CONSTRAINT asistencias_estado_check;
-- Luego vuelve a ejecutar el script
```

2. O si usas versión corregida, el `IF NOT EXISTS` lo evita

### Error de conexión a base de datos

Si ves error `ECONNREFUSED`:
- Verifica que PostgreSQL está ejecutándose
- Verifica credenciales en `lib/db.js`
- Verifica que la base de datos `control_acceso_upqroo` existe

### Error de permiso

Si ves error `EPERM`:
- Verifica que tu usuario tiene permisos en la base de datos
- Intenta con usuario `postgres` o con mayor privilegio

## Rollback (Si necesitas revertir)

Si algo falla y necesitas revertir:

```bash
# Restaurar desde backup
psql -U postgres -d control_acceso_upqroo < backup_antes_v3.sql
```

O ejecutar SQL de rollback:

```sql
-- Eliminar columnas nuevas
ALTER TABLE asistencias_potenciales DROP COLUMN IF EXISTS estado;
ALTER TABLE asistencias_potenciales DROP COLUMN IF EXISTS hora_salida_registro;

-- Restaurar procedimiento v2 si es necesario
-- (Ver README_MIGRACION_V3.md para detalles)
```

## Después de la Migración

La aplicación automáticamente usará:
- `registrar_salida_v3` en lugar de `registrar_salida_v2`
- APIs actualizadas incluirán campos `estado` y `hora_salida_registro`

No necesitas cambios adicionales en la aplicación.

## Documentación Adicional

Para más detalles sobre el sistema híbrido, estados de asistencia y consultas útiles:

```bash
# Ver documentación completa
cat docs/README_MIGRACION_V3.md
```

## Éxito

Después de una migración exitosa:

✓ Todas las clases del día se registran al escanear entrada
✓ Asistencias se actualizan al escanear salida
✓ Estados distinguen entre asistencias confirmadas y asumidas
✓ Sistema ready para auditoría y reportes avanzados
