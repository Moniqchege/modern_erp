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

