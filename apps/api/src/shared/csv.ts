import { HttpError } from "./http-error";

export type CsvRow = {
  rowNumber: number;
  values: Record<string, string>;
};

export type CsvParseResult = {
  headers: string[];
  rows: CsvRow[];
};

export function parseCsv(text: string): CsvParseResult {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        index += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field.trim());
      field = "";
    } else if (char === "\n") {
      record.push(field.trim());
      records.push(record);
      record = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (inQuotes) {
    throw new HttpError(400, "CSV_INVALID_QUOTES", "CSV contains an unclosed quoted field.");
  }

  if (field || record.length) {
    record.push(field.trim());
    records.push(record);
  }

  const nonEmptyRecords = records.filter((items) => items.some((value) => value.trim() !== ""));
  const headers = nonEmptyRecords[0]?.map((header) => header.trim()) ?? [];

  if (!headers.length) {
    throw new HttpError(400, "CSV_EMPTY", "CSV file is empty.");
  }

  const rows = nonEmptyRecords.slice(1).map((items, index) => ({
    rowNumber: index + 2,
    values: Object.fromEntries(headers.map((header, headerIndex) => [header, items[headerIndex]?.trim() ?? ""]))
  }));

  return { headers, rows };
}

export function requireCsvHeaders(headers: string[], required: string[]) {
  const present = new Set(headers);
  const missing = required.filter((header) => !present.has(header));

  if (missing.length) {
    throw new HttpError(400, "CSV_MISSING_COLUMNS", `CSV missing required columns: ${missing.join(", ")}.`);
  }
}

export async function readCsvFile(body: Record<string, unknown>) {
  const file = body.file;

  if (!(file instanceof File)) {
    throw new HttpError(400, "CSV_FILE_REQUIRED", "A CSV file is required in the file field.");
  }

  if (file.size > 2 * 1024 * 1024) {
    throw new HttpError(400, "CSV_TOO_LARGE", "CSV file must be 2 MB or smaller.");
  }

  return parseCsv(await file.text());
}
