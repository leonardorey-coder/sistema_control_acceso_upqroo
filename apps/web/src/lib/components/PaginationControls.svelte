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
</script>

<div class="pagination-controls">
  <span class="muted">{total} registros</span>
  <button type="button" class="ghost" disabled={page <= 1} onclick={() => setPage(page - 1)}>Anterior</button>
  <span>Pagina {page} / {totalPages}</span>
  <button type="button" class="ghost" disabled={page >= totalPages} onclick={() => setPage(page + 1)}>Siguiente</button>
  <span class="muted">10 por pagina</span>
</div>
