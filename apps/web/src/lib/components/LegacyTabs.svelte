<script lang="ts">
  let {
    activeTab,
    tabs,
    isSuperAdmin = false,
    onTab
  }: {
    activeTab: string;
    tabs: Array<{ id: string; label: string }>;
    isSuperAdmin?: boolean;
    onTab: (id: string) => void;
  } = $props();

  const visibleTabs = $derived(tabs.filter((tab) => tab.id !== "admins" || isSuperAdmin));
</script>

<div class="tabs-container">
  <nav class="tabs" aria-label="Modulos administrativos">
    {#each visibleTabs as tab}
      <button
        type="button"
        class="tab-button"
        class:active={activeTab === tab.id}
        aria-current={activeTab === tab.id ? "page" : undefined}
        onclick={() => onTab(tab.id)}
      >
        <span class="tab-icon" aria-hidden="true">
          {#if tab.id === "generator"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
            </svg>
          {:else if tab.id === "edit"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
          {:else if tab.id === "access"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 3h18v18H3z" />
              <path d="M3 9h18M3 15h18M9 3v18" />
            </svg>
          {:else if tab.id === "attendance"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <path d="M9 16l2 2 4-4" />
            </svg>
          {:else if tab.id === "hotqr"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          {:else if tab.id === "vehicles"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 17h14l-1.4-5.6A2 2 0 0 0 15.66 10H8.34a2 2 0 0 0-1.94 1.4L5 17z" />
              <path d="M7 17v2" />
              <path d="M17 17v2" />
              <circle cx="7.5" cy="17" r="1.5" />
              <circle cx="16.5" cy="17" r="1.5" />
              <path d="M8 10l1-4h6l1 4" />
            </svg>
          {:else if tab.id === "gates"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
              <path d="M14 21V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v12" />
              <path d="M9 12h.01M9 17h.01" />
            </svg>
          {:else if tab.id === "admins"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          {:else if tab.id === "config"}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6 1.65 1.65 0 0 0-.4 1.08V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 8.6 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1 1.65 1.65 0 0 0-1.08-.4H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.9l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6 1.65 1.65 0 0 0 .4-1.08V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 15.4 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c0 .38.22.72.6 1 .3.22.68.4 1.08.4H21a2 2 0 1 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
            </svg>
          {/if}
        </span>
        <span>{tab.label}</span>
      </button>
    {/each}
  </nav>
</div>
