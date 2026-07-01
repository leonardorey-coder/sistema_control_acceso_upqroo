<script lang="ts">
  let {
    value = $bindable(),
    options,
    label
  }: {
    value: string;
    options: Array<{ value: string; label: string }>;
    label: string;
  } = $props();
</script>

<div class="segmented-control" role="tablist" aria-label={label}>
  {#each options as option}
    <button
      type="button"
      role="tab"
      aria-selected={value === option.value}
      class:active={value === option.value}
      onclick={() => (value = option.value)}
    >
      {option.label}
    </button>
  {/each}
</div>
