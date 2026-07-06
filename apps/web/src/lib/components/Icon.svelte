<script lang="ts">
  export type IconName =
    | "calendar"
    | "check"
    | "close"
    | "copy"
    | "download"
    | "edit"
    | "eye"
    | "exit"
    | "file"
    | "filter"
    | "key"
    | "lock"
    | "power"
    | "qr"
    | "refresh"
    | "reject"
    | "revoke"
    | "search"
    | "settings"
    | "share"
    | "shield"
    | "trash"
    | "user"
    | "users"
    | "vehicle"
    | "warning";

  let {
    name,
    size = 18
  }: {
    name: IconName;
    size?: number;
  } = $props();
</script>

<svg
  class="ui-icon"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === "calendar"}
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" />
  {:else if name === "check"}
    <path d="M20 6 9 17l-5-5" />
  {:else if name === "close"}
    <path d="M18 6 6 18" /><path d="M6 6l12 12" />
  {:else if name === "copy"}
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  {:else if name === "download"}
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />
  {:else if name === "edit"}
    <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  {:else if name === "eye"}
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
  {:else if name === "exit"}
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
  {:else if name === "file"}
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h5" />
  {:else if name === "filter"}
    <path d="M22 3H2l8 9.5V20l4 1v-8.5Z" />
  {:else if name === "key"}
    <circle cx="7.5" cy="15.5" r="4.5" /><path d="M11 12 21 2" /><path d="m17 6 2 2" /><path d="m14 9 2 2" />
  {:else if name === "lock"}
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  {:else if name === "power"}
    <path d="M12 2v10" /><path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
  {:else if name === "qr"}
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><path d="M14 14h2v2h-2zM19 14h2v2h-2zM14 19h2v2h-2zM19 19h2v2h-2z" />
  {:else if name === "refresh"}
    <path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /><path d="M3 12A9 9 0 0 1 18.5 5.8L21 8" /><path d="M21 3v5h-5" />
  {:else if name === "reject"}
    <circle cx="12" cy="12" r="9" /><path d="m15 9-6 6" /><path d="m9 9 6 6" />
  {:else if name === "revoke"}
    <circle cx="12" cy="12" r="9" /><path d="m5.7 5.7 12.6 12.6" />
  {:else if name === "trash"}
    <path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" />
  {:else if name === "search"}
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  {:else if name === "settings"}
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 .6V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-.6 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-.6-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 .6-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 6.1 4.3l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-.6V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 .6 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c0 .38.22.72.6 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  {:else if name === "share"}
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4" /><path d="m15.4 6.5-6.8 4" />
  {:else if name === "shield"}
    <path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3Z" /><path d="m9 12 2 2 4-5" />
  {:else if name === "user"}
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  {:else if name === "users"}
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  {:else if name === "vehicle"}
    <path d="M5 17h14l-1.4-5.6A2 2 0 0 0 15.66 10H8.34a2 2 0 0 0-1.94 1.4Z" /><path d="M7 17v2" /><path d="M17 17v2" /><circle cx="7.5" cy="17" r="1.5" /><circle cx="16.5" cy="17" r="1.5" /><path d="M8 10l1-4h6l1 4" />
  {:else if name === "warning"}
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
  {/if}
</svg>
