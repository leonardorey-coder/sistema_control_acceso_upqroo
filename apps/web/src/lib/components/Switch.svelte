<script lang="ts">
  let {
    checked = $bindable(false),
    label,
    disabled = false
  }: {
    checked: boolean;
    label: string;
    disabled?: boolean;
  } = $props();
</script>

<label class="switch-control">
  <span class="switch-copy">
    <span>{label}</span>
    <small>{checked ? "Activado" : "Desactivado"}</small>
  </span>
  <span class="ios-switch">
    <input type="checkbox" bind:checked {disabled} aria-label={label} />
    <span class="slider"></span>
  </span>
</label>
