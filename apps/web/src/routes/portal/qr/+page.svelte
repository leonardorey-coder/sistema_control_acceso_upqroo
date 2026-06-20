<script lang="ts">
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { apiRequest } from "$lib/api/client";
  import LegacyHeader from "$lib/components/LegacyHeader.svelte";
  import QrPreview from "$lib/components/QrPreview.svelte";

  type Row = Record<string, unknown>;
  type PortalSession = {
    user: { fullName: string; matricula: string; personType: string };
    expiresAt: string;
  };

  let session = $state<PortalSession | null>(null);
  let qrToken = $state("");
  let qrCredential = $state<Row | null>(null);

  async function load() {
    try {
      session = await apiRequest<PortalSession>("/api/v1/portal/me");
      qrCredential = (await apiRequest<{ credential: Row | null }>("/api/v1/portal/qr")).credential;
    } catch {
      await goto("/portal/login");
    }
  }

  async function rotateQr() {
    const result = await apiRequest<{ credential: Row; token: string }>("/api/v1/portal/qr/rotate", { method: "POST" });
    qrCredential = result.credential;
    qrToken = result.token;
  }

  async function logout() {
    await apiRequest("/api/v1/portal/auth/logout", { method: "POST" }).catch(() => null);
    await goto("/portal/login");
  }

  onMount(load);
</script>

<svelte:head><title>Mi QR - Sistema de Control</title></svelte:head>

<LegacyHeader title="Mi QR" actionHref="/portal" actionLabel="Portal" session={session} onLogout={logout} />

<main class="legacy-main portal-qr-page">
  {#if session}
    <section class="panel qr-focus qr-max">
      <QrPreview token={qrToken} title={session.user.fullName} subtitle={qrToken ? "Token visible solo en esta emision" : qrCredential ? "QR vigente registrado. Rota para ver un token nuevo." : "No hay QR vigente."} />
      <button onclick={rotateQr}>Rotar QR personal</button>
    </section>
  {/if}
</main>
