import { describe, expect, it } from "bun:test";
import { seedPersonTypes } from "../src/db/seeds/person-types.seed";

describe("person type seed defaults", () => {
  it("preserves legacy institutional person types as catalog rows", () => {
    expect(seedPersonTypes.map((type) => type.code)).toEqual([
      "estudiante",
      "aspirante",
      "docente",
      "administrativo",
      "invitado",
      "otro"
    ]);
  });

  it("generates student attendance by default only for estudiantes", () => {
    const attendanceTypes = seedPersonTypes
      .filter((type) => type.generatesAttendance)
      .map((type) => type.code);

    expect(attendanceTypes).toEqual(["estudiante"]);
  });

  it("keeps vehicle permits enabled for stable institutional people", () => {
    const vehicleEnabled = seedPersonTypes
      .filter((type) => type.canHaveVehiclePermit)
      .map((type) => type.code);

    expect(vehicleEnabled).toEqual([
      "estudiante",
      "aspirante",
      "docente",
      "administrativo"
    ]);
  });
});
