-- Migración para agregar tipo de persona 'aspirante'
-- Ejecutar este script en la base de datos PostgreSQL

-- Agregar tipo 'aspirante' al CHECK constraint de personas
ALTER TABLE personas 
DROP CONSTRAINT IF EXISTS personas_tipo_persona_check;

ALTER TABLE personas 
ADD CONSTRAINT personas_tipo_persona_check 
CHECK (tipo_persona IN ('estudiante', 'docente', 'administrativo', 'invitado', 'aspirante', 'otro'));
