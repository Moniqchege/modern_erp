import type { Request, Response } from "express";
import { listSalesProducts } from "../../services/sales/sales-product.service";

export async function listSalesProductsController(_req: Request, res: Response) {
  const products = await listSalesProducts();
  res.status(200).json({ products });
}
