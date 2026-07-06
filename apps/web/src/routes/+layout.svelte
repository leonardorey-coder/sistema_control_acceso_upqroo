<script lang="ts">
  import { onNavigate } from "$app/navigation";
  import "../app.css";

  let { children } = $props();

  type ViewTransitionDocument = Document & {
    startViewTransition?: (callback: () => Promise<void> | void) => void;
  };

  onNavigate((navigation) => {
    const viewTransitionDocument = document as ViewTransitionDocument;
    if (!viewTransitionDocument.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    return new Promise<void>((resolve) => {
      viewTransitionDocument.startViewTransition?.(async () => {
        resolve();
        await navigation.complete;
      });
    });
  });
</script>

{@render children()}
