# Futuras Integraciones - Sistema de Control de Acceso UPQROO

## Asistencias a Clases - Opciones de Registro

### Estado Actual
La función `registrar_asistencias_potenciales` registra asistencia para clases dentro de un margen de **30 minutos** desde la hora de entrada.

---

## Opción 1: Un escaneo = Una clase inmediata (Actual)

**Comportamiento:**
- Solo registra asistencia para clases que inician dentro de 30 minutos
- El estudiante debe escanear antes de cada clase

**Ejemplo:** Estudiante llega a las 13:45
| Clase | Horario | Resultado |
|-------|---------|-----------|
| Programación I | 14:00-16:00 | ✅ Registrada (100%) |
| Base de Datos | 16:00-18:00 | ❌ No registrada |
| Redes | 18:00-20:00 | ❌ No registrada |

**Pros:**
- ✅ Mayor precisión en registro de asistencia
- ✅ Permite detectar si el estudiante realmente asistió a cada clase

**Contras:**
- ❌ Requiere múltiples escaneos por día
- ❌ Puede ser incómodo para estudiantes

---

## Opción 2: Un escaneo = Todas las clases del día

**Comportamiento:**
- Con un solo escaneo al entrar, se registran todas las clases restantes del día
- Asume que el estudiante permanecerá todo el día

**Ejemplo:** Estudiante llega a las 13:45
| Clase | Horario | Resultado |
|-------|---------|-----------|
| Programación I | 14:00-16:00 | ✅ Registrada (100%) |
| Base de Datos | 16:00-18:00 | ✅ Registrada (100% potencial) |
| Redes | 18:00-20:00 | ✅ Registrada (100% potencial) |

**Pros:**
- ✅ Un solo escaneo por día
- ✅ Más práctico para estudiantes

**Contras:**
- ❌ Menos precisión (asume asistencia a todas las clases)
- ❌ No detecta si el estudiante se fue antes

---

## Opción 3: Híbrido (Futura)

**Comportamiento:**
- Al entrar: registra clase inmediata + marca clases futuras como "pendientes"
- Al salir: actualiza asistencias según hora de salida

**Ejemplo:** Estudiante llega 13:45, sale 17:30
| Clase | Horario | Resultado |
|-------|---------|-----------|
| Programación I | 14:00-16:00 | ✅ 100% (completa) |
| Base de Datos | 16:00-18:00 | ✅ 75% (salió a las 17:30) |
| Redes | 18:00-20:00 | ❌ 0% (ya había salido) |

---

## Decisión Pendiente

[ ] Implementar Opción 1 (ya implementada)
[ ] Implementar Opción 2
[ ] Implementar Opción 3 (híbrido)

---

## Estados de Asistencia

Cuando el sistema marca **salida automática** (el estudiante no escaneó su salida), las asistencias necesitan un estado especial para diferenciarlas de asistencias normales.

### Estados Propuestos

| Estado | Código | Descripción |
|--------|--------|-------------|
| **Confirmada** | `confirmed` | Entrada y salida registradas manualmente |
| **En curso** | `in_progress` | Solo entrada registrada, clase aún no termina |
| **Asumida** | `assumed` | Salida automática al final del día - se asume asistencia completa pero no verificada |
| **Parcial** | `partial` | Salida registrada antes de terminar la clase |
| **Sin verificar** | `unverified` | Salida automática + clase posterior a la hora de salida automática |

### Lógica de Estados con Salida Automática

**Escenario:** Estudiante entra 14:00, NO registra salida, sistema marca salida automática a las 23:59

| Clase | Horario | Estado |
|-------|---------|--------|
| Programación I | 14:00-16:00 | `assumed` ⚠️ |
| Base de Datos | 16:00-18:00 | `assumed` ⚠️ |
| Redes | 18:00-20:00 | `assumed` ⚠️ |

> ⚠️ El estado `assumed` indica que **no se puede confirmar** si el estudiante realmente asistió, ya que no registró su salida. Útil para reportes y auditorías.

### Implementación Sugerida

```sql
-- Agregar columna estado a asistencias_potenciales
ALTER TABLE asistencias_potenciales 
ADD COLUMN IF NOT EXISTS estado VARCHAR(20) DEFAULT 'in_progress';

-- Estados válidos: confirmed, in_progress, assumed, partial, unverified
```

---

## Otras Integraciones Futuras

### Reportes de Asistencia
- [ ] Gráfico de barras: % asistencia por materia
- [ ] Gráfico de líneas: tendencia de asistencia
- [ ] Heatmap: asistencia por día/hora

### Alertas
- [ ] Notificar estudiantes con asistencia < 70%
- [ ] Reportes semanales/mensuales

### Exportación
- [ ] PDF de reportes
- [ ] Excel con datos detallados
- [ ] API para integración con sistemas académicos
