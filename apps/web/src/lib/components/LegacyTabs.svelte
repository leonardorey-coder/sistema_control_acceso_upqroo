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
      <button class="tab-button" class:active={activeTab === tab.id} onclick={() => onTab(tab.id)}>
        {tab.label}
      </button>
    {/each}
  </nav>
</div>
