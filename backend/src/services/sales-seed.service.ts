import { prisma } from "../server";

const CUSTOMERS = [
  {
    name: "Nairobi Grain Distributors Ltd",
    email: "orders@nairobigrain.co.ke",
    phone: "+254712000101",
    address: "Industrial Area, Nairobi",
    type: "DISTRIBUTOR" as const,
    creditLimit: "500000.00",
    creditDays: 30,
    taxPin: "P051234567A",
  },
  {
    name: "Rift Valley Wholesalers",
    email: "sales@riftwholesale.co.ke",
    phone: "+254712000202",
    address: "Eldoret Town, Uasin Gishu",
    type: "WHOLESALER" as const,
    creditLimit: "150000.00",
    creditDays: 21,
    taxPin: "P051234568B",
  },
  {
    name: "Walk-in Counter",
    email: null,
    phone: "+254700000303",
    address: "Factory Gate, Plant Reception",
    type: "WALK_IN" as const,
    creditLimit: "0.00",
    creditDays: 0,
    taxPin: null,
  },
];

const PRODUCTS = [
  {
    sku: "FLR-PREM-2KG",
    name: "Premium Maize Flour 2kg",
    description: "2kg retail pack — premium grade",
    basePrice: "185.00",
    unit: "bag",
    category: "FLOUR",
  },
  {
    sku: "FLR-BALE-24KG",
    name: "Maize Flour Bale 24kg",
    description: "24kg wholesale bale",
    basePrice: "1980.00",
    unit: "bale",
    category: "FLOUR",
  },
];

export async function seedSalesModuleIfNeeded(): Promise<void> {
  for (const product of PRODUCTS) {
    await prisma.salesProduct.upsert({
      where: { sku: product.sku },
      create: product,
      update: {
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        isActive: true,
      },
    });
  }

  for (const customer of CUSTOMERS) {
    if (customer.email) {
      await prisma.customer.upsert({
        where: { email: customer.email },
        create: {
          ...customer,
          currentBalance: "0.00",
          status: "ACTIVE",
        },
        update: {
          name: customer.name,
          type: customer.type,
          creditLimit: customer.creditLimit,
          creditDays: customer.creditDays,
          taxPin: customer.taxPin,
        },
      });
    } else {
      await prisma.customer.upsert({
        where: { id: "seed-walk-in-customer" },
        create: {
          id: "seed-walk-in-customer",
          ...customer,
          currentBalance: "0.00",
          status: "ACTIVE",
        },
        update: {
          name: customer.name,
          type: customer.type,
          creditLimit: customer.creditLimit,
        },
      });
    }
  }
}
