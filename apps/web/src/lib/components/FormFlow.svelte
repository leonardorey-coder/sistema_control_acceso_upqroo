<script lang="ts">
  import type { Snippet } from "svelte";
  import SegmentedControl from "./SegmentedControl.svelte";

  let {
    title,
    description = "",
    value = $bindable(),
    options,
    children,
    aside
  }: {
    title: string;
    description?: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    children: Snippet;
    aside?: Snippet;
  } = $props();
</script>

<section class="form-flow">
  <div class="workspace-header">
    <div>
      <h2>{title}</h2>
      {#if description}<p class="muted">{description}</p>{/if}
    </div>
    <SegmentedControl bind:value options={options} label={title} />
  </div>

  <div class="form-flow-body" class:with-aside={Boolean(aside)}>
    <div class="form-flow-main">
      {@render children()}
    </div>
    {#if aside}
      <aside class="form-flow-aside" aria-label={`Resumen de ${title}`}>
        {@render aside()}
      </aside>
    {/if}
  </div>
</section>
