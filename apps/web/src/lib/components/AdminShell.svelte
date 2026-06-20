<script lang="ts">
  import type { Snippet } from "svelte";
  import LegacyFooter from "./LegacyFooter.svelte";
  import LegacyHeader from "./LegacyHeader.svelte";
  import LegacyTabs from "./LegacyTabs.svelte";

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

  const isSuperAdmin = $derived(session?.admin.role === "super_admin");
</script>

<LegacyHeader {session} onLogout={onLogout} />
<LegacyTabs {activeTab} {tabs} {isSuperAdmin} onTab={onTab} />

<main class="legacy-main">
  <div class="api-state">
    <span class={apiOnline ? "dot ok-dot" : "dot bad-dot"}></span>
    API {apiOnline ? "activa" : "sin conexion"}
  </div>
  {@render children()}
</main>

<LegacyFooter />
