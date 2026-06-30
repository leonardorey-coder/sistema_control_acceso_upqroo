import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { readCsvFile, requireCsvHeaders } from "../../shared/csv";
import { toOperationalDateRange } from "../../shared/date-range";
import { HttpError } from "../../shared/http-error";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { broadcastEvent } from "../events/events";
import { findPersonByMatricula } from "../people/people.repository";
import {
  adjustAttendance,
  createSchedule,
  createSubject,
  findMatchingSchedule,
  findSubjectByClave,
  listAttendanceByPerson,
  listAttendanceToday,
  listSchedules,
  listSubjects,
  updateSchedule,
  updateSubject
} from "./attendance.repository";

const attendanceQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  subject: z.string().trim().min(1).optional(),
  status: z.enum(["in_progress", "confirmed", "partial", "unverified", "assumed"]).optional(),
  careerId: z.string().uuid().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const subjectSchema = z.object({
  clave: z.string().trim().min(1).max(60),
  nombre: z.string().trim().min(1).max(180),
  active: z.boolean().default(true)
});

const booleanQuerySchema = z.enum(["true", "false"]).transform((value) => value === "true");

const subjectQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  active: booleanQuerySchema.optional()
});

const scheduleSchema = z.object({
  personId: z.string().uuid(),
  subjectId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
  horaInicio: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  horaFin: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  aula: z.string().trim().max(80).optional(),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  active: z.boolean().default(true)
});

const scheduleQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  personId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  active: booleanQuerySchema.optional()
});

const attendanceAdjustSchema = z.object({
  estado: z.enum(["confirmed", "partial", "unverified", "assumed"]),
  minutosAsistidos: z.number().int().min(0).optional(),
  porcentaje: z.number().int().min(0).max(100).optional(),
  reason: z.string().trim().max(500).optional()
});

const scheduleImportRowSchema = z.object({
  matricula: z.string().trim().min(1),
  subjectClave: z.string().trim().min(1).max(60),
  subjectName: z.string().trim().min(1).max(180),
  weekday: z.string().trim().min(1),
  horaInicio: z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  horaFin: z.string().trim().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  aula: z.string().trim().max(80).optional(),
  validFrom: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/),
  validUntil: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const scheduleImportHeaders = [
  "matricula",
  "subjectClave",
  "subjectName",
  "weekday",
  "horaInicio",
  "horaFin",
  "aula",
  "validFrom",
  "validUntil"
];

type ImportError = {
  row: number;
  code: string;
  message: string;
};

type ImportSummary = {
  created: number;
  updated: number;
  issuedQr: number;
  skipped: number;
  errors: ImportError[];
};

function cleanOptional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseWeekday(value: string) {
  const normalized = value.trim().toLowerCase();
  const aliases: Record<string, number> = {
    domingo: 0,
    lunes: 1,
    martes: 2,
    miercoles: 3,
    "miércoles": 3,
    jueves: 4,
    viernes: 5,
    sabado: 6,
    "sábado": 6
  };
  const weekday = aliases[normalized] ?? Number(normalized);

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw new HttpError(400, "INVALID_WEEKDAY", "Weekday must be a number from 0 to 6 or a weekday name.");
  }

  return weekday;
}

function importError(row: number, error: unknown): ImportError {
  if (error instanceof HttpError) {
    return { row, code: error.code, message: error.message };
  }

  if (error instanceof z.ZodError) {
    return {
      row,
      code: "CSV_ROW_INVALID",
      message: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")
    };
  }

  return {
    row,
    code: "CSV_ROW_FAILED",
    message: error instanceof Error ? error.message : "Row could not be imported."
  };
}

export const attendanceRoutes = new Hono();
export const subjectsRoutes = new Hono();
export const schedulesRoutes = new Hono();

attendanceRoutes.get("/today", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(attendanceQuerySchema.parse(c.req.query()));
  const range = toOperationalDateRange(query.date);
  const result = await listAttendanceToday({ ...query, date: range.date }, pagination);

  return c.json({
    data: paginated(result.rows, result.total, pagination, {
      date: range.date,
      filtered: Boolean(query.q || query.subject || query.status || query.careerId)
    })
  });
});

attendanceRoutes.get("/person/:personId", async (c) => {
  const personId = z.string().uuid().parse(c.req.param("personId"));
  const rows = await listAttendanceByPerson(personId);
  return c.json({ data: rows });
});

attendanceRoutes.patch("/:id/adjust", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const input = attendanceAdjustSchema.parse(await c.req.json());
  const row = await adjustAttendance(id, withoutUndefined({
    estado: input.estado,
    minutosAsistidos: input.minutosAsistidos,
    porcentaje: input.porcentaje
  }));

  if (!row) {
    return c.json({ error: { code: "ATTENDANCE_NOT_FOUND" } }, 404);
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "attendance.adjusted",
    entityType: "attendance",
    entityId: id,
    metadata: {
      estado: input.estado,
      minutosAsistidos: input.minutosAsistidos,
      porcentaje: input.porcentaje,
      reason: input.reason
    }
  });
  broadcastEvent("attendance.table", { action: "adjusted", id, estado: input.estado });

  return c.json({ data: row });
});

subjectsRoutes.get("/", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(subjectQuerySchema.parse(c.req.query()));
  const result = await listSubjects(query, pagination);

  return c.json({
    data: paginated(result.rows, result.total, pagination, {
      filtered: Boolean(query.q || typeof query.active === "boolean")
    })
  });
});

subjectsRoutes.post("/", async (c) => {
  const row = await createSubject(subjectSchema.parse(await c.req.json()));
  await recordAudit({
    ...getActorMetadata(c),
    action: "subject.created",
    entityType: "subject",
    entityId: row.id,
    metadata: { clave: row.clave }
  });
  return c.json({ data: row }, 201);
});

subjectsRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateSubject(id, withoutUndefined(subjectSchema.partial().parse(await c.req.json())));
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "subject.updated",
      entityType: "subject",
      entityId: id
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "SUBJECT_NOT_FOUND" } }, 404);
});

schedulesRoutes.get("/", async (c) => {
  const pagination = parsePagination(c.req.query());
  const query = withoutUndefined(scheduleQuerySchema.parse(c.req.query()));
  const result = await listSchedules(query, pagination);

  return c.json({
    data: paginated(result.rows, result.total, pagination, {
      filtered: Boolean(query.q || query.personId || query.subjectId || typeof query.weekday === "number" || typeof query.active === "boolean")
    })
  });
});

schedulesRoutes.post("/", async (c) => {
  const row = await createSchedule(scheduleSchema.parse(await c.req.json()));
  await recordAudit({
    ...getActorMetadata(c),
    action: "schedule.created",
    entityType: "schedule",
    entityId: row.id,
    metadata: { personId: row.personId, subjectId: row.subjectId }
  });
  return c.json({ data: row }, 201);
});

schedulesRoutes.post("/import", async (c) => {
  const csv = await readCsvFile(await c.req.parseBody());
  requireCsvHeaders(csv.headers, scheduleImportHeaders);
  const summary: ImportSummary = { created: 0, updated: 0, issuedQr: 0, skipped: 0, errors: [] };

  for (const row of csv.rows) {
    try {
      const parsed = scheduleImportRowSchema.parse({
        matricula: row.values.matricula,
        subjectClave: row.values.subjectClave,
        subjectName: row.values.subjectName,
        weekday: row.values.weekday,
        horaInicio: row.values.horaInicio,
        horaFin: row.values.horaFin,
        aula: cleanOptional(row.values.aula),
        validFrom: row.values.validFrom,
        validUntil: cleanOptional(row.values.validUntil)
      });
      const person = await findPersonByMatricula(parsed.matricula);

      if (!person) {
        throw new HttpError(400, "PERSON_NOT_FOUND", `Person with matricula ${parsed.matricula} was not found.`);
      }

      let subject = await findSubjectByClave(parsed.subjectClave);

      if (!subject) {
        subject = await createSubject({
          clave: parsed.subjectClave,
          nombre: parsed.subjectName,
          active: true
        });
      }

      const scheduleInput = withoutUndefined({
        personId: person.id,
        subjectId: subject.id,
        weekday: parseWeekday(parsed.weekday),
        horaInicio: parsed.horaInicio,
        horaFin: parsed.horaFin,
        aula: parsed.aula,
        validFrom: parsed.validFrom,
        validUntil: parsed.validUntil,
        active: true
      });
      const existing = await findMatchingSchedule(scheduleInput);

      if (existing) {
        await updateSchedule(existing.id, scheduleInput);
        summary.updated += 1;
      } else {
        await createSchedule(scheduleInput);
        summary.created += 1;
      }
    } catch (error) {
      summary.skipped += 1;
      summary.errors.push(importError(row.rowNumber, error));
    }
  }

  await recordAudit({
    ...getActorMetadata(c),
    action: "schedule.imported",
    entityType: "schedule",
    metadata: {
      created: summary.created,
      updated: summary.updated,
      skipped: summary.skipped
    }
  });
  broadcastEvent("attendance.table", { action: "schedules_imported", created: summary.created, updated: summary.updated });

  return c.json({ data: summary }, 201);
});

schedulesRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updateSchedule(id, withoutUndefined(scheduleSchema.partial().parse(await c.req.json())));
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "schedule.updated",
      entityType: "schedule",
      entityId: id
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "SCHEDULE_NOT_FOUND" } }, 404);
});
