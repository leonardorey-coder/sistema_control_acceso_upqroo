# Pasos Finales para Completar Migración v3

## Estado Actual

✓ Versiones de PostgreSQL corregidas (16.11 en cliente y servidor)
✓ PostgreSQL@16 está enlazado en PATH
✓ PostgreSQL@14 removido de servicios
✓ PostgreSQL@16 iniciado como servicio

## Lo que Falta

1. Verificar conexión a base de datos
2. Crear backup
3. Ejecutar migración
4. Verificar estado

## Instrucciones Paso a Paso

### Paso 1: Verificar Conexión

Abre una nueva terminal en tu máquina y ejecuta:

```bash
cd ~/Documents/proyectos/sistema_control_acceso_upqroo

# Probar conexión
psql -U leonardocruz -d control_acceso -c "SELECT version();"
```

**Esperado:** Muestra versión de PostgreSQL 16.11

**Si falla:** 
- Verifica que PostgreSQL está corriendo: `brew services list`
- Reinicia si es necesario: `brew services restart postgresql@16`
- Intenta con host local: `psql -h localhost -U leonardocruz -d control_acceso -c "SELECT 1"`

### Paso 2: Crear Backup

```bash
# Hacer backup seguro
pg_dump -U leonardocruz -d control_acceso > backup_antes_v3.sql

# Verificar que se creó
ls -lh backup_antes_v3.sql
wc -l backup_antes_v3.sql
```

**Esperado:** Archivo SQL con 1000+ líneas

### Paso 3: Ejecutar Migración desde Node.js

```bash
node temp/migrar_v3_hibrido.js
```

**Esperado:** Mensaje "MIGRACIÓN COMPLETADA EXITOSAMENTE"

### Paso 4: Verificar Estado de Migración

```bash
# Ver estados de asistencia
psql -U leonardocruz -d control_acceso -c "
  SELECT estado, COUNT(*) as total 
  FROM asistencias_potenciales 
  GROUP BY estado 
  ORDER BY estado;
"

# Ver nuevas columnas
psql -U leonardocruz -d control_acceso -c "
  \d asistencias_potenciales
"

# Ver vista
psql -U leonardocruz -d control_acceso -c "
  SELECT COUNT(*) as total FROM vista_asistencias_con_estado;
"
```

### Paso 5: Alternativa - Aplicar Schema Directamente

Si prefieres aplicar el schema sin script:

```bash
# Opción A: Desde archivo SQL
psql -U leonardocruz -d control_acceso -f temp/control_acceso_postgres_v3_hibrido.sql

# Opción B: Desde psql interactivo
psql -U leonardocruz -d control_acceso
# Dentro de psql:
\i temp/control_acceso_postgres_v3_hibrido.sql
```

## Ubicación de Archivos

```
proyecto/
├── temp/
│   ├── control_acceso_postgres_v3_hibrido.sql  (Schema SQL v3)
│   └── migrar_v3_hibrido.js                    (Script de migración)
├── docs/
│   ├── APLICAR_MIGRACION_V3.md                 (Guía completa)
│   ├── README_MIGRACION_V3.md                  (Documentación detallada)
│   ├── RESOLVER_VERSION_POSTGRESQL.md          (Guía de versiones)
│   └── feats.md                                (Características)
└── backup_antes_v3.sql                         (Tu backup)
```

## Verificar Que Todo Funciona

Después de la migración:

```bash
# 1. Conectarse a la aplicación localmente
npm run vercel:dev

# 2. Escanear entrada de estudiante
# Debería registrar TODAS las clases del día

# 3. Escanear salida
# Debería actualizar asistencias con estados

# 4. Ver registros
psql -U leonardocruz -d control_acceso -c "
  SELECT * FROM vista_asistencias_con_estado 
  WHERE fecha_clase = CURRENT_DATE
  LIMIT 5;
"
```

## Troubleshooting

### Problema: "Operation not permitted" al conectar

```bash
# Verificar estado
brew services list

# Si postgresql@16 no dice "started", reiniciar:
brew services restart postgresql@16

# Esperar 3 segundos
sleep 3

# Intentar conexión nuevamente
psql -U leonardocruz -d control_acceso -c "SELECT 1"
```

### Problema: "database does not exist"

```bash
# Listar bases de datos disponibles
psql -U leonardocruz -l

# Si no existe, usar el nombre correcto
# Probables nombres: control_acceso, control_acceso_upqroo, acceso_system
```

### Problema: "role does not exist"

```bash
# Listar usuarios disponibles
psql -U leonardocruz -c "\du"

# Crear usuario si es necesario
# psql -U postgres -c "CREATE USER leonardocruz WITH PASSWORD 'password';"
```

### Problema: Script no encuentra módulos

```bash
# Instalar dependencias si es necesario
npm install

# Intentar migración nuevamente
node temp/migrar_v3_hibrido.js
```

## Próximos Pasos Después de Éxito

1. **Probar en desarrollo:**
```bash
npm run vercel:dev
# Escanear entrada/salida de un estudiante
# Verificar que las asistencias se registran correctamente
```

2. **Commit de cambios:**
```bash
git add .
git commit -m "Aplicar migración v3 - sistema híbrido completado"
```

3. **Push a repositorio:**
```bash
git push origin main
```

## Documentación de Referencia

- **Completa:** `docs/README_MIGRACION_V3.md`
- **Versiones:** `docs/RESOLVER_VERSION_POSTGRESQL.md`
- **Aplicar:** `docs/APLICAR_MIGRACION_V3.md`
- **Características:** `docs/feats.md`

## Contacto para Problemas

Si algo falla, revisa:
1. Logs del terminal
2. Estado de PostgreSQL: `brew services list`
3. Archivo de log de PostgreSQL
4. Intenta el rollback si es necesario (ver README_MIGRACION_V3.md)

