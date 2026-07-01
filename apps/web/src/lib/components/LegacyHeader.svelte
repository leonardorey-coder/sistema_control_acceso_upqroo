<script lang="ts">
  import IconButton from "./IconButton.svelte";
  import { labelFor } from "$lib/ui/labels";

  type SessionShape =
    | {
        admin?: {
          displayName?: string;
          role?: string;
        };
        user?: {
          fullName?: string;
          personType?: string;
        };
      }
    | null;

  let {
    title = "Sistema de Control de Acceso",
    actionHref = "/scanner",
    actionLabel = "Vista Escaneo",
    session = null,
    onLogout
  }: {
    title?: string;
    actionHref?: string;
    actionLabel?: string;
    session?: SessionShape;
    onLogout?: (() => void) | null;
  } = $props();

  const displayName = $derived(session?.admin?.displayName ?? session?.user?.fullName ?? "");
  const role = $derived(session?.admin?.role ?? session?.user?.personType ?? "");
  const roleLabel = $derived(role ? labelFor("role", role) : "");
  const initials = $derived(
    displayName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.slice(0, 1).toUpperCase())
      .join("") || "UP"
  );
</script>

<header class="legacy-header">
  <div class="header-container">
    <div class="header-left">
      <img class="logo" src="/logo-universidad.png" alt="Universidad Politecnica de Quintana Roo" />
      <div class="divider"></div>
      <h1 class="system-title">{title}</h1>
    </div>

    <div class="header-right">
      <a class="view-switch-button" href={actionHref}>{actionLabel}</a>

      {#if displayName}
        <div class="admin-section">
          <div class="admin-info">
            <span class="admin-avatar" aria-hidden="true">{initials}</span>
            <span class="admin-name">{displayName}</span>
            {#if roleLabel}<small>{roleLabel}</small>{/if}
          </div>
          {#if onLogout}
            <IconButton icon="exit" label="Cerrar sesion" compact onClick={onLogout} />
          {/if}
        </div>
      {/if}
    </div>
  </div>
</header>
