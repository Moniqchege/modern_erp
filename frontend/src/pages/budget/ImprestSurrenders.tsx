import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import { Compass, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { decodeJwtPayload } from "../../api/apiClient";
import { getAccessToken } from "../../auth/authClient";

interface Surrender {
  id: string;
  surrenderNo: string;
  surrenderDate: string;
  actualSpent: string | number;
  refundAmount: string | number;
  receiptUrl?: string;
  status: string;
  verifiedAt?: string;
  verifiedBy?: { name: string };
  rejectionReason?: string;
  imprestRequest: {
    requestNo: string;
    amount: string | number;
    purpose: string;
    requester: { name: string };
    budget: { category: { name: string } };
  };
}

export function ImprestSurrenders() {
  const [surrenders, setSurrenders] = useState<Surrender[]>([]);
  const [loading, setLoading] = useState(true);
  const [userContext, setUserContext] = useState<{ userId: string; role: string } | null>(null);

  // Verification Form states
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [selectedSurrender, setSelectedSurrender] = useState<Surrender | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    // Decode user
    const token = getAccessToken();
    if (token) {
      const decoded = decodeJwtPayload<{ userId: string; role: string }>(token);
      setUserContext(decoded);
    }

    loadSurrenders();
  }, []);

  async function loadSurrenders() {
    try {
      setLoading(true);
      const res = await apiFetch("/api/budget/surrenders");
      if (res.ok) {
        const data = await res.json();
        setSurrenders(data.surrenders);
      }
    } catch (err) {
      console.error("Error loading surrenders:", err);
    } finally {
      setLoading(false);
    }
  }

  const handleVerification = async (approve: boolean) => {
    if (!selectedSurrender) return;
    setFormError("");
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/budget/surrenders/${selectedSurrender.id}/verify`, {
        method: "POST",
        body: JSON.stringify({
          approve,
          reason: !approve ? rejectReason : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to process verification");
      }

      setShowVerifyModal(false);
      setSelectedSurrender(null);
      setRejectReason("");
      loadSurrenders();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    let color = "bg-slate-100 text-slate-650 border-slate-200/50";
    if (status === "PENDING") color = "bg-amber-50 text-amber-700 border-amber-200/50";
    if (status === "APPROVED") color = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    if (status === "REJECTED") color = "bg-rose-50 text-rose-700 border-rose-200/50";

    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full uppercase ${color}`}>
        {status}
      </span>
    );
  };

  const canVerify = userContext && (userContext.role === "ADMIN" || userContext.role === "SUPERADMIN" || userContext.role === "FINANCE_DIRECTOR");

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Imprest Surrenders</h1>
        <p className="text-xs text-slate-500 mt-1">
          Review and audit petty cash surrender claims, verify spent receipts, and reconcile unused cash.
        </p>
      </div>

      {/* SURRENDERS LIST */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-sm font-bold text-slate-900">Receipt Surrenders Queue</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/70">
                <th className="p-4 uppercase tracking-wider text-[10px]">Surrender No</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Claimant</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Claim (JE Ref)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right">Imprest Paid (KES)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right">Actual Spent (KES)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right">Refund Amount (KES)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-center">Status</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Date Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">Loading surrenders...</td>
                </tr>
              ) : surrenders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400 font-medium">No petty cash surrenders submitted.</td>
                </tr>
              ) : (
                surrenders.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => {
                      setSelectedSurrender(s);
                      setShowVerifyModal(true);
                    }}
                    className="hover:bg-slate-50/60 transition cursor-pointer"
                  >
                    <td className="p-4 font-mono font-bold text-slate-900">{s.surrenderNo}</td>
                    <td className="p-4 font-bold text-slate-800">{s.imprestRequest.requester.name}</td>
                    <td className="p-4">
                      <span className="font-bold text-slate-700">{s.imprestRequest.requestNo}</span>
                      <span className="text-[10px] text-slate-400 block truncate max-w-[150px]">{s.imprestRequest.purpose}</span>
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-850">
                      {Number(s.imprestRequest.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right font-bold text-rose-650">
                      {Number(s.actualSpent).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right font-bold text-emerald-650">
                      {Number(s.refundAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">{getStatusBadge(s.status)}</td>
                    <td className="p-4 text-slate-400 font-medium">{new Date(s.surrenderDate).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VERIFY MODAL */}
      {showVerifyModal && selectedSurrender && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4 max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Verify Surrender {selectedSurrender.surrenderNo}</h3>
              <button
                onClick={() => {
                  setShowVerifyModal(false);
                  setSelectedSurrender(null);
                  setRejectReason("");
                  setFormError("");
                }}
                className="text-slate-400 hover:text-slate-600 font-bold text-sm"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* DETAILS CONTAINER */}
            <div className="space-y-3.5 text-xs font-bold text-slate-750">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[9px] text-slate-400 block uppercase">Claimant</span>
                <span className="text-slate-800">{selectedSurrender.imprestRequest.requester.name}</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-2.5 rounded-xl">
                  <span className="text-[9px] text-slate-400 block uppercase">Imprest Paid</span>
                  <span>KES {Number(selectedSurrender.imprestRequest.amount).toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl">
                  <span className="text-[9px] text-slate-400 block uppercase">Spent</span>
                  <span className="text-rose-600">KES {Number(selectedSurrender.actualSpent).toLocaleString()}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-xl">
                  <span className="text-[9px] text-slate-400 block uppercase">Refunded</span>
                  <span className="text-emerald-700">KES {Number(selectedSurrender.refundAmount).toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[9px] text-slate-400 block uppercase">Purpose</span>
                <p className="text-slate-650 font-semibold leading-relaxed mt-0.5">{selectedSurrender.imprestRequest.purpose}</p>
              </div>

              {selectedSurrender.receiptUrl && (
                <div className="bg-slate-50 p-3 rounded-xl">
                  <span className="text-[9px] text-slate-400 block uppercase">Receipt Doc URL</span>
                  <a
                    href={selectedSurrender.receiptUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 underline font-semibold font-mono text-[10px] break-all block mt-0.5"
                  >
                    {selectedSurrender.receiptUrl}
                  </a>
                </div>
              )}

              {selectedSurrender.verifiedBy && (
                <div className="text-[10px] text-slate-400">
                  Verified by {selectedSurrender.verifiedBy.name} {selectedSurrender.verifiedAt ? `at ${new Date(selectedSurrender.verifiedAt).toLocaleString()}` : ""}
                </div>
              )}

              {selectedSurrender.rejectionReason && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl space-y-1">
                  <span className="font-bold">Rejection Feedback:</span>
                  <p className="font-semibold">{selectedSurrender.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* ACTION TRIGGERS */}
            {selectedSurrender.status === "PENDING" && canVerify && (
              <div className="border-t border-slate-100 pt-4 space-y-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => handleVerification(true)}
                    disabled={submitting}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/10"
                  >
                    Approve Surrender
                  </button>
                  <button
                    onClick={() => handleVerification(false)}
                    disabled={submitting || !rejectReason}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-250 text-white p-2.5 rounded-xl font-bold text-xs shadow-md"
                  >
                    Reject Surrender
                  </button>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Rejection Feedback (Required if rejecting)</label>
                  <textarea
                    placeholder="Describe audit issues or request receipt corrections"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs font-bold focus:outline-none focus:border-indigo-500 h-16"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
