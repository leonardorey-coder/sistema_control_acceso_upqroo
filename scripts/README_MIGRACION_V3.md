# Migración v3 - Sistema Híbrido de Asistencias

## Resumen de Cambios

La versión 3 implementa un sistema híbrido de registro de asistencias con estados avanzados para mejor trazabilidad y auditoría.

## Nuevas Funcionalidades

### 1. Sistema Híbrido de Asistencias

**Antes (v2):**
- Al escanear entrada: registra solo clases que inician en 30 minutos
- Requiere escaneo antes de cada clase

**Ahora (v3):**
- Al escanear entrada: registra TODAS las clases del día
- Al escanear salida: actualiza asistencias según tiempo real de permanencia
- Sistema inteligente que calcula porcentajes automáticamente

### 2. Estados de Asistencia

| Estado | Descripción | Cuándo se asigna |
|--------|-------------|------------------|
| `confirmed` | Entrada y salida verificadas | Estudiante salió después de terminar la clase |
| `in_progress` | Clase en curso | Estudiante entró pero no ha salido |
| `assumed` | Asistencia asumida | Salida automática marcada a medianoche |
| `partial` | Asistencia parcial | Estudiante salió antes de terminar la clase |
| `unverified` | No verificada | Estudiante salió antes de que iniciara la clase |

### 3. Cálculo Preciso de Porcentajes

El sistema ahora calcula el porcentaje de asistencia basado en:
- Hora real de entrada del estudiante
- Hora real de salida del estudiante (o salida automática)
- Duración total de la clase
- Tiempo efectivo de permanencia

## Archivos Modificados

### Base de Datos
- `control_acceso_postgres_v3_hibrido.sql` - Schema completo v3

### APIs
- `api/procesar_qr.js` - Usa `registrar_salida_v3` para actualizar asistencias
- `api/obtener_asistencias_clases.js` - Incluye campos `estado` y `hora_salida_registro`

### Scripts
- `scripts/migrar_v3_hibrido.js` - Script de migración automatizada

### Documentación
- `docs/feats.md` - Actualizado con estado de implementación

## Cómo Migrar

### Prerrequisitos
- Sistema v2 funcionando
- Node.js y npm instalados
- Acceso a la base de datos PostgreSQL

### Pasos

1. **Hacer backup de la base de datos:**

```bash
pg_dump -U postgres -d control_acceso_upqroo > backup_antes_v3.sql
```

2. **Ejecutar script de migración:**

```bash
node scripts/migrar_v3_hibrido.js
```

3. **Verificar migración:**

El script mostrará un reporte completo incluyendo:
- Columnas agregadas
- Funciones creadas
- Procedimientos actualizados
- Registros migrados

4. **Verificar en la aplicación:**

- Escanear entrada de un estudiante
- Verificar que se registren todas sus clases del día
- Escanear salida
- Verificar que los estados se actualicen correctamente

## Cambios en el Flujo de Trabajo

### Flujo de Entrada (Sin cambios para el usuario)
1. Estudiante escanea QR al entrar
2. Sistema registra entrada en `registros_acceso`
3. Sistema registra TODAS las clases del día en `asistencias_potenciales` con estado `in_progress`

### Flujo de Salida (Mejorado)
1. Estudiante escanea QR al salir
2. Sistema registra salida en `registros_acceso`
3. **NUEVO:** Sistema actualiza asistencias:
   - Calcula tiempo real de permanencia
   - Actualiza porcentajes
   - Asigna estado correcto (`confirmed`, `partial`, `unverified`)

### Flujo de Salida Automática (Mejorado)
1. Cron job ejecuta `marcar_salidas_automaticas()` a medianoche
2. Sistema marca salida automática en registros sin salida
3. **NUEVO:** Sistema actualiza asistencias a estado `assumed`

## Consultas Útiles

### Ver asistencias con estado
```sql
SELECT * FROM vista_asistencias_con_estado
WHERE fecha_clase = CURRENT_DATE;
```

### Contar asistencias por estado
```sql
SELECT estado, estado_descripcion, COUNT(*) as total
FROM vista_asistencias_con_estado
WHERE fecha_clase = CURRENT_DATE
GROUP BY estado, estado_descripcion;
```

### Ver estudiantes con asistencias asumidas
```sql
SELECT DISTINCT matricula, nombres, apellidos
FROM vista_asistencias_con_estado
WHERE estado = 'assumed'
AND fecha_clase >= CURRENT_DATE - INTERVAL '7 days';
```

### Calcular promedio de asistencia real vs asumida
```sql
SELECT 
    matricula,
    nombres,
    apellidos,
    COUNT(*) FILTER (WHERE estado = 'confirmed') as confirmadas,
    COUNT(*) FILTER (WHERE estado = 'assumed') as asumidas,
    AVG(porcentaje_asistencia) as promedio_asistencia
FROM vista_asistencias_con_estado
WHERE fecha_clase >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY matricula, nombres, apellidos
ORDER BY promedio_asistencia DESC;
```

## Rollback (En caso de problemas)

Si necesitas revertir los cambios:

```sql
-- Eliminar columnas nuevas
ALTER TABLE asistencias_potenciales DROP COLUMN IF EXISTS estado;
ALTER TABLE asistencias_potenciales DROP COLUMN IF EXISTS hora_salida_registro;

-- Restaurar procedimiento v2
CREATE OR REPLACE PROCEDURE registrar_salida_v2(
    p_matricula VARCHAR, 
    p_id_admin INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE registros_acceso 
    SET hora_salida = NOW(),
        id_admin_salida = p_id_admin
    WHERE matricula = p_matricula 
    AND DATE(hora_entrada) = CURRENT_DATE 
    AND hora_salida IS NULL;
END;
$$;
```

O restaurar desde backup:

```bash
psql -U postgres -d control_acceso_upqroo < backup_antes_v3.sql
```

## Soporte

Para dudas o problemas con la migración, revisar:
- Logs del script de migración
- Logs de PostgreSQL
- Estado de la base de datos con las consultas de verificación

## Próximos Pasos

Con v3 implementado, ahora es posible:
- Generar reportes más precisos de asistencia
- Identificar patrones de asistencia irregular
- Auditar registros con salida automática
- Implementar alertas para estudiantes con baja asistencia
