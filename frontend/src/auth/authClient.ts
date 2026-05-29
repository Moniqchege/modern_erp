export type AccessTokenPayload = {
    userId: string;
    email: string;
    role: string;
    forcePasswordReset: boolean;
};

export function getAccessToken(): string | null {
    return localStorage.getItem("accessToken");
}

export function logout() {
    localStorage.removeItem("accessToken");
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

