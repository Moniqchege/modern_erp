import type { Customer } from "@prisma/client";
import { BadRequestError, NotFoundError } from "../../errors/http-error";
import { customerRepository } from "../../repositories/customer.repository";

/**
 * Prevents order creation when outstanding balance + new order would exceed credit limit.
 * Walk-in / cash customers (WALK_IN or zero credit limit) skip the check.
 */
export async function checkCreditAvailability(
  customerId: string,
  orderTotal: number
): Promise<void> {
  const customer = await customerRepository.findById(customerId);
  if (!customer) {
    throw new NotFoundError(`Customer with ID ${customerId} not found`);
  }

  assertCreditAvailable(customer, orderTotal);
}

export function assertCreditAvailable(customer: Customer, orderTotal: number): void {
  if (customer.type === "WALK_IN") return;
  if (Number(customer.creditLimit) <= 0) return;

  const projected =
    Number(customer.currentBalance) + orderTotal;
  const limit = Number(customer.creditLimit);

  if (projected > limit) {
    throw new BadRequestError(
      `Credit limit exceeded. Available credit: ${Math.max(0, limit - Number(customer.currentBalance)).toFixed(2)}, order total: ${orderTotal.toFixed(2)}`,
      "CREDIT_LIMIT_EXCEEDED"
    );
  }
}
