# Resolver Incompatibilidad de Versiones PostgreSQL

## Problema Actual

Tu sistema tiene una incompatibilidad de versiones:
- **Servidor PostgreSQL**: 16.11 (Homebrew)
- **Cliente (pg_dump/psql)**: 14.20 (Homebrew)

Esto previene hacer backups y ejecutar migraciones.

## Solución Rápida

### Opción 1: Actualizar PostgreSQL Client (Recomendado)

```bash
# Actualizar Homebrew
brew update

# Actualizar PostgreSQL a la versión más reciente
brew upgrade postgresql

# Verificar versión actualizada
pg_dump --version
psql --version
```

### Opción 2: Usando PostgreSQL 16 específicamente

Si prefieres la versión 16 directamente:

```bash
# Desinstalar versión vieja
brew uninstall postgresql@14

# Instalar PostgreSQL 16
brew install postgresql@16

# Enlazar en PATH
brew link postgresql@16
```

## Verificar Que Funciona

Después de actualizar, verifica:

```bash
# Ambas deben mostrar 16.x
pg_dump --version
psql --version

# Verificar conexión a servidor
psql -U leonardocruz -d control_acceso -c "SELECT version();"
```

## Hacer Backup Después de Actualizar

Una vez actualizado, ejecuta:

```bash
# Backup de la base de datos
pg_dump -U leonardocruz -d control_acceso > backup_antes_v3.sql

# Verificar backup
ls -lh backup_antes_v3.sql
wc -l backup_antes_v3.sql
```

## Alternativamente: Sin Actualizar

Si no quieres actualizar, puedes aplicar el schema directamente:

```bash
# Conectar directamente a psql
psql -U leonardocruz -d control_acceso

# Dentro de psql, ejecutar el schema
\i temp/control_acceso_postgres_v3_hibrido.sql

# O ejecutar desde terminal
psql -U leonardocruz -d control_acceso -f temp/control_acceso_postgres_v3_hibrido.sql
```

## Próximos Pasos

Después de resolver la versión, sigue:

1. **Hacer backup:**
```bash
pg_dump -U leonardocruz -d control_acceso > backup_antes_v3.sql
```

2. **Ejecutar migración:**
```bash
node temp/migrar_v3_hibrido.js
```

3. **Verificar migración:**
```bash
psql -U leonardocruz -d control_acceso -c "
  SELECT estado, COUNT(*) FROM asistencias_potenciales GROUP BY estado;
"
```

## Troubleshooting

### Error: "Can't find PostgreSQL installation"

Después de brew install/upgrade, asegúrate de que está en PATH:

```bash
# Encontrar instalación
find /opt/homebrew -name "pg_dump" -o -name "psql"

# Si es necesario, enlazar manualmente
brew link postgresql
```

### Error: "Unexpected error while installing formula"

Intenta limpiar y reinstalar:

```bash
brew cleanup
brew uninstall postgresql
brew install postgresql@16
```

### Error: Connection refused

Asegúrate que PostgreSQL está ejecutándose:

```bash
# En otra terminal, inicia PostgreSQL
brew services start postgresql

# Verifica que está ejecutándose
brew services list
```

## Referencia Rápida

| Comando | Propósito |
|---------|-----------|
| `brew upgrade postgresql` | Actualizar a versión más reciente |
| `brew install postgresql@16` | Instalar versión 16 específicamente |
| `brew uninstall postgresql@14` | Remover versión vieja |
| `brew link postgresql` | Enlazar en PATH |
| `brew services start postgresql` | Iniciar servicio |
| `brew services stop postgresql` | Detener servicio |

## ¿Más Ayuda?

Si el problema persiste después de actualizar, verifica:

1. Versión del servidor PostgreSQL:
```bash
psql -U leonardocruz -d control_acceso -c "SELECT version();"
```

2. Versión del cliente:
```bash
pg_dump --version
```

Ambas deben coincidir en número de versión mayor (16.x con 16.x, etc.)

