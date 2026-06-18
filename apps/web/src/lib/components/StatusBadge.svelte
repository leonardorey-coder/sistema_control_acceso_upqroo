<script lang="ts">
  let { value }: { value: unknown } = $props();

  const label = $derived(String(value ?? "-"));
  const tone = $derived(
    ["active", "activo", "completed", "confirmed", "used"].includes(label)
      ? "ok"
      : ["in_progress", "partial", "auto_closed", "assumed"].includes(label)
        ? "warn"
        : "muted"
  );
</script>

<span class={`badge ${tone}`}>{label}</span>
