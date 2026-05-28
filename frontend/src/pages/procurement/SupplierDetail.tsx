import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Pencil, Save, X } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { ROUTES } from "../../app/router/routes";
import type { Supplier } from "../../modules/procurement/types/procurement";

type SupplierEditPayload = {
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  taxPin?: string | null;
  vatNumber?: string | null;

  bankName?: string | null;
  bankAccountNo?: string | null;
  bankBranch?: string | null;
  bankSwiftCode?: string | null;
};

export function SupplierDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supplierIdSafe = supplierId ?? "";

  const onboardingApprovalState = useMemo(() => {
    if (!supplier) return null;
    if (supplier.onboardingStatus === "REJECTED") return "rejected" as const;
    if (
      supplier.onboardingStatus === "ACTIVE" || supplier.isActive
    )
      return "approved" as const;
    return "pending" as const;
  }, [supplier]);


  const supplierActivationState = useMemo(() => {
    if (!supplier) return null;
    // lockedAt => locked
    const lockedAt = (supplier as any).lockedAt as string | null | undefined;
    if (lockedAt) return "locked" as const;
    if (supplier.isActive) return "active" as const;
    return "inactive" as const;
  }, [supplier]);

  const [form, setForm] = useState<SupplierEditPayload>({});

  useEffect(() => {
    if (!supplierId) return;

    void procurementApi.suppliers
      .get(supplierId)
      .then((d) => {
        const s = d.supplier as Supplier;
        setSupplier(s);

        setForm({
          contactPerson: s.contactPerson ?? null,
          phone: s.phone ?? null,
          email: s.email ?? null,
          taxPin: s.taxPin ?? null,
          vatNumber: s.vatNumber ?? null,

          bankName: (s as any).bankName ?? null,
          bankAccountNo: (s as any).bankAccountNo ?? null,
          bankBranch: (s as any).bankBranch ?? null,
          bankSwiftCode: (s as any).bankSwiftCode ?? null,
        });
      })
      .catch(() => setSupplier(null))
      .finally(() => setLoading(false));
  }, [supplierId]);

  const advanceOnboarding = async () => {
    if (!supplierId) return;
    try {
      await procurementApi.suppliers.advanceOnboarding(
        supplierId,
        "Procurement Officer"
      );
      const d = await procurementApi.suppliers.get(supplierId);
      setSupplier(d.supplier as Supplier);
      setEditing(false);
    } catch {
      // ignore
    }
  };

  const startEdit = () => {
    if (!supplier) return;
    setError(null);
    setEditing(true);
    setForm({
      contactPerson: supplier.contactPerson ?? null,
      phone: supplier.phone ?? null,
      email: supplier.email ?? null,
      taxPin: supplier.taxPin ?? null,
      vatNumber: supplier.vatNumber ?? null,

      bankName: (supplier as any).bankName ?? null,
      bankAccountNo: (supplier as any).bankAccountNo ?? null,
      bankBranch: (supplier as any).bankBranch ?? null,
      bankSwiftCode: (supplier as any).bankSwiftCode ?? null,
    });
  };

  const cancelEdit = () => {
    if (!supplier) return;
    setError(null);
    setEditing(false);
    setForm({
      contactPerson: supplier.contactPerson ?? null,
      phone: supplier.phone ?? null,
      email: supplier.email ?? null,
      taxPin: supplier.taxPin ?? null,
      vatNumber: supplier.vatNumber ?? null,

      bankName: (supplier as any).bankName ?? null,
      bankAccountNo: (supplier as any).bankAccountNo ?? null,
      bankBranch: (supplier as any).bankBranch ?? null,
      bankSwiftCode: (supplier as any).bankSwiftCode ?? null,
    });
  };

  const saveEdit = async () => {
    if (!supplierId) return;
    if (!supplier) return;

    setSaving(true);
    setError(null);

    try {
      const payload: SupplierEditPayload = {
        contactPerson: form.contactPerson ?? null,
        phone: form.phone ?? null,
        email: form.email ?? null,
        taxPin: form.taxPin ?? null,
        vatNumber: form.vatNumber ?? null,

        bankName: form.bankName ?? null,
        bankAccountNo: form.bankAccountNo ?? null,
        bankBranch: form.bankBranch ?? null,
        bankSwiftCode: form.bankSwiftCode ?? null,
      };

      await procurementApi.suppliers.update(supplierId, payload);

      const d = await procurementApi.suppliers.get(supplierId);
      setSupplier(d.supplier as Supplier);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-slate-400 text-xs gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-20">
        <p className="text-sm text-slate-500">Supplier not found</p>
        <button
          type="button"
          onClick={() => navigate(ROUTES.PROCUREMENT_SUPPLIERS)}
          className="mt-4 text-xs font-bold text-emerald-700"
        >
          Back to list
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.PROCUREMENT_SUPPLIERS)}
        className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Suppliers
      </button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">{supplier.name}</h1>
          <p className="text-xs font-mono text-slate-500 mt-1">{supplier.code}</p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={supplier.onboardingStatus} />

          {!editing ? (
            <>
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>

              {supplierActivationState === "active" && (
                <button
                  type="button"
                  onClick={() => {
                    setError("Lock endpoint not implemented yet in backend");
                  }}
                  className="inline-flex items-center gap-2 text-xs font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-lg"
                >
                  Lock
                </button>
              )}

              {onboardingApprovalState === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                          await procurementApi.suppliers.approveOnboarding(
                          supplierIdSafe,
                          "Procurement Officer"
                        );
                        const d = await procurementApi.suppliers.get(supplierIdSafe);
                        setSupplier(d.supplier as Supplier);
                      } catch {
                        // ignore
                      }
                    }}
                    className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await procurementApi.suppliers.rejectOnboarding(
                          supplierId,
                          "Procurement Officer"
                        );
                        const d = await procurementApi.suppliers.get(supplierId);
                        setSupplier(d.supplier as Supplier);
                      } catch {
                        // ignore
                      }
                    }}
                    className="inline-flex items-center gap-2 text-xs font-bold bg-rose-600 text-white px-3 py-1.5 rounded-lg"
                  >
                    Reject
                  </button>
                </>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEdit()}
                className="inline-flex items-center gap-2 text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={saving}
                className="inline-flex items-center gap-2 text-xs font-bold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {editing && error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs space-y-2">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">
            Tax & registration
          </h2>

          {!editing ? (
            <>
              <p>
                <span className="text-slate-500">Tax PIN:</span> {supplier.taxPin ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">VAT:</span> {supplier.vatNumber ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">Email:</span> {supplier.email ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">Phone:</span> {supplier.phone ?? "—"}
              </p>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Tax PIN</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.taxPin ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, taxPin: e.target.value || null }))}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">VAT number</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.vatNumber ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value || null }))}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Email</span>
                <input
                  type="email"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.email ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value || null }))}
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Phone</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.phone ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value || null }))}
                />
              </label>
            </>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs space-y-2">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">
            Payment details
          </h2>

          {!editing ? (
            <>
              <p>
                <span className="text-slate-500">Bank name:</span>{" "}
                {(supplier as any).bankName ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">Account number:</span>{" "}
                {(supplier as any).bankAccountNo ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">Branch:</span>{" "}
                {(supplier as any).bankBranch ?? "—"}
              </p>
              <p>
                <span className="text-slate-500">SWIFT:</span>{" "}
                {(supplier as any).bankSwiftCode ?? "—"}
              </p>
            </>
          ) : (
            <>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Bank name</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.bankName ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value || null }))}
                />
              </label>

              <label className="block mt-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Bank account number</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.bankAccountNo ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, bankAccountNo: e.target.value || null }))
                  }
                />
              </label>

              <label className="block mt-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Bank branch</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.bankBranch ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, bankBranch: e.target.value || null }))}
                />
              </label>

              <label className="block mt-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase">SWIFT code</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={form.bankSwiftCode ?? ""}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, bankSwiftCode: e.target.value || null }))
                  }
                />
              </label>
            </>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs space-y-3">
        <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest">
          Supplied stock mapping
        </h2>
        {(supplier as any).suppliedItems?.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {(supplier as any).suppliedItems.map((entry: any) => (
              <div
                key={entry.id}
                className="rounded-lg border border-slate-200 px-3 py-2 bg-slate-50/50"
              >
                <p className="font-semibold text-slate-700">{entry.itemProfile?.name ?? "Unknown item"}</p>
                <p className="text-[10px] text-slate-500">
                  {entry.itemProfile?.sku ?? "-"} • {String(entry.itemProfile?.category ?? "").replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500">No stock mapping yet for this supplier.</p>
        )}
      </div>
    </div>
  );
}

