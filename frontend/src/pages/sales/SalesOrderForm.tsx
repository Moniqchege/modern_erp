import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { ROUTES } from "../../app/router/routes";
import { salesApi } from "../../modules/sales/api/salesClient";
import type { Customer, SalesProduct } from "../../modules/sales/types/sales";

type Line = { productSku: string; quantity: number };

export function SalesOrderForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefillCustomerId = searchParams.get("customerId") ?? "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [customerId, setCustomerId] = useState(prefillCustomerId);
  const [lines, setLines] = useState<Line[]>([{ productSku: "", quantity: 1 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const [c, p] = await Promise.all([
        salesApi.customers.list({ status: "ACTIVE" }),
        salesApi.products.list(),
      ]);
      setCustomers(c.customers ?? []);
      setProducts(p.products ?? []);
      if (p.products?.[0] && !lines[0].productSku) {
        setLines([{ productSku: p.products[0].sku, quantity: 1 }]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setError("Select a customer");
      return;
    }
    const validLines = lines.filter((l) => l.productSku && l.quantity > 0);
    if (validLines.length === 0) {
      setError("Add at least one line item");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await salesApi.orders.create({
        customerId,
        items: validLines,
      });
      navigate(ROUTES.SALES_ORDER_DETAIL(res.order.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <button
        type="button"
        onClick={() => navigate(ROUTES.SALES_ORDERS)}
        className="flex items-center gap-2 text-xs font-bold text-slate-500"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-xl font-black">New sales order</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="bg-white border rounded-2xl p-6 space-y-4">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase">Customer</label>
          <select
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="w-full mt-1 border rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase">Line items</label>
          {lines.map((line, idx) => (
            <div key={idx} className="flex gap-2">
              <select
                value={line.productSku}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, productSku: e.target.value };
                  setLines(next);
                }}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Product</option>
                {products.map((p) => (
                  <option key={p.sku} value={p.sku}>
                    {p.name} ({p.sku}) — KES {p.basePrice}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={0.001}
                step={0.001}
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx] = { ...line, quantity: Number(e.target.value) };
                  setLines(next);
                }}
                className="w-24 border rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                className="p-2 text-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setLines([...lines, { productSku: products[0]?.sku ?? "", quantity: 1 }])}
            className="text-xs font-bold text-indigo-600 flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Add line
          </button>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm flex justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Create order
        </button>
      </form>
    </div>
  );
}
