import { salesProductRepository } from "../../repositories/sales-product.repository";

export async function listSalesProducts() {
  const rows = await salesProductRepository.findManyActive();
  return rows.map((p) => ({
    ...p,
    basePrice: Number(p.basePrice),
  }));
}
