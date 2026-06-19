import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { recordAudit } from "../../shared/audit";
import { toOperationalDateRange } from "../../shared/date-range";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import {
  createSchedule,
  createSubject,
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

subjectsRoutes.get("/", async (c) => {
  const rows = await listSubjects();
  return c.json({ data: { rows } });
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
  const rows = await listSchedules();
  return c.json({ data: { rows } });
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
