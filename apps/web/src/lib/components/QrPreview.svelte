<script lang="ts" module>
  const autoOpenedQrTokens = new Set<string>();
</script>

<script lang="ts">
  import * as QRCode from "qrcode";
  import IconButton from "./IconButton.svelte";
  import Modal from "./Modal.svelte";

  let {
    token = "",
    title = "QR generado",
    subtitle = "",
    showToken = true,
    autoOpen = false,
    subjectName = "",
    subjectId = ""
  }: {
    token?: string;
    title?: string;
    subtitle?: string;
    showToken?: boolean;
    autoOpen?: boolean;
    subjectName?: string;
    subjectId?: string;
  } = $props();

  let dataUrl = $state("");
  let open = $state(false);
  let feedback = $state("");
  const qrCardWidth = 1080;
  const qrCardHeight = 1350;
  const displaySubjectName = $derived(subjectName.trim());
  const displaySubjectId = $derived(subjectId.trim());
  const hasSubject = $derived(Boolean(displaySubjectName || displaySubjectId));

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
    if (!autoOpen || !token || autoOpenedQrTokens.has(token)) return;
    autoOpenedQrTokens.add(token);
    open = true;
  });

  function fileName() {
    const id = displaySubjectId ? `_${displaySubjectId.replace(/[^\w-]+/g, "_")}` : "";
    return `${title.replace(/[^\w-]+/g, "_")}${id}_${Date.now()}.png`;
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

    context.fillStyle = "#fff7ed";
    context.fillRect(0, 0, qrCardWidth, qrCardHeight);

    const cardX = 70;
    const cardY = 70;
    const cardWidth = qrCardWidth - 140;
    const cardHeight = qrCardHeight - 140;

    context.fillStyle = "#ffffff";
    context.beginPath();
    context.roundRect(cardX, cardY, cardWidth, cardHeight, 34);
    context.fill();

    context.strokeStyle = "#ff8c00";
    context.lineWidth = 6;
    context.stroke();

    const headerGradient = context.createLinearGradient(cardX, cardY, cardX + cardWidth, cardY);
    headerGradient.addColorStop(0, "#fff7ed");
    headerGradient.addColorStop(1, "#ffffff");
    context.fillStyle = headerGradient;
    context.beginPath();
    context.roundRect(cardX + 18, cardY + 18, cardWidth - 36, 150, 24);
    context.fill();

    try {
      const logo = await loadCanvasImage("/logo-universidad.png");
      context.drawImage(logo, cardX + 42, cardY + 44, 205, 74);
    } catch {
      context.fillStyle = "#8f2f24";
      context.font = "700 28px Arial";
      context.fillText("UPQROO", cardX + 42, cardY + 90);
    }

    context.textAlign = "right";
    context.fillStyle = "#ff8c00";
    context.font = "800 24px Arial";
    context.fillText("Sistema de Control de Acceso", cardX + cardWidth - 42, cardY + 76);
    context.fillStyle = "#64748b";
    context.font = "600 18px Arial";
    context.fillText(new Date().toLocaleDateString("es-MX"), cardX + cardWidth - 42, cardY + 108);

    context.textAlign = "left";
    context.fillStyle = "#111827";
    context.font = "800 46px Arial";
    drawWrappedText(context, title, cardX + 42, cardY + 225, cardWidth - 84, 52, 1);

    if (hasSubject) {
      const infoY = cardY + 286;
      context.fillStyle = "#f8fafc";
      context.beginPath();
      context.roundRect(cardX + 42, infoY, cardWidth - 84, 104, 18);
      context.fill();

      context.fillStyle = "#111827";
      context.font = "800 31px Arial";
      drawWrappedText(context, displaySubjectName || "Usuario sin nombre", cardX + 72, infoY + 43, cardWidth - 250, 34, 1);

      context.textAlign = "right";
      context.fillStyle = "#ff8c00";
      context.font = "800 25px Arial";
      context.fillText(displaySubjectId || "Sin matricula", cardX + cardWidth - 72, infoY + 56);
      context.textAlign = "left";
    }

    const qrImage = await loadCanvasImage(dataUrl);
    const qrSize = 560;
    const qrX = (qrCardWidth - qrSize) / 2;
    const qrY = hasSubject ? cardY + 445 : cardY + 360;
    context.fillStyle = "#f8fafc";
    context.beginPath();
    context.roundRect(qrX - 42, qrY - 42, qrSize + 84, qrSize + 84, 24);
    context.fill();

    context.fillStyle = "#ffffff";
    context.beginPath();
    context.roundRect(qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 14);
    context.fill();
    context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    context.fillStyle = "#475569";
    context.font = "600 24px Arial";
    const subtitleY = hasSubject ? cardY + 1088 : cardY + 1004;
    drawWrappedText(
      context,
      subtitle || "Comparte o descarga este QR solo al emitirlo.",
      cardX + 72,
      subtitleY,
      cardWidth - 144,
      32,
      2
    );

    if (showToken && token) {
      const tokenY = hasSubject ? cardY + 1150 : cardY + 1070;
      context.fillStyle = "#f1f5f9";
      context.beginPath();
      context.roundRect(cardX + 72, tokenY, cardWidth - 144, 82, 12);
      context.fill();
      context.fillStyle = "#1f2937";
      context.font = "700 22px monospace";
      drawWrappedText(context, token, cardX + 96, tokenY + 48, cardWidth - 192, 27, 2);
    }

    context.fillStyle = "#ff8c00";
    context.font = "800 20px Arial";
    context.textAlign = "center";
    context.fillText("Universidad Politecnica de Quintana Roo", qrCardWidth / 2, cardY + cardHeight - 46);
    context.fillStyle = "#64748b";
    context.font = "600 16px Arial";
    context.fillText("Presente este codigo en el punto de acceso autorizado.", qrCardWidth / 2, cardY + cardHeight - 20);
    context.textAlign = "left";

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
    const identity = [displaySubjectName, displaySubjectId].filter(Boolean).join(" - ");
    const text = `${title}\n${identity ? `${identity}\n` : ""}${subtitle ? `${subtitle}\n` : ""}${token}`;
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
      <span class="qr-empty">
        <svg class="qr-empty-icon" viewBox="0 0 64 64" aria-hidden="true">
          <path d="M19 7H9a2 2 0 0 0-2 2v10" />
          <path d="M45 7h10a2 2 0 0 1 2 2v10" />
          <path d="M7 45v10a2 2 0 0 0 2 2h10" />
          <path d="M57 45v10a2 2 0 0 1-2 2H45" />
          <rect x="19" y="18" width="12" height="12" rx="1.5" />
          <rect x="37" y="18" width="12" height="12" rx="1.5" />
          <rect x="19" y="36" width="12" height="12" rx="1.5" />
          <rect class="qr-empty-dot" x="37" y="36" width="5" height="5" rx="1" />
          <rect class="qr-empty-dot" x="45" y="36" width="5" height="5" rx="1" />
          <rect class="qr-empty-dot" x="37" y="45" width="5" height="5" rx="1" />
          <rect class="qr-empty-dot" x="47" y="47" width="6" height="6" rx="1" />
        </svg>
        <span>QR pendiente</span>
      </span>
    {/if}
  </button>
  <div>
    <strong>{title}</strong>
    {#if hasSubject}
      <dl class="qr-subject">
        {#if displaySubjectName}
          <div>
            <dt>Nombre</dt>
            <dd>{displaySubjectName}</dd>
          </div>
        {/if}
        {#if displaySubjectId}
          <div>
            <dt>Matricula</dt>
            <dd>{displaySubjectId}</dd>
          </div>
        {/if}
      </dl>
    {/if}
    {#if subtitle}<p>{subtitle}</p>{/if}
    {#if token && showToken}<code>{token}</code>{/if}
    {#if token}<span class="qr-copy-hint">Toca el QR para descargar, copiar o compartir.</span>{/if}
  </div>
</div>

<Modal {open} title={title} size="qr" onClose={() => (open = false)}>
  <div class="qr-modal-layout">
    <button class="qr-modal-image" type="button" aria-label="Descargar QR en PNG" onclick={downloadQr}>
      {#if dataUrl}
        <img src={dataUrl} alt="QR generado" />
      {:else}
        <span class="qr-empty">
          <svg class="qr-empty-icon" viewBox="0 0 64 64" aria-hidden="true">
            <path d="M19 7H9a2 2 0 0 0-2 2v10" />
            <path d="M45 7h10a2 2 0 0 1 2 2v10" />
            <path d="M7 45v10a2 2 0 0 0 2 2h10" />
            <path d="M57 45v10a2 2 0 0 1-2 2H45" />
            <rect x="19" y="18" width="12" height="12" rx="1.5" />
            <rect x="37" y="18" width="12" height="12" rx="1.5" />
            <rect x="19" y="36" width="12" height="12" rx="1.5" />
            <rect class="qr-empty-dot" x="37" y="36" width="5" height="5" rx="1" />
            <rect class="qr-empty-dot" x="45" y="36" width="5" height="5" rx="1" />
            <rect class="qr-empty-dot" x="37" y="45" width="5" height="5" rx="1" />
            <rect class="qr-empty-dot" x="47" y="47" width="6" height="6" rx="1" />
          </svg>
          <span>QR pendiente</span>
        </span>
      {/if}
    </button>
    <div class="qr-modal-info">
      {#if hasSubject}
        <dl class="qr-subject qr-subject-modal">
          {#if displaySubjectName}
            <div>
              <dt>Nombre</dt>
              <dd>{displaySubjectName}</dd>
            </div>
          {/if}
          {#if displaySubjectId}
            <div>
              <dt>Matricula</dt>
              <dd>{displaySubjectId}</dd>
            </div>
          {/if}
        </dl>
      {/if}
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
