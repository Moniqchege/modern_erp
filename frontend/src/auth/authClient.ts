export type AccessTokenPayload = {
    userId: string;
    email: string;
    role: string;
    forcePasswordReset: boolean;
};

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_FLAG_KEY = "erp:session:refreshFailed";

export function getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function logout() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    // Use a flag so other tabs / the session manager can react and redirect
    // to the login page consistently.
    try {
        sessionStorage.setItem(REFRESH_FLAG_KEY, String(Date.now()));
    } catch {
        // ignore
    }
}

/**
 * Mark the session as expired. The session manager will pick this up and
 * redirect the user to the login page on the next tick.
 */
export function markSessionExpired() {
    try {
        sessionStorage.setItem(REFRESH_FLAG_KEY, String(Date.now()));
    } catch {
        // ignore
    }
}

export function consumeSessionExpiredSignal(): boolean {
    try {
        const v = sessionStorage.getItem(REFRESH_FLAG_KEY);
        if (v) {
            sessionStorage.removeItem(REFRESH_FLAG_KEY);
            return true;
        }
    } catch {
        // ignore
    }
    return false;
}

export function isAuthenticated(): boolean {
    return Boolean(getAccessToken());
}

/** Decode the JWT payload without verifying the signature (client-side only). */
export function getCurrentUser(): AccessTokenPayload | null {
    const token = getAccessToken();
    if (!token) return null;
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        return payload as AccessTokenPayload;
    } catch {
        return null;
    }
}

/**
 * Returns the time (in ms) until the access token expires. If the token is
 * missing or cannot be decoded, returns 0.
 */
export function getTokenExpiresAt(): number {
    const user = getCurrentUser();
    if (!user) return 0;
    // JWT `exp` is in the payload but our typed shape doesn't expose it.
    // Re-decode to grab it.
    const token = getAccessToken();
    if (!token) return 0;
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return 0;
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
    } catch {
        return 0;
    }
}
