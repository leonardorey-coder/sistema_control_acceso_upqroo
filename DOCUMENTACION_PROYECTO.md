# Sistema de Control de Acceso por Códigos QR – v2

## Nombre del proyecto
Sistema de Control de Acceso por Códigos QR – v2

## Introducción
Este sistema web permite gestionar y controlar el acceso de personas a instalaciones mediante la lectura de códigos QR. Desarrollado con tecnologías web modernas (HTML5, JavaScript, PHP y MySQL), el sistema proporciona una solución integral para el registro automatizado de entradas y salidas de estudiantes, docentes y personal administrativo en instituciones educativas. La aplicación utiliza la cámara del dispositivo para escanear códigos QR que contienen la matrícula del usuario, validando la información en tiempo real y registrando cada acceso con marca temporal y datos del administrador responsable.

## Justificación
La adopción de este sistema se justifica por la necesidad de modernizar procesos de control de acceso que, en su forma manual, son lentos, propensos a errores y difíciles de estandarizar. La lectura de códigos QR desde cámara y los flujos digitales sustituyen hojas de registro y digitación, reducen tiempos de espera y mejoran la experiencia tanto para usuarios como para operadores.

Desde el punto de vista de la seguridad, la aplicación incorpora autenticación de administradores, validación estricta en servidor y almacenamiento seguro de credenciales (hash de contraseñas y uso de tokens). Al validar formatos como matrícula y CURP y evitar la manipulación de datos en el cliente, se disminuye la superficie de ataque y se previenen accesos no autorizados.

La trazabilidad es otro pilar: cada evento de entrada o salida se registra con marca temporal, identificando a la persona y al administrador responsable. Esta bitácora facilita auditorías, atención de incidencias y cumplimiento normativo. Además, el diseño orientado a alta concurrencia —interfaz ágil, escaneo veloz y comunicación asíncrona— mantiene la fluidez en momentos pico sin cuellos de botella.

Contar con datos confiables habilita reportes y análisis por carrera, tipo de persona y periodos, apoyando decisiones basadas en evidencia. La arquitectura modular y web permite escalar a nuevos puntos de control sin hardware propietario, mientras que la interfaz responsiva garantiza accesibilidad desde dispositivos móviles, tabletas o equipos de escritorio con cámara.

## Objetivos

### Objetivo general
Desarrollar e implementar un sistema web integral de control de acceso basado en códigos QR que automatice, asegure y optimice el registro de entradas y salidas en instituciones educativas.

### Objetivos específicos
1. **Gestión de usuarios**: Implementar un sistema de autenticación seguro para administradores con diferentes niveles de acceso.
2. **Captura de QR**: Desarrollar un módulo de escaneo que utilice la cámara del dispositivo para leer códigos QR en tiempo real.
3. **Validación de identidad**: Crear un sistema de verificación que valide la matrícula escaneada contra la base de datos de personas registradas.
4. **Registro automatizado**: Implementar el registro automático de entradas y salidas con marca temporal precisa.
5. **Gestión de personas**: Desarrollar un módulo completo para el alta, modificación y consulta de personas (estudiantes, docentes, administrativos).
6. **Generación de QR**: Crear funcionalidad para generar y descargar códigos QR personalizados para cada usuario registrado.
7. **Reportes y consultas**: Implementar un sistema de reportes que permita consultar y exportar registros filtrados por fecha, carrera y tipo de persona.
8. **Auditoría**: Mantener trazabilidad completa de todas las operaciones realizadas por cada administrador.

## Desarrollo del software

### Arquitectura del sistema

El sistema sigue una arquitectura cliente-servidor tradicional con las siguientes capas:

**Capa de presentación (Frontend)**
- Interfaz de usuario desarrollada en HTML5, CSS3 y JavaScript vanilla
- Sistema de navegación por pestañas (tabs) para organizar funcionalidades
- Diseño responsivo que se adapta a diferentes tamaños de pantalla
- Integración con la librería html5-qrcode para lectura de códigos QR
- Uso de QRCode.js para generación de códigos QR en el cliente

**Capa de lógica de negocio (Backend)**
- Desarrollada en PHP 7+ siguiendo principios de programación estructurada
- Validación de datos en servidor para garantizar integridad
- Manejo de sesiones y tokens de autenticación
- Procesamiento de imágenes para fotos de perfil
- Generación de respuestas JSON para comunicación asíncrona

**Capa de datos**
- Base de datos MySQL con diseño relacional normalizado
- Stored procedures para operaciones complejas
- Índices optimizados para búsquedas frecuentes
- Vistas para simplificar consultas de reportes

### Modelo de datos

El sistema gestiona las siguientes entidades principales:

**Administradores**
- Usuarios del sistema con credenciales de acceso
- Campos: id, usuario, password (hash), nombre, último_acceso
- Tokens de sesión para autenticación persistente

**Personas**
- Registro maestro de todos los individuos con acceso autorizado
- Campos: matrícula (PK), nombres, apellidos, CURP, tipo_persona, estado, foto_perfil
- Relación con carreras para estudiantes

**Carreras**
- Catálogo de programas académicos
- Campos: id_carrera, nombre_carrera, clave_carrera
- Referenciada por personas de tipo estudiante

**Registros de Acceso**
- Bitácora completa de entradas y salidas
- Campos: id_registro, matrícula, hora_entrada, id_admin_entrada, hora_salida, id_admin_salida
- Vista especial para registros del día actual

### Flujos principales del sistema

**1. Autenticación de administradores**
- Ingreso de credenciales en login.html
- Validación contra base de datos con password hasheado
- Generación de token de sesión único
- Almacenamiento en localStorage para persistencia
- Verificación de token en cada operación sensible

**2. Escaneo y registro de acceso**
- Activación de cámara con permisos del navegador
- Detección automática de código QR en el video stream
- Extracción de matrícula del código
- Consulta a la base de datos para validar persona
- Determinación automática si es entrada o salida
- Registro con timestamp y administrador responsable
- Retroalimentación visual y auditiva del resultado

**3. Gestión de personas**
- Formulario completo con validaciones en cliente y servidor
- Carga dinámica de carreras según tipo de persona
- Validación de formato CURP (18 caracteres específicos)
- Manejo de fotografías con redimensionamiento automático
- Prevención de duplicados por matrícula y CURP

**4. Generación de códigos QR**
- Dos modos de operación: registro nuevo o solo generación
- Creación de QR con matrícula como contenido principal
- Personalización visual con datos de la institución
- Descarga en formato PNG con información adicional
- Almacenamiento opcional en perfil de persona

**5. Consulta de registros**
- Tabla dinámica con registros del día actual
- Actualización automática sin recargar página
- Visualización de administrador responsable
- Indicadores de estado (en curso/completado)
- Preparado para futura exportación a CSV/Excel

### Medidas de seguridad implementadas

- **Autenticación robusta**: Uso de bcrypt para hasheo de contraseñas
- **Prevención de inyección SQL**: Prepared statements en todas las consultas
- **Validación doble**: Cliente y servidor validan todos los datos
- **Sanitización de salidas**: Escape de caracteres especiales en HTML
- **Control de sesiones**: Tokens únicos con expiración configurable
- **Registro de auditoría**: Trazabilidad completa de acciones administrativas
- **HTTPS recomendado**: Preparado para certificados SSL en producción
- **Permisos granulares**: Sistema extensible para roles y permisos

### Consideraciones técnicas

**Rendimiento**
- Índices en campos de búsqueda frecuente (matrícula, fecha)
- Consultas optimizadas con JOINs eficientes
- Caché de resultados en el cliente cuando es apropiado
- Lazy loading de imágenes de perfil

**Compatibilidad**
- Soporte para navegadores modernos (Chrome, Firefox, Safari, Edge)
- Degradación elegante si no hay soporte de cámara
- Diseño responsivo para móviles y tablets
- Fallback para navegadores sin JavaScript

**Mantenibilidad**
- Código modular y comentado
- Separación clara de responsabilidades
- Configuración centralizada en config.php
- Logs de error para debugging

## Ejemplos funcionales o mockups

### Caso de uso 1: Registro de entrada exitoso
1. Administrador inicia sesión en el sistema
2. Sistema muestra interfaz principal con escáner activo
3. Estudiante presenta su código QR a la cámara
4. Sistema detecta QR con matrícula "202300097"
5. Validación exitosa: estudiante activo, carrera Ingeniería de Software
6. Registro de entrada a las 08:45:23
7. Mensaje: "✅ Entrada Registrada - Juan Pérez García"
8. Sonido de confirmación exitosa

### Caso de uso 2: Intento de acceso con persona inactiva
1. Escaneo de QR con matrícula "202200045"
2. Sistema detecta que el estado es "inactivo"
3. Mensaje: "❌ Esta matrícula está inactiva. Acceso denegado."
4. Sonido de error
5. No se registra el acceso en la base de datos

### Caso de uso 3: Generación de QR para nuevo estudiante
1. Administrador selecciona pestaña "Generar QR"
2. Modo: "Registrar y Generar"
3. Completa formulario:
   - Matrícula: 202400123
   - Nombres: María Elena
   - Apellidos: González Ramírez
   - CURP: GORM040515MQRNRLA8
   - Tipo: Estudiante
   - Carrera: Ingeniería en Biotecnología
4. Sistema registra persona y genera QR
5. Opción de descargar QR con diseño institucional

### Mockup: Pantalla principal de escaneo
```
┌─────────────────────────────────────────────┐
│ [Logo] Sistema de Control de Acceso   👤Admin│
├─────────────────────────────────────────────┤
│ [📷 Escáner] [🎫 Generar] [📊 Registros]    │
├─────────────────────────────────────────────┤
│          Escanear Código QR                 │
│   Coloque su código QR frente a la cámara  │
│                                             │
│        ┌───────────────────┐               │
│        │                   │               │
│        │   [Vista Cámara]  │               │
│        │    ┌─────────┐    │               │
│        │    │   QR    │    │               │
│        │    └─────────┘    │               │
│        └───────────────────┘               │
│                                             │
│    Estado: Esperando código QR...           │
│                                             │
└─────────────────────────────────────────────┘
```

### Mockup: Resultado de escaneo exitoso
```
┌─────────────────────────────────────────────┐
│        ✅ Entrada Registrada                │
├─────────────────────────────────────────────┤
│    [Foto]  Juan Pérez García               │
│     👤     Estudiante                       │
├─────────────────────────────────────────────┤
│    Estado: ACTIVO                           │
├─────────────────────────────────────────────┤
│ Matrícula: 202300097                       │
│ Carrera: Ingeniería de Software            │
├─────────────────────────────────────────────┤
│ 15/10/2025 08:45:23                        │
│                                             │
│         [Continuar Escaneando]              │
└─────────────────────────────────────────────┘
```

### Mockup: Tabla de registros del día
```
┌─────────────────────────────────────────────┐
│    Registros del día          [🔄 Actualizar]│
├────┬──────────┬─────────┬────────┬─────────┤
│Mat │ Nombre   │ Carrera │Entrada │ Salida  │
├────┼──────────┼─────────┼────────┼─────────┤
│2023│Juan Pérez│Ing. Soft│08:45   │   --    │
│0009│García    │         │👤 Admin1│         │
├────┼──────────┼─────────┼────────┼─────────┤
│2023│María     │Biotec.  │09:15   │ 14:30   │
│0012│López     │         │👤 Admin1│👤 Admin2│
└────┴──────────┴─────────┴────────┴─────────┘
```

## Conclusión

El Sistema de Control de Acceso por Códigos QR v2 representa una solución tecnológica integral que moderniza y optimiza la gestión de accesos en instituciones educativas. Su arquitectura web permite una implementación rápida sin necesidad de instalaciones complejas, mientras que su diseño modular facilita futuras expansiones y adaptaciones a necesidades específicas.

El sistema no solo automatiza un proceso tradicionalmente manual, sino que agrega valor mediante la generación de datos analíticos, trazabilidad completa y mejora en la experiencia de usuario. La combinación de tecnologías probadas (PHP, MySQL, JavaScript) con bibliotecas especializadas para QR garantiza estabilidad y mantenibilidad a largo plazo.

Con su enfoque en la seguridad, usabilidad y eficiencia, este sistema se posiciona como una herramienta fundamental para instituciones que buscan modernizar sus procesos de control de acceso, mejorando simultáneamente la seguridad, la productividad administrativa y la satisfacción de los usuarios finales.

## Glosario técnico (10 palabras)

1. **QR (Quick Response)**: Código de barras bidimensional que almacena información legible por dispositivos ópticos, utilizado para identificación rápida.

2. **Frontend**: Capa de presentación de la aplicación que interactúa directamente con el usuario mediante interfaz gráfica en el navegador.

3. **Backend**: Capa del servidor que procesa la lógica de negocio, gestiona datos y responde a peticiones del frontend.

4. **API REST**: Interfaz de programación que permite la comunicación entre sistemas mediante protocolo HTTP y formato JSON.

5. **Hash**: Función criptográfica unidireccional que transforma contraseñas en cadenas irreversibles para almacenamiento seguro.

6. **Token**: Cadena única generada por el servidor para identificar y validar sesiones de usuario sin reenviar credenciales.

7. **Timestamp**: Marca temporal que registra el momento exacto de un evento en formato fecha/hora para auditoría.

8. **Prepared Statement**: Técnica de programación que separa consultas SQL de datos para prevenir inyecciones maliciosas.

9. **JSON**: Formato ligero de intercambio de datos basado en JavaScript, usado para comunicación cliente-servidor.

10. **Responsive Design**: Técnica de diseño web que adapta automáticamente la interfaz a diferentes tamaños de pantalla.
