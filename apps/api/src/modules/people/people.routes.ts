import { Hono } from "hono";
import { z } from "zod";
import { findPersonByMatricula, createPerson, listPeople, updatePerson } from "./people.repository";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";

const peopleQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  personType: z.string().trim().min(1).optional(),
  status: z.enum(["activo", "inactivo", "suspendido", "egresado", "baja"]).optional(),
  careerId: z.string().uuid().optional()
});

const personUpsertSchema = z.object({
  matricula: z.string().trim().min(1).max(50),
  nombres: z.string().trim().min(1).max(120),
  apellidos: z.string().trim().max(120).default(""),
  curp: z.string().trim().length(18).optional(),
  tipoPersona: z.string().trim().min(1).max(40).default("estudiante"),
  estado: z.enum(["activo", "inactivo", "suspendido", "egresado", "baja"]).default("activo"),
  carreraId: z.string().uuid().optional(),
  notas: z.string().trim().optional(),
  profileFileId: z.string().uuid().optional()
});

const personPatchSchema = personUpsertSchema.partial();

export const peopleRoutes = new Hono();

peopleRoutes.get("/", async (c) => {
  const pagination = parsePagination(c.req.query());
  const filters = withoutUndefined(peopleQuerySchema.parse(c.req.query()));
  const result = await listPeople(filters, pagination);

  return c.json({
    data: paginated(result.rows, result.total, pagination, {
      filtered: Boolean(filters.q || filters.personType || filters.status || filters.careerId)
    })
  });
});

peopleRoutes.post("/", async (c) => {
  const input = personUpsertSchema.parse(await c.req.json());
  const row = await createPerson(input);

  return c.json({ data: row }, 201);
});

peopleRoutes.get("/by-matricula/:matricula", async (c) => {
  const matricula = c.req.param("matricula");
  const person = await findPersonByMatricula(matricula);

  if (!person) {
    return c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
  }

  return c.json({ data: person });
});

peopleRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const input = withoutUndefined(personPatchSchema.parse(await c.req.json()));
  const row = await updatePerson(id, input);

  if (!row) {
    return c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
  }

  return c.json({ data: row });
});
