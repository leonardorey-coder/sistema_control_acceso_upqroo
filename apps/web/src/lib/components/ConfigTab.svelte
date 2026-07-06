<script lang="ts">
  import type { OperationalConfigPayload, ScannerDevicesConfigPayload, SignedQrConfigPayload } from "@control-acceso/shared";
  import FormFlow from "./FormFlow.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import Switch from "./Switch.svelte";

  let {
    config = $bindable(),
    signedQrConfig = $bindable(),
    scannerDevicesConfig = $bindable(),
    onSave,
    onSaveSignedQr,
    onSaveScannerDevices
  }: {
    config: OperationalConfigPayload;
    signedQrConfig: SignedQrConfigPayload;
    scannerDevicesConfig: ScannerDevicesConfigPayload;
    onSave: () => void | Promise<void>;
    onSaveSignedQr: () => void | Promise<void>;
    onSaveScannerDevices: () => void | Promise<void>;
  } = $props();

  let activeSection = $state("scan");
  let savePending = $state(false);
  const sectionOptions = [
    { value: "scan", label: "Escaneo" },
    { value: "signed", label: "QR firmado" },
    { value: "scanners", label: "Scanners" }
  ];

  async function saveAll() {
    savePending = true;
    try {
      await onSave();
      await onSaveSignedQr();
      await onSaveScannerDevices();
    } finally {
      savePending = false;
    }
  }
</script>

<FormFlow
  title="Configuracion operativa"
  description="Ajusta escaneo, QR dinamico y autorizacion de scanners desde un solo flujo."
  bind:value={activeSection}
  options={sectionOptions}
>
  <form class="panel form-grid" aria-busy={savePending} onsubmit={(event) => { event.preventDefault(); saveAll(); }}>
    {#if activeSection === "scan"}
      <div class="section-header">
        <h2>Escaneo y operacion</h2>
        <p>Controles usados durante la captura diaria de entradas y salidas.</p>
      </div>
      <Switch bind:checked={config.retryEnabled} label="Auto-escaneo QR" />
      <label class="form-field">
        <span>Delay entre escaneos</span>
        <input name="retryDelayMs" bind:value={config.retryDelayMs} type="number" min="250" step="50" />
      </label>
      <Switch bind:checked={config.cameraEnabled} label="Camara QR" />
      <Switch bind:checked={config.manualEntryEnabled} label="Entrada manual" />
      <Switch bind:checked={config.soundsEnabled} label="Sonidos" />
      <Switch bind:checked={config.autoExitEnabled} label="Salidas automaticas" />
    {:else if activeSection === "signed"}
      <div class="section-header">
        <h2>QR firmado dinamico</h2>
        <p>Define la vigencia del QR dinamico y si el portal exige vinculo local.</p>
      </div>
      <Switch bind:checked={signedQrConfig.enabled} label="Activar QR firmado" />
      <label class="form-field">
        <span>Vigencia del token</span>
        <input name="ttlSeconds" bind:value={signedQrConfig.ttlSeconds} type="number" min="15" max="30" step="1" />
      </label>
      <label class="form-field">
        <span>Tolerancia de reloj</span>
        <input name="clockToleranceSeconds" bind:value={signedQrConfig.clockToleranceSeconds} type="number" min="0" max="30" step="1" />
      </label>
      <Switch bind:checked={signedQrConfig.compatibilityOpaqueTokens} label="Compatibilidad QR opaco" />
      <Switch bind:checked={signedQrConfig.requireDeviceBinding} label="Vinculacion de dispositivo" />
    {:else}
      <div class="section-header">
        <h2>Dispositivos scanner</h2>
        <p>Controla si una sesion admin necesita estar en un dispositivo scanner autorizado.</p>
      </div>
      <Switch bind:checked={scannerDevicesConfig.required} label="Exigir scanner autorizado" />
      <p class="notice">Cuando esta activo, una sesion admin no basta para escanear: el dispositivo debe estar vinculado con un codigo autorizado por superadmin.</p>
    {/if}

    <div class="flow-card">
      <h3>Resumen</h3>
      <dl class="flow-summary">
        <div><dt>Auto-escaneo</dt><dd>{config.retryEnabled ? "Activo" : "Inactivo"}</dd></div>
        <div><dt>QR firmado</dt><dd>{signedQrConfig.enabled ? `${signedQrConfig.ttlSeconds}s` : "Inactivo"}</dd></div>
        <div><dt>Scanner autorizado</dt><dd>{scannerDevicesConfig.required ? "Requerido" : "No requerido"}</dd></div>
      </dl>
    </div>

    <LoadingButton type="submit" loading={savePending} loadingLabel="Guardando...">Guardar configuracion</LoadingButton>
  </form>
</FormFlow>
