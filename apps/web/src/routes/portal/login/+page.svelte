<script lang="ts">
  import { goto } from "$app/navigation";
  import { apiRequest } from "$lib/api/client";

  let identity = $state("");
  let password = $state("");
  let error = $state("");

  async function login() {
    error = "";

    try {
      await apiRequest("/api/v1/portal/auth/login", {
        method: "POST",
        body: JSON.stringify({ identity, password })
      });
      await goto("/portal");
    } catch (loginError) {
      error = loginError instanceof Error ? loginError.message : "No se pudo iniciar sesion";
    }
  }
</script>

<svelte:head>
  <title>Portal - Sistema de Control</title>
</svelte:head>

<main class="login-page">
  <form class="panel login-card" onsubmit={(event) => { event.preventDefault(); login(); }}>
    <div class="logo-mark large">UP</div>
    <h1>Portal de Usuario</h1>
    <input bind:value={identity} placeholder="Correo institucional" autocomplete="username" />
    <input bind:value={password} placeholder="Password" type="password" autocomplete="current-password" />
    <button>Entrar</button>
    <a class="view-switch" href="/">Panel administrativo</a>
    {#if error}<p class="error">{error}</p>{/if}
  </form>
</main>
