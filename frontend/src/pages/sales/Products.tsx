import React, { useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { salesApi } from "../../modules/sales/api/salesClient";
import type { SalesProduct } from "../../modules/sales/types/sales";

export function Products() {
  const [products, setProducts] = useState<SalesProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const data = await salesApi.products.list();
        setProducts(data.products ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-black">Product catalog</h1>
        <p className="text-xs text-slate-500">Tiered pricing applied by customer type at order time</p>
      </div>
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {products.map((p) => (
            <div key={p.id} className="bg-white border rounded-2xl p-5 flex gap-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Package className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">{p.name}</h3>
                <p className="text-[10px] font-mono text-slate-500">{p.sku}</p>
                <p className="text-sm font-black text-indigo-700 mt-2">
                  KES {p.basePrice.toLocaleString()} / {p.unit}
                </p>
                {p.description && (
                  <p className="text-xs text-slate-500 mt-1">{p.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
