<script lang="ts">
  import type { ScannerResultPayload } from "@control-acceso/shared";
  import StatusBadge from "./StatusBadge.svelte";

  type Row = Record<string, unknown>;

  let {
    result,
    scannerId = "",
    connected = false
  }: {
    result: (ScannerResultPayload & Row) | null;
    scannerId?: string;
    connected?: boolean;
  } = $props();

  const displayName = $derived(String(result?.fullName ?? result?.visitorName ?? ""));
  const initial = $derived((displayName || "?").slice(0, 1).toUpperCase());
</script>

<section class="scanner-display-page">
  <div class="scanner-display-status">
    <span class={connected ? "dot ok-dot" : "dot bad-dot"}></span>
    {connected ? "Escuchando escaneos" : "Reconectando"}
    {#if scannerId}<span>Estacion: {scannerId}</span>{/if}
  </div>

  <section class="panel result-card scanner-display-card" class:accepted={result?.accepted === true} class:rejected={result?.accepted === false}>
    <h2>Resultado de acceso</h2>
    {#if result}
      {#if result.profilePhotoUrl}
        <img class="avatar photo-avatar display-avatar" src={String(result.profilePhotoUrl)} alt={`Foto de ${displayName || "persona"}`} />
      {:else}
        <div class="avatar display-avatar">{initial}</div>
      {/if}
      <strong>{displayName || "Sin nombre"}</strong>
      <p>{result.matricula ?? ""} {result.vehiclePlate ? `- ${result.vehiclePlate}` : ""}</p>
      <div class="result-meta">
        <StatusBadge value={result.accepted ? "accepted" : "rejected"} />
        {#if result.action}<StatusBadge value={result.action} />{/if}
        {#if result.credentialType}<StatusBadge value={result.credentialType} />{/if}
        {#if result.accessMode}<StatusBadge value={result.accessMode} />{/if}
      </div>
      <dl class="detail-list scanner-result-details">
        <div><dt>Tipo</dt><dd>{result.personType ?? "-"}</dd></div>
        <div><dt>Carrera</dt><dd>{result.career ?? "-"}</dd></div>
        <div><dt>Vehiculo</dt><dd>{result.vehiclePlate ?? "-"}</dd></div>
        <div><dt>Estado</dt><dd>{result.reasonCode ?? (result.accepted ? "ACEPTADO" : "RECHAZADO")}</dd></div>
        <div><dt>Fecha</dt><dd>{result.timestamp ? new Date(String(result.timestamp)).toLocaleString("es-MX") : "-"}</dd></div>
      </dl>
    {:else}
      <div class="result-skeleton" aria-live="polite">
        <span class="skeleton-avatar"></span>
        <span class="skeleton-line"></span>
        <span class="skeleton-line short"></span>
      </div>
      <p class="muted">Esperando el siguiente escaneo...</p>
    {/if}
  </section>
</section>
