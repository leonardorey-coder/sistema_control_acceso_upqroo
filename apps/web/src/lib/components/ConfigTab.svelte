<script lang="ts">
  import type { AdminClientRowPayload, AdminClientsConfigPayload, OperationalConfigPayload, ScannerDevicesConfigPayload, SignedQrConfigPayload } from "@control-acceso/shared";
  import FormFlow from "./FormFlow.svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import Switch from "./Switch.svelte";

  let {
    config = $bindable(),
    signedQrConfig = $bindable(),
    scannerDevicesConfig = $bindable(),
    adminClientsConfig = $bindable(),
    adminClientRows = [],
    isSuperAdmin = false,
    onSave,
    onSaveSignedQr,
    onSaveScannerDevices,
    onSaveAdminClients,
    onAuthorizeAdminBrowser,
    onRevokeAdminBrowser
  }: {
    config: OperationalConfigPayload;
    signedQrConfig: SignedQrConfigPayload;
    scannerDevicesConfig: ScannerDevicesConfigPayload;
    adminClientsConfig: AdminClientsConfigPayload;
    adminClientRows?: Array<AdminClientRowPayload & Record<string, unknown>>;
    isSuperAdmin?: boolean;
    onSave: () => void | Promise<void>;
    onSaveSignedQr: () => void | Promise<void>;
    onSaveScannerDevices: () => void | Promise<void>;
    onSaveAdminClients: () => void | Promise<void>;
    onAuthorizeAdminBrowser: () => void | Promise<void>;
    onRevokeAdminBrowser: (row: AdminClientRowPayload & Record<string, unknown>) => void | Promise<void>;
  } = $props();

  let activeSection = $state("scan");
  let savePending = $state(false);
  let browserPending = $state(false);
  const sectionOptions = [
    { value: "scan", label: "Escaneo" },
    { value: "signed", label: "QR firmado" },
    { value: "scanners", label: "Scanners" },
    { value: "browsers", label: "Navegadores" }
  ];

  async function saveAll() {
    savePending = true;
    try {
      await onSave();
      if (isSuperAdmin) {
        await onSaveSignedQr();
        await onSaveScannerDevices();
        await onSaveAdminClients();
      }
    } finally {
      savePending = false;
    }
  }

  async function authorizeBrowser() {
    browserPending = true;
    try {
      await onAuthorizeAdminBrowser();
    } finally {
      browserPending = false;
    }
  }

  function formatDate(value: unknown) {
    if (!value) return "Sin registro";
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(value)));
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
    {:else if activeSection === "scanners"}
      <div class="section-header">
        <h2>Dispositivos scanner</h2>
        <p>Controla si una sesion admin necesita estar en un dispositivo scanner autorizado.</p>
      </div>
      <Switch bind:checked={scannerDevicesConfig.required} label="Exigir scanner autorizado" disabled={!isSuperAdmin} />
      <p class="notice">Cuando esta activo, una sesion admin no basta para escanear: el dispositivo debe estar vinculado con un codigo autorizado por superadmin.</p>
    {:else}
      <div class="section-header">
        <h2>Navegadores administrativos</h2>
        <p>Exige una llave local autorizada para iniciar sesion desde clientes admin no-superadmin.</p>
      </div>
      <Switch bind:checked={adminClientsConfig.required} label="Exigir navegador autorizado para login admin" disabled={!isSuperAdmin} />
      <p class="notice">El superadmin y ADMIN_CLIENT_AUTH_BYPASS=true quedan como modo de rescate. Los navegadores privados o clientes API sin llave local no pasan este control.</p>
      <LoadingButton type="button" loading={browserPending} loadingLabel="Autorizando..." disabled={!isSuperAdmin} onClick={authorizeBrowser}>
        Autorizar este navegador
      </LoadingButton>
      <div class="browser-list">
        {#if adminClientRows.length === 0}
          <p class="muted">No hay navegadores administrativos autorizados.</p>
        {:else}
          {#each adminClientRows as row}
            <div class="browser-row">
              <div>
                <strong>{row.label || "Navegador administrativo"}</strong>
                <span>{row.displayName} · {row.status}</span>
                <small>Alta: {formatDate(row.createdAt)} · Ultimo uso: {formatDate(row.lastUsedAt)}</small>
              </div>
              <button type="button" class="danger-outline" disabled={!isSuperAdmin || row.status === "revoked"} onclick={() => onRevokeAdminBrowser(row)}>Revocar</button>
            </div>
          {/each}
        {/if}
      </div>
    {/if}

    <div class="flow-card">
      <h3>Resumen</h3>
      <dl class="flow-summary">
        <div><dt>Auto-escaneo</dt><dd>{config.retryEnabled ? "Activo" : "Inactivo"}</dd></div>
        <div><dt>QR firmado</dt><dd>{signedQrConfig.enabled ? `${signedQrConfig.ttlSeconds}s` : "Inactivo"}</dd></div>
        <div><dt>Scanner autorizado</dt><dd>{scannerDevicesConfig.required ? "Requerido" : "No requerido"}</dd></div>
        <div><dt>Navegador admin</dt><dd>{adminClientsConfig.required ? "Requerido" : "No requerido"}</dd></div>
      </dl>
    </div>

    <LoadingButton type="submit" loading={savePending} loadingLabel="Guardando...">Guardar configuracion</LoadingButton>
  </form>
</FormFlow>
