import { env } from "$env/dynamic/public";
import type { PaginatedResponse } from "@control-acceso/shared";

export type ApiResult<T> = {
  data?: T;
  error?: {
    code: string;
    message?: string;
    details?: unknown;
  };
};

export type PaginatedRows<T> = PaginatedResponse<T>;

export const apiBaseUrl = env.PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const apiMessages: Record<string, string> = {
  INVALID_CREDENTIALS: "Usuario o contrasena incorrectos.",
  LOGIN_TEMPORARILY_LOCKED: "Demasiados intentos fallidos. Espera antes de volver a intentar.",
  VALIDATION_ERROR: "Revisa los datos del formulario.",
  INVALID_JSON: "La solicitud enviada no es valida.",
  SESSION_REQUIRED: "Tu sesion expiro. Inicia sesion nuevamente.",
  SESSION_INVALID: "Tu sesion expiro. Inicia sesion nuevamente.",
  USER_SESSION_REQUIRED: "Tu sesion expiro. Inicia sesion nuevamente.",
  USER_SESSION_INVALID: "Tu sesion expiro. Inicia sesion nuevamente.",
  SUPER_ADMIN_REQUIRED: "Esta accion requiere una sesion de super administrador.",
  INTERNAL_ERROR: "Ocurrio un error inesperado en el servidor."
};

function notifySessionExpired(code?: string) {
  if (!code?.includes("SESSION")) return;
  globalThis.window?.dispatchEvent(new CustomEvent("control-acceso:session-expired", { detail: { code } }));
}

function errorMessage(code?: string, fallback?: string, details?: unknown) {
  const base = code ? apiMessages[code] ?? fallback ?? code : fallback ?? "No se pudo completar la solicitud.";
  if (code === "INVALID_CREDENTIALS" && details && typeof details === "object" && "remainingAttempts" in details) {
    const remaining = Number((details as { remainingAttempts?: unknown }).remainingAttempts);
    if (Number.isFinite(remaining) && remaining > 0) {
      return `${base} Intentos restantes: ${remaining}.`;
    }
    if (remaining === 0) {
      return `${base} La cuenta queda bloqueada temporalmente para nuevos intentos.`;
    }
  }
  if (code === "LOGIN_TEMPORARILY_LOCKED" && details && typeof details === "object" && "retryAfterMs" in details) {
    const retryAfterMs = Number((details as { retryAfterMs?: unknown }).retryAfterMs);
    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      return `${base} Intenta de nuevo en ${Math.ceil(retryAfterMs / 60000)} min.`;
    }
  }
  return base;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  fetcher: typeof fetch = fetch
): Promise<T> {
  const headers = new Headers(init.headers);

  if (!(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  const response = await fetcher(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers
  });
  const payload = await response.json().catch(() => ({})) as ApiResult<T>;

  if (!response.ok || payload.error) {
    notifySessionExpired(payload.error?.code);
    const message = errorMessage(payload.error?.code, payload.error?.message, payload.error?.details);
    throw Object.assign(new Error(message), {
      code: payload.error?.code,
      details: payload.error?.details,
      status: response.status
    });
  }

  return payload.data as T;
}

export function toQuery(input: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
