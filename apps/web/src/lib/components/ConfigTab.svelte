<script lang="ts">
  import type { OperationalConfigPayload, ScannerDevicesConfigPayload, SignedQrConfigPayload } from "@control-acceso/shared";
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

  let savePending = $state(false);
  let signedPending = $state(false);
  let scannerDevicesPending = $state(false);

  async function saveConfig() {
    savePending = true;
    try {
      await onSave();
    } finally {
      savePending = false;
    }
  }

  async function saveSignedQr() {
    signedPending = true;
    try {
      await onSaveSignedQr();
    } finally {
      signedPending = false;
    }
  }

  async function saveScannerDevices() {
    scannerDevicesPending = true;
    try {
      await onSaveScannerDevices();
    } finally {
      scannerDevicesPending = false;
    }
  }
</script>

<section class="grid two">
  <form class="panel form-grid" aria-busy={savePending} onsubmit={(event) => { event.preventDefault(); saveConfig(); }}>
    <h2>Configuracion del Sistema</h2>
    <Switch bind:checked={config.retryEnabled} label="Auto-escaneo QR" />
    <label class="form-field">
      <span>Delay entre escaneos</span>
      <input bind:value={config.retryDelayMs} type="number" min="250" step="50" />
    </label>
    <Switch bind:checked={config.cameraEnabled} label="Camara QR" />
    <Switch bind:checked={config.manualEntryEnabled} label="Entrada manual" />
    <Switch bind:checked={config.soundsEnabled} label="Sonidos" />
    <Switch bind:checked={config.autoExitEnabled} label="Salidas automaticas" />
    <LoadingButton type="submit" loading={savePending} loadingLabel="Aplicando...">Aplicar</LoadingButton>
  </form>

  <form class="panel form-grid" aria-busy={signedPending} onsubmit={(event) => { event.preventDefault(); saveSignedQr(); }}>
    <h2>QR firmado dinamico</h2>
    <Switch bind:checked={signedQrConfig.enabled} label="Activar QR firmado" />
    <label class="form-field">
      <span>Vigencia del token</span>
      <input bind:value={signedQrConfig.ttlSeconds} type="number" min="15" max="30" step="1" />
    </label>
    <label class="form-field">
      <span>Tolerancia de reloj</span>
      <input bind:value={signedQrConfig.clockToleranceSeconds} type="number" min="0" max="30" step="1" />
    </label>
    <Switch bind:checked={signedQrConfig.compatibilityOpaqueTokens} label="Compatibilidad QR opaco" />
    <Switch bind:checked={signedQrConfig.requireDeviceBinding} label="Vinculacion de dispositivo" />
    <LoadingButton type="submit" loading={signedPending} loadingLabel="Guardando...">Guardar QR firmado</LoadingButton>
  </form>

  <form class="panel form-grid" aria-busy={scannerDevicesPending} onsubmit={(event) => { event.preventDefault(); saveScannerDevices(); }}>
    <h2>Dispositivos scanner</h2>
    <Switch bind:checked={scannerDevicesConfig.required} label="Exigir scanner autorizado" />
    <p class="muted">Cuando esta activo, una sesion admin no basta para escanear: el dispositivo debe estar vinculado con un codigo autorizado por superadmin.</p>
    <LoadingButton type="submit" loading={scannerDevicesPending} loadingLabel="Guardando...">Guardar scanners</LoadingButton>
  </form>
</section>
