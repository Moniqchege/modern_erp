import { ConflictError } from "../../errors/http-error";
import { customerRepository } from "../../repositories/customer.repository";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
} from "../../validation/sales/customer.schemas";

function formatCustomer(customer: Awaited<ReturnType<typeof customerRepository.findById>>) {
  if (!customer) return customer;
  return {
    ...customer,
    creditLimit: Number(customer.creditLimit),
    currentBalance: Number(customer.currentBalance),
  };
}

export async function listCustomers(query: ListCustomersQuery) {
  const rows = await customerRepository.findMany({
    type: query.type,
    status: query.status,
    creditStatus: query.creditStatus,
  });
  return rows.map((c) => formatCustomer(c)!);
}

export async function createCustomer(input: CreateCustomerInput) {
  if (input.email) {
    const existing = await customerRepository.findByEmail(input.email);
    if (existing) {
      throw new ConflictError("A customer with this email already exists");
    }
  }

  const creditLimit =
    input.type === "WALK_IN" ? 0 : (input.creditLimit ?? 0);

  const customer = await customerRepository.create({
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    type: input.type,
    creditLimit: creditLimit.toFixed(2),
    currentBalance: "0.00",
    creditDays: input.creditDays,
    taxPin: input.taxPin,
    status: input.status,
  });

  return formatCustomer(customer)!;
}
