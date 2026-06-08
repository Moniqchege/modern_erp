/**
 * Simulated "live scale" hook.
 *
 * In production, this would connect to a serial/USB scale, an
 * industrial indicator (e.g. via Web Serial API) or a vendor SDK
 * (e.g. Mettler Toledo, Cardinal). For the demo we generate a
 * smooth random walk that converges to a "stable" target weight
 * when a `stable` flag is set, then captures it as the official reading.
 *
 * Returns:
 *   - weight: current live reading (kg)
 *   - stable: whether the reading has settled
 *   - capture(): call when the operator presses "Capture" — sets a target
 *     and forces the value to converge there within a couple of seconds
 *   - reset(): clear the captured value
 */
import { useEffect, useRef, useState } from "react";

interface UseLiveScaleOptions {
  /** ms between ticks */
  intervalMs?: number;
  /** When stable, jitter shrinks to ±this many kg */
  stableJitter?: number;
  /** When unstable, jitter is ±this many kg */
  unstableJitter?: number;
}

export interface LiveScaleApi {
  weight: number;
  stable: boolean;
  capturedWeight: number | null;
  capture: (target?: number) => void;
  reset: () => void;
  manuallySet: (kg: number) => void;
}

export function useLiveScale(opts: UseLiveScaleOptions = {}): LiveScaleApi {
  const { intervalMs = 500, stableJitter = 1, unstableJitter = 80 } = opts;
  const [weight, setWeight] = useState<number>(0);
  const [stable, setStable] = useState<boolean>(false);
  const [capturedWeight, setCapturedWeight] = useState<number | null>(null);
  const targetRef = useRef<number | null>(null);
  const tickRef = useRef<number>(0);

  useEffect(() => {
    const id = setInterval(() => {
      setWeight((prev) => {
        tickRef.current += 1;
        const tgt = targetRef.current;
        // If we have a target we're "converging" to, pull 80% of the way
        let next = prev;
        if (tgt != null) {
          const delta = tgt - prev;
          next = prev + delta * 0.35;
          if (Math.abs(delta) < 0.5) {
            next = tgt;
            targetRef.current = null;
          }
        } else {
          // Free random walk
          next = prev + (Math.random() - 0.5) * unstableJitter * 0.2;
        }
        // Tiny live jitter (sensor noise)
        next = next + (Math.random() - 0.5) * 1.5;
        if (next < 0) next = 0;
        return Number(next.toFixed(2));
      });

      // Stability is true once the random walk has been calm for a few ticks
      // (or always true once converged onto a target)
      setStable((s) => {
        const tgt = targetRef.current;
        if (tgt != null) {
          // We're aiming somewhere — not yet stable
          return false;
        }
        // If random walk is small for several ticks, mark stable
        if (tickRef.current % 4 === 0) {
          return Math.random() > 0.2 ? true : s;
        }
        return s;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, stableJitter, unstableJitter]);

  const capture = (target?: number) => {
    const t = typeof target === "number" ? target : weight;
    targetRef.current = Number(t.toFixed(2));
    setStable(false);
    // Optimistically lock in the value after a short delay
    setTimeout(() => {
      setCapturedWeight(Number(t.toFixed(2)));
      setStable(true);
    }, Math.max(intervalMs * 2, 900));
  };

  const reset = () => {
    setCapturedWeight(null);
    setStable(false);
    targetRef.current = null;
  };

  const manuallySet = (kg: number) => {
    setWeight(Number(kg));
    setCapturedWeight(Number(kg));
    setStable(true);
  };

  return { weight, stable, capturedWeight, capture, reset, manuallySet };
}
