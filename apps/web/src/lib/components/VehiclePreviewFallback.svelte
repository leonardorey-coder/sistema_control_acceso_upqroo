<script lang="ts">
  import { normalizeVehicleColor, vehicleDescription, vehicleTypeLabel } from "$lib/vehicles/vehicle-visuals";

  let {
    vehicleType,
    plate = "",
    color = "",
    make = "",
    model = "",
    size = "compact"
  }: {
    vehicleType: string;
    plate?: string | null;
    color?: string | null;
    make?: string | null;
    model?: string | null;
    size?: "compact" | "card" | "scanner";
  } = $props();

  const colorInfo = $derived(normalizeVehicleColor(color));
  const description = $derived(vehicleDescription({ vehicleType, plate, color, make, model }));
  const typeLabel = $derived(vehicleTypeLabel(vehicleType));
</script>

<div class={`vehicle-preview-fallback ${size}`} aria-label={description} role="img">
  <div class="vehicle-shape" aria-hidden="true">
    <span class="vehicle-roof"></span>
    <span class="vehicle-body"></span>
    <span class="vehicle-wheel left"></span>
    <span class="vehicle-wheel right"></span>
  </div>
  <div class="vehicle-preview-meta">
    <strong>{plate || "Sin placa"}</strong>
    <span>{typeLabel}</span>
    <span class="vehicle-color-line">
      <i style={colorInfo.cssColor ? `--vehicle-color: ${colorInfo.cssColor}` : ""}></i>
      {colorInfo.label}
    </span>
  </div>
</div>
