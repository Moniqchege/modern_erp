import React, { useEffect, useState } from "react";
import { apiFetch } from "../../api/apiClient";
import { Plus, Wallet, FileText, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { decodeJwtPayload } from "../../api/apiClient";
import { getAccessToken } from "../../auth/authClient";

interface ImprestRequest {
  id: string;
  requestNo: string;
  requesterId: string;
  requester: { id: string; name: string; email: string };
  department: string;
  amount: string | number;
  purpose: string;
  status: string;
  approvedAt?: string;
  approver?: { name: string };
  disbursementDate?: string;
  paymentMethod?: string;
  referenceNo?: string;
  rejectionReason?: string;
  createdAt: string;
  budget: {
    id: string;
    department: string;
    category: { name: string; code: string };
    period: { name: string };
  };
  surrender?: {
    id: string;
    surrenderNo: string;
    actualSpent: string | number;
    refundAmount: string | number;
    receiptUrl?: string;
    status: string;
    verifiedBy?: { name: string };
    rejectionReason?: string;
  };
}

interface BudgetAllocation {
  id: string;
  department: string;
  totalAllocation: string | number;
  spentAmount: string | number;
  committedAmount: string | number;
  category: { name: string; code: string };
  period: { name: string; status: string };
}

export function ImprestRequests() {
  const [requests, setRequests] = useState<ImprestRequest[]>([]);
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("ALL");

  // Auth User Details
  const [userContext, setUserContext] = useState<{ userId: string; role: string } | null>(null);

  // Modals
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ImprestRequest | null>(null);

  // Request Form
  const [reqForm, setReqForm] = useState({ department: "", budgetId: "", amount: "", purpose: "" });

  // Disbursement Form
  const [disburseForm, setDisburseForm] = useState({ paymentMethod: "CASH", referenceNo: "" });
  const [showDisbursePanel, setShowDisbursePanel] = useState(false);

  // Surrender Form
  const [surrenderForm, setSurrenderForm] = useState({ actualSpent: "", receiptUrl: "" });
  const [showSurrenderPanel, setShowSurrenderPanel] = useState(false);

  // Reject Form
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectPanel, setShowRejectPanel] = useState(false);

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Decode user
    const token = getAccessToken();
    if (token) {
      const decoded = decodeJwtPayload<{ userId: string; role: string }>(token);
      setUserContext(decoded);
    }

    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [rRes, aRes] = await Promise.all([
        apiFetch("/api/budget/imprests"),
        apiFetch("/api/budget/allocations"),
      ]);

      if (rRes.ok && aRes.ok) {
        const rData = await rRes.json();
        const aData = await aRes.json();
        setRequests(rData.imprests);
        // Only active budget allocations can be requested
        setAllocations(aData.allocations.filter((a: BudgetAllocation) => a.period.status === "ACTIVE"));
      }
    } catch (err) {
      console.error("Error loading imprest requests:", err);
    } finally {
      setLoading(false);
    }
  }

  // Submit New Request
  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/budget/imprests", {
        method: "POST",
        body: JSON.stringify({
          department: reqForm.department,
          budgetId: reqForm.budgetId,
          amount: Number(reqForm.amount),
          purpose: reqForm.purpose,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to submit request");
      }
      setShowRequestModal(false);
      setReqForm({ department: "", budgetId: "", amount: "", purpose: "" });
      loadData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Workflow Actions
  const triggerWorkflowAction = async (action: "approve" | "reject" | "disburse" | "surrender") => {
    if (!selectedRequest) return;
    setFormError("");
    setSubmitting(true);
    try {
      let url = `/api/budget/imprests/${selectedRequest.id}/${action}`;
      let body: any = {};

      if (action === "reject") {
        body.reason = rejectReason;
      } else if (action === "disburse") {
        body = disburseForm;
      } else if (action === "surrender") {
        body = {
          actualSpent: Number(surrenderForm.actualSpent),
          receiptUrl: surrenderForm.receiptUrl,
        };
      }

      const res = await apiFetch(url, {
        method: "POST",
        body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to perform action: ${action}`);
      }

      // Refresh Detail View & List
      setShowDisbursePanel(false);
      setShowSurrenderPanel(false);
      setShowRejectPanel(false);
      setRejectReason("");
      setSurrenderForm({ actualSpent: "", receiptUrl: "" });
      
      // Load individual item detail
      const detailRes = await apiFetch(`/api/budget/imprests/${selectedRequest.id}`);
      if (detailRes.ok) {
        const detailData = await detailRes.json();
        setSelectedRequest(detailData.imprest);
      }
      
      loadData();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter((r) => {
    if (activeTab === "ALL") return true;
    if (activeTab === "PENDING") return r.status === "PENDING_APPROVAL";
    if (activeTab === "APPROVED") return r.status === "APPROVED";
    if (activeTab === "DISBURSED") return r.status === "DISBURSED";
    if (activeTab === "SURRENDERED") return r.status === "SURRENDERED";
    if (activeTab === "REJECTED") return r.status === "REJECTED";
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return <Clock className="h-4 w-4 text-amber-500" />;
      case "APPROVED":
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
      case "DISBURSED":
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case "SURRENDERED":
        return <CheckCircle className="h-4 w-4 text-purple-500" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-rose-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    let color = "bg-slate-100 text-slate-650 border-slate-200/50";
    if (status === "PENDING_APPROVAL") color = "bg-amber-50 text-amber-700 border-amber-200/50";
    if (status === "APPROVED") color = "bg-blue-50 text-blue-700 border-blue-200/50";
    if (status === "DISBURSED") color = "bg-emerald-50 text-emerald-700 border-emerald-200/50";
    if (status === "SURRENDERED") color = "bg-purple-50 text-purple-700 border-purple-200/50";
    if (status === "REJECTED") color = "bg-rose-50 text-rose-700 border-rose-200/50";

    return (
      <span className={`text-[9px] font-bold px-2 py-0.5 border rounded-full uppercase ${color}`}>
        {status.replace("_", " ")}
      </span>
    );
  };

  const canApproveReject = userContext && (userContext.role === "ADMIN" || userContext.role === "SUPERADMIN" || userContext.role === "FINANCE_DIRECTOR" || userContext.role === "MANAGER");
  const canDisburse = userContext && (userContext.role === "ADMIN" || userContext.role === "SUPERADMIN" || userContext.role === "FINANCE_DIRECTOR");

  return (
    <div className="space-y-6">
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Imprest Requests</h1>
          <p className="text-xs text-slate-500 mt-1">
            Request and approve petty cash funds from department budgets.
          </p>
        </div>

        <button
          onClick={() => setShowRequestModal(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition"
        >
          <Plus className="h-4 w-4" />
          <span>New Imprest Claim</span>
        </button>
      </div>

      {/* FILTER TABS */}
      <div className="bg-white border border-slate-200 p-2.5 rounded-2xl shadow-sm flex flex-wrap gap-2">
        {["ALL", "PENDING", "APPROVED", "DISBURSED", "SURRENDERED", "REJECTED"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === tab
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* REQUESTS LIST */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50/70">
                <th className="p-4 uppercase tracking-wider text-[10px]">Claim Number</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Claimant</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Dept / Budget Line</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Purpose</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-right">Amount (KES)</th>
                <th className="p-4 uppercase tracking-wider text-[10px] text-center">Status</th>
                <th className="p-4 uppercase tracking-wider text-[10px]">Date Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">Loading claims...</td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    No imprest claims matching selected status.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => {
                      setSelectedRequest(r);
                      setShowDetailModal(true);
                    }}
                    className="hover:bg-slate-50/60 transition cursor-pointer"
                  >
                    <td className="p-4 font-mono font-bold text-slate-900">{r.requestNo}</td>
                    <td className="p-4">
                      <span className="font-bold text-slate-800">{r.requester.name}</span>
                      <span className="text-[10px] text-slate-400 block">{r.requester.email}</span>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-slate-700">{r.department}</span>
                      <span className="text-[10px] text-slate-400 block">
                        {r.budget.category.name} ({r.budget.period.name})
                      </span>
                    </td>
                    <td className="p-4 text-slate-650 max-w-[200px] truncate">{r.purpose}</td>
                    <td className="p-4 text-right font-black text-slate-900">
                      {Number(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-center">{getStatusBadge(r.status)}</td>
                    <td className="p-4 text-slate-400 font-medium">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* NEW CLAIM MODAL */}
      {showRequestModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-900 text-sm">Submit Petty Cash Claim</h3>
              <button onClick={() => setShowRequestModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRequestSubmit} className="space-y-4 text-xs font-bold text-slate-700">
              <div className="space-y-1">
                <label>Department</label>
                <select
                  required
                  value={reqForm.department}
                  onChange={(e) => setReqForm({ ...reqForm, department: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Department --</option>
                  <option value="Administration">Administration</option>
                  <option value="Sales">Sales</option>
                  <option value="Procurement">Procurement</option>
                  <option value="Production">Production</option>
                  <option value="Milling">Milling</option>
                  <option value="Logistics">Logistics</option>
                </select>
              </div>

              <div className="space-y-1">
                <label>Target Budget Line (Active)</label>
                <select
                  required
                  value={reqForm.budgetId}
                  onChange={(e) => setReqForm({ ...reqForm, budgetId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Budget Line --</option>
                  {allocations.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.department} • {a.category.name} ({a.period.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label>Request Amount (KES)</label>
                <input
                  type="number"
                  required
                  placeholder="5000"
                  value={reqForm.amount}
                  onChange={(e) => setReqForm({ ...reqForm, amount: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label>Purpose</label>
                <textarea
                  required
                  placeholder="Purpose of request (e.g. transport, repair parts, office snacks)"
                  value={reqForm.purpose}
                  onChange={(e) => setReqForm({ ...reqForm, purpose: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-indigo-500 h-24"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 text-white p-2.5 rounded-xl text-xs font-bold hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                {submitting ? "Submitting..." : "Submit Petty Cash Claim"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS VIEW MODAL */}
      {showDetailModal && selectedRequest && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <h3 className="font-bold text-slate-900 text-sm">{selectedRequest.requestNo}</h3>
                {getStatusBadge(selectedRequest.status)}
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setSelectedRequest(null);
                  setShowDisbursePanel(false);
                  setShowSurrenderPanel(false);
                  setShowRejectPanel(false);
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

            {/* DETAILS CARDS */}
            <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-700">
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Claimant</span>
                <span className="text-slate-800 mt-0.5 block">{selectedRequest.requester.name}</span>
                <span className="text-[10px] text-slate-400 font-medium">{selectedRequest.requester.email}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Claim Amount</span>
                <span className="text-slate-950 mt-0.5 block text-sm font-black">
                  KES {Number(selectedRequest.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Department</span>
                <span className="text-slate-800 mt-0.5 block">{selectedRequest.department}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Budget Line</span>
                <span className="text-slate-800 mt-0.5 block truncate">
                  {selectedRequest.budget.category.name}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">({selectedRequest.budget.period.name})</span>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl text-xs">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Purpose</span>
              <p className="text-slate-700 font-semibold mt-1 leading-relaxed">{selectedRequest.purpose}</p>
            </div>

            {/* LOG DETAILS */}
            <div className="border-t border-slate-100 pt-3 space-y-2 text-[10px] font-bold text-slate-400">
              <div className="flex justify-between">
                <span>Date Created:</span>
                <span className="text-slate-700">{new Date(selectedRequest.createdAt).toLocaleString()}</span>
              </div>
              {selectedRequest.approver && (
                <div className="flex justify-between">
                  <span>Approved By:</span>
                  <span className="text-slate-700">
                    {selectedRequest.approver.name} {selectedRequest.approvedAt ? `at ${new Date(selectedRequest.approvedAt).toLocaleString()}` : ""}
                  </span>
                </div>
              )}
              {selectedRequest.disbursementDate && (
                <div className="flex justify-between">
                  <span>Disbursement Paid:</span>
                  <span className="text-slate-750">
                    {new Date(selectedRequest.disbursementDate).toLocaleString()} via {selectedRequest.paymentMethod}
                    {selectedRequest.referenceNo ? ` (Ref: ${selectedRequest.referenceNo})` : ""}
                  </span>
                </div>
              )}
              {selectedRequest.rejectionReason && (
                <div className="bg-rose-50 border border-rose-100 text-rose-700 p-3 rounded-xl text-xs space-y-1">
                  <span className="font-bold">Rejection Reason:</span>
                  <p className="font-semibold">{selectedRequest.rejectionReason}</p>
                </div>
              )}
            </div>

            {/* SURRENDER LOG */}
            {selectedRequest.surrender && (
              <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl space-y-2.5 text-xs text-slate-700 font-bold">
                <div className="flex justify-between items-center border-b border-purple-100/50 pb-2">
                  <span className="text-purple-800">Surrender Receipt ({selectedRequest.surrender.surrenderNo})</span>
                  <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                    {selectedRequest.surrender.status}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[9px] text-slate-400 block">Actual Spent</span>
                    <span className="text-slate-900">KES {Number(selectedRequest.surrender.actualSpent).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 block">Refund Unused Funds</span>
                    <span className="text-emerald-700">KES {Number(selectedRequest.surrender.refundAmount).toLocaleString()}</span>
                  </div>
                </div>
                {selectedRequest.surrender.receiptUrl && (
                  <div>
                    <span className="text-[9px] text-slate-400 block">Receipt Attachment URL</span>
                    <span className="text-indigo-600 truncate block font-mono text-[10px]">{selectedRequest.surrender.receiptUrl}</span>
                  </div>
                )}
                {selectedRequest.surrender.verifiedBy && (
                  <div className="text-[9px] text-slate-400 font-medium">
                    Verified by {selectedRequest.surrender.verifiedBy.name}
                  </div>
                )}
              </div>
            )}

            {/* WORKFLOW CONTROLS PANEL */}
            <div className="border-t border-slate-100 pt-4 flex flex-col gap-3">
              {/* Approving/Rejecting workflow triggers */}
              {selectedRequest.status === "PENDING_APPROVAL" && canApproveReject && !showRejectPanel && (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => triggerWorkflowAction("approve")}
                    disabled={submitting}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white p-2.5 rounded-xl font-bold text-xs shadow-md shadow-emerald-600/10"
                  >
                    Approve Claim
                  </button>
                  <button
                    onClick={() => setShowRejectPanel(true)}
                    className="bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-700 hover:text-rose-700 p-2.5 rounded-xl font-bold text-xs"
                  >
                    Reject Claim
                  </button>
                </div>
              )}

              {/* Reject Reason input panel */}
              {showRejectPanel && (
                <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl space-y-3">
                  <span className="text-xs font-bold text-rose-800 block">Provide Rejection Feedback</span>
                  <textarea
                    required
                    placeholder="Provide reason for request rejection"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full bg-white border border-rose-200 rounded-lg p-2 text-xs font-bold focus:outline-none focus:border-rose-500 h-16"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowRejectPanel(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => triggerWorkflowAction("reject")}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold shadow"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}

              {/* Disbursement workflow trigger */}
              {selectedRequest.status === "APPROVED" && canDisburse && !showDisbursePanel && (
                <button
                  onClick={() => setShowDisbursePanel(true)}
                  className="bg-indigo-600 hover:bg-indigo-755 text-white p-2.5 rounded-xl font-bold text-xs shadow"
                >
                  Pay & Disburse Imprest
                </button>
              )}

              {/* Disburse forms */}
              {showDisbursePanel && (
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-3 text-xs font-bold text-slate-750">
                  <span className="text-slate-800 block text-xs">Payment Settlement Details</span>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label>Payment Method</label>
                      <select
                        value={disburseForm.paymentMethod}
                        onChange={(e) => setDisburseForm({ ...disburseForm, paymentMethod: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:outline-none"
                      >
                        <option value="CASH">CASH</option>
                        <option value="MPESA">MPESA</option>
                        <option value="BANK TRANSFER">BANK TRANSFER</option>
                        <option value="CHEQUE">CHEQUE</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label>Reference # / Tx ID</label>
                      <input
                        type="text"
                        placeholder="MPESA Ref, Chq #"
                        value={disburseForm.referenceNo}
                        onChange={(e) => setDisburseForm({ ...disburseForm, referenceNo: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-bold focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowDisbursePanel(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => triggerWorkflowAction("disburse")}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold shadow"
                    >
                      Confirm Payout
                    </button>
                  </div>
                </div>
              )}

              {/* Surrender trigger (Claimant only) */}
              {selectedRequest.status === "DISBURSED" && userContext && userContext.userId === selectedRequest.requesterId && !showSurrenderPanel && (
                <button
                  onClick={() => setShowSurrenderPanel(true)}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-2.5 rounded-xl font-bold text-xs shadow"
                >
                  Surrender Receipts
                </button>
              )}

              {/* Surrender receipt submission form */}
              {showSurrenderPanel && (
                <div className="bg-purple-50/50 border border-purple-100 p-4 rounded-xl space-y-3 text-xs font-bold text-slate-700">
                  <span className="text-purple-800 block text-xs">Petty Cash Surrender Claim</span>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label>Actual Amount Spent (KES)</label>
                      <input
                        type="number"
                        required
                        placeholder="4500"
                        value={surrenderForm.actualSpent}
                        onChange={(e) => setSurrenderForm({ ...surrenderForm, actualSpent: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label>Receipt Document URL (Mock)</label>
                      <input
                        type="text"
                        placeholder="https://mockreceipts.s3/img.png"
                        value={surrenderForm.receiptUrl}
                        onChange={(e) => setSurrenderForm({ ...surrenderForm, receiptUrl: e.target.value })}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2.5 font-bold focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowSurrenderPanel(false)}
                      className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => triggerWorkflowAction("surrender")}
                      disabled={submitting}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-[10px] font-bold shadow"
                    >
                      Submit Surrender
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
