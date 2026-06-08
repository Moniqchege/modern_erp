/**
 * Shared footer action row used by all three weighbridge screens.
 * Save Pending (Step 1) / Complete Ticket (Step 2) / Cancel Ticket.
 */
import React from "react";
import { Loader2, Save, CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Props {
  isResuming: boolean;
  hasFirstWeight: boolean;
  hasSecondWeight: boolean;
  submitting: boolean;
  step1Label: string;
  step2Label: string;
  onReset: () => void;
  onCancel: () => void;
  onSavePending: () => void;
  onComplete: () => void;
}

export function WeighbridgeFooterActions({
  isResuming,
  hasFirstWeight,
  hasSecondWeight,
  submitting,
  step1Label,
  step2Label,
  onReset,
  onCancel,
  onSavePending,
  onComplete,
}: Props) {
  return (
    <section className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onReset}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 active:scale-95"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={submitting}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100 active:scale-95 disabled:opacity-60"
      >
        <XCircle className="h-3.5 w-3.5" />
        Cancel Ticket
      </button>
      <button
        type="button"
        onClick={onSavePending}
        disabled={submitting || isResuming || !hasFirstWeight}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold hover:bg-amber-100 active:scale-95 disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        {step1Label}
      </button>
      <button
        type="button"
        onClick={onComplete}
        disabled={submitting || !isResuming || !hasSecondWeight}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-extrabold shadow hover:bg-emerald-700 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        {step2Label}
      </button>
    </section>
  );
}
