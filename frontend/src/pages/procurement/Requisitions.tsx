import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import type {
  ProcurementItemProfile,
  PurchaseRequisition,
  Supplier,
} from "../../modules/procurement/types/procurement";

export function Requisitions() {
  const [rows, setRows] = useState<PurchaseRequisition[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemProfiles, setItemProfiles] = useState<ProcurementItemProfile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({
    requestedBy: "",
    department: "",
    supplierId: "",
    source: "MANUAL_PROCUREMENT",
    justification: "",
    requiredByDate: "",
    currency: "KES",
    lines: [{ itemProfileId: "", quantity: "1", unitPriceEstimate: "", notes: "" }],
  });

  const loadRequisitions = async () => {
    try {
      const d = await procurementApi.requisitions.list();
      setRows(d.requisitions as PurchaseRequisition[]);
    } catch {
      setRows([]);
    }
  };

  useEffect(() => {
    void loadRequisitions();
    void procurementApi.suppliers.list(true).then((d) => setSuppliers(d.suppliers as Supplier[])).catch(() => setSuppliers([]));
    void procurementApi.itemProfiles.list().then((d) => setItemProfiles(d.profiles as ProcurementItemProfile[])).catch(() => setItemProfiles([]));
  }, []);

  const rowClass = (status: string) => {
    if (status === "REJECTED") return "bg-red-50/50";
    if (status.startsWith("PENDING")) return "bg-amber-50/40";
    return "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Purchase Requisitions</h1>
          <p className="text-xs text-slate-500 mt-1">Low-stock auto-gen • plant manual • multi-level approval</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
            onClick={async () => {
              await procurementApi.requisitions.generateLowStock();
              await loadRequisitions();
            }}
          >
            Generate low-stock
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => {
              setFormError(null);
              setShowCreate(true);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New manual requisition
          </button>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="bg-slate-50 uppercase text-slate-500 font-semibold tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Req No.</th>
              <th className="px-4 py-3">Requested By</th>
              <th className="px-4 py-3 text-right">Est. Subtotal</th>
              <th className="px-4 py-3 text-right">Est. VAT (16%)</th>
              <th className="px-4 py-3 text-right">Est. Gross Total</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              // Extract the total securely and derive standard VAT metrics dynamically
              const subtotal = Number(r.estimatedTotal) || 0;
              const vat = subtotal * 0.16; // Standard fallback calculation
              const grossTotal = subtotal + vat;

              return (
                <tr key={r.id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${rowClass(r.status)}`}>
                  <td className="px-4 py-3 font-mono font-bold text-slate-700">{r.requisitionNo}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{r.requestedBy}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {r.currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-slate-600">
                    {r.currency} {vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                    {r.currency} {grossTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400 font-medium">
                  No requisitions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-xl p-5 space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Create manual requisition</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="text-xs font-bold text-slate-500">X</button>
            </div>
            {formError && <p className="text-xs text-red-600">{formError}</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input className="border rounded-lg px-3 py-2 text-xs" placeholder="Requested by *" value={form.requestedBy} onChange={(e) => setForm((p) => ({ ...p, requestedBy: e.target.value }))} />
              <input className="border rounded-lg px-3 py-2 text-xs" placeholder="Department" value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} />
              <select className="border rounded-lg px-3 py-2 text-xs" value={form.supplierId} onChange={(e) => setForm((p) => ({ ...p, supplierId: e.target.value }))}>
                <option value="">Select supplier (optional)</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className="border rounded-lg px-3 py-2 text-xs" value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value }))}>
                <option value="MANUAL_PROCUREMENT">Manual procurement</option>
                <option value="MANUAL_PLANT">Manual plant request</option>
              </select>
              <input type="date" className="border rounded-lg px-3 py-2 text-xs" value={form.requiredByDate} onChange={(e) => setForm((p) => ({ ...p, requiredByDate: e.target.value }))} />
              <select className="border rounded-lg px-3 py-2 text-xs" value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}>
                {["KES", "USD", "EUR", "UGX", "TZS"].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <textarea className="w-full border rounded-lg px-3 py-2 text-xs" rows={2} placeholder="Justification" value={form.justification} onChange={(e) => setForm((p) => ({ ...p, justification: e.target.value }))} />

            <div className="space-y-2">
              {form.lines.map((line, index) => (
                <div key={index} className="grid grid-cols-1 md:grid-cols-12 gap-2 border rounded-lg p-2">
                  <select className="md:col-span-5 border rounded-lg px-2 py-2 text-xs" value={line.itemProfileId} onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === index ? { ...l, itemProfileId: e.target.value } : l) }))}>
                    <option value="">Item profile *</option>
                    {itemProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>{profile.name} ({profile.sku})</option>
                    ))}
                  </select>
                  <input className="md:col-span-2 border rounded-lg px-2 py-2 text-xs" type="number" min="0.001" step="0.001" placeholder="Qty *" value={line.quantity} onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === index ? { ...l, quantity: e.target.value } : l) }))} />
                  <input className="md:col-span-2 border rounded-lg px-2 py-2 text-xs" type="number" min="0" step="0.01" placeholder="Unit price" value={line.unitPriceEstimate} onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === index ? { ...l, unitPriceEstimate: e.target.value } : l) }))} />
                  <input className="md:col-span-2 border rounded-lg px-2 py-2 text-xs" placeholder="Notes" value={line.notes} onChange={(e) => setForm((p) => ({ ...p, lines: p.lines.map((l, i) => i === index ? { ...l, notes: e.target.value } : l) }))} />
                  <button type="button" className="md:col-span-1 inline-flex items-center justify-center border rounded-lg text-slate-500 hover:text-red-600" onClick={() => setForm((p) => ({ ...p, lines: p.lines.length > 1 ? p.lines.filter((_, i) => i !== index) : p.lines }))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" className="px-3 py-1.5 text-xs font-semibold border rounded-lg" onClick={() => setForm((p) => ({ ...p, lines: [...p.lines, { itemProfileId: "", quantity: "1", unitPriceEstimate: "", notes: "" }] }))}>Add line</button>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" className="px-3 py-2 text-xs font-bold border rounded-lg" onClick={() => setShowCreate(false)}>Cancel</button>
              <button
                type="button"
                disabled={saving}
                className="px-3 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white disabled:opacity-50"
                onClick={async () => {
                  if (!form.requestedBy.trim()) {
                    setFormError("Requested by is required.");
                    return;
                  }
                  const lines = form.lines
                    .filter((line) => line.itemProfileId && Number(line.quantity) > 0)
                    .map((line) => ({
                      itemProfileId: line.itemProfileId,
                      quantity: Number(line.quantity),
                      unitPriceEstimate: line.unitPriceEstimate ? Number(line.unitPriceEstimate) : undefined,
                      notes: line.notes || undefined,
                    }));
                  if (!lines.length) {
                    setFormError("Add at least one valid line.");
                    return;
                  }
                  setSaving(true);
                  setFormError(null);
                  try {
                    await procurementApi.requisitions.create({
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
                      requestedBy: "",
                      department: "",
                      supplierId: "",
                      source: "MANUAL_PROCUREMENT",
                      justification: "",
                      requiredByDate: "",
                      currency: "KES",
                      lines: [{ itemProfileId: "", quantity: "1", unitPriceEstimate: "", notes: "" }],
                    });
                    await loadRequisitions();
                  } catch (e) {
                    setFormError(e instanceof Error ? e.message : "Failed to create requisition.");
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                {saving ? "Saving..." : "Create requisition"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
