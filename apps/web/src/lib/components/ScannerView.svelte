<script lang="ts">
  import { onDestroy } from "svelte";
  import LoadingButton from "./LoadingButton.svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  let {
    scannerId = "",
    onScan
  }: {
    scannerId?: string;
    onScan: (payload: { token?: string; signedQr?: string; manualMatricula?: string; scannerId?: string }) => Promise<void>;
  } = $props();

  let active = $state<"qr" | "manual">("qr");
  let token = $state("");
  let manualMatricula = $state("");
  let busy = $state(false);
  let error = $state("");
  let cameraActive = $state(false);
  const cameraStatus = $derived(error ? "Error" : busy ? "Procesando" : cameraActive ? "Camara activa" : "Listo");
  let scanner: import("html5-qrcode").Html5Qrcode | null = null;
  const readerId = `reader-${Math.random().toString(36).slice(2)}`;

  function payloadFromQr(value: string) {
    const trimmed = value.trim();
    return trimmed.split(".").length === 3 ? { signedQr: trimmed } : { token: trimmed };
  }

  function withScannerId(payload: { token?: string; signedQr?: string; manualMatricula?: string }) {
    return scannerId ? { ...payload, scannerId } : payload;
  }

  async function submitScan(payload: { token?: string; signedQr?: string; manualMatricula?: string }) {
    busy = true;
    error = "";

    try {
      await onScan(withScannerId(payload));
      token = "";
      manualMatricula = "";
    } catch (scanError) {
      error = scanError instanceof Error ? scanError.message : "No se pudo registrar";
    } finally {
      busy = false;
    }
  }

  function pressKey(key: string) {
    if (key === "backspace") {
      manualMatricula = manualMatricula.slice(0, -1);
      return;
    }

    if (key === "enter") {
      submitScan({ manualMatricula });
      return;
    }

    manualMatricula += key;
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "backspace", "0", "enter"];
  const letters = ["A", "B", "I", "M", "P"];
  const scannerModes = [
    { value: "qr", label: "Escaner QR" },
    { value: "manual", label: "Matricula" }
  ];

  async function startCamera() {
    if (scanner) return;
    error = "";

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const activeScanner = new Html5Qrcode(readerId);
      scanner = activeScanner;
      await activeScanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decodedText: string) => {
          scanner?.stop().catch(() => null);
          scanner = null;
          cameraActive = false;
          submitScan(payloadFromQr(decodedText));
        },
        () => undefined
      );
      cameraActive = true;
    } catch (scanError) {
      scanner = null;
      cameraActive = false;
      error = scanError instanceof Error ? scanError.message : "No se pudo abrir la camara";
    }
  }

  async function stopCamera() {
    if (!scanner) return;
    await scanner.stop().catch(() => null);
    scanner.clear();
    scanner = null;
    cameraActive = false;
  }

  onDestroy(() => {
    stopCamera();
  });
</script>

<section class="scanner-page">
  <div class="scanner-display-link">
    <a class="view-switch" href={scannerId ? `/scanner/display?scannerId=${encodeURIComponent(scannerId)}` : "/scanner/display"} target="_blank" rel="noreferrer">Abrir pantalla de resultado</a>
    {#if scannerId}<span class="muted">Estacion: {scannerId}</span>{/if}
  </div>
  <SegmentedControl bind:value={active} options={scannerModes} label="Modo de escaneo" />

  <div class="scanner-stack scanner-capture-only">
    {#if active === "qr"}
      <form class="panel scanner-card" onsubmit={(event) => { event.preventDefault(); submitScan(payloadFromQr(token)); }}>
        <h2>Escanear Codigo QR</h2>
        <p class="muted">Coloca el codigo QR frente a la camara</p>
        <div class="camera-status" class:active={cameraActive}>{cameraStatus}</div>
        <div class="camera-box" id={readerId}>Camara QR</div>
        <div class="scanner-actions">
          <button type="button" onclick={startCamera} disabled={cameraActive}>Iniciar camara</button>
          <button type="button" class="ghost" onclick={stopCamera} disabled={!cameraActive}>Detener</button>
        </div>
        <label class="form-field">
          <span>Token QR</span>
          <input bind:value={token} placeholder="Token QR" autocomplete="off" />
        </label>
        <LoadingButton type="submit" loading={busy} loadingLabel="Registrando..." disabled={!token}>Registrar QR</LoadingButton>
      </form>
    {:else}
      <form class="panel scanner-card" onsubmit={(event) => { event.preventDefault(); submitScan({ manualMatricula }); }}>
        <h2>Ingresa tu Matricula</h2>
        <label class="form-field">
          <span>Matricula</span>
          <input bind:value={manualMatricula} placeholder="Ej: 21A00000" autocomplete="off" />
        </label>
        <div class="pin-pad">
          {#each keys as key}
            <button type="button" class="pin-key" onclick={() => pressKey(key)}>{key === "backspace" ? "⌫" : key === "enter" ? "✓" : key}</button>
          {/each}
        </div>
        <div class="letter-pad">
          {#each letters as key}
            <button type="button" onclick={() => pressKey(key)}>{key}</button>
          {/each}
        </div>
        <LoadingButton type="submit" loading={busy} loadingLabel="Verificando..." disabled={!manualMatricula}>Verificar Acceso</LoadingButton>
      </form>
    {/if}
  </div>
  {#if error}
    <p class="error scanner-error" role="alert">{error}</p>
  {/if}
</section>
