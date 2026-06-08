/**
 * Large, prominent digital scale readout used by all three weighing screens.
 * Renders the live value, a stability indicator, and optional capture button.
 */
import React from "react";
import { Scale, Loader2, Hand, Lock } from "lucide-react";
import type { LiveScaleApi } from "../liveScale";

interface ScaleReadoutProps {
  scale: LiveScaleApi;
  /** Label shown above the reading, e.g. "First Weight (Gross)" */
  label?: string;
  /** Whether this is the active capture target */
  active?: boolean;
  /** Trigger a capture; the button is disabled if scale is unstable */
  onCapture?: () => void;
  /** Allow manual override of the scale value */
  showManualEntry?: boolean;
  /** Manual override callback */
  onManualSet?: (kg: number) => void;
  /** Accent color */
  accent?: "emerald" | "indigo" | "amber";
}

const ACCENT_BG: Record<NonNullable<ScaleReadoutProps["accent"]>, string> = {
  emerald: "from-emerald-600 to-teal-700 shadow-emerald-600/30",
  indigo: "from-indigo-600 to-blue-700 shadow-indigo-600/30",
  amber: "from-amber-500 to-orange-600 shadow-amber-500/30",
};

const ACCENT_RING: Record<NonNullable<ScaleReadoutProps["accent"]>, string> = {
  emerald: "ring-emerald-200",
  indigo: "ring-indigo-200",
  amber: "ring-amber-200",
};

export function ScaleReadout({
  scale,
  label = "Live Weight",
  active = false,
  onCapture,
  showManualEntry = true,
  onManualSet,
  accent = "emerald",
}: ScaleReadoutProps) {
  const { weight, stable, capturedWeight, capture, manuallySet } = scale;
  return (
    <div
      className={`relative rounded-2xl border bg-slate-900 text-white overflow-hidden shadow-lg ${
        active ? `ring-4 ${ACCENT_RING[accent]}` : ""
      }`}
    >
      {/* Background glow */}
      <div
        className={`absolute -inset-1 bg-gradient-to-br ${ACCENT_BG[accent]} opacity-25 blur-2xl pointer-events-none`}
      />
      <div className="relative p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-extrabold tracking-widest uppercase text-slate-300">
            <Scale className="h-3.5 w-3.5" />
            {label}
          </div>
          <div className="flex items-center gap-1.5">
            {stable ? (
              <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                STABLE
              </span>
            ) : (
              <span className="flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md text-[10px] font-bold">
                <Loader2 className="h-3 w-3 animate-spin" />
                READING…
              </span>
            )}
          </div>
        </div>

        {/* Digital readout */}
        <div className="text-center font-mono font-black tracking-tight tabular-nums">
          <span className="text-6xl text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.25)]">
            {Number(weight).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
          <span className="ml-2 text-base text-slate-400 font-bold">kg</span>
        </div>

        {/* Captured badge */}
        {capturedWeight != null && (
          <div className="flex items-center justify-center gap-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-200 rounded-lg py-1.5 text-xs font-bold">
            <Lock className="h-3 w-3" />
            Captured: {capturedWeight.toLocaleString()} kg
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2">
          {onCapture && (
            <button
              type="button"
              onClick={() => capture()}
              disabled={!stable}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-extrabold transition-all ${
                stable
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white active:scale-95"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              }`}
              title={stable ? "Capture current weight" : "Scale not stable"}
            >
              <Lock className="h-3.5 w-3.5" />
              Capture
            </button>
          )}
          {showManualEntry && (
            <ManualOverride
              onSet={(kg) => {
                manuallySet(kg);
                onManualSet?.(kg);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ManualOverride({ onSet }: { onSet: (kg: number) => void }) {
  const [open, setOpen] = React.useState(false);
  const [val, setVal] = React.useState("");

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-all"
        title="Enter weight manually (flagged as manual entry)"
      >
        <Hand className="h-3.5 w-3.5" />
        Manual
      </button>
      {open && (
        <div className="absolute right-5 top-full mt-2 z-30 w-64 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-200 p-3 space-y-2">
          <label className="block text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            Manual override (kg)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g. 12500.00"
            className="w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                const n = Number(val);
                if (!isNaN(n) && n >= 0) {
                  onSet(n);
                  setOpen(false);
                  setVal("");
                }
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-1.5 rounded-md"
            >
              Set
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold py-1.5 rounded-md"
            >
              Cancel
            </button>
          </div>
          <p className="text-[9px] text-amber-600 leading-tight">
            Manual values are persisted with <code>is_manual = TRUE</code> and
            highlighted in red on the activities log.
          </p>
        </div>
      )}
    </>
  );
}
