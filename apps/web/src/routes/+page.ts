import { getApiHealth } from "$lib/api/health";

export async function load({ fetch }) {
  return {
    health: await getApiHealth(fetch)
  };
}
