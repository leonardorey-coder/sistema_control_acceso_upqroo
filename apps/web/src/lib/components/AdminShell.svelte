<script lang="ts">
  import type { Snippet } from "svelte";

  type Session = {
    admin: {
      displayName: string;
      role: string;
    };
  };

  let {
    activeTab,
    tabs,
    session,
    apiOnline,
    children,
    onTab,
    onLogout
  }: {
    activeTab: string;
    tabs: Array<{ id: string; label: string }>;
    session: Session | null;
    apiOnline: boolean;
    children: Snippet;
    onTab: (id: string) => void;
    onLogout: () => void;
  } = $props();
</script>

<header class="legacy-header">
  <div class="header-left">
    <div class="logo-mark">UP</div>
    <div class="divider"></div>
    <h1>Sistema de Control de Acceso</h1>
  </div>
  <div class="header-right">
    <a class="view-switch" href="/scanner">Vista Escaneo</a>
    {#if session}
      <div class="admin-pill">
        <span>{session.admin.displayName}</span>
        <small>{session.admin.role}</small>
        <button class="ghost" onclick={onLogout}>Salir</button>
      </div>
    {/if}
  </div>
</header>

<div class="tabs-container">
  <nav class="tabs" aria-label="Modulos">
    {#each tabs as tab}
      <button class:active={activeTab === tab.id} onclick={() => onTab(tab.id)}>
        {tab.label}
      </button>
    {/each}
  </nav>
</div>

<main class="legacy-main">
  <div class="api-state">
    <span class={apiOnline ? "dot ok-dot" : "dot bad-dot"}></span>
    API {apiOnline ? "activa" : "sin conexion"}
  </div>
  {@render children()}
</main>
