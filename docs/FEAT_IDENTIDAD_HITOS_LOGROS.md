# Feature: hitos y logros

## Objetivo

Registrar logros que representen progreso o participacion significativa dentro
del campus.

Los logros pueden desbloquear insignias, marcos o colores, pero no deben
convertir el acceso diario en una mecanica trivial.

## Tipos de hitos

### Automaticos simples

Permitidos para primera version:

- Primer acceso.
- 100 accesos.
- Primer evento registrado.
- Primer badge recibido.

### Institucionales

Recomendados para valor alto:

- Ganador de hackathon.
- Ponente.
- Organizador.
- Voluntario.
- Tutor.
- Embajador.
- Integrante de club.
- Equipo deportivo.

Estos deben venir de eventos, clubes o asignacion administrativa auditada.

## Modelo recomendado

Usar `reward_definitions` con:

```txt
type = achievement
requirements = jsonb
```

Y `person_rewards` como instancia desbloqueada.

Ejemplo:

```json
{
  "source": "access_count",
  "threshold": 100
}
```

## Motor de logros

Primera version:

- Worker o job manual revisa logros automaticos basicos.
- Admin/eventos otorgan logros importantes.

No implementar un motor complejo de reglas hasta tener datos reales.

## Reglas anti-trivialidad

- No basar todo en entrar muchas veces.
- No publicar rankings de acceso.
- No premiar conductas que saturen scanner.
- No generar incentivos para escaneos falsos.

## API

```txt
GET  /api/v1/portal/rewards?type=achievement
POST /api/v1/rewards/evaluate-achievements
POST /api/v1/rewards/:id/grant
```

El endpoint de evaluacion puede ser admin-only o worker-only al inicio.

## Auditoria

Auditar:

- Logro automatico otorgado.
- Logro manual otorgado.
- Revocacion.
- Recalculo administrativo.

## Criterios de aceptacion

- Los logros automaticos no se duplican.
- Un logro manual requiere actor y motivo.
- Los logros visibles respetan privacidad.
- El sistema puede explicar la fuente del logro.
- Revocar un logro actualiza perfil y scanner.
