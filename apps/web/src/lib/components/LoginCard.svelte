<script lang="ts">
  let {
    title = "Acceso Administrativo",
    identity = $bindable(""),
    password = $bindable(""),
    identityPlaceholder = "Usuario",
    passwordPlaceholder = "Contrasena",
    identityExample = "tuAdminID",
    passwordExample = "TuPassword2026",
    submitLabel = "Entrar",
    submitting = false,
    accessGranted = false,
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
    identityExample?: string;
    passwordExample?: string;
    submitLabel?: string;
    submitting?: boolean;
    accessGranted?: boolean;
    error?: string;
    footerHref?: string;
    footerLabel?: string;
    onSubmit: () => void | Promise<void>;
  } = $props();

  const requiredMessage = "Este campo es obligatorio.";

  function clearValidity(event: Event) {
    (event.currentTarget as HTMLInputElement).setCustomValidity("");
  }

  function requireField(event: Event) {
    (event.currentTarget as HTMLInputElement).setCustomValidity(requiredMessage);
  }
</script>

<main class="login-page">
  <form
    class="login-card"
    class:submitting
    class:access-granted={accessGranted}
    aria-busy={submitting}
    onsubmit={(event) => {
      event.preventDefault();
      onSubmit();
    }}
  >
    <img class="login-logo" src="/logo-universidad.png" alt="Universidad Politecnica de Quintana Roo" />
    <h1>{title}</h1>
    <label class="form-field">
      <span>{identityPlaceholder}</span>
      <input
        bind:value={identity}
        placeholder={identityExample}
        autocomplete="username"
        required
        aria-required="true"
        oninvalid={requireField}
        oninput={clearValidity}
      />
    </label>
    <label class="form-field">
      <span>{passwordPlaceholder}</span>
      <input
        bind:value={password}
        placeholder={passwordExample}
        type="password"
        autocomplete="current-password"
        required
        aria-required="true"
        oninvalid={requireField}
        oninput={clearValidity}
      />
    </label>
    <button disabled={submitting || accessGranted}>{accessGranted ? "Acceso concedido" : submitting ? "Validando..." : submitLabel}</button>
    {#if submitting || accessGranted}
      <p class="login-progress" aria-live="polite">{accessGranted ? "Abriendo panel administrativo" : "Verificando credenciales"}</p>
    {/if}
    {#if footerHref && footerLabel}
      <a class="view-switch-button login-link" href={footerHref}>{footerLabel}</a>
    {/if}
    {#if error}<p class="error">{error}</p>{/if}
  </form>
</main>
