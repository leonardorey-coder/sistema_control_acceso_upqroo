# FORMATO FORMAL PARA CASOS DE PRUEBA DE SOFTWARE

## Introducción

El presente documento establece la estructura y metodología estándar para la documentación de casos de prueba en proyectos de software. Este formato asegura la consistencia, trazabilidad y calidad en el proceso de validación y verificación de sistemas.

---

## Estructura General del Caso de Prueba

### 1. **ID del Caso de Prueba**
- **Definición**: Código único e identificador del caso de prueba
- **Formato**: `PS-XXX` (donde PS = Prueba Software y XXX = número secuencial)
- **Ejemplo**: `PS-001`, `PS-002`, `PS-156`
- **Propósito**: Permitir trazabilidad y referencia rápida en documentación y seguimiento

---

## Estructura Detallada de cada Caso de Prueba

```
ID DE CASO DE PRUEBA: [Código único del caso - ej. PS-001]
```

### **A. Información General del Caso**

#### **A1. Nombre/Descripción**
- **Descripción**: Breve y clara explicación de lo que se prueba
- **Extensión**: 1-2 líneas máximo
- **Características**:
  - Debe ser descriptiva y específica
  - Evitar términos vagos o ambiguos
  - Indicar claramente la funcionalidad bajo prueba
- **Ejemplo**: "Validación de login con credenciales correctas"

#### **A2. Módulo/Sistema**
- **Descripción**: Identificar el módulo o sistema al que pertenece la prueba
- **Importancia**: Facilita la organización y clasificación de pruebas
- **Ejemplo**: "Módulo de Autenticación", "Sistema de Registro de Asistencia"

#### **A3. Tipo(s) de Prueba**
- **Definición**: Categoría o categorías a la que pertenece el caso
- **Tipos Comunes**:
  - **Funcional**: Verifica que el sistema realiza las funciones esperadas
  - **Seguridad**: Valida la protección contra accesos no autorizados
  - **Rendimiento**: Evalúa velocidad y eficiencia del sistema
  - **Usabilidad**: Verifica facilidad de uso de la interfaz
  - **Compatibilidad**: Prueba funcionamiento en diferentes entornos
  - **Integración**: Valida la comunicación entre módulos
  - **Regresión**: Verifica que cambios no afecten funcionalidad existente
- **Formato**: Pueden ser uno o varios tipos simultáneamente

#### **A4. Prioridad**
- **Niveles**:
  - **Alta**: Funcionalidad crítica, debe probar primero
  - **Media**: Funcionalidad importante
  - **Baja**: Funcionalidad secundaria o enhancements
- **Justificación**: Incluir razón de la prioridad asignada

#### **A5. Fecha de Creación y Última Actualización**
- **Formato**: DD/MM/YYYY
- **Responsable**: Nombre de quién creó y quién actualizó

---

### **B. Condiciones Previas**

#### **B1. Precondiciones**
- **Definición**: Estado inicial necesario para ejecutar la prueba
- **Importancia**: Asegura que la prueba se realiza en contexto correcto
- **Características**:
  - Debe ser reproducible
  - Detalladas y explícitas
  - Incluir estado de datos, permisos, configuraciones
- **Ejemplos**:
  - Usuario debe estar registrado en el sistema
  - Aplicación debe estar abierta
  - Base de datos debe contener datos de prueba
  - Usuario debe tener rol de administrador
  - Conexión a internet debe estar activa

#### **B2. Requisitos Previos**
- Verificar disponibilidad de recursos
- Confirmar acceso a sistemas necesarios
- Validar configuración del ambiente

---

### **C. Especificación de Entrada**

#### **C1. Datos de Entrada**
- **Definición**: Los valores concretos y específicos utilizados en la prueba
- **Detalle Requerido**:
  - Campo específico
  - Valor exacto a ingresar
  - Tipo de dato
  - Validaciones aplicables
- **Tabla Recomendada**:
  | Campo | Valor | Tipo | Observación |
  |-------|-------|------|-------------|
  | Usuario | admin@universidad.edu | Email | Cuenta válida |
  | Contraseña | Pass123! | String | Contraseña correcta |
  | QR | [código] | String | Código de matrícula válido |

#### **C2. Datos de Prueba Alternativos**
- Casos con valores límite
- Datos inválidos para pruebas negativas
- Caracteres especiales o inesperados

---

### **D. Pasos de Ejecución**

#### **D1. Descripción de Pasos**
- **Formato**: Lista numerada secuencial
- **Estructura de cada paso**:
  ```
  Paso N. [Acción clara y precisa]
  - Descripción detallada si es necesario
  - Valores específicos a usar
  - Elemento UI si aplica
  ```

#### **D2. Características Requeridas**:
- **Claridad**: Un tester sin conocimiento previo debe entender
- **Secuencialidad**: Orden lógico de acciones
- **Precisión**: Indicar dónde hacer clic, qué escribir, etc.
- **Completitud**: Incluir todas las acciones necesarias

#### **D3. Ejemplo de Pasos**:
1. Abrir navegador web (Firefox, Chrome o Edge)
2. Ingresar URL: https://sistema.universidad.edu/login
3. Esperar carga completa de página de login
4. Ingresar usuario: admin@universidad.edu en campo "Usuario"
5. Ingresar contraseña: Pass123! en campo "Contraseña"
6. Hacer clic en botón "Ingresar"
7. Esperar redirección a dashboard (máximo 5 segundos)
8. Verificar que aparezca menú de navegación

---

### **E. Resultados Esperados**

#### **E1. Resultado Esperado**
- **Definición**: Qué debería ocurrir si el sistema funciona correctamente
- **Características**:
  - Descripto en término de comportamiento observable
  - Específico y mesurable
  - No debe ser ambiguo
  - Incluir mensajes exactos esperados

#### **E2. Ejemplo de Resultado Esperado**:
- Sistema redirige a página de inicio (dashboard)
- Aparece mensaje: "Sesión iniciada correctamente"
- Se muestra nombre del usuario en esquina superior derecha
- Menú lateral muestra opciones: Registros, Reportes, Configuración
- No se muestra página de error
- Tiempo de carga no excede 5 segundos

---

### **F. Ejecución de la Prueba**

#### **F1. Resultado Obtenido**
- **Definición**: Qué ocurrió realmente durante la ejecución de la prueba
- **Registro Detallado**:
  - Anotar exactamente lo que pasó
  - Incluir mensajes de error recibidos
  - Describir comportamiento inesperado
  - Capturar screenshots si es relevante
- **Honestidad**: Debe reflejar realidad observada

#### **F2. Ambiente de Ejecución**
- Navegador utilizado y versión
- Sistema operativo
- Resolución de pantalla
- Datos de sesión
- Timestamp de ejecución

---

### **G. Análisis de Resultados**

#### **G1. Status (Pasó/Falló)**
- **Opciones**:
  - ✅ **PASÓ**: Resultado obtenido = Resultado esperado
  - ❌ **FALLÓ**: Resultado obtenido ≠ Resultado esperado
  - ⚠️ **BLOQUEADO**: No se pudo completar prueba (error ambiental)
  - 🔄 **RETEST**: Requiere validación posterior

#### **G2. Criterios de Éxito**
- Todos los puntos del resultado esperado se cumplieron
- No hubo errores o excepciones
- Tiempo de respuesta dentro de límites aceptables
- Sistema en estado consistente

---

### **H. Documentación de Problemas**

#### **H1. Observaciones/Notas**
- **Categorías**:
  - **Errores Encontrados**: Bugs identificados, con severidad
  - **Mejoras Sugeridas**: Recomendaciones de optimización
  - **Comentarios Generales**: Información relevante
  - **Screenshots/Evidencia**: Archivos adjuntos

#### **H2. Detalle de Errores**:
| Aspecto | Descripción |
|--------|------------|
| Error | Descripción clara del problema |
| Severidad | Crítica / Alta / Media / Baja |
| Reproducibilidad | Consistente / Intermitente / Única vez |
| Pasos para reproducir | Lista exacta de acciones |
| Archivo de evidencia | Nombre de screenshot o log |

#### **H3. Información Técnica Adicional**:
- Logs del sistema si aplica
- Mensajes de consola/errores
- Comportamiento esperado vs observado
- Impacto en otras funcionalidades

---

### **I. Datos Administrativos**

#### **I1. Trazabilidad**
- **Ejecutado por**: Nombre del QA/Tester
- **Fecha de Ejecución**: DD/MM/YYYY
- **Hora de Ejecución**: HH:MM (con zona horaria si aplica)
- **Versión de Software Probado**: Ej. v2.1.0
- **Versión de Base de Datos**: Ej. BD v1.5

#### **I2. Referencias y Vinculación**
- **Relacionado con Requisito**: ID del requisito funcional
- **Relacionado con Defecto**: ID del bug si aplica
- **Relacionado con Sprint**: Número de sprint
- **Línea de Código Relacionada**: Archivo o función específica

---

## PLANTILLA ESTÁNDAR DE CASO DE PRUEBA

```markdown
---
ID_PRUEBA: PS-XXX
MODULO: [Nombre del módulo]
PRIORIDAD: [Alta/Media/Baja]
FECHA_CREACION: DD/MM/YYYY
ULTIMA_ACTUALIZACION: DD/MM/YYYY
RESPONSABLE: [Nombre]
---

# CASO DE PRUEBA: PS-XXX

## 1. Información General

**Nombre/Descripción**: 
[Descripción breve pero clara]

**Tipo de Prueba**: 
- [ ] Funcional
- [ ] Seguridad
- [ ] Rendimiento
- [ ] Usabilidad
- [ ] Compatibilidad
- [ ] Integración
- [ ] Regresión

**Módulo/Sistema**: [Identificar módulo]

---

## 2. Precondiciones

### Condiciones Previas Requeridas:
1. [Precondición 1]
2. [Precondición 2]
3. [Precondición N]

### Datos Previos Necesarios:
| Elemento | Valor | Estado |
|----------|-------|--------|
| [Item 1] | [Valor] | [Estado] |

---

## 3. Datos de Entrada

| Campo | Valor | Tipo | Validación |
|-------|-------|------|-----------|
| [Campo 1] | [Valor] | [Tipo] | [Regla] |
| [Campo 2] | [Valor] | [Tipo] | [Regla] |

---

## 4. Pasos de Ejecución

1. [Paso 1 - Acción clara]
   - Detalle si aplica
   
2. [Paso 2 - Acción clara]
   - Detalle si aplica
   
3. [Paso N - Acción clara]
   - Detalle si aplica

---

## 5. Resultado Esperado

Cuando se completen todos los pasos anteriores, se debe observar:

- [ ] [Comportamiento esperado 1]
- [ ] [Comportamiento esperado 2]
- [ ] [Comportamiento esperado N]

**Descripción Detallada**:
[Descripción completa del resultado esperado]

---

## 6. Ejecución Realizada

**Fecha de Ejecución**: DD/MM/YYYY  
**Hora de Ejecución**: HH:MM  
**Ejecutado por**: [Nombre del Tester]  
**Ambiente**: [Descripción del ambiente]  
**Navegador/Sistema**: [Especificar]  
**Versión de Software**: v[X.X.X]  

### Resultado Obtenido:

[Descripción detallada de lo que ocurrió]

### Screenshots/Evidencia:
[Incluir referencias a archivos adjuntos si aplica]

---

## 7. Análisis de Resultados

### Status: ✅ PASÓ / ❌ FALLÓ / ⚠️ BLOQUEADO

### Comparación Esperado vs Obtenido:

| Aspecto | Esperado | Obtenido | Coincide |
|--------|----------|----------|----------|
| [Aspecto 1] | [Valor] | [Valor] | ✅/❌ |
| [Aspecto 2] | [Valor] | [Valor] | ✅/❌ |

---

## 8. Observaciones y Notas

### Errores Encontrados:

| Severidad | Descripción | Reproducibilidad |
|-----------|-------------|------------------|
| [Crítica/Alta/Media/Baja] | [Descripción del error] | [Consistente/Intermitente] |

### Mejoras Sugeridas:

1. [Mejora 1]
2. [Mejora 2]

### Comentarios Generales:

[Comentarios relevantes sobre la prueba]

---

## 9. Información de Trazabilidad

- **Requisito Relacionado**: REQ-XXX
- **Defecto Asociado**: BUG-XXX
- **Sprint**: [Número de Sprint]
- **Archivo de Evidencia**: [nombre_archivo]
- **Estado de Revisión**: [Pendiente/Aprobado/Rechazado]

---

```

## GUÍA DE USO

### Llenado Correcto:

1. **Siempre incluir**: ID, Precondiciones, Pasos, Resultado Esperado y Status
2. **Ser específico**: Evitar términos genéricos o ambiguos
3. **Documentar todo**: Incluir detalles que otro tester necesitaría
4. **Mantener trazabilidad**: Vincular con requisitos y defectos
5. **Actualizar regularmente**: Revisar casos conforme el software cambia

### Buenas Prácticas:

✅ **HACER**:
- Escribir pasos secuenciales y claros
- Incluir valores exactos en datos de entrada
- Capturar screenshots de errores
- Documentar ambiente de prueba
- Vincular casos con requisitos

❌ **EVITAR**:
- Pasos ambiguos o poco claros
- Omitir valores específicos
- No documentar errores encontrados
- Olvidar datos de ambient/versión
- Crear casos de prueba duplicados

### Niveles de Severidad de Defectos:

| Nivel | Descripción | Impacto |
|-------|------------|--------|
| **Crítica** | Sistema inoperante o datos perdidos | Sistema no funcional |
| **Alta** | Funcionalidad principal no funciona | Impide uso normal |
| **Media** | Funcionalidad con problemas menores | Afecta experiencia |
| **Baja** | Problemas cosméticos o mejoras | Mínimo impacto |

---

## EJEMPLO COMPLETO DE CASO DE PRUEBA

```markdown
---
ID_PRUEBA: PS-001
MODULO: Autenticación
PRIORIDAD: Alta
FECHA_CREACION: 01/10/2025
ULTIMA_ACTUALIZACION: 15/10/2025
RESPONSABLE: Juan Pérez
---

# CASO DE PRUEBA: PS-001

## 1. Información General

**Nombre/Descripción**: 
Validación de acceso al sistema con credenciales válidas de usuario administrador

**Tipo de Prueba**: 
- [x] Funcional
- [x] Seguridad
- [ ] Rendimiento
- [ ] Usabilidad
- [ ] Compatibilidad
- [ ] Integración
- [x] Regresión

**Módulo/Sistema**: Autenticación - Login de Usuario

---

## 2. Precondiciones

### Condiciones Previas Requeridas:
1. Sistema debe estar instalado y operativo
2. Base de datos debe estar disponible y contener usuarios
3. Navegador web debe estar instalado (Firefox, Chrome o Edge)
4. Conexión a internet debe estar activa
5. Usuario admin@universidad.edu debe existir en la BD

### Datos Previos Necesarios:
| Elemento | Valor | Estado |
|----------|-------|--------|
| Usuario administrador | admin@universidad.edu | Activo |
| Contraseña | Pass123! | Configurada |
| Rol | Administrador | Asignado |

---

## 3. Datos de Entrada

| Campo | Valor | Tipo | Validación |
|-------|-------|------|-----------|
| Usuario | admin@universidad.edu | Email | RFC 5322 |
| Contraseña | Pass123! | String | Min 8 caracteres |
| Botón | Ingresar | Button | Click |

---

## 4. Pasos de Ejecución

1. Abrir navegador web (Chrome versión 128.0.x)
   - Asegurarse que cache esté limpio
   
2. Navegar a URL: https://127.0.0.1/scanner/v2/login.html
   - Esperar carga completa de página (máximo 5 segundos)
   
3. Verificar que se cargó página de login correctamente
   - Debe haber campos de Usuario y Contraseña visibles
   
4. Hacer clic en campo "Usuario"
   - Campo debe estar enfocado (borde azul)
   
5. Ingresa usuario: admin@universidad.edu
   - Debe aparecer en el campo
   
6. Hacer clic en campo "Contraseña"
   - Campo debe estar enfocado
   
7. Ingresa contraseña: Pass123!
   - Los caracteres deben aparecer como puntos (enmascarados)
   
8. Hacer clic en botón "Ingresar"
   - Botón debe cambiar estado (presionado)
   
9. Esperar procesamiento del login
   - Máximo 5 segundos de tiempo de respuesta

---

## 5. Resultado Esperado

Cuando se completen todos los pasos anteriores, se debe observar:

- [x] Redirección a página de dashboard
- [x] Mensaje: "Sesión iniciada correctamente"
- [x] Nombre del usuario visible en esquina superior derecha
- [x] Menú lateral activo con opciones: Registros, Reportes, Configuración
- [x] No debe mostrar página de error
- [x] URL cambia a https://127.0.0.1/scanner/v2/dashboard.html

**Descripción Detallada**:
El sistema debe autenticar al usuario y dirigirlo al panel de control (dashboard), mostrando todos los elementos de interfaz correspondientes a su rol administrativo. La sesión debe iniciarse correctamente y permitir navegación dentro del sistema.

---

## 6. Ejecución Realizada

**Fecha de Ejecución**: 15/10/2025  
**Hora de Ejecución**: 14:30  
**Ejecutado por**: Juan Pérez  
**Ambiente**: Local - Servidor XAMPP  
**Navegador/Sistema**: Chrome 128.0.6613 / Windows 10 64-bit  
**Versión de Software**: v2.1.0  

### Resultado Obtenido:

Se siguieron todos los pasos correctamente. Al hacer clic en el botón "Ingresar", el sistema procesó las credenciales y redirigió correctamente a la página de dashboard. Se visualizó el mensaje de bienvenida "Sesión iniciada correctamente" en la parte superior de la pantalla. El nombre del usuario "Administrador" apareció en la esquina superior derecha. El menú lateral mostró todas las opciones esperadas sin problemas.

### Screenshots/Evidencia:
- login_screen_filled.png
- dashboard_loaded.png
- user_menu_visible.png

---

## 7. Análisis de Resultados

### Status: ✅ PASÓ

### Comparación Esperado vs Obtenido:

| Aspecto | Esperado | Obtenido | Coincide |
|--------|----------|----------|----------|
| Redirección a dashboard | Sí | Sí | ✅ |
| Mensaje de éxito | "Sesión iniciada correctamente" | "Sesión iniciada correctamente" | ✅ |
| Nombre usuario visible | admin | admin | ✅ |
| Menú lateral | 3 opciones | 3 opciones | ✅ |
| Tiempo respuesta | < 5 seg | 2.5 seg | ✅ |
| URL final | /dashboard.html | /dashboard.html | ✅ |

---

## 8. Observaciones y Notas

### Errores Encontrados:

Ninguno identificado en esta ejecución.

### Mejoras Sugeridas:

1. Agregar animación de carga durante el procesamiento del login
2. Considerar agregar opción "Recuérdame" para futuras sesiones
3. Implementar recuperación de contraseña en página de login

### Comentarios Generales:

La funcionalidad de autenticación se comporta de manera esperada. El sistema responde rápidamente y proporciona retroalimentación clara al usuario. La seguridad de la contraseña se mantiene correctamente enmascarada durante la entrada.

---

## 9. Información de Trazabilidad

- **Requisito Relacionado**: REQ-AUTH-001
- **Defecto Asociado**: Ninguno
- **Sprint**: Sprint 2
- **Archivo de Evidencia**: PS-001-ejecucion-15oct2025.zip
- **Estado de Revisión**: Aprobado

---

```

---

## CONCLUSIONES

Este formato de casos de prueba proporciona:

✅ **Trazabilidad completa** de todas las pruebas realizadas  
✅ **Reproducibilidad** para otros testers  
✅ **Documentación clara** para stakeholders  
✅ **Base para métricas** de calidad  
✅ **Registro histórico** de validaciones  

---

**Última Actualización**: 16/10/2025  
**Versión del Formato**: 1.0

