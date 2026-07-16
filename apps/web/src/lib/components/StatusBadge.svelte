<script lang="ts">
  import { labelAny } from "$lib/ui/labels";

  let { value }: { value: unknown } = $props();

  const raw = $derived(String(value ?? ""));
  const label = $derived(labelAny(value) || "-");
  const tone = $derived(
    ["active", "activo", "completed", "confirmed", "used", "accepted", "entry"].includes(raw)
      ? "ok"
      : ["in_progress", "partial", "auto_closed", "assumed", "exit", "maintenance", "entry_only", "exit_only"].includes(raw)
        ? "warn"
        : ["rejected", "revoked", "disabled", "blocked", "baja", "false", "emergency"].includes(raw)
          ? "danger"
        : "muted"
  );
</script>

<span class={`badge ${tone}`}>{label}</span>
