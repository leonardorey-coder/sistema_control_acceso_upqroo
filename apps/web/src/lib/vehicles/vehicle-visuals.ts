import type { VehicleType } from "@control-acceso/shared";
import { vehicleTypeLabels } from "$lib/ui/labels";

const modelFallbackSrc = "/models/vehicles/other.glb";

export const vehicleModelByType = {
  car: "/models/vehicles/car.glb",
  motorcycle: "/models/vehicles/motorcycle.glb",
  bicycle: "/models/vehicles/bicycle.glb",
  electric_scooter: "/models/vehicles/electric-scooter.glb",
  truck: "/models/vehicles/truck.glb",
  official: "/models/vehicles/official.glb",
  university_transport: "/models/vehicles/university-transport.glb",
  visitor: "/models/vehicles/visitor.glb",
  other: modelFallbackSrc
} satisfies Record<VehicleType, string>;

const colorAliases: Record<string, string> = {
  amarillo: "#f4c430",
  amarilla: "#f4c430",
  azul: "#2563eb",
  beige: "#d6c3a5",
  blanco: "#ffffff",
  blanca: "#ffffff",
  cafe: "#795548",
  "café": "#795548",
  dorado: "#c9a227",
  dorada: "#c9a227",
  gris: "#737373",
  naranja: "#f97316",
  negro: "#171717",
  negra: "#171717",
  plata: "#c0c0c0",
  plateado: "#c0c0c0",
  plateada: "#c0c0c0",
  rojo: "#dc2626",
  roja: "#dc2626",
  rosa: "#ec4899",
  verde: "#16a34a",
  vino: "#7f1d1d",
  white: "#ffffff",
  black: "#171717",
  gray: "#737373",
  grey: "#737373",
  silver: "#c0c0c0",
  red: "#dc2626",
  blue: "#2563eb",
  green: "#16a34a",
  yellow: "#f4c430",
  orange: "#f97316",
  brown: "#795548",
  gold: "#c9a227"
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function isVehicleType(value: string): value is VehicleType {
  return Object.hasOwn(vehicleModelByType, value);
}

export function resolveVehicleModelSrc(vehicleType: unknown) {
  const key = normalizeText(vehicleType).toLowerCase().replace(/-/g, "_");
  return isVehicleType(key) ? vehicleModelByType[key] : modelFallbackSrc;
}

export function vehicleTypeLabel(vehicleType: unknown) {
  const key = normalizeText(vehicleType).toLowerCase().replace(/-/g, "_");
  return key ? (vehicleTypeLabels[key] ?? key.replace(/_/g, " ")) : vehicleTypeLabels.other;
}

export function normalizeVehicleColor(color: unknown): { label: string; cssColor: string | null } {
  const label = normalizeText(color);
  if (!label) return { label: "Sin color", cssColor: null };

  const key = label.toLowerCase();
  if (colorAliases[key]) return { label, cssColor: colorAliases[key] };

  const hex = key.match(/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) return { label, cssColor: label };

  return { label, cssColor: null };
}

export function vehicleDescription(input: {
  vehicleType?: unknown;
  plate?: unknown;
  color?: unknown;
  make?: unknown;
  model?: unknown;
}) {
  const plate = normalizeText(input.plate) || "Sin placa";
  const type = vehicleTypeLabel(input.vehicleType);
  const color = normalizeVehicleColor(input.color).label;
  const makeModel = [normalizeText(input.make), normalizeText(input.model)].filter(Boolean).join(" ");
  return [plate, type, color, makeModel].filter(Boolean).join(" - ");
}
