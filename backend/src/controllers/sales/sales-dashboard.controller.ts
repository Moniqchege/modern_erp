import type { Request, Response } from "express";
import { getSalesDashboard } from "../../services/sales/sales-dashboard.service";

export async function getSalesDashboardController(_req: Request, res: Response) {
  const dashboard = await getSalesDashboard();
  res.status(200).json({ dashboard });
}
