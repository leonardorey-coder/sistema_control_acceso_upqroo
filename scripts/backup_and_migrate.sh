#!/bin/bash

# Script para hacer backup de la BD actual y migrar al nuevo esquema
# Uso: ./backup_and_migrate.sh

set -e

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuración de la base de datos
DB_HOST=${DB_HOST:-localhost}
DB_USER=${DB_USER:-leonardocruz}
DB_NAME=${DB_NAME:-control_acceso}
DB_PORT=${DB_PORT:-5432}

# Directorio para backups
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.sql"
DATA_BACKUP="${BACKUP_DIR}/data_backup_${TIMESTAMP}.sql"

echo -e "${GREEN}=== Backup y Migración de Base de Datos ===${NC}"
echo ""

# Crear directorio de backups si no existe
mkdir -p "$BACKUP_DIR"

# 1. Hacer backup completo de la BD actual
echo -e "${YELLOW}[1/5] Haciendo backup completo de la base de datos...${NC}"
pg_dump -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -d "$DB_NAME" -F p -f "$BACKUP_FILE"
echo -e "${GREEN}✓ Backup completo guardado en: $BACKUP_FILE${NC}"
echo ""

# 2. Extraer solo los datos de administradores y personas
echo -e "${YELLOW}[2/5] Extrayendo datos de administradores y personas...${NC}"
pg_dump -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -d "$DB_NAME" \
    --data-only \
    --table=administradores \
    --table=personas \
    --table=carreras \
    -F p -f "$DATA_BACKUP"
echo -e "${GREEN}✓ Datos extraídos en: $DATA_BACKUP${NC}"
echo ""

# 3. Aplicar el nuevo esquema
echo -e "${YELLOW}[3/5] Aplicando nuevo esquema (control_acceso_postgres_v2.sql)...${NC}"
echo -e "${RED}ADVERTENCIA: Esto eliminará todas las tablas existentes y recreará el esquema.${NC}"
read -p "¿Deseas continuar? (s/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${RED}Operación cancelada.${NC}"
    exit 1
fi

psql -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -d "$DB_NAME" -f "./control_acceso_postgres_v2.sql"
echo -e "${GREEN}✓ Nuevo esquema aplicado correctamente${NC}"
echo ""

# 4. Restaurar datos de administradores y personas
echo -e "${YELLOW}[4/5] Restaurando datos de administradores, carreras y personas...${NC}"
psql -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -d "$DB_NAME" -f "$DATA_BACKUP"
echo -e "${GREEN}✓ Datos restaurados correctamente${NC}"
echo ""

# 5. Verificar la migración
echo -e "${YELLOW}[5/5] Verificando la migración...${NC}"
echo ""
echo "Conteo de registros:"
psql -h "$DB_HOST" -U "$DB_USER" -p "$DB_PORT" -d "$DB_NAME" -c "
SELECT 
    'Administradores' as tabla, COUNT(*) as registros FROM administradores
UNION ALL
SELECT 
    'Carreras' as tabla, COUNT(*) as registros FROM carreras
UNION ALL
SELECT 
    'Personas' as tabla, COUNT(*) as registros FROM personas
UNION ALL
SELECT 
    'Registros de Acceso' as tabla, COUNT(*) as registros FROM registros_acceso;
"
echo ""

echo -e "${GREEN}=== Migración completada exitosamente ===${NC}"
echo ""
echo "Archivos de backup guardados:"
echo "  - Backup completo: $BACKUP_FILE"
echo "  - Datos extraídos: $DATA_BACKUP"
echo ""
echo -e "${YELLOW}Nota: Los registros de acceso históricos NO fueron migrados (como se solicitó).${NC}"
