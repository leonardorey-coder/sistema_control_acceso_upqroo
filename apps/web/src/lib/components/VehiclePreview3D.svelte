<script lang="ts">
  import { browser } from "$app/environment";
  import { onMount } from "svelte";
  import StatusBadge from "./StatusBadge.svelte";
  import VehiclePreviewFallback from "./VehiclePreviewFallback.svelte";
  import { normalizeVehicleColor, resolveVehicleModelSrc, vehicleDescription, vehicleTypeLabel } from "$lib/vehicles/vehicle-visuals";

  let {
    vehicleType,
    plate = "",
    color = "",
    make = "",
    model = "",
    status = "",
    approvalStatus = "",
    size = "compact",
    interactive = false
  }: {
    vehicleType: string;
    plate?: string | null;
    color?: string | null;
    make?: string | null;
    model?: string | null;
    status?: string | null;
    approvalStatus?: string | null;
    size?: "compact" | "card" | "scanner";
    interactive?: boolean;
  } = $props();

  let ready = $state(false);
  let failed = $state(false);
  let reduceMotion = $state(false);

  const modelSrc = $derived(resolveVehicleModelSrc(vehicleType));
  const colorInfo = $derived(normalizeVehicleColor(color));
  const typeLabel = $derived(vehicleTypeLabel(vehicleType));
  const description = $derived(vehicleDescription({ vehicleType, plate, color, make, model }));
  const canInteract = $derived(interactive && size !== "compact");
  const shouldRotate = $derived(canInteract && !reduceMotion);
  const makeModel = $derived([make, model].filter(Boolean).join(" "));

  onMount(() => {
    reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    if (!browser) return;
    import("@google/model-viewer")
      .then(() => {
        ready = true;
      })
      .catch((error) => {
        failed = true;
        console.warn("No se pudo cargar model-viewer", error);
      });
  });
</script>

<section class={`vehicle-preview ${size}`} aria-label={description}>
  <div class="vehicle-preview-stage">
    {#if ready && !failed}
      <model-viewer
        src={modelSrc}
        camera-controls={canInteract}
        auto-rotate={shouldRotate}
        interaction-prompt="none"
        loading="lazy"
        shadow-intensity="0.45"
        ar={false}
        onerror={() => (failed = true)}
        aria-label={description}
      ></model-viewer>
    {:else}
      <VehiclePreviewFallback {vehicleType} {plate} {color} {make} {model} {size} />
    {/if}
    <div class="vehicle-plate-overlay">{plate || "Sin placa"}</div>
  </div>

  <div class="vehicle-preview-details">
    <div>
      <strong>{typeLabel}</strong>
      <span>{makeModel || "Marca/modelo no capturado"}</span>
    </div>
    <div class="vehicle-preview-badges">
      {#if status}<StatusBadge value={status} />{/if}
      {#if approvalStatus}<StatusBadge value={approvalStatus} />{/if}
    </div>
    <span class="vehicle-color-line">
      <i style={colorInfo.cssColor ? `--vehicle-color: ${colorInfo.cssColor}` : ""}></i>
      {colorInfo.label}
    </span>
  </div>
</section>
