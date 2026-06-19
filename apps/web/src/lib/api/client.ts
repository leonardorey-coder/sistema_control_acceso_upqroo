import { env } from "$env/dynamic/public";

export type ApiResult<T> = {
  data?: T;
  error?: {
    code: string;
    message?: string;
    details?: unknown;
  };
};

export type PaginatedRows<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  summary?: Record<string, unknown>;
};

export const apiBaseUrl = env.PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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
    const message = payload.error?.message ?? payload.error?.code ?? "API request failed";
    throw new Error(message);
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
