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

  const selectedIndex = $derived(Math.max(0, options.findIndex((option) => option.value === value)));
  const segmentCount = $derived(Math.max(1, options.length));
</script>

<div
  class="segmented-control"
  role="tablist"
  aria-label={label}
  style={`--segment-count: ${segmentCount}; --segment-index: ${selectedIndex};`}
>
  <span class="segmented-control-indicator" aria-hidden="true"></span>
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
