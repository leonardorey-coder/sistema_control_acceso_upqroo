import { describe, expect, test } from "bun:test";
import { normalizeVehicleColor, resolveVehicleModelSrc, vehicleDescription, vehicleTypeLabel } from "./vehicle-visuals";

describe("vehicle visuals", () => {
  test("resolves known and unknown vehicle model sources safely", () => {
    expect(resolveVehicleModelSrc("car")).toBe("/models/vehicles/car.glb");
    expect(resolveVehicleModelSrc("electric-scooter")).toBe("/models/vehicles/electric-scooter.glb");
    expect(resolveVehicleModelSrc("electric_scooter")).toBe("/models/vehicles/electric-scooter.glb");
    expect(resolveVehicleModelSrc("truck")).toBe("/models/vehicles/truck.glb");
    expect(resolveVehicleModelSrc("motorcycle")).toBe("/models/vehicles/motorcycle.glb");
    expect(resolveVehicleModelSrc("unexpected")).toBe("/models/vehicles/other.glb");
    expect(resolveVehicleModelSrc(null)).toBe("/models/vehicles/other.glb");
  });

  test("labels vehicle types without throwing on unknown values", () => {
    expect(vehicleTypeLabel("car")).toBe("Automovil");
    expect(vehicleTypeLabel("electric-scooter")).toBe("Scooter electrico");
    expect(vehicleTypeLabel("")).toBe("Otro");
    expect(vehicleTypeLabel("golf_cart")).toBe("golf cart");
  });

  test("normalizes common colors and preserves free text", () => {
    expect(normalizeVehicleColor("Rojo")).toEqual({ label: "Rojo", cssColor: "#dc2626" });
    expect(normalizeVehicleColor("#abc")).toEqual({ label: "#abc", cssColor: "#abc" });
    expect(normalizeVehicleColor("Azul marino")).toEqual({ label: "Azul marino", cssColor: null });
    expect(normalizeVehicleColor(undefined)).toEqual({ label: "Sin color", cssColor: null });
  });

  test("builds stable accessible descriptions", () => {
    expect(vehicleDescription({ vehicleType: "truck", plate: "ABC123", color: "Negro", make: "Nissan", model: "NP300" }))
      .toBe("ABC123 - Camioneta - Negro - Nissan NP300");
    expect(vehicleDescription({})).toBe("Sin placa - Otro - Sin color");
  });
});
