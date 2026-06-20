<script lang="ts">
  let {
    config = $bindable(),
    onSave
  }: {
    config: {
      retryEnabled: boolean;
      retryDelayMs: number;
      cameraEnabled: boolean;
      manualEntryEnabled: boolean;
      soundsEnabled: boolean;
      autoExitEnabled: boolean;
    };
    onSave: () => void;
  } = $props();
</script>

<form class="panel form-grid" onsubmit={(event) => { event.preventDefault(); onSave(); }}>
  <h2>Configuracion del Sistema</h2>
  <label class="switch-row">
    <span>Auto-escaneo QR</span>
    <input bind:checked={config.retryEnabled} type="checkbox" />
  </label>
  <label>
    Delay entre escaneos
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
