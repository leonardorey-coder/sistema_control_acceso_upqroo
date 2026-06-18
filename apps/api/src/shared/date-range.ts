import { z } from "zod";

export const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

export function toOperationalDateRange(dateValue?: string) {
  const date = dateValue ?? new Date().toISOString().slice(0, 10);
  return {
    date,
    from: new Date(`${date}T00:00:00.000Z`),
    to: new Date(`${date}T23:59:59.999Z`)
  };
}
