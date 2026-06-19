<script lang="ts">
  let {
    value = $bindable(),
    onSave
  }: {
    value: string;
    onSave: () => void;
  } = $props();
</script>

<form class="panel" onsubmit={(event) => { event.preventDefault(); onSave(); }}>
  <h2>Configuracion operativa</h2>
  <textarea bind:value rows="12"></textarea>
  <button>Guardar configuracion</button>
</form>
