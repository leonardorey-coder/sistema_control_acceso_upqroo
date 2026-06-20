<script lang="ts">
  import * as QRCode from "qrcode";

  let {
    token = "",
    title = "QR generado",
    subtitle = ""
  }: {
    token?: string;
    title?: string;
    subtitle?: string;
  } = $props();

  let dataUrl = $state("");

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
</script>

<div class="qr-preview">
  <div class="qr-box" aria-label="QR generado">
    {#if dataUrl}
      <img src={dataUrl} alt="QR generado" />
    {:else}
      <span>QR</span>
    {/if}
  </div>
  <div>
    <strong>{title}</strong>
    {#if subtitle}<p>{subtitle}</p>{/if}
    {#if token}<code>{token}</code>{/if}
  </div>
</div>
