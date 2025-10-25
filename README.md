## Sistema de Control de Acceso por Códigos QR – v2

### Nombre del proyecto
Sistema de Control de Acceso por Códigos QR – v2

### Introducción
Este sistema permite gestionar accesos y asistencias mediante la lectura de códigos QR desde la cámara del dispositivo. El flujo típico: un usuario autorizado inicia sesión, escanea el QR del asistente/visitante, el servidor valida la información y registra el acceso en una base de datos para consulta y auditoría. Está pensado para entornos académicos y administrativos, optimizando tiempos y reduciendo errores manuales.

### Justificación
- **Eficiencia**: elimina planillas y digitación manual.
- **Trazabilidad**: historial verificable de entradas/salidas.
- **Seguridad**: validación en servidor y control de permisos.
- **Calidad de datos**: menos errores humanos, datos normalizados.
- **Escalabilidad**: admite múltiples puntos de control simultáneos.
- **Reportes**: estadísticas y exportaciones en tiempo real.

### Objetivos
- **Objetivo general**: Implementar un sistema web seguro y fácil de usar para registrar y auditar accesos mediante QR.
- **Objetivos específicos**:
  - Autenticación de usuarios administrativos y operadores.
  - Escaneo de QR con cámara del navegador.
  - Validación de matrícula/identidad y estado.
  - Registro de accesos con marca temporal y punto de control.
  - Consulta y exportación de reportes filtrados.
  - Gestión de personas y carreras/programas.
  - Auditoría básica (quién registra, cuándo y dónde).
  - Operación estable en `XAMPP` con `PHP` y `MySQL`.

### Desarrollo del software (sin código)
- **Alcance y requisitos**
  - Lectura de QR desde navegador (desktop o móvil).
  - Validación en servidor y registro en base de datos.
  - Roles básicos: administrador y operador.
  - Módulos: autenticación, escaneo/registro, personas, consultas/reportes.

- **Arquitectura**
  - Cliente (web): `index.html`, `login.html`, `style.css` y JavaScript para cámara y lectura de QR.
  - Servidor (PHP): `procesar_login.php`, `verificar_admin.php`, `procesar_qr.php`, `verificar_matricula.php`, `registrar_persona.php`, `obtener_carreras.php`, `obtener_registros.php`.
  - Base de datos: `control_acceso.sql` (tablas para usuarios, personas, carreras, accesos).
  - Despliegue: entorno `XAMPP` (Apache + PHP + MySQL) con configuración en `config.php`.

- **Modelo de datos (conceptual)**
  - Personas: `id_persona`, `matricula`, `nombre`, `carrera`, `estado`.
  - Carreras: `id_carrera`, `nombre`, `codigo`.
  - Usuarios (admin/op): `id_usuario`, `nombre`, `email`, `hash_contraseña`, `rol`.
  - Accesos: `id_acceso`, `id_persona`, `fecha_hora`, `punto_control`, `registrado_por`.

- **Flujos principales**
  - Autenticación: formulario en `login.html` → `procesar_login.php` → sesión válida.
  - Escaneo/Registro: cámara en `index.html` → lectura del QR → `procesar_qr.php` → validación (`verificar_matricula.php`) → inserción en Accesos.
  - Gestión de personas: alta/edición en `registrar_persona.php` con soporte de `obtener_carreras.php`.
  - Reportes: filtros por fecha, carrera, punto de control en `obtener_registros.php` (con exportación CSV).

- **Seguridad y buenas prácticas**
  - Contraseñas con hash seguro y sesiones con regeneración de ID.
  - Validación en servidor de todos los datos del QR (no confiar en el cliente).
  - Sanitización/escape de entradas y salidas para prevenir inyecciones.
  - HTTPS en producción; política de permisos de cámara restringida.
  - Registros de auditoría y control de acceso por rol.

- **Calidad, pruebas y operación**
  - Pruebas funcionales del lector, validaciones y reportes.
  - Logs de errores del servidor y métricas básicas de uso.
  - Respaldos de base de datos y procedimiento de recuperación.
  - Monitoreo de disponibilidad y tiempos de respuesta.

- **Accesibilidad y UX**
  - Botones grandes y contraste adecuado.
  - Indicadores de estado de cámara y lectura.
  - Mensajes de error claros y accionables.

### Ejemplos funcionales o mockups
- **Casos de uso**
  - Estudiante con QR válido: registro exitoso con fecha/hora y punto de control.
  - QR caducado: rechazo con mensaje “Código expirado”.
  - Matrícula no registrada: sugerir alta de persona (si el rol lo permite).
  - Doble escaneo en corto tiempo: idempotencia/antirrebote configurable.
  - Administrador descarga reporte del día por carrera.

- **Ejemplo de contenido de QR (formato recomendado)**
```text
MATRICULA=20231234;TS=2025-10-09T14:22:11Z;FIRMA=BASE64(FIRMA_DIGITAL)
```

- **Wireframe: Inicio de sesión**
```text
+-----------------------------------------+
|        Control de Acceso por QR         |
+-----------------------------------------+
|  Usuario/Email: [____________________]  |
|  Contraseña:     [____________________] |
|  [ Ingresar ]   [ ¿Olvidé mi clave? ]   |
+-----------------------------------------+
```

- **Wireframe: Escaneo y registro**
```text
+-----------------------------------------+
| [ Camara: ON ]  [ Cambiar dispositivo ] |
| +---------------- Video Preview -------+|
| |   [   Marco de escaneo (QR)       ]  |
| +------------------------------------+ |
| Estado: QR detectado ✓  Matrícula: 20231234
| [ Registrar acceso ]  [ Reintentar ]  |
+-----------------------------------------+
```

- **Wireframe: Reportes**
```text
+-----------------------------------------+
| Filtros: [Fecha desde] [Fecha hasta]    |
|          [Carrera] [Punto de control]   |
| [ Buscar ]  [ Exportar CSV ]            |
|-----------------------------------------|
| # | Matrícula | Nombre | Carrera | Fecha|
| 1 | 20231234  | Ana P. | Ing.Sis | 10:02|
| ...                                     |
+-----------------------------------------+
```

### Conclusión
El sistema de Control de Acceso por Códigos QR – v2 ofrece una solución web segura y eficiente para registrar y auditar accesos en tiempo real. Su arquitectura ligera en `PHP` y `MySQL`, junto con un frontend basado en cámara y lectura de QR, facilita la adopción y el mantenimiento, a la vez que mejora la calidad y trazabilidad de la información.

### Glosario técnico (10 palabras)
- **QR**: Código bidimensional que almacena datos escaneables por cámara.
- **Backend**: Lógica del servidor que procesa, valida y persiste datos.
- **Frontend**: Interfaz de usuario que corre en el navegador.
- **Endpoint**: Ruta del servidor que expone una funcionalidad específica.
- **Sesión**: Contexto autenticado que identifica a un usuario en el tiempo.
- **Hash**: Transformación unidireccional de datos, usada para contraseñas.
- **Validación**: Verificación de que los datos cumplen reglas y formatos.
- **Idempotencia**: Operación que no produce efectos duplicados al repetirse.
- **Auditoría**: Registro de acciones para seguimiento y cumplimiento.
- **Exportación CSV**: Descarga de datos en formato separado por comas.


