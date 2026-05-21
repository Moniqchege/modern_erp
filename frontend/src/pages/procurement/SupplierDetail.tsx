import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { ROUTES } from "../../app/router/routes";
import type { Supplier } from "../../modules/procurement/types/procurement";

interface ComplianceDoc {
  id: string;
  title: string;
  documentType: string;
  status: string;
  expiresAt?: string | null;
}

export function SupplierDetail() {
  const { supplierId } = useParams<{ supplierId: string }>();
  const navigate = useNavigate();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [documents, setDocuments] = useState<ComplianceDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supplierId) return;
    void procurementApi.suppliers
      .get(supplierId)
      .then((d) => {
        setSupplier(d.supplier as Supplier);
        setDocuments((d.documents as ComplianceDoc[]) ?? []);
      })
      .catch(() => setSupplier(null))
      .finally(() => setLoading(false));
  }, [supplierId]);

  const advanceOnboarding = async () => {
    if (!supplierId) return;
    try {
      await procurementApi.suppliers.advanceOnboarding(supplierId, "Procurement Officer");
      const d = await procurementApi.suppliers.get(supplierId);
      setSupplier(d.supplier as Supplier);
    } catch {
      /* ignore */
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
          {supplier.onboardingStatus !== "ACTIVE" && (
            <button
              type="button"
              onClick={() => void advanceOnboarding()}
              className="text-xs font-bold bg-emerald-600 text-white px-3 py-1.5 rounded-lg"
            >
              Advance onboarding
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5 text-xs space-y-2">
          <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">
            Tax & registration
          </h2>
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
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-extrabold text-slate-400 uppercase text-[10px] tracking-widest mb-3">
              Compliance wallet
            </h2>
          </div>

          {/* upload form (metadata only; no binary upload/storage yet) */}
          <form
            className="mt-2 mb-4 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();

              if (!supplierId) return;

              const form = e.currentTarget;
              const formData = new FormData(form);
              const titles = String(formData.get("titles") ?? "")
                .split("|")
                .map((s) => s.trim())
                .filter(Boolean);
              const documentType = String(formData.get("documentType") ?? "OTHER")
                .trim();

              if (titles.length === 0) return;

              await procurementApi.suppliers.createComplianceDocumentsBatch(supplierId, {
                documents: titles.map((title) => ({
                  documentType,
                  title,
                  referenceNo: null,
                  // fileUrl intentionally omitted until storage exists
                })),
              });

              const d = await procurementApi.suppliers.get(supplierId);
              setDocuments((d.documents as ComplianceDoc[]) ?? []);
              form.reset();
            }}
          >
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_170px] gap-2">
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Add file titles (separate with |)
                </span>
                <input
                  name="titles"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  placeholder="KEBS 2026|Tax Compliance"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Type
                </span>
                <select
                  name="documentType"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  defaultValue="OTHER"
                >
                  <option value="FOOD_SAFETY">FOOD_SAFETY</option>
                  <option value="KEBS_CERTIFICATE">KEBS_CERTIFICATE</option>
                  <option value="ISO">ISO</option>
                  <option value="ORGANIC">ORGANIC</option>
                  <option value="GLOBALGAP">GLOBALGAP</option>
                  <option value="TAX_COMPLIANCE">TAX_COMPLIANCE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="text-xs font-bold bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700"
              >
                Add to wallet
              </button>
            </div>
          </form>

          {documents.length === 0 ? (
            <p className="text-xs text-slate-400">No documents on file</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between border-b border-slate-50 pb-2"
                >
                  <span className="font-medium">{doc.title}</span>
                  <StatusBadge status={doc.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
