declare namespace svelteHTML {
  interface IntrinsicElements {
    "model-viewer": {
      src?: string;
      poster?: string;
      "camera-controls"?: boolean;
      "auto-rotate"?: boolean;
      "interaction-prompt"?: string;
      loading?: "auto" | "lazy" | "eager";
      "shadow-intensity"?: string;
      ar?: boolean;
      "aria-label"?: string;
      onerror?: (event: Event) => void;
    };
  }
}
