import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import type { Customer } from "../../modules/sales/types/sales";

export function DispatchForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillCustomerId = searchParams.get("customerId") ?? "";
  const prefillOrderId = searchParams.get("salesOrderId") ?? "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [salesOrderId, setSalesOrderId] = useState(prefillOrderId);
  const [truckRegistration, setTruckRegistration] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const data = await salesApi.customers.list({ status: "ACTIVE" });
      setCustomers(data.customers ?? []);
      if (prefillCustomerId) {
        const c = data.customers?.find((x) => x.id === prefillCustomerId);
        if (c?.address) setDeliveryAddress(c.address);
      }
    })();
  }, [prefillCustomerId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !truckRegistration || !driverName || !deliveryAddress) {
      setError("Fill required fields");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await salesApi.dispatches.create({
        customerId,
        salesOrderId: salesOrderId || null,
        truckRegistration,
        driverName,
        driverPhone: driverPhone || null,
        deliveryAddress,
        remarks: remarks || null,
        items: [],
      });
      navigate(ROUTES.SALES_DISPATCH_DETAIL(res.dispatch.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-xl space-y-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.SALES_DISPATCHES)}
        className="flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-xl font-black">New dispatch</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-6 space-y-3">
        <select
          required
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={truckRegistration}
          onChange={(e) => setTruckRegistration(e.target.value)}
          placeholder="Truck registration *"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          required
        />
        <input
          value={driverName}
          onChange={(e) => setDriverName(e.target.value)}
          placeholder="Driver name *"
          className="w-full border rounded-lg px-3 py-2 text-sm"
          required
        />
        <input
          value={driverPhone}
          onChange={(e) => setDriverPhone(e.target.value)}
          placeholder="Driver phone"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={deliveryAddress}
          onChange={(e) => setDeliveryAddress(e.target.value)}
          placeholder="Delivery address *"
          className="w-full border rounded-lg px-3 py-2 text-sm min-h-[80px]"
          required
        />
        <input
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Remarks"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm flex justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create dispatch
        </button>
      </form>
    </div>
  );
}
