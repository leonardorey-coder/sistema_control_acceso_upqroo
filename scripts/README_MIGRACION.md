# Guía de Migración al Nuevo Esquema

## Descripción

Este script realiza una migración segura de tu base de datos actual al nuevo esquema `control_acceso_postgres_v2.sql`, preservando los datos de administradores, carreras y personas.

## Proceso de Migración

El script realiza los siguientes pasos:

1. **Backup Completo**: Crea un backup completo de la base de datos actual
2. **Extracción de Datos**: Extrae solo los datos de las tablas:
   - `administradores`
   - `carreras`
   - `personas`
3. **Aplicación del Nuevo Esquema**: Elimina las tablas existentes y crea el nuevo esquema
4. **Restauración de Datos**: Restaura los datos extraídos en el nuevo esquema
5. **Actualización de Secuencias**: Actualiza las secuencias de IDs para evitar conflictos
6. **Verificación**: Muestra un conteo de registros para verificar la migración

## Requisitos Previos

- Node.js instalado
- PostgreSQL instalado con `pg_dump` y `psql` disponibles
- Archivo `.env` configurado con las credenciales de la base de datos

## Uso

### Opción 1: Script de Node.js (Recomendado)

```bash
cd /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo
node scripts/backup_and_migrate.js
```

### Opción 2: Script de Bash

```bash
cd /Users/leonardocruz/Documents/proyectos/sistema_control_acceso_upqroo
./scripts/backup_and_migrate.sh
```

## Archivos Generados

Los backups se guardan en el directorio `backups/` con el formato:

- `backup_YYYYMMDD_HHMMSS.sql` - Backup completo de la base de datos
- `data_backup_YYYYMMDD_HHMMSS.sql` - Solo los datos de administradores, carreras y personas

## Restauración en Caso de Error

Si algo sale mal durante la migración, puedes restaurar el backup completo:

```bash
psql -h localhost -U leonardocruz -p 5432 -d control_acceso -f backups/backup_YYYYMMDD_HHMMSS.sql
```

## Notas Importantes

- ⚠️ **Los registros de acceso históricos NO se migran** (como se solicitó)
- ✓ Se preservan todos los administradores con sus tokens de sesión
- ✓ Se preservan todas las personas registradas con sus fotos de perfil
- ✓ Se preservan todas las carreras
- ✓ El nuevo esquema incluye las mejoras de blockchain y nuevos campos

## Nuevas Características del Esquema v2

1. **Sistema Blockchain**: Cada registro de entrada tiene un hash que garantiza su integridad
2. **Campos Nuevos en Personas**:
   - `notas`: Para observaciones adicionales
   - `fecha_caducidad_qr`: Para QR temporales
3. **Salidas Automáticas**: Sistema para marcar salidas automáticas a medianoche
4. **Verificación de Integridad**: Función para verificar que los registros no han sido alterados
5. **Asistencias Potenciales**: Sistema para registrar asistencias automáticas de estudiantes

## Verificación Post-Migración

Después de la migración, verifica que:

1. Todos los administradores pueden iniciar sesión
2. Todas las personas aparecen en el panel administrativo
3. Las carreras están disponibles en los formularios
4. Puedes registrar nuevas entradas/salidas sin problemas

## Soporte

Si encuentras algún problema durante la migración, revisa:

1. Los logs del script para identificar el error
2. Los archivos de backup en el directorio `backups/`
3. La configuración de conexión en el archivo `.env`
