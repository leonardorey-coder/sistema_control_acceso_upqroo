# Organización del Proyecto - Metodología Cascada
## Sistema de Control de Acceso por Códigos QR v2

## Metodología Cascada

La metodología cascada es un enfoque secuencial donde cada fase del desarrollo depende de la finalización de la fase anterior. Cada miembro del equipo tiene responsabilidades específicas en su fase correspondiente.


## Fases del Desarrollo y Asignación de Roles

### **Fase 1: Análisis y Requerimientos**
**Responsable: Leo**

#### Responsabilidades:
- Definir objetivos del sistema
- Recopilar requerimientos funcionales y no funcionales
- Identificar usuarios del sistema (administradores, estudiantes, docentes)
- Documentar casos de uso principales
- Establecer criterios de aceptación

#### Entregables:
- Documento de requerimientos
- Casos de uso detallados
- Especificaciones funcionales
- Análisis de stakeholders


### **Fase 2: Diseño del Sistema**
**Responsable: Yahir**

#### Responsabilidades:
- Diseñar la arquitectura del sistema
- Crear diagramas de flujo de datos
- Definir la estructura de la base de datos
- Diseñar la interfaz de usuario
- Especificar la integración con APIs

#### Entregables:
- Diagramas de arquitectura
- Modelo de base de datos (ER)
- Mockups de interfaz
- Especificaciones técnicas
- Documento de diseño del sistema


### **Fase 3: Diseño de Base de Datos**
**Responsable: Mewi**

#### Responsabilidades:
- Normalizar el modelo de datos
- Crear scripts de creación de tablas
- Definir relaciones entre entidades
- Implementar procedimientos almacenados
- Configurar índices y optimizaciones

#### Entregables:
- Scripts SQL de creación
- Diagrama de base de datos
- Procedimientos almacenados
- Documentación de esquema
- Scripts de datos de prueba


### **Fase 4: Desarrollo Backend**
**Responsable: Prestegui**

#### Responsabilidades:
- Implementar APIs en PHP
- Desarrollar lógica de negocio
- Implementar autenticación y seguridad
- Crear endpoints para el frontend
- Implementar validaciones de datos

#### Entregables:
- Código PHP funcional
- APIs documentadas
- Sistema de autenticación
- Validaciones implementadas
- Pruebas unitarias del backend


### **Fase 5: Desarrollo Frontend**
**Responsable: David**

#### Responsabilidades:
- Implementar interfaz de usuario en HTML/CSS/JS
- Integrar librería de escaneo QR
- Desarrollar formularios de registro
- Implementar sistema de navegación
- Optimizar experiencia de usuario

#### Entregables:
- Interfaz web completa
- Funcionalidad de escaneo QR
- Formularios funcionales
- Diseño responsivo
- Integración con backend


### **Fase 6: Integración y Pruebas**
**Responsable: Johan**

#### Responsabilidades:
- Integrar frontend con backend
- Realizar pruebas de integración
- Ejecutar pruebas de caja gris
- Validar flujos completos del sistema
- Documentar bugs y soluciones

#### Entregables:
- Sistema integrado funcional
- Reporte de pruebas
- Documentación de bugs
- Casos de prueba ejecutados
- Validación de requerimientos


### **Fase 7: Pruebas de Sistema**
**Responsable: Didi**

#### Responsabilidades:
- Ejecutar pruebas de sistema completas
- Validar rendimiento del sistema
- Probar casos límite y escenarios de error
- Verificar seguridad del sistema
- Validar compatibilidad con navegadores

#### Entregables:
- Reporte de pruebas de sistema
- Análisis de rendimiento
- Documentación de casos límite
- Reporte de seguridad
- Validación de compatibilidad


### **Fase 8: Despliegue y Mantenimiento**
**Responsable: Estrella**

#### Responsabilidades:
- Configurar servidor de producción
- Desplegar la aplicación
- Configurar respaldos y monitoreo
- Documentar proceso de despliegue
- Establecer plan de mantenimiento

#### Entregables:
- Sistema en producción
- Documentación de despliegue
- Plan de respaldos
- Manual de mantenimiento
- Monitoreo configurado


## Flujo de Trabajo Cascada

```
Leo (Análisis) 
    ↓
Yahir (Diseño) 
    ↓
Mewi (Base de Datos) 
    ↓
Prestegui (Backend) 
    ↓
David (Frontend) 
    ↓
Johan (Integración) 
    ↓
Didi (Pruebas) 
    ↓
Estrella (Despliegue)
```

## Criterios de Transición entre Fases

### **De Análisis a Diseño:**
- ✅ Todos los requerimientos documentados
- ✅ Casos de uso aprobados
- ✅ Objetivos del sistema definidos

### **De Diseño a Base de Datos:**
- ✅ Arquitectura del sistema definida
- ✅ Modelo de datos aprobado
- ✅ Especificaciones técnicas completas

### **De Base de Datos a Backend:**
- ✅ Base de datos implementada y probada
- ✅ Procedimientos almacenados funcionando
- ✅ Datos de prueba cargados

### **De Backend a Frontend:**
- ✅ APIs funcionando correctamente
- ✅ Autenticación implementada
- ✅ Validaciones del servidor completas

### **De Frontend a Integración:**
- ✅ Interfaz de usuario completa
- ✅ Funcionalidad de escaneo QR operativa
- ✅ Formularios validados

### **De Integración a Pruebas:**
- ✅ Sistema completamente integrado
- ✅ Flujos principales funcionando
- ✅ Comunicación frontend-backend establecida

### **De Pruebas a Despliegue:**
- ✅ Todas las pruebas pasando
- ✅ Sistema estable y funcional
- ✅ Documentación completa

## Comunicación y Coordinación

### **Reuniones de Transición:**
- Al final de cada fase, el responsable presenta sus entregables
- El siguiente responsable valida que puede iniciar su fase
- Se documentan decisiones y cambios

### **Documentación Compartida:**
- Todos los entregables se almacenan en repositorio compartido
- Cada fase documenta sus decisiones técnicas
- Se mantiene un registro de cambios y versiones

### **Gestión de Riesgos:**
- Si una fase se retrasa, se notifica inmediatamente al equipo
- Se evalúan alternativas para mantener el cronograma
- Se documentan impactos en fases posteriores


## Cronograma Estimado

| Fase | Responsable | Duración Estimada | Dependencias |
|------|------------|-----------------|--------------|
| Análisis | Leo | 1 semana | Ninguna |
| Diseño | Yahir | 1.5 semanas | Análisis completo |
| Base de Datos | Mewi | 1 semana | Diseño aprobado |
| Backend | Prestegui | 2 semanas | Base de datos lista |
| Frontend | David | 2 semanas | Backend funcional |
| Integración | Johan | 1 semana | Frontend y Backend |
| Pruebas | Didi | 1.5 semanas | Sistema integrado |
| Despliegue | Estrella | 1 semana | Pruebas completadas |

**Duración Total Estimada: 10 semanas**