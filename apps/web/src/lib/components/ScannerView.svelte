<script lang="ts">
  import { onDestroy } from "svelte";
  import type { ScannerResultPayload } from "@control-acceso/shared";
  import StatusBadge from "./StatusBadge.svelte";

  type Row = Record<string, unknown>;

  let {
    result,
    onScan
  }: {
    result: (ScannerResultPayload & Row) | null;
    onScan: (payload: { token?: string; signedQr?: string; manualMatricula?: string }) => Promise<void>;
  } = $props();

  let active = $state<"qr" | "manual">("qr");
  let token = $state("");
  let manualMatricula = $state("");
  let busy = $state(false);
  let error = $state("");
  let cameraActive = $state(false);
  let scanner: import("html5-qrcode").Html5Qrcode | null = null;
  const readerId = `reader-${Math.random().toString(36).slice(2)}`;

  function payloadFromQr(value: string) {
    const trimmed = value.trim();
    return trimmed.split(".").length === 3 ? { signedQr: trimmed } : { token: trimmed };
  }

  async function submitScan(payload: { token?: string; signedQr?: string; manualMatricula?: string }) {
    busy = true;
    error = "";

    try {
      await onScan(payload);
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
  <div class="client-tabs">
    <button class:active={active === "qr"} onclick={() => (active = "qr")}>Escaner QR</button>
    <button class:active={active === "manual"} onclick={() => (active = "manual")}>Matricula</button>
  </div>

  <div class="scanner-stack">
    {#if active === "qr"}
      <form class="panel scanner-card" onsubmit={(event) => { event.preventDefault(); submitScan(payloadFromQr(token)); }}>
        <h2>Escanear Codigo QR</h2>
        <p class="muted">Coloca el codigo QR frente a la camara</p>
        <div class="camera-box" id={readerId}>Camara QR</div>
        <div class="scanner-actions">
          <button type="button" onclick={startCamera} disabled={cameraActive}>Iniciar camara</button>
          <button type="button" class="ghost" onclick={stopCamera} disabled={!cameraActive}>Detener</button>
        </div>
        <label class="form-field">
          <span>Token QR</span>
          <input bind:value={token} placeholder="Token QR" autocomplete="off" />
        </label>
        <button disabled={busy || !token}>Registrar QR</button>
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
        <button disabled={busy || !manualMatricula}>Verificar Acceso</button>
      </form>
    {/if}

    <section class="panel result-card">
      <h2>Resultado</h2>
      {#if error}
        <p class="error">{error}</p>
      {/if}
      {#if result}
        {#if result.profilePhotoUrl}
          <img class="avatar photo-avatar" src={String(result.profilePhotoUrl)} alt={`Foto de ${result.fullName ?? result.visitorName ?? "persona"}`} />
        {:else}
          <div class="avatar">{String(result.fullName ?? result.visitorName ?? "?").slice(0, 1)}</div>
        {/if}
        <strong>{result.fullName ?? result.visitorName}</strong>
        <p>{result.matricula ?? ""} {result.vehiclePlate ? `- ${result.vehiclePlate}` : ""}</p>
        <div class="result-meta">
          <StatusBadge value={result.action} />
          <StatusBadge value={result.credentialType} />
          <StatusBadge value={result.accessMode} />
        </div>
        <dl class="detail-list">
          <div><dt>Tipo</dt><dd>{result.personType ?? "-"}</dd></div>
          <div><dt>Carrera</dt><dd>{result.career ?? "-"}</dd></div>
          <div><dt>Vehiculo</dt><dd>{result.vehiclePlate ?? "-"}</dd></div>
          <div><dt>Estado</dt><dd>{result.reasonCode ?? (result.accepted ? "ACEPTADO" : "RECHAZADO")}</dd></div>
        </dl>
        <small>{result.timestamp ? new Date(String(result.timestamp)).toLocaleString("es-MX") : ""}</small>
      {:else}
        <p class="muted">Esperando escanear codigo QR...</p>
      {/if}
    </section>
  </div>
</section>
