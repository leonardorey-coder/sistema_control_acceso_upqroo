import { Hono } from "hono";
import { z } from "zod";
import { getActorMetadata } from "../../http/middleware/session";
import { HttpError } from "../../shared/http-error";
import { findPersonType } from "../person-types/person-types.repository";
import { createPerson, findPersonById, findPersonByMatricula, listPeople, updatePerson } from "./people.repository";
import { recordAudit } from "../../shared/audit";
import { withoutUndefined } from "../../shared/object";
import { paginated, parsePagination } from "../../shared/pagination";
import { storeFile } from "../../shared/storage";

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
const allowedPhotoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxPhotoBytes = 5 * 1024 * 1024;

export const peopleRoutes = new Hono();

async function validatePersonTypeRules(input: Partial<z.infer<typeof personUpsertSchema>>) {
  if (!input.tipoPersona) {
    return;
  }

  const type = await findPersonType(input.tipoPersona);

  if (!type || !type.active) {
    throw new HttpError(400, "PERSON_TYPE_NOT_FOUND_OR_INACTIVE", "The selected person type is not available.");
  }

  if (type.requiresCareer && !input.carreraId) {
    throw new HttpError(400, "CAREER_REQUIRED_FOR_PERSON_TYPE", "This person type requires a career.");
  }
}

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
  if (input.curp) {
    input.curp = input.curp.toUpperCase();
  }
  await validatePersonTypeRules(input);
  const row = await createPerson(input);
  await recordAudit({
    ...getActorMetadata(c),
    action: "person.created",
    entityType: "person",
    entityId: row.id,
    metadata: { matricula: row.matricula, tipoPersona: row.tipoPersona }
  });

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

peopleRoutes.get("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const person = await findPersonById(id);

  if (!person) {
    return c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
  }

  return c.json({ data: person });
});

peopleRoutes.patch("/:id", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const input = withoutUndefined(personPatchSchema.parse(await c.req.json()));
  if (input.curp) {
    input.curp = input.curp.toUpperCase();
  }
  const current = await findPersonById(id);

  if (!current) {
    return c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
  }

  await validatePersonTypeRules({
    tipoPersona: input.tipoPersona ?? current.tipoPersona,
    carreraId: input.carreraId ?? current.carreraId ?? undefined
  });
  const row = await updatePerson(id, input);
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "person.updated",
      entityType: "person",
      entityId: id,
      metadata: { changed: Object.keys(input) }
    });
  }

  if (!row) {
    return c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
  }

  return c.json({ data: row });
});

peopleRoutes.post("/:id/disable", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updatePerson(id, { estado: "inactivo" });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "person.disabled",
      entityType: "person",
      entityId: id
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
});

peopleRoutes.post("/:id/enable", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const row = await updatePerson(id, { estado: "activo" });
  if (row) {
    await recordAudit({
      ...getActorMetadata(c),
      action: "person.enabled",
      entityType: "person",
      entityId: id
    });
  }
  return row ? c.json({ data: row }) : c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
});

peopleRoutes.post("/:id/photo", async (c) => {
  const id = z.string().uuid().parse(c.req.param("id"));
  const current = await findPersonById(id);

  if (!current) {
    return c.json({ error: { code: "PERSON_NOT_FOUND" } }, 404);
  }

  const body = await c.req.parseBody();
  const file = body.file;

  if (!(file instanceof File)) {
    return c.json({ error: { code: "PHOTO_FILE_REQUIRED" } }, 400);
  }

  if (!allowedPhotoTypes.has(file.type)) {
    throw new HttpError(400, "PHOTO_TYPE_NOT_ALLOWED", "Only PNG, JPEG and WebP profile photos are allowed.");
  }

  if (file.size > maxPhotoBytes) {
    throw new HttpError(400, "PHOTO_TOO_LARGE", "Profile photos must be 5 MB or smaller.");
  }

  const stored = await storeFile({
    bytes: new Uint8Array(await file.arrayBuffer()),
    mimeType: file.type || "application/octet-stream",
    originalName: file.name,
    visibility: "private"
  });
  const row = await updatePerson(id, { profileFileId: stored.id });

  await recordAudit({
    ...getActorMetadata(c),
    action: "person.photo_updated",
    entityType: "person",
    entityId: id,
    metadata: { storedFileId: stored.id }
  });

  return c.json({ data: { person: row, file: stored } });
});
