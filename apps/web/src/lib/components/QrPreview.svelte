<script lang="ts">
  import * as QRCode from "qrcode";
  import IconButton from "./IconButton.svelte";
  import Modal from "./Modal.svelte";

  let {
    token = "",
    title = "QR generado",
    subtitle = "",
    showToken = true,
    autoOpen = false
  }: {
    token?: string;
    title?: string;
    subtitle?: string;
    showToken?: boolean;
    autoOpen?: boolean;
  } = $props();

  let dataUrl = $state("");
  let open = $state(false);
  let feedback = $state("");
  let lastAutoToken = $state("");
  const qrCardWidth = 900;
  const qrCardHeight = 1200;

  $effect(() => {
    if (!token) {
      dataUrl = "";
      return;
    }

    QRCode.toDataURL(token, {
      errorCorrectionLevel: "M",
      margin: 2,
      scale: 8,
      color: {
        dark: "#333333",
        light: "#ffffff"
      }
    }).then((value) => {
      dataUrl = value;
    });
  });

  $effect(() => {
    if (!autoOpen || !token || token === lastAutoToken) return;
    lastAutoToken = token;
    open = true;
  });

  function fileName() {
    return `${title.replace(/[^\w-]+/g, "_")}_${Date.now()}.png`;
  }

  function loadCanvasImage(src: string) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }

  function drawWrappedText(
    context: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines = 4
  ) {
    const words = text.split(/\s+/).filter(Boolean);
    let line = "";
    let lines = 0;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (context.measureText(testLine).width > maxWidth && line) {
        context.fillText(line, x, y);
        y += lineHeight;
        lines += 1;
        line = word;
        if (lines >= maxLines - 1) break;
      } else {
        line = testLine;
      }
    }

    if (line && lines < maxLines) context.fillText(line, x, y);
  }

  async function buildQrCardDataUrl() {
    if (!dataUrl) return;
    const canvas = document.createElement("canvas");
    canvas.width = qrCardWidth;
    canvas.height = qrCardHeight;
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;

    context.fillStyle = "#fffaf4";
    context.fillRect(0, 0, qrCardWidth, qrCardHeight);
    context.fillStyle = "#ffffff";
    context.strokeStyle = "#ff8c00";
    context.lineWidth = 4;
    context.beginPath();
    context.roundRect(64, 64, qrCardWidth - 128, qrCardHeight - 128, 32);
    context.fill();
    context.stroke();

    try {
      const logo = await loadCanvasImage("/logo-universidad.png");
      context.drawImage(logo, 96, 94, 180, 64);
    } catch {
      context.fillStyle = "#8f2f24";
      context.font = "700 24px Arial";
      context.fillText("UPQROO", 96, 135);
    }

    context.fillStyle = "#333333";
    context.font = "700 38px Arial";
    drawWrappedText(context, title, 96, 220, qrCardWidth - 192, 48, 2);

    const qrImage = await loadCanvasImage(dataUrl);
    const qrSize = 560;
    const qrX = (qrCardWidth - qrSize) / 2;
    context.fillStyle = "#ffffff";
    context.fillRect(qrX - 18, 285, qrSize + 36, qrSize + 36);
    context.drawImage(qrImage, qrX, 303, qrSize, qrSize);

    context.fillStyle = "#555555";
    context.font = "400 26px Arial";
    drawWrappedText(
      context,
      subtitle || "Comparte o descarga este QR solo al emitirlo.",
      96,
      930,
      qrCardWidth - 192,
      34,
      3
    );

    if (showToken && token) {
      context.fillStyle = "#f5f6f7";
      context.fillRect(96, 1038, qrCardWidth - 192, 78);
      context.fillStyle = "#333333";
      context.font = "600 22px monospace";
      drawWrappedText(context, token, 120, 1085, qrCardWidth - 240, 28, 2);
    }

    context.fillStyle = "#ff8c00";
    context.font = "700 20px Arial";
    context.fillText("Sistema de Control de Acceso", 96, 1148);

    return canvas.toDataURL("image/png");
  }

  async function downloadQr() {
    const cardUrl = await buildQrCardDataUrl();
    if (!cardUrl) return;
    const link = document.createElement("a");
    link.download = fileName();
    link.href = cardUrl;
    link.click();
    feedback = "QR descargado";
  }

  async function copyToken() {
    if (!token) return;
    await navigator.clipboard?.writeText(token);
    feedback = "Codigo copiado";
  }

  async function shareQr() {
    if (!token || !dataUrl) return;
    const text = `${title}\n${subtitle ? `${subtitle}\n` : ""}${token}`;
    try {
      const cardUrl = await buildQrCardDataUrl();
      const blob = await fetch(cardUrl ?? dataUrl).then((response) => response.blob());
      const file = new File([blob], fileName(), { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title, text, files: [file] });
        feedback = "QR compartido";
        return;
      }
      if (navigator.share) {
        await navigator.share({ title, text });
        feedback = "Codigo compartido";
        return;
      }
    } catch {
      // Fall back to download below.
    }
    downloadQr();
    feedback = "Tu navegador no permite compartir archivos; se descargo el QR.";
  }
</script>

<div class="qr-preview">
  <button class="qr-box" class:clickable={Boolean(token)} type="button" aria-label="Abrir opciones del QR" disabled={!token} onclick={() => (open = true)}>
    {#if dataUrl}
      <img src={dataUrl} alt="QR generado" />
    {:else}
      <span class="qr-empty">QR pendiente</span>
    {/if}
  </button>
  <div>
    <strong>{title}</strong>
    {#if subtitle}<p>{subtitle}</p>{/if}
    {#if token && showToken}<code>{token}</code>{/if}
    {#if token}<span class="qr-copy-hint">Toca el QR para descargar, copiar o compartir.</span>{/if}
  </div>
</div>

<Modal {open} title={title} size="lg" onClose={() => (open = false)}>
  <div class="qr-modal-layout">
    <button class="qr-modal-image" type="button" aria-label="Descargar QR en PNG" onclick={downloadQr}>
      {#if dataUrl}
        <img src={dataUrl} alt="QR generado" />
      {:else}
        <span class="qr-empty">QR pendiente</span>
      {/if}
    </button>
    <div class="qr-modal-info">
      {#if subtitle}<p class="muted">{subtitle}</p>{/if}
      {#if showToken && token}<code>{token}</code>{/if}
      {#if feedback}<p class="notice" aria-live="polite">{feedback}</p>{/if}
      <div class="qr-actions">
        <IconButton icon="download" label="Descargar PNG" tone="primary" onClick={downloadQr} />
        <IconButton icon="copy" label="Copiar codigo" onClick={copyToken} />
        <IconButton icon="share" label="Compartir" onClick={shareQr} />
      </div>
    </div>
  </div>
</Modal>
