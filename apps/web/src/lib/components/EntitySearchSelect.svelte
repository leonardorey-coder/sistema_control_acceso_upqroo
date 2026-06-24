<script lang="ts">
  type Row = Record<string, unknown>;

  let {
    label,
    value,
    displayValue = "",
    placeholder = "Buscar",
    disabled = false,
    search,
    displayResult,
    onSelect
  }: {
    label: string;
    value: string;
    displayValue?: string;
    placeholder?: string;
    disabled?: boolean;
    search: (query: string) => Promise<Row[]>;
    displayResult: (row: Row) => string;
    onSelect: (row: Row | null) => void;
  } = $props();

  const inputId = `entity-search-${Math.random().toString(36).slice(2)}`;
  let query = $state("");
  let rows = $state<Row[]>([]);
  let loading = $state(false);
  let open = $state(false);
  let error = $state("");
  let timer: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (value && displayValue && query !== displayValue) query = displayValue;
  });

  function scheduleSearch() {
    if (timer) clearTimeout(timer);
    if (query.trim().length < 2) {
      rows = [];
      open = false;
      return;
    }
    timer = setTimeout(runSearch, 250);
  }

  async function runSearch() {
    loading = true;
    error = "";
    try {
      rows = await search(query.trim());
      open = true;
    } catch (searchError) {
      error = searchError instanceof Error ? searchError.message : "No se pudo buscar";
      rows = [];
      open = true;
    } finally {
      loading = false;
    }
  }

  function select(row: Row) {
    query = displayResult(row);
    open = false;
    onSelect(row);
  }

  function clear() {
    query = "";
    rows = [];
    open = false;
    onSelect(null);
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
      oninput={(event) => {
        query = event.currentTarget.value;
        scheduleSearch();
      }}
      onfocus={() => {
        if (rows.length) open = true;
      }}
    />
    {#if value}
      <button type="button" class="ghost" onclick={clear}>Limpiar</button>
    {/if}
  </div>
  {#if open}
    <div class="entity-results">
      {#if loading}
        <p class="muted">Buscando...</p>
      {:else if error}
        <p class="error">{error}</p>
      {:else if rows.length}
        {#each rows as row}
          <button type="button" onclick={() => select(row)}>
            {displayResult(row)}
          </button>
        {/each}
      {:else}
        <p class="muted">Sin resultados</p>
      {/if}
    </div>
  {/if}
</div>
