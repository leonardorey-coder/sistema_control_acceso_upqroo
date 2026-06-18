<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Control de Acceso UPQROO v2</title>
</svelte:head>

<main class="min-h-screen bg-[#f6f7f4] text-[#17201b]">
  <section class="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-10">
    <div class="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-center">
      <div>
        <p class="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#46715d]">
          Sistema institucional
        </p>
        <h1 class="max-w-3xl text-4xl font-semibold leading-tight md:text-6xl">
          Control de Acceso UPQROO v2
        </h1>
        <p class="mt-6 max-w-2xl text-lg leading-8 text-[#405247]">
          Base limpia para migrar acceso, QR dinamico, credenciales temporales,
          auditoria y asistencia sobre Bun, Hono, SvelteKit, PostgreSQL y Drizzle.
        </p>
      </div>

      <aside class="rounded-lg border border-[#dbe2dc] bg-white p-5 shadow-sm">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-base font-semibold">Estado de API</h2>
          <span
            class={`rounded-full px-3 py-1 text-xs font-semibold ${
              data.health ? "bg-[#dcefe5] text-[#285840]" : "bg-[#f7dedc] text-[#8c2f27]"
            }`}
          >
            {data.health ? "Activa" : "Sin conexion"}
          </span>
        </div>

        {#if data.health}
          <dl class="mt-5 grid gap-3 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-[#66756c]">Servicio</dt>
              <dd class="font-medium">{data.health.service}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-[#66756c]">Version</dt>
              <dd class="font-medium">{data.health.version}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-[#66756c]">Revision</dt>
              <dd class="font-medium">{new Date(data.health.checkedAt).toLocaleString()}</dd>
            </div>
          </dl>
        {:else}
          <p class="mt-5 text-sm leading-6 text-[#66756c]">
            Inicia el backend con <code>bun run dev:api</code> y verifica
            <code>PUBLIC_API_BASE_URL</code>.
          </p>
        {/if}
      </aside>
    </div>
  </section>
</main>
