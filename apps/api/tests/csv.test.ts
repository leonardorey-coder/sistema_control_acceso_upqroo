import { describe, expect, it } from "bun:test";
import { parseCsv, requireCsvHeaders } from "../src/shared/csv";

describe("csv parser", () => {
  it("parses headers, rows, and quoted commas", () => {
    const result = parseCsv("matricula,nombres,notas\nA1,Ana,\"uno, dos\"\nB2,Beto,\n");

    expect(result.headers).toEqual(["matricula", "nombres", "notas"]);
    expect(result.rows).toEqual([
      { rowNumber: 2, values: { matricula: "A1", nombres: "Ana", notas: "uno, dos" } },
      { rowNumber: 3, values: { matricula: "B2", nombres: "Beto", notas: "" } }
    ]);
  });

  it("rejects missing required headers", () => {
    const result = parseCsv("matricula,nombres\nA1,Ana\n");

    expect(() => requireCsvHeaders(result.headers, ["matricula", "subjectClave"])).toThrow("subjectClave");
  });
});
