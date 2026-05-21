import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Loader2, X, Eye } from "lucide-react";
import { StatusBadge } from "../../modules/procurement/components/StatusBadge";
import { procurementApi } from "../../modules/procurement/api/procurementClient";
import { ROUTES } from "../../app/router/routes";
import type { Supplier } from "../../modules/procurement/types/procurement";

// ── types ────────────────────────────────────────────────────────────────────

type ComplianceDocumentType =
  | "FOOD_SAFETY"
  | "KEBS_CERTIFICATE"
  | "ISO"
  | "ORGANIC"
  | "GLOBALGAP"
  | "TAX_COMPLIANCE"
  | "OTHER";

const COMPLIANCE_DOC_TYPES: ComplianceDocumentType[] = [
  "FOOD_SAFETY",
  "KEBS_CERTIFICATE",
  "ISO",
  "ORGANIC",
  "GLOBALGAP",
  "TAX_COMPLIANCE",
  "OTHER",
];

interface DocEntry {
  file: File;
  documentType: ComplianceDocumentType;
  title: string;
}

// ── mock data ─────────────────────────────────────────────────────────────────

const MOCK: Supplier[] = [
  {
    id: "1",
    code: "SUP-001",
    name: "Rift Valley Maize Co-op",
    onboardingStatus: "ACTIVE",
    isActive: true,
    taxPin: "P051234567X",
  },
];

// ── component ─────────────────────────────────────────────────────────────────

export function Suppliers() {
  const navigate = useNavigate();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState(false);

  // supplier fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [taxPin, setTaxPin] = useState("");
  const [vatNumber, setVatNumber] = useState("");

  // compliance documents
  const [docFiles, setDocFiles] = useState<DocEntry[]>([]);

  // ── data loading ────────────────────────────────────────────────────────────

  const load = async () => {
    setLoading(true);
    try {
      const data = await procurementApi.suppliers.list();
      const list = data.suppliers as Supplier[];
      setSuppliers(list.length ? list : MOCK);
      setApiConnected(list.length > 0);
    } catch {
      setSuppliers(MOCK);
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  // ── helpers ─────────────────────────────────────────────────────────────────

  const filtered = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setCode("");
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
    setTaxPin("");
    setVatNumber("");
    setDocFiles([]);
    setError(null);
  };

  const handleAddFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked: DocEntry[] = Array.from(e.target.files ?? []).map((f) => ({
      file: f,
      documentType: "OTHER",
      title: f.name.replace(/\.[^.]+$/, ""),
    }));
    setDocFiles((prev) => [...prev, ...picked].slice(0, 5));
    e.target.value = "";
  };

  const updateDocEntry = (index: number, patch: Partial<DocEntry>) => {
    setDocFiles((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry))
    );
  };

  const removeDocEntry = (index: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // ── form submission ─────────────────────────────────────────────────────────

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      setError("Code and name are required.");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      code: code.trim(),
      name: name.trim(),
      contactPerson: contactPerson || null,
      phone: phone || null,
      email: email || null,
      taxPin: taxPin || null,
      vatNumber: vatNumber || null,
    };

    try {
      const created = await procurementApi.suppliers.create(payload);
      const supplierId =
        (created as any).supplier?.id ?? (created as any).id;

      const documents = docFiles
        .filter((d) => d.title.trim().length > 0)
        .map((d) => ({
          documentType: d.documentType,
          title: d.title.trim(),
          referenceNo: null,
          fileUrl: null, // swap for real upload URL once storage exists
        }));

      if (supplierId && documents.length) {
        await procurementApi.suppliers.createComplianceDocumentsBatch(
          supplierId,
          { documents }
        );
      }

      setModalOpen(false);
      resetForm();
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create supplier"
      );
    } finally {
      setSaving(false);
    }
  };

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900">Suppliers & CRM</h1>
          <p className="text-xs text-slate-500 mt-1">
            Profiles, tax compliance, onboarding, and certificate wallet
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add supplier
        </button>
      </div>

      {/* search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or code..."
          className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 outline-none"
        />
      </div>

      {/* table */}
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-slate-400 py-12 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading suppliers…
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Tax PIN</th>
                <th className="px-4 py-3">Onboarding</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() =>
                    navigate(ROUTES.PROCUREMENT_SUPPLIER_DETAIL(s.id))
                  }
                >
                  <td className="px-4 py-3 font-mono font-bold">{s.code}</td>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">{s.taxPin ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.onboardingStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        s.isActive
                          ? "text-emerald-600 font-bold"
                          : "text-slate-400"
                      }
                    >
                      {s.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-left">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 active:scale-95"
                    >
                      <Eye className="h-3 w-3" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    No suppliers match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[820px] border border-slate-200 max-h-[70vh] flex flex-col">
            {/* modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
              <h2 className="text-sm font-black text-slate-900">
                New supplier
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* modal body */}
            <form
              onSubmit={handleCreate}
              className="p-6 space-y-4 overflow-y-auto"
            >
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              {/* code + name */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Code *
                  </span>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="SUP-002"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Name *
                  </span>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </label>
              </div>

              {/* contact person */}
              <label className="block">
                <span className="text-[10px] font-bold text-slate-500 uppercase">
                  Contact person
                </span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </label>

              {/* phone + email */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Phone
                  </span>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Email
                  </span>
                  <input
                    type="email"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>

              {/* tax PIN + VAT */}
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    Tax PIN
                  </span>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={taxPin}
                    onChange={(e) => setTaxPin(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    VAT number
                  </span>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                    value={vatNumber}
                    onChange={(e) => setVatNumber(e.target.value)}
                  />
                </label>
              </div>

              {/* compliance documents */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase">
                      Compliance documents
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Up to 5 files. Title is pre-filled from filename — edit
                      as needed.
                    </p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 border border-emerald-200 rounded-lg cursor-pointer hover:bg-emerald-50">
                    <Plus className="h-3 w-3" />
                    Add file
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      className="sr-only"
                      onChange={handleAddFiles}
                    />
                  </label>
                </div>

                {docFiles.length === 0 && (
                  <p className="text-[11px] text-slate-400 text-center py-3">
                    No files added yet
                  </p>
                )}

                {docFiles.map((d, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
                  >
                    <label className="block">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Title
                      </span>
                      <input
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                        value={d.title}
                        onChange={(e) =>
                          updateDocEntry(i, { title: e.target.value })
                        }
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Type
                      </span>
                      <select
                        className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-xs"
                        value={d.documentType}
                        onChange={(e) =>
                          updateDocEntry(i, {
                            documentType:
                              e.target.value as ComplianceDocumentType,
                          })
                        }
                      >
                        {COMPLIANCE_DOC_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => removeDocEntry(i)}
                      className="mb-0.5 p-1.5 text-slate-400 hover:text-red-500 rounded"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* footer actions */}
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 sticky bottom-0 bg-white">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Create supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}