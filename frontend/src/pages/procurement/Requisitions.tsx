import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Eye, Loader2 } from "lucide-react";
import { Trash2 } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { getCurrentUser } from "../../auth/authClient";
import { ROUTES } from "../../app/router/routes";
import type {
  ProcurementItemProfile,
  PurchaseRequisition,
  Supplier,
} from "../../modules/procurement/types/procurement";

const MAKER_ROLES = new Set([
  "PROCUREMENT_OFFICER", "MANAGER", "ADMIN", "SUPERADMIN", "EMPLOYEE", "WAREHOUSE_OPERATOR",
]);

const rowBg = (status: string) => {
  if (status === "REJECTED") return "bg-red-50/40";
  if (status === "APPROVED" || status === "CONVERTED_TO_PO") return "bg-emerald-50/30";
  if (status.startsWith("PENDING")) return "bg-amber-50/30";
  return "";
};

export function Requisitions() {
  const navigate = useNavigate();
  const user = getCurrentUser();
  const isMaker = user ? MAKER_ROLES.has(user.role) : false;

  const [rows, setRows] = useState<PurchaseRequisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemProfiles, setItemProfiles] = useState<ProcurementItemProfile[]>([]);

  // create modal
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncHintDismissed, setSyncHintDismissed] = useState(false);

  const [form, setForm] = useState({
    requestedBy: user?.email ?? "",
    department: "",
    supplierId: "",
    source: "MANUAL_PROCUREMENT",
    justification: "",
    requiredByDate: "",
    currency: "KES",
    lines: [{ itemProfileId: "", quantity: "1", unitPriceEstimate: "", notes: "" }],
  });

  // ─── load ──────────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const d = await procurementApi.requisitions.list();
      setRows(d.requisitions as PurchaseRequisition[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void procurementApi.suppliers.list(true)
      .then((d) => setSuppliers(d.suppliers as Supplier[]))
      .catch(() => setSuppliers([]));
    void procurementApi.itemProfiles.list()
      .then((d) => setItemProfiles(d.profiles as ProcurementItemProfile[]))
      .catch(() => setItemProfiles([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── create ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!form.requestedBy.trim()) { setFormError("Requested by is required."); return; }
    const lines = form.lines
      .filter((l) => l.itemProfileId && Number(l.quantity) > 0)
      .map((l) => ({
        itemProfileId: l.itemProfileId,
        quantity: Number(l.quantity),
        unitPriceEstimate: l.unitPriceEstimate ? Number(l.unitPriceEstimate) : undefined,
        notes: l.notes || undefined,
      }));
    if (!lines.length) { setFormError("Add at least one valid line."); return; }
    setSaving(true);
    setFormError(null);
    try {
      const result = await procurementApi.requisitions.create({
        requestedBy: form.requestedBy.trim(),
        department: form.department || undefined,
        supplierId: form.supplierId || undefined,
        source: form.source,
        justification: form.justification || undefined,
        requiredByDate: form.requiredByDate || undefined,
        currency: form.currency,
        lines,
      });
      setShowCreate(false);
      setForm({
        requestedBy: user?.email ?? "",
        department: "",
        supplierId: "",
        source: "MANUAL_PROCUREMENT",
        justification: "",
        requiredByDate: "",
        currency: "KES",
        lines: [{ itemProfileId: "", quantity: "1", unitPriceEstimate: "", notes: "" }],
      });
      // Navigate straight to the detail page after creation
      navigate(ROUTES.PROCUREMENT_REQUISITION_DETAIL(result.requisition.id));
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Failed to create requisition.");
    } finally {
      setSaving(false);
    }
  };

  const fmtMoney = (v: string | number, currency: string) => {
    const n = Number(v) || 0;
    return `${currency} ${(n * 1.16).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // ─── render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Purchase Requisitions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Maker creates · Approver reviews · Auto PO on approval
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            onClick={async () => {
              await procurementApi.requisitions.generateLowStock();
              await load();
            }}
          >
            Generate low-stock
          </button>
          {isMaker && (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => { setFormError(null); setShowCreate(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              New requisition
            </button>
          )}
        </div>
      </div>

      {/* table */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50 uppercase text-slate-500 font-semibold tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3">Req No.</th>
                <th className="px-4 py-3">Requested By</th>
                <th className="px-4 py-3">Dept</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3 text-right">Est. Total (incl. VAT)</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${rowBg(r.status)}`}
                >
                  <td className="px-4 py-3 font-mono font-bold text-slate-700">{r.requisitionNo}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.requestedBy}</td>
                  <td className="px-4 py-3 text-slate-500">{r.department ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{r.supplier?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {fmtMoney(r.estimatedTotal, r.currency)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.PROCUREMENT_REQUISITION_DETAIL(r.id))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 active:scale-95 transition-all"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400 font-medium">
                    No requisitions found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}


      {/* ── Create Modal ─────────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black text-slate-900">New manual requisition</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-slate-400 hover:text-slate-700">✕</button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {formError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{formError}</p>
              )}

              {itemProfiles.length === 0 && !syncHintDismissed && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-700">No active item profiles found.</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={syncBusy}
                      onClick={async () => {
                        setSyncBusy(true);
                        try {
                          await procurementApi.itemProfiles.syncFromInventory();
                          const d = await procurementApi.itemProfiles.list();
                          setItemProfiles(d.profiles as ProcurementItemProfile[]);
                        } catch (e) {
                          setFormError(e instanceof Error ? e.message : "Sync failed.");
                        } finally {
                          setSyncBusy(false);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white disabled:opacity-50"
                    >
                      {syncBusy ? "Syncing…" : "Sync from inventory"}
                    </button>
                    <button type="button" onClick={() => setSyncHintDismissed(true)} className="text-xs font-bold text-amber-700/80">Dismiss</button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Requested by *</span>
                  <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" value={form.requestedBy} onChange={(e) => setForm((p) => ({ ...p, requestedBy: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Department</span>
                  <input className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Supplier (optional)</span>
                  <select aria-label="Supplier" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
                    <option value="">Auto-select preferred</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Source</span>
                  <select aria-label="Source" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}>
                    <option value="MANUAL_PROCUREMENT">Manual – Procurement</option>
                    <option value="MANUAL_PLANT">Manual – Plant request</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Required by</span>
                  <input type="date" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" value={form.requiredByDate} onChange={(e) => setForm((p) => ({ ...p, requiredByDate: e.target.value }))} />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Currency</span>
                  <select aria-label="Currency" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
                    {["KES", "USD", "EUR", "UGX", "TZS"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Justification</span>
                <textarea className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs" rows={2} value={form.justification} onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))} />
              </label>

              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase mb-2">Line items</p>
                <div className="space-y-2">
                  {form.lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center border border-slate-200 rounded-lg p-2 bg-slate-50/50">
                      <select
                        aria-label={`Item for line ${idx + 1}`}
                        className="col-span-5 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white"
                        value={line.itemProfileId}
                        onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, itemProfileId: e.target.value } : l) }))}
                      >
                        <option value="">Select item *</option>
                        {itemProfiles.map((ip) => <option key={ip.id} value={ip.id}>{ip.name} ({ip.sku})</option>)}
                      </select>
                      <input type="number" min="0.001" step="0.001" placeholder="Qty *" aria-label={`Quantity for line ${idx + 1}`}
                        className="col-span-2 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white"
                        value={line.quantity}
                        onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, quantity: e.target.value } : l) }))}
                      />
                      <input type="number" min="0" step="0.01" placeholder="Unit price" aria-label={`Unit price for line ${idx + 1}`}
                        className="col-span-2 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white"
                        value={line.unitPriceEstimate}
                        onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, unitPriceEstimate: e.target.value } : l) }))}
                      />
                      <input placeholder="Notes" aria-label={`Notes for line ${idx + 1}`}
                        className="col-span-2 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-white"
                        value={line.notes}
                        onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, notes: e.target.value } : l) }))}
                      />
                      <button type="button" aria-label={`Remove line ${idx + 1}`}
                        className="col-span-1 flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200"
                        onClick={() => setForm((p) => ({ ...p, lines: p.lines.length > 1 ? p.lines.filter((_, i) => i !== idx) : p.lines }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button"
                  className="mt-2 px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg hover:bg-slate-50"
                  onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, { itemProfileId: "", quantity: "1", unitPriceEstimate: "", notes: "" }] }))}
                >
                  + Add line
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-xs font-bold border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button
                type="button"
                disabled={saving || itemProfiles.length === 0}
                onClick={() => void handleCreate()}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Create & view"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
