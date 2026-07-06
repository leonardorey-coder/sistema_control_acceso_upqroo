<script lang="ts">
  import Icon, { type IconName } from "./Icon.svelte";

  export type ActivityTone = "primary" | "success" | "warning" | "danger" | "info" | "muted";
  export type ActivityChip = {
    label: string;
    value?: unknown;
    icon?: IconName;
    tone?: ActivityTone;
  };
  export type ActivityItem = {
    id: string;
    title: string;
    subject?: string;
    description?: string;
    time?: unknown;
    icon?: IconName;
    tone?: ActivityTone;
    chips?: ActivityChip[];
    detailLabel?: string;
    onDetail?: () => void;
  };

  let {
    items,
    emptyTitle = "Sin actividad",
    emptyDescription = "No hay eventos para mostrar con los filtros actuales."
  }: {
    items: ActivityItem[];
    emptyTitle?: string;
    emptyDescription?: string;
  } = $props();

  function formatValue(value: unknown) {
    if (value === null || value === undefined || value === "") return "";
    return String(value);
  }

  function hasValue(value: unknown) {
    return value !== null && value !== undefined && value !== "";
  }

  function parseTime(value: unknown) {
    if (!value) return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTime(value: unknown) {
    const date = parseTime(value);
    if (!date) return "";
    return date.toLocaleString("es-MX");
  }

  function relativeTime(value: unknown) {
    const date = parseTime(value);
    if (!date) return "";
    const diffMs = Date.now() - date.getTime();
    const absMs = Math.abs(diffMs);
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (absMs < minute) return "Hace un momento";
    if (absMs < hour) return `Hace ${Math.max(1, Math.round(absMs / minute))} min`;
    if (absMs < day) return `Hace ${Math.round(absMs / hour)} h`;
    return date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  }

  function dateHeading(value: unknown) {
    const date = parseTime(value);
    if (!date) return "Sin fecha";
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    if (sameDay) return `Hoy - ${date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}`;
    return date.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  function openDetail(item: ActivityItem) {
    item.onDetail?.();
  }
</script>

{#snippet activityCardContent(item: ActivityItem)}
  <div class={`activity-icon ${item.tone ?? "primary"}`} aria-hidden="true">
    <Icon name={item.icon ?? "settings"} size={22} />
  </div>

  <div class="activity-content">
    <div class="activity-head">
      <div>
        <h4>{item.title}</h4>
        {#if item.subject}
          <p class="activity-subject">{item.subject}</p>
        {/if}
      </div>
      {#if item.onDetail}
        <span class="activity-detail-button" aria-hidden="true">
          {item.detailLabel ?? "Detalle"}
        </span>
      {/if}
    </div>

    {#if item.description}
      <p class="activity-description">{item.description}</p>
    {/if}

    <div class="activity-meta">
      {#each item.chips ?? [] as chip}
        {#if formatValue(chip.value ?? chip.label)}
          <span class={`activity-chip ${chip.tone ?? item.tone ?? "primary"}`}>
            {#if chip.icon}
              <Icon name={chip.icon} size={15} />
            {/if}
            <span>{hasValue(chip.value) ? `${chip.label}: ${chip.value}` : chip.label}</span>
          </span>
        {/if}
      {/each}
      {#if item.time}
        <span class="activity-time" title={formatTime(item.time)}>
          <Icon name="calendar" size={16} />
          {relativeTime(item.time)}
        </span>
      {/if}
    </div>
  </div>
{/snippet}

{#if items.length}
  <div class="activity-timeline">
    <div class="activity-date">
      <span class="activity-date-dot" aria-hidden="true"></span>
      <h3>{dateHeading(items[0]?.time)}</h3>
    </div>

    <div class="activity-list">
      {#each items as item}
        {#if item.onDetail}
          <button type="button" class="activity-card clickable" aria-label={`Abrir detalle de ${item.title}`} onclick={() => openDetail(item)}>
            {@render activityCardContent(item)}
          </button>
        {:else}
          <article class="activity-card">
            {@render activityCardContent(item)}
          </article>
        {/if}
      {/each}
    </div>
  </div>
{:else}
  <div class="activity-empty">
    <Icon name="search" size={22} />
    <h3>{emptyTitle}</h3>
    <p>{emptyDescription}</p>
  </div>
{/if}
