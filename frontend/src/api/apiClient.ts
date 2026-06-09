import {
  getAccessToken,
  setAccessToken,
  markSessionExpired,
} from "../auth/authClient";

/**
 * Public endpoints that must not trigger the "session expired" redirect when
 * they return 401. Everything else is treated as a session-expiry signal
 * and will redirect the user to the login page.
 */
const PUBLIC_PATHS = [
  "/api/auth/login",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/force-reset",
  "/api/auth/request-password-reset",
  "/api/auth/reset-password",
  "/api/auth/seed",
];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`));
}

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

  const response = await fetch(path, { ...init, headers });

  // If the server tells us our token is invalid/expired and we're not
  // already on a public auth endpoint, treat that as a session expiry.
  if (response.status === 401 && !isPublicPath(path)) {
    markSessionExpired();
  }

  return response;
}

/**
 * Wraps apiFetch with a single retry: if the call fails with 401 (token
 * expired), attempts to refresh the token via /api/auth/refresh and replays
 * the original request. Returns null if the refresh also fails so the caller
 * can show a friendly error.
 */
export async function apiFetchWithRefresh(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await apiFetch(path, init);
  if (res.status !== 401 || isPublicPath(path)) {
    return res;
  }

  const refreshed = await tryRefreshToken();
  if (!refreshed) {
    return res;
  }

  // Replay the original request with the new token.
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

let inflightRefresh: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const current = getAccessToken();
  if (!current) return false;

  // Coalesce parallel callers so we only ever have one refresh in flight.
  if (inflightRefresh) return inflightRefresh;

  inflightRefresh = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${current}`,
        },
      });
      if (!res.ok) {
        markSessionExpired();
        return false;
      }
      const json = (await res.json()) as {
        success: boolean;
        accessToken?: string;
      };
      if (!json.success || !json.accessToken) {
        markSessionExpired();
        return false;
      }
      setAccessToken(json.accessToken);
      return true;
    } catch {
      markSessionExpired();
      return false;
    } finally {
      inflightRefresh = null;
    }
  })();

  return inflightRefresh;
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
