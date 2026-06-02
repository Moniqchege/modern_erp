import React, { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Loader2,
  Plus,
  Pencil,
  UserPlus,
  Trash2,
  RefreshCw,
  X,
  AlertCircle,
} from "lucide-react";
import { apiFetch } from "../../api/apiClient";
import { getCurrentUser } from "../../auth/authClient";

// ─── Types ────────────────────────────────────────────────────────────────────

type Store = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  isActive: boolean;
  isLegacy: boolean;
  createdAt: string;
  updatedAt: string;
};

type Assignment = {
  userId: string;
  storeId: string;
  storeCode: string;
  storeName: string;
  userName: string;
  userEmail: string;
  userRole: string;
  assignedAt: string;
};

// ─── Add Store Modal ──────────────────────────────────────────────────────────

interface AddStoreModalProps {
  onClose: () => void;
  onSaved: (store: Store) => void;
}

function AddStoreModal({ onClose, onSaved }: AddStoreModalProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedCode = code.trim();
    const trimmedName = name.trim();
    if (!trimmedCode) { setError("Store code is required."); return; }
    if (/\s/.test(trimmedCode)) { setError("Store code must not contain spaces."); return; }
    if (!trimmedName) { setError("Store name is required."); return; }
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch("/api/stores", {
        method: "POST",
        body: JSON.stringify({
          code: trimmedCode,
          name: trimmedName,
          description: description.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      onSaved(j.store as Store);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create store.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
              <Plus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Register Store</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Add a new store location</p>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex gap-2 items-start text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="add-store-code" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Store Code *</label>
            <input
              id="add-store-code"
              type="text"
              required
              maxLength={64}
              placeholder="e.g. BRANCH_NORTH"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-store-name" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Store Name *</label>
            <input
              id="add-store-name"
              type="text"
              required
              maxLength={255}
              placeholder="e.g. North Branch Store"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-store-desc" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
              Description <span className="text-slate-300 font-normal">optional</span>
            </label>
            <textarea
              id="add-store-desc"
              maxLength={1000}
              placeholder="Brief description of this store…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="add-store-address" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
              Address <span className="text-slate-300 font-normal">optional</span>
            </label>
            <input
              id="add-store-address"
              type="text"
              maxLength={500}
              placeholder="Physical address…"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#ff7d12] text-white text-xs font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving…" : "Register Store"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit Store Modal ─────────────────────────────────────────────────────────

interface EditStoreModalProps {
  store: Store;
  onClose: () => void;
  onSaved: (store: Store) => void;
}

function EditStoreModal({ store, onClose, onSaved }: EditStoreModalProps) {
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description ?? "");
  const [address, setAddress] = useState(store.address ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          address: address.trim() || undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      onSaved(j.store as Store);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update store.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-lg rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Edit Store</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">{store.code}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex gap-2 items-start text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="edit-store-name" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Store Name</label>
            <input
              id="edit-store-name"
              type="text"
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-store-desc" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
              Description <span className="text-slate-300 font-normal">optional</span>
            </label>
            <textarea
              id="edit-store-desc"
              maxLength={1000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="edit-store-address" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
              Address <span className="text-slate-300 font-normal">optional</span>
            </label>
            <input
              id="edit-store-address"
              type="text"
              maxLength={500}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#ff7d12] text-white text-xs font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Assign Manager Modal ─────────────────────────────────────────────────────

interface AssignManagerModalProps {
  activeStores: Store[];
  onClose: () => void;
  onSaved: () => void;
}

function AssignManagerModal({ activeStores, onClose, onSaved }: AssignManagerModalProps) {
  const [storeId, setStoreId] = useState(activeStores[0]?.id ?? "");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storeId) { setError("Please select a store."); return; }
    if (!userId.trim()) { setError("User ID is required."); return; }
    setError(null);
    setSaving(true);
    try {
      const res = await apiFetch(`/api/stores/${storeId}/assign-manager`, {
        method: "POST",
        body: JSON.stringify({ userId: userId.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign manager.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-orange-50 border border-orange-100 flex items-center justify-center text-orange-500">
              <UserPlus className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Assign Manager</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Assign a user as store manager</p>
            </div>
          </div>
          <button type="button" onClick={onClose} title="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex gap-2 items-start text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="assign-store-select" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">Store *</label>
            <select
              id="assign-store-select"
              required
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            >
              {activeStores.length === 0 && (
                <option value="">No active stores available</option>
              )}
              {activeStores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="assign-user-id" className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">User ID *</label>
            <input
              id="assign-user-id"
              type="text"
              required
              placeholder="Paste the user's UUID…"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400/20"
            />
          </div>
          <div className="pt-2 flex justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-[#ff7d12] text-white text-xs font-bold rounded-lg px-4 py-2 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Assigning…" : "Assign Manager"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Stores Tab ───────────────────────────────────────────────────────────────

interface StoresTabProps {
  stores: Store[];
  isAdmin: boolean;
  actionId: string | null;
  onEdit: (store: Store) => void;
  onToggleActive: (store: Store) => void;
  onRegister: () => void;
}

function StoresTab({ stores, isAdmin, actionId, onEdit, onToggleActive, onRegister }: StoresTabProps) {
  if (stores.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Building2 className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-700">No stores yet</p>
          <p className="text-xs text-slate-400 mt-1">Register your first store to get started.</p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={onRegister}
            className="flex items-center gap-2 bg-[#ff7d12] text-white text-xs font-bold rounded-lg px-4 py-2 mt-2"
          >
            <Plus className="h-3.5 w-3.5" />
            Register Store
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-extrabold tracking-widest uppercase">
              <th className="px-5 py-3.5">Code</th>
              <th className="px-5 py-3.5">Name</th>
              <th className="px-5 py-3.5">Description</th>
              <th className="px-5 py-3.5">Address</th>
              <th className="px-5 py-3.5">Status</th>
              {isAdmin && <th className="px-5 py-3.5 text-center">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
            {stores.map((store) => (
              <tr key={store.id} className="hover:bg-slate-50/40 transition-colors">
                <td className="px-5 py-3.5">
                  <span className="font-mono font-bold text-slate-800">{store.code}</span>
                  {store.isLegacy && (
                    <span className="ml-2 inline-block text-[9px] font-bold text-orange-700 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-md">
                      Legacy
                    </span>
                  )}
                </td>
                <td className="px-5 py-3.5 font-medium text-slate-800">{store.name}</td>
                <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                  {store.description ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-slate-500 max-w-xs truncate">
                  {store.address ?? <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5">
                  {store.isActive ? (
                    <span className="inline-block text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg">
                      Inactive
                    </span>
                  )}
                </td>
                {isAdmin && (
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-center gap-2">
                      {!store.isLegacy && (
                        <button
                          type="button"
                          disabled={actionId === store.id}
                          onClick={() => onEdit(store)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 text-[10px] font-bold text-slate-500 hover:text-orange-600 transition-all disabled:opacity-50"
                        >
                          <Pencil className="h-3 w-3" />
                          Edit
                        </button>
                      )}
                      {store.isActive ? (
                        <button
                          type="button"
                          disabled={actionId === store.id}
                          onClick={() => onToggleActive(store)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-[10px] font-bold text-rose-600 transition-all disabled:opacity-50"
                        >
                          {actionId === store.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Deactivate
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={actionId === store.id}
                          onClick={() => onToggleActive(store)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-white hover:bg-emerald-50 text-[10px] font-bold text-emerald-700 transition-all disabled:opacity-50"
                        >
                          {actionId === store.id ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Activate
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────────────────────

interface AssignmentsTabProps {
  assignments: Assignment[];
  loadingAssignments: boolean;
  activeStores: Store[];
  actionId: string | null;
  onRemove: (assignment: Assignment) => void;
  onAssign: () => void;
}

function AssignmentsTab({
  assignments,
  loadingAssignments,
  activeStores,
  actionId,
  onRemove,
  onAssign,
}: AssignmentsTabProps) {
  if (loadingAssignments) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading assignments…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {assignments.length} manager assignment{assignments.length !== 1 ? "s" : ""}
        </p>
        <button
          type="button"
          onClick={onAssign}
          className="flex items-center gap-2 bg-[#ff7d12] text-white text-xs font-bold rounded-lg px-4 py-2"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Assign Manager
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center py-12 text-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
            <UserPlus className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-700">No manager assignments</p>
            <p className="text-xs text-slate-400 mt-1">Assign managers to stores to get started.</p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-extrabold tracking-widest uppercase">
                  <th className="px-5 py-3.5">Store</th>
                  <th className="px-5 py-3.5">Manager</th>
                  <th className="px-5 py-3.5">Role</th>
                  <th className="px-5 py-3.5">Assigned</th>
                  <th className="px-5 py-3.5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-600">
                {assignments.map((a) => (
                  <tr key={`${a.storeId}-${a.userId}`} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">{a.storeName}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">{a.storeCode}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-800">{a.userName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{a.userEmail}</div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                        {a.userRole}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-slate-500">
                      {new Date(a.assignedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <button
                        type="button"
                        disabled={actionId === a.userId}
                        onClick={() => onRemove(a)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 text-[10px] font-bold text-rose-600 transition-all disabled:opacity-50 mx-auto"
                      >
                        {actionId === a.userId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Stores Component ────────────────────────────────────────────────────

export function Stores() {
  const user = getCurrentUser();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPERADMIN";

  const [activeTab, setActiveTab] = useState<"stores" | "assignments">("stores");

  // Stores state
  const [stores, setStores] = useState<Store[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  // Assignments state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [assignmentsError, setAssignmentsError] = useState<string | null>(null);
  const [assignmentsLoaded, setAssignmentsLoaded] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Store | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  // ── Load stores ──────────────────────────────────────────────────────────────

  const loadStores = useCallback(async () => {
    setLoadingStores(true);
    setStoresError(null);
    try {
      const res = await apiFetch("/api/stores");
      if (res.status === 401) { setStoresError("Session expired. Please log in again."); return; }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      setStores(j.stores ?? []);
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Failed to load stores.");
    } finally {
      setLoadingStores(false);
    }
  }, []);

  useEffect(() => { void loadStores(); }, [loadStores]);

  // ── Load assignments (admin only, lazy on tab switch) ─────────────────────

  const loadAssignments = useCallback(async () => {
    setLoadingAssignments(true);
    setAssignmentsError(null);
    try {
      const res = await apiFetch("/api/stores/assignments");
      if (res.status === 401) { setAssignmentsError("Session expired."); return; }
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? `HTTP ${res.status}`);
      setAssignments(j.assignments ?? []);
      setAssignmentsLoaded(true);
    } catch (err) {
      setAssignmentsError(err instanceof Error ? err.message : "Failed to load assignments.");
    } finally {
      setLoadingAssignments(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "assignments" && isAdmin && !assignmentsLoaded) {
      void loadAssignments();
    }
  }, [activeTab, isAdmin, assignmentsLoaded, loadAssignments]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleToggleActive = async (store: Store) => {
    if (store.isActive) {
      if (!window.confirm(`Deactivate store "${store.name}"?`)) return;
    }
    setActionId(store.id);
    setStoresError(null);
    try {
      const endpoint = store.isActive ? "deactivate" : "activate";
      const res = await apiFetch(`/api/stores/${store.id}/${endpoint}`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Action failed");
      setStores((prev) => prev.map((s) => (s.id === store.id ? (j.store as Store) : s)));
    } catch (err) {
      setStoresError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  const handleRemoveAssignment = async (assignment: Assignment) => {
    if (!window.confirm(`Remove manager assignment for "${assignment.userName}" from "${assignment.storeName}"?`)) return;
    setActionId(assignment.userId);
    setAssignmentsError(null);
    try {
      const res = await apiFetch(`/api/stores/assignments/${assignment.userId}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.message ?? "Failed to remove assignment");
      setAssignments((prev) => prev.filter((a) => !(a.userId === assignment.userId && a.storeId === assignment.storeId)));
    } catch (err) {
      setAssignmentsError(err instanceof Error ? err.message : "Failed to remove assignment.");
    } finally {
      setActionId(null);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const activeStores = stores.filter((s) => s.isActive);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Store Management</h1>
          <p className="text-xs text-slate-500 mt-1">Register stores and assign store managers</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { void loadStores(); if (activeTab === "assignments") { setAssignmentsLoaded(false); } }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-bold text-slate-600"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-[#ff7d12] text-white text-xs font-bold rounded-lg px-4 py-2"
            >
              <Plus className="h-3.5 w-3.5" />
              Register Store
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-6 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("stores")}
          className={`pb-3 text-xs font-bold transition-colors ${
            activeTab === "stores"
              ? "text-orange-700 border-b-2 border-orange-500 font-bold"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Stores
          <span className="ml-2 text-[10px] bg-slate-100 text-slate-500 font-bold px-1.5 py-0.5 rounded-md">
            {stores.length}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("assignments")}
          className={`pb-3 text-xs font-bold transition-colors ${
            activeTab === "assignments"
              ? "text-orange-700 border-b-2 border-orange-500 font-bold"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Manager Assignments
        </button>
      </div>

      {/* ── Stores tab ── */}
      {activeTab === "stores" && (
        <>
          {storesError && (
            <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
              {storesError}
            </div>
          )}
          {loadingStores ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading stores…
            </div>
          ) : (
            <StoresTab
              stores={stores}
              isAdmin={isAdmin}
              actionId={actionId}
              onEdit={(s) => setEditTarget(s)}
              onToggleActive={handleToggleActive}
              onRegister={() => setShowAddModal(true)}
            />
          )}
        </>
      )}

      {/* ── Assignments tab ── */}
      {activeTab === "assignments" && (
        <>
          {!isAdmin ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col items-center justify-center py-12 text-center gap-2">
              <p className="text-sm font-bold text-slate-700">Access Restricted</p>
              <p className="text-xs text-slate-400">You don't have permission to manage store assignments.</p>
            </div>
          ) : (
            <>
              {assignmentsError && (
                <div className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {assignmentsError}
                </div>
              )}
              <AssignmentsTab
                assignments={assignments}
                loadingAssignments={loadingAssignments}
                activeStores={activeStores}
                actionId={actionId}
                onRemove={handleRemoveAssignment}
                onAssign={() => setShowAssignModal(true)}
              />
            </>
          )}
        </>
      )}

      {/* ── Modals ── */}
      {showAddModal && (
        <AddStoreModal
          onClose={() => setShowAddModal(false)}
          onSaved={(s) => {
            setStores((prev) => [s, ...prev]);
            setShowAddModal(false);
          }}
        />
      )}

      {editTarget && (
        <EditStoreModal
          store={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(s) => {
            setStores((prev) => prev.map((st) => (st.id === s.id ? s : st)));
            setEditTarget(null);
          }}
        />
      )}

      {showAssignModal && (
        <AssignManagerModal
          activeStores={activeStores}
          onClose={() => setShowAssignModal(false)}
          onSaved={() => {
            setShowAssignModal(false);
            setAssignmentsLoaded(false);
            void loadAssignments();
          }}
        />
      )}
    </div>
  );
}
