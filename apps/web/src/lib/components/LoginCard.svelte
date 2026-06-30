<script lang="ts">
  let {
    title = "Acceso Administrativo",
    identity = $bindable(""),
    password = $bindable(""),
    identityPlaceholder = "Usuario",
    passwordPlaceholder = "Contrasena",
    submitLabel = "Entrar",
    error = "",
    footerHref = "",
    footerLabel = "",
    onSubmit
  }: {
    title?: string;
    identity?: string;
    password?: string;
    identityPlaceholder?: string;
    passwordPlaceholder?: string;
    submitLabel?: string;
    error?: string;
    footerHref?: string;
    footerLabel?: string;
    onSubmit: () => void | Promise<void>;
  } = $props();
</script>

<main class="login-page">
  <form
    class="login-card"
    onsubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <img class="login-logo" src="/logo-universidad.png" alt="Universidad Politecnica de Quintana Roo" />
    <h1>{title}</h1>
    <label class="form-field">
      <span>{identityPlaceholder}</span>
      <input bind:value={identity} placeholder={identityPlaceholder} autocomplete="username" />
    </label>
    <label class="form-field">
      <span>{passwordPlaceholder}</span>
      <input bind:value={password} placeholder={passwordPlaceholder} type="password" autocomplete="current-password" />
    </label>
    <button>{submitLabel}</button>
    {#if footerHref && footerLabel}
      <a class="view-switch-button login-link" href={footerHref}>{footerLabel}</a>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
  </form>
</main>
