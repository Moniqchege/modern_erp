import type { CustomerType } from "@prisma/client";
import { NotFoundError } from "../../errors/http-error";
import { customerRepository } from "../../repositories/customer.repository";
import { salesProductRepository } from "../../repositories/sales-product.repository";
import { TIER_DISCOUNT_PERCENT } from "./sales.constants";

export type PricedLine = {
  productSku: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  lineTotal: number;
};

/**
 * Applies tiered pricing: distributors receive the highest discount.
 */
export async function calculateTieredPricing(
  customerId: string,
  productSku: string,
  quantity: number
): Promise<PricedLine> {
  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError(`Customer with ID ${customerId} not found`);
  }

  const product = await salesProductRepository.findActiveBySku(productSku);
  if (!product) {
    throw new NotFoundError(`Product SKU ${productSku} not found or inactive`);
  }

  return priceLineForCustomer(customer.type, productSku, quantity, Number(product.basePrice));
}

export function priceLineForCustomer(
  customerType: CustomerType,
  productSku: string,
  quantity: number,
  basePrice: number
): PricedLine {
  const discountPercent = TIER_DISCOUNT_PERCENT[customerType] ?? 0;
  const unitPrice = roundMoney(basePrice * (1 - discountPercent / 100));
  const lineTotal = roundMoney(unitPrice * quantity);

  return {
    productSku,
    quantity,
    unitPrice,
    discountPercent,
    lineTotal,
  };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
