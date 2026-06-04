import { ConflictError, NotFoundError } from "../../errors/http-error";
import { customerRepository } from "../../repositories/customer.repository";
import type {
  CreateCustomerInput,
  ListCustomersQuery,
  UpdateCustomerInput,
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

export async function getCustomerById(id: string) {
  const customer = await customerRepository.findById(id);
  if (!customer) {
    throw new NotFoundError(`Customer ${id} not found`);
  }
  return formatCustomer(customer)!;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const existing = await customerRepository.findById(id);
  if (!existing) {
    throw new NotFoundError(`Customer ${id} not found`);
  }

  if (input.email && input.email !== existing.email) {
    const dup = await customerRepository.findByEmail(input.email);
    if (dup) {
      throw new ConflictError("A customer with this email already exists");
    }
  }

  const creditLimit =
    input.type === "WALK_IN"
      ? "0.00"
      : input.creditLimit !== undefined
        ? input.creditLimit.toFixed(2)
        : undefined;

  const updated = await customerRepository.update(id, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.email !== undefined ? { email: input.email } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.type !== undefined ? { type: input.type } : {}),
    ...(creditLimit !== undefined ? { creditLimit } : {}),
    ...(input.creditDays !== undefined ? { creditDays: input.creditDays } : {}),
    ...(input.taxPin !== undefined ? { taxPin: input.taxPin } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });

  return formatCustomer(updated)!;
}
