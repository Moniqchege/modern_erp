import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getAccessToken,
  getTokenExpiresAt,
  setAccessToken,
  consumeSessionExpiredSignal,
  markSessionExpired,
} from "./authClient";

/**
 * Configuration for the in-tab session keep-alive behaviour.
 *
 * - REFRESH_INTERVAL_MS: how often the manager wakes up to evaluate whether
 *   the token should be refreshed.
 * - REFRESH_LEAD_MS: how long before the token actually expires we attempt
 *   to refresh it.
 * - ACTIVITY_EVENTS: events that count as the user "actively using" the
 *   system. Any of these will reset the inactivity timer.
 * - INACTIVITY_TIMEOUT_MS: if the user is inactive for this long, we stop
 *   refreshing the token and let it expire naturally. After the next 401
 *   the user will be redirected to the login page.
 */
const REFRESH_INTERVAL_MS = 30_000; // check every 30 seconds
const REFRESH_LEAD_MS = 60_000;     // refresh 60s before expiry
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
  "wheel",
];

/**
 * Mount this hook once near the top of the React tree (e.g. in AppRouter).
 *
 * Behaviour:
 *  1. Listens for mouse/keyboard activity to detect that the user is "actively
 *     using" the system.
 *  2. Periodically calls /api/auth/refresh so that the access token is renewed
 *     as long as the user is active. The token therefore only ever expires if
 *     the user walks away.
 *  3. If the backend signals a session expiry (via 401 on a protected route
 *     or via the local "session expired" signal), the user is redirected to
 *     /login.
 */
export function useSessionManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const lastActivityRef = useRef<number>(Date.now());

  // Track user activity so we know when the user is "actively using" the app.
  useEffect(() => {
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, onActivity, { passive: true });
    }
    return () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, onActivity);
      }
    };
  }, []);

  // Redirect to /login when something marks the session as expired.
  useEffect(() => {
    const checkExpired = () => {
      if (consumeSessionExpiredSignal()) {
        // If we got an expiry signal, clear the token and go to login.
        try {
          localStorage.removeItem("accessToken");
        } catch {
          // ignore
        }
        const path = location.pathname + location.search;
        navigate(`/login?from=${encodeURIComponent(path)}`, { replace: true });
      }
    };

    // Check on every render and on focus/visibility changes.
    checkExpired();
    const onFocus = () => checkExpired();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkExpired();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [navigate, location.pathname, location.search]);

  // Periodic refresh while the user is active.
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return; // don't hit the network while the tab is hidden
      }

      const token = getAccessToken();
      if (!token) return;

      const inactiveFor = Date.now() - lastActivityRef.current;
      if (inactiveFor > INACTIVITY_TIMEOUT_MS) {
        // User has been idle longer than the threshold; let the token
        // expire naturally. Next protected call will 401 → redirect.
        return;
      }

      const expiresAt = getTokenExpiresAt();
      if (!expiresAt) return;

      const msUntilExpiry = expiresAt - Date.now();
      if (msUntilExpiry > REFRESH_LEAD_MS) {
        return; // token is still fresh, nothing to do
      }

      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!res.ok) {
          markSessionExpired();
          return;
        }
        const json = (await res.json()) as {
          success: boolean;
          accessToken?: string;
        };
        if (json.success && json.accessToken) {
          setAccessToken(json.accessToken);
        } else {
          markSessionExpired();
        }
      } catch {
        // Network error — we'll try again on the next tick.
      }
    };

    // Run once immediately and then on the interval.
    void tick();
    const id = window.setInterval(tick, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
}
