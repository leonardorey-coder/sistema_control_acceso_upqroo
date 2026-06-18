import { Hono } from "hono";
import { z } from "zod";
import { seedPersonTypes } from "../../db/seeds/person-types.seed";
import { withoutUndefined } from "../../shared/object";
import { createPersonType, listPersonTypes, updatePersonType } from "./person-types.repository";

const personTypeSchema = z.object({
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  label: z.string().trim().min(2).max(80),
  requiresCareer: z.boolean().default(false),
  generatesAttendance: z.boolean().default(false),
  canHaveUserPortal: z.boolean().default(false),
  canHaveVehiclePermit: z.boolean().default(false),
  isTemporary: z.boolean().default(false),
  active: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({})
});

const personTypePatchSchema = personTypeSchema.omit({ code: true }).partial();

export const personTypesRoutes = new Hono();

personTypesRoutes.get("/", async (c) => {
  const rows = await listPersonTypes();
  return c.json({
    data: {
      rows,
      seedDefaults: seedPersonTypes
    }
  });
});

personTypesRoutes.post("/", async (c) => {
  const input = personTypeSchema.parse(await c.req.json());
  const row = await createPersonType(input);
  return c.json({ data: row }, 201);
});

personTypesRoutes.patch("/:code", async (c) => {
  const code = z.string().min(2).max(40).parse(c.req.param("code"));
  const input = withoutUndefined(personTypePatchSchema.parse(await c.req.json()));
  const row = await updatePersonType(code, input);

  if (!row) {
    return c.json({ error: { code: "PERSON_TYPE_NOT_FOUND" } }, 404);
  }

  return c.json({ data: row });
});
