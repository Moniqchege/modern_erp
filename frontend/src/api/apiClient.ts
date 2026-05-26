import { getAccessToken } from "../auth/authClient";

export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(path, { ...init, headers });
}

export function decodeJwtPayload<T extends Record<string, unknown>>(
  token: string
): T | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
