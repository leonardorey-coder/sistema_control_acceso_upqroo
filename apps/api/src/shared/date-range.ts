import { z } from "zod";
import { env } from "../config/env";

export const dateQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

function getZonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second)
  };
}

function operationalDateFor(date: Date, timeZone = env.OPERATING_TIMEZONE) {
  const parts = getZonedParts(date, timeZone);
  return `${parts.year.toString().padStart(4, "0")}-${parts.month.toString().padStart(2, "0")}-${parts.day.toString().padStart(2, "0")}`;
}

function zonedDateTimeToUtc(dateValue: string, timeValue: string, timeZone = env.OPERATING_TIMEZONE) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour = "0", minute = "0", secondWithMs = "0"] = timeValue.split(":");
  const [second, millisecond = "0"] = secondWithMs.split(".");
  const utcGuess = new Date(Date.UTC(
    year!,
    month! - 1,
    day!,
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, "0"))
  ));
  const zoned = getZonedParts(utcGuess, timeZone);
  const zonedAsUtc = Date.UTC(zoned.year, zoned.month - 1, zoned.day, zoned.hour, zoned.minute, zoned.second);
  const expectedAsUtc = Date.UTC(year!, month! - 1, day!, Number(hour), Number(minute), Number(second));
  const offsetMs = zonedAsUtc - expectedAsUtc;

  return new Date(utcGuess.getTime() - offsetMs);
}

export function currentOperationalDate() {
  return operationalDateFor(new Date());
}

export function toOperationalDateRange(dateValue?: string) {
  const date = dateValue ?? currentOperationalDate();
  return {
    date,
    from: zonedDateTimeToUtc(date, "00:00:00.000"),
    to: zonedDateTimeToUtc(date, "23:59:59.999")
  };
}
