<script lang="ts">
  import type { OperationalConfigPayload, SignedQrConfigPayload } from "@control-acceso/shared";

  let {
    config = $bindable(),
    signedQrConfig = $bindable(),
    onSave,
    onSaveSignedQr
  }: {
    config: OperationalConfigPayload;
    signedQrConfig: SignedQrConfigPayload;
    onSave: () => void;
    onSaveSignedQr: () => void;
  } = $props();
</script>

<section class="grid two">
  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onSave(); }}>
    <h2>Configuracion del Sistema</h2>
    <label class="switch-row">
      <span>Auto-escaneo QR</span>
      <input bind:checked={config.retryEnabled} type="checkbox" />
    </label>
    <label class="form-field">
      <span>Delay entre escaneos</span>
      <input bind:value={config.retryDelayMs} type="number" min="250" step="50" />
    </label>
    <label class="switch-row">
      <span>Camara QR</span>
      <input bind:checked={config.cameraEnabled} type="checkbox" />
    </label>
    <label class="switch-row">
      <span>Entrada manual</span>
      <input bind:checked={config.manualEntryEnabled} type="checkbox" />
    </label>
    <label class="switch-row">
      <span>Sonidos</span>
      <input bind:checked={config.soundsEnabled} type="checkbox" />
    </label>
    <label class="switch-row">
      <span>Salidas automaticas</span>
      <input bind:checked={config.autoExitEnabled} type="checkbox" />
    </label>
    <button>Aplicar</button>
  </form>

  <form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onSaveSignedQr(); }}>
    <h2>QR firmado dinamico</h2>
    <label class="switch-row">
      <span>Activar QR firmado</span>
      <input bind:checked={signedQrConfig.enabled} type="checkbox" />
    </label>
    <label class="form-field">
      <span>Vigencia del token</span>
      <input bind:value={signedQrConfig.ttlSeconds} type="number" min="15" max="30" step="1" />
    </label>
    <label class="form-field">
      <span>Tolerancia de reloj</span>
      <input bind:value={signedQrConfig.clockToleranceSeconds} type="number" min="0" max="30" step="1" />
    </label>
    <label class="switch-row">
      <span>Compatibilidad QR opaco</span>
      <input bind:checked={signedQrConfig.compatibilityOpaqueTokens} type="checkbox" />
    </label>
    <label class="switch-row">
      <span>Vinculacion de dispositivo</span>
      <input bind:checked={signedQrConfig.requireDeviceBinding} type="checkbox" />
    </label>
    <button>Guardar QR firmado</button>
  </form>
</section>
