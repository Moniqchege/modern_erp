import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, PackageCheck, CheckCircle2, AlertTriangle, XCircle,
  TrendingUp, Clock, Scale, FlaskConical, FileText,
} from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { ROUTES } from "../../app/router/routes";
import type { GoodsReceivedNote } from "../../modules/procurement/types/procurement";

const fmtNum = (v?: number | string | null, dp = 2) =>
  v == null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });

const fmtDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

function GradePill({ grade }: { grade?: string | null }) {
  if (!grade) return null;
  const map: Record<string, string> = {
    GRADE_A: "bg-emerald-100 text-emerald-700",
    GRADE_B: "bg-amber-100 text-amber-700",
    GRADE_C: "bg-orange-100 text-orange-700",
    REJECT: "bg-red-100 text-red-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${map[grade] ?? "bg-slate-100 text-slate-600"}`}>
      {grade.replace("_", " ")}
    </span>
  );
}

interface AnalyticsData {
  totalGRNs: number;
  pendingQC: number;
  readyToPost: number;
  posted: number;
  rejected: number;
  totalWeightKg: number;
  avgGradeA: number;
}

export function GRNManagement() {
  const navigate = useNavigate();
  const [grns, setGrns] = useState<GoodsReceivedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadGrns = () => {
    void procurementApi.grns
      .list()
      .then((d) => setGrns(d.grns as GoodsReceivedNote[]))
      .catch(() => setGrns([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadGrns(); }, []);

  // Analytics
  const analytics: AnalyticsData = {
    totalGRNs: grns.length,
    pendingQC: grns.filter((g) => g.status === "PENDING_QC").length,
    readyToPost: grns.filter((g) => {
      const qc = g.qcResults?.[0];
      return g.status === "PENDING_QC" && qc && !qc.blocksInventoryPost;
    }).length,
    posted: grns.filter((g) => g.status === "POSTED").length,
    rejected: grns.filter((g) => g.qcResults?.some((q) => q.status === "FULL_REJECTION")).length,
    totalWeightKg: grns
      .filter((g) => g.status === "POSTED")
      .reduce((sum, g) => sum + Number(g.netWeightAccepted ?? 0), 0),
    avgGradeA: grns.filter((g) => g.qcResults?.some((q) => q.assignedGrade === "GRADE_A")).length,
  };

  const readyToPost = grns.filter((g) => {
    const qc = g.qcResults?.[0];
    return g.status === "PENDING_QC" && qc && !qc.blocksInventoryPost;
  });

  const handlePost = async (grn: GoodsReceivedNote) => {
    setPosting(grn.id);
    try {
      await procurementApi.grns.post(grn.id, "GRN_MANAGER");
      loadGrns();
    } catch (err) {
      setErrors((e) => ({ ...e, [grn.id]: err instanceof Error ? err.message : "Post failed." }));
    } finally {
      setPosting(null);
    }
  };

  const StatCard = ({ icon, label, value, color, sublabel }: {
    icon: React.ReactNode;
    label: string;
    value: string | number;
    color: string;
    sublabel?: string;
  }) => (
    <div className={`bg-white border rounded-xl p-4 shadow-sm ${color}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color.replace("border-", "bg-").replace("-200", "-100")}`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] uppercase font-semibold text-slate-500 tracking-wide">{label}</p>
          <p className="text-2xl font-black text-slate-900">{value}</p>
          {sublabel && <p className="text-[10px] text-slate-400 mt-0.5">{sublabel}</p>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <PackageCheck className="h-6 w-6 text-indigo-600" />
          GRN Management & Approval
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Analytics · auto-generated GRNs awaiting final approval · post to inventory
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {/* Analytics Dashboard */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard
              icon={<FileText className="h-5 w-5 text-indigo-600" />}
              label="Total GRNs"
              value={analytics.totalGRNs}
              color="border-indigo-200"
            />
            <StatCard
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              label="Pending QC"
              value={analytics.pendingQC}
              color="border-amber-200"
              sublabel="Awaiting lab results"
            />
            <StatCard
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              label="Ready to Post"
              value={analytics.readyToPost}
              color="border-emerald-200"
              sublabel="QC passed, awaiting approval"
            />
            <StatCard
              icon={<PackageCheck className="h-5 w-5 text-emerald-600" />}
              label="Posted"
              value={analytics.posted}
              color="border-emerald-200"
              sublabel={`${fmtNum(analytics.totalWeightKg, 0)} kg total`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StatCard
              icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
              label="Grade A Deliveries"
              value={analytics.avgGradeA}
              color="border-emerald-200"
              sublabel={`${analytics.totalGRNs > 0 ? Math.round((analytics.avgGradeA / analytics.totalGRNs) * 100) : 0}% of total`}
            />
            <StatCard
              icon={<XCircle className="h-5 w-5 text-red-600" />}
              label="Rejected"
              value={analytics.rejected}
              color="border-red-200"
              sublabel="Failed QC, cannot post"
            />
          </div>

          {/* Quick Actions */}
          <div className="bg-gradient-to-r from-indigo-50 to-sky-50 border border-indigo-200 rounded-xl p-5">
            <h2 className="text-sm font-bold text-slate-800 mb-3">Quick Actions</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => navigate(ROUTES.PROCUREMENT_WEIGHBRIDGE)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                <Scale className="h-3.5 w-3.5" />
                Go to Weighbridge
              </button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.PROCUREMENT_LAB)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                Go to Lab
              </button>
            </div>
          </div>

          {/* Approval Queue */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Awaiting Final Approval ({readyToPost.length})
            </h2>
            {readyToPost.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No GRNs ready to post</p>
                <p className="text-xs mt-1">GRNs will appear here after QC passes.</p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-slate-50 uppercase text-slate-500 font-semibold tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3">GRN</th>
                      <th className="px-4 py-3">PO</th>
                      <th className="px-4 py-3">Supplier</th>
                      <th className="px-4 py-3">Batch / Lot</th>
                      <th className="px-4 py-3 text-center">QC Grade</th>
                      <th className="px-4 py-3 text-right">Deduction</th>
                      <th className="px-4 py-3">Received</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readyToPost.map((grn) => {
                      const qc = grn.qcResults?.[0];
                      return (
                        <tr key={grn.id} className="border-b border-slate-100 hover:bg-emerald-50/30 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-slate-900">{grn.grnNumber}</td>
                          <td className="px-4 py-3 font-mono text-slate-600">{grn.purchaseOrder?.poNumber ?? "—"}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{grn.purchaseOrder?.supplier?.name ?? "—"}</td>
                          <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{grn.batchTraceCode ?? "—"}</td>
                          <td className="px-4 py-3 text-center">
                            <GradePill grade={qc?.assignedGrade} />
                          </td>
                          <td className="px-4 py-3 text-right">
                            {qc && Number(qc.priceDeductionPct) > 0 ? (
                              <span className="text-orange-600 font-bold">-{fmtNum(qc.priceDeductionPct, 1)}%</span>
                            ) : (
                              <span className="text-emerald-600 font-bold">None</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500">{fmtDate(grn.receivedAt)}</td>
                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => { void handlePost(grn); }}
                              disabled={posting === grn.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-60"
                            >
                              {posting === grn.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Approve & Post
                            </button>
                            {errors[grn.id] && (
                              <p className="text-[10px] text-red-600 mt-1">{errors[grn.id]}</p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* All GRNs History */}
          <div>
            <h2 className="text-sm font-bold text-slate-800 mb-3">All GRNs</h2>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-slate-50 uppercase text-slate-500 font-semibold tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3">GRN</th>
                    <th className="px-4 py-3">Supplier</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">QC Grade</th>
                    <th className="px-4 py-3 text-right">Net Weight (kg)</th>
                    <th className="px-4 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {grns.map((grn) => {
                    const qc = grn.qcResults?.[0];
                    const isRejected = qc?.status === "FULL_REJECTION";
                    return (
                      <tr
                        key={grn.id}
                        className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${
                          isRejected ? "bg-red-50/30" : grn.status === "POSTED" ? "bg-emerald-50/20" : ""
                        }`}
                      >
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">{grn.grnNumber}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{grn.purchaseOrder?.supplier?.name ?? "—"}</td>
                        <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{grn.batchTraceCode ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={grn.status} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <GradePill grade={qc?.assignedGrade} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {grn.status === "POSTED" ? fmtNum(grn.netWeightAccepted, 3) : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {fmtDate(grn.status === "POSTED" ? grn.postedAt : grn.receivedAt)}
                        </td>
                      </tr>
                    );
                  })}
                  {grns.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                        No GRNs found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
