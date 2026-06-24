<script lang="ts">
  let {
    page,
    pageSize,
    total,
    onChange
  }: {
    page: number;
    pageSize: number;
    total: number;
    onChange: (next: { page: number; pageSize: number }) => void;
  } = $props();

  const totalPages = $derived(Math.max(1, Math.ceil(total / pageSize)));

  function setPage(nextPage: number) {
    onChange({ page: Math.min(totalPages, Math.max(1, nextPage)), pageSize });
  }

  function setPageSize(nextPageSize: number) {
    onChange({ page: 1, pageSize: nextPageSize });
  }
</script>

<div class="pagination-controls">
  <span class="muted">{total} registros</span>
  <button type="button" class="ghost" disabled={page <= 1} onclick={() => setPage(page - 1)}>Anterior</button>
  <span>Pagina {page} / {totalPages}</span>
  <button type="button" class="ghost" disabled={page >= totalPages} onclick={() => setPage(page + 1)}>Siguiente</button>
  <select value={pageSize} onchange={(event) => setPageSize(Number(event.currentTarget.value))}>
    <option value="10">10</option>
    <option value="25">25</option>
    <option value="50">50</option>
    <option value="100">100</option>
  </select>
</div>
