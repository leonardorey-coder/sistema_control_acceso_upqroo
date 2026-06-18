import type { ApiHealth } from "@control-acceso/shared";
import { env } from "$env/dynamic/public";

export async function getApiHealth(fetcher: typeof fetch): Promise<ApiHealth | null> {
  try {
    const apiBaseUrl = env.PUBLIC_API_BASE_URL ?? "http://localhost:4000";
    const response = await fetcher(`${apiBaseUrl}/health`);

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}
