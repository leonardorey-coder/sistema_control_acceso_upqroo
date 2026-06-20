<script lang="ts">
  import { goto } from "$app/navigation";
  import LoginCard from "$lib/components/LoginCard.svelte";
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

<LoginCard
  bind:identity
  bind:password
  title="Portal de Usuario"
  identityPlaceholder="Correo institucional"
  passwordPlaceholder="Contrasena"
  footerHref="/"
  footerLabel="Panel administrativo"
  {error}
  onSubmit={login}
/>
