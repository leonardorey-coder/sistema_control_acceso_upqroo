<script lang="ts">
  import { tick } from "svelte";

  type Row = Record<string, unknown>;

  let {
    label,
    value,
    displayValue = "",
    placeholder = "Buscar",
    disabled = false,
    search,
    displayResult,
    onSelect,
    onQueryChange,
    onSelectSubmit
  }: {
    label: string;
    value: string;
    displayValue?: string;
    placeholder?: string;
    disabled?: boolean;
    search: (query: string) => Promise<Row[]>;
    displayResult: (row: Row) => string;
    onSelect: (row: Row | null) => void;
    onQueryChange?: (query: string) => void;
    onSelectSubmit?: () => void | Promise<void>;
  } = $props();

  const inputId = `entity-search-${Math.random().toString(36).slice(2)}`;
  const listId = `${inputId}-list`;
  let query = $state("");
  let rows = $state<Row[]>([]);
  let cachedRows = $state<Row[]>([]);
  let loading = $state(false);
  let open = $state(false);
  let error = $state("");
  let loaded = $state(false);
  let loadedQuery = $state("");
  let activeIndex = $state(-1);
  let loadPromise: Promise<Row[]> | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (value && displayValue && query !== displayValue) query = displayValue;
  });

  function rowSearchText(row: Row) {
    return `${displayResult(row)} ${Object.values(row).join(" ")}`.toLowerCase();
  }

  function filterCachedRows() {
    const needle = query.trim().toLowerCase();
    const source = cachedRows;
    if (!needle) {
      rows = source.slice(0, 10);
      open = Boolean(rows.length);
      activeIndex = rows.length ? 0 : -1;
      return;
    }
    rows = source.filter((row) => rowSearchText(row).includes(needle)).slice(0, 10);
    open = true;
    activeIndex = rows.length ? 0 : -1;
  }

  function scheduleLoad() {
    if (timer) clearTimeout(timer);
    if (query.trim().length < 2) {
      rows = [];
      open = false;
      activeIndex = -1;
      return;
    }
    timer = setTimeout(ensureLoaded, 250);
  }

  async function ensureLoaded() {
    const normalizedQuery = query.trim().toLowerCase();
    if (loaded && (normalizedQuery.length < 3 || normalizedQuery === loadedQuery)) {
      filterCachedRows();
      return;
    }
    if (loadPromise) {
      await loadPromise;
      filterCachedRows();
      return;
    }
    loading = true;
    error = "";
    open = true;
    loadPromise = search(query.trim());
    try {
      cachedRows = await loadPromise;
      loaded = true;
      loadedQuery = normalizedQuery;
      filterCachedRows();
    } catch (searchError) {
      error = searchError instanceof Error ? searchError.message : "No se pudo buscar";
      rows = [];
      open = true;
      activeIndex = -1;
    } finally {
      loading = false;
      loadPromise = null;
    }
  }

  async function select(row: Row) {
    query = displayResult(row);
    open = false;
    activeIndex = -1;
    onSelect(row);
    if (onSelectSubmit) {
      await tick();
      await onSelectSubmit();
    }
  }

  function clear() {
    query = "";
    rows = [];
    open = false;
    activeIndex = -1;
    onQueryChange?.("");
    onSelect(null);
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open && rows.length) open = true;
      activeIndex = rows.length ? Math.min(activeIndex + 1, rows.length - 1) : -1;
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      activeIndex = rows.length ? Math.max(activeIndex - 1, 0) : -1;
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0 && rows[activeIndex]) {
      event.preventDefault();
      const row = rows[activeIndex];
      if (row) select(row);
      return;
    }
    if (event.key === "Escape") {
      open = false;
      activeIndex = -1;
    }
  }
</script>

<div class="entity-search">
  <label for={inputId}>{label}</label>
  <div class="entity-search-row">
    <input
      id={inputId}
      value={query}
      {placeholder}
      {disabled}
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-expanded={open}
      aria-controls={listId}
      aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
      oninput={(event) => {
        query = event.currentTarget.value;
        onQueryChange?.(query);
        if (value && query !== displayValue) onSelect(null);
        scheduleLoad();
      }}
      onfocus={() => {
        if (rows.length) open = true;
      }}
      onkeydown={handleKeydown}
    />
    {#if value}
      <button type="button" class="ghost" onclick={clear}>Limpiar</button>
    {/if}
  </div>
  {#if open}
    <div id={listId} class="entity-results" role="listbox" aria-label={`Resultados de ${label}`}>
      {#if loading}
        <p class="muted">Buscando…</p>
      {:else if error}
        <p class="error">{error}</p>
      {:else if rows.length}
        {#each rows as row, index}
          <button
            id={`${listId}-${index}`}
            type="button"
            role="option"
            aria-selected={activeIndex === index}
            class:active={activeIndex === index}
            onmouseenter={() => (activeIndex = index)}
            onclick={() => select(row)}
          >
            {displayResult(row)}
          </button>
        {/each}
      {:else}
        <p class="muted">Sin resultados</p>
      {/if}
    </div>
  {/if}
</div>
