import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

async function main() {
  for (const product of PRODUCTS) {
    await prisma.salesProduct.upsert({
      where: { sku: product.sku },
      create: product,
      update: {
        name: product.name,
        description: product.description,
        basePrice: product.basePrice,
        unit: product.unit,
        category: product.category,
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
          phone: customer.phone,
          address: customer.address,
          type: customer.type,
          creditLimit: customer.creditLimit,
          creditDays: customer.creditDays,
          taxPin: customer.taxPin,
          status: "ACTIVE",
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
          phone: customer.phone,
          address: customer.address,
          type: customer.type,
          creditLimit: customer.creditLimit,
          creditDays: customer.creditDays,
          taxPin: customer.taxPin,
          status: "ACTIVE",
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log("Sales seed: 3 customers, 2 product SKUs");

  // --- FINANCE CHART OF ACCOUNTS SEED ---
  const ACCOUNTS = [
    { code: "1010", name: "Bank Current Account", type: "ASSET" as const, description: "Main operating bank account" },
    { code: "1020", name: "Petty Cash & Imprest Clearing", type: "ASSET" as const, description: "Clearing account for imprests and petty cash" },
    { code: "1200", name: "Accounts Receivable", type: "ASSET" as const, description: "Receivables from sales customers" },
    { code: "1300", name: "Inventory Asset", type: "ASSET" as const, description: "Valuation of warehouse inventory" },
    { code: "2010", name: "Accounts Payable", type: "LIABILITY" as const, description: "Payables to supplier vendors" },
    { code: "3010", name: "Retained Earnings", type: "EQUITY" as const, description: "Accumulated earnings of the enterprise" },
    { code: "4010", name: "Maize Flour Sales Revenue", type: "REVENUE" as const, description: "Revenue from sales products" },
    { code: "5010", name: "Operating & Travel Expenses", type: "EXPENSE" as const, description: "General office and business travel expenses" },
    { code: "5020", name: "Rent & Utilities", type: "EXPENSE" as const, description: "Factory rent and utility bills" },
  ];

  for (const acc of ACCOUNTS) {
    await prisma.financeAccount.upsert({
      where: { code: acc.code },
      create: { ...acc, balance: 100000.00 }, // Start with some initial balance for bank account, others at 0
      update: { name: acc.name, type: acc.type, description: acc.description },
    });
  }
  // eslint-disable-next-line no-console
  console.log("Finance seed: 9 General Ledger accounts seeded");

  // Set main bank account starting balance higher
  await prisma.financeAccount.update({
    where: { code: "1010" },
    data: { balance: 1500000.00 },
  });
  await prisma.financeAccount.update({
    where: { code: "1020" },
    data: { balance: 0.00 }, // Petty cash starts at 0
  });

  // --- BUDGET PERIODS & CATEGORIES SEED ---
  const periods = [
    { name: "FY 2026 Q2", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30"), status: "ACTIVE" as const },
    { name: "FY 2026 Q3", startDate: new Date("2026-07-01"), endDate: new Date("2026-09-30"), status: "ACTIVE" as const },
  ];

  const periodModels = [];
  for (const p of periods) {
    const pm = await prisma.budgetPeriod.upsert({
      where: { name: p.name },
      create: p,
      update: { startDate: p.startDate, endDate: p.endDate, status: p.status },
    });
    periodModels.push(pm);
  }

  const categories = [
    { name: "Travel & Logistics", code: "EXP-TRAV", description: "Business travel, transport, and lodging" },
    { name: "Office Supplies", code: "EXP-OFF", description: "Stationery, software licenses, printing" },
    { name: "Milling Consumables", code: "EXP-MILL", description: "Consumables, parts, and machine maintenance" },
    { name: "Marketing & Sales Promo", code: "EXP-MKT", description: "Advertisements, sales events, discounts" },
  ];

  const categoryModels = [];
  for (const c of categories) {
    const cm = await prisma.budgetCategory.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, description: c.description },
    });
    categoryModels.push(cm);
  }
  // eslint-disable-next-line no-console
  console.log("Budget seed: 2 periods, 4 categories seeded");

  // --- BUDGET ALLOCATIONS ---
  const q2Period = periodModels.find(p => p.name === "FY 2026 Q2");
  if (q2Period) {
    const travelCat = categoryModels.find(c => c.code === "EXP-TRAV");
    const officeCat = categoryModels.find(c => c.code === "EXP-OFF");
    const millCat = categoryModels.find(c => c.code === "EXP-MILL");
    const mktCat = categoryModels.find(c => c.code === "EXP-MKT");

    const allocations = [
      { periodId: q2Period.id, categoryId: travelCat!.id, department: "Administration", totalAllocation: 50000.00 },
      { periodId: q2Period.id, categoryId: officeCat!.id, department: "Administration", totalAllocation: 25000.00 },
      { periodId: q2Period.id, categoryId: millCat!.id, department: "Procurement", totalAllocation: 250000.00 },
      { periodId: q2Period.id, categoryId: mktCat!.id, department: "Sales", totalAllocation: 100000.00 },
    ];

    for (const alloc of allocations) {
      await prisma.budget.upsert({
        where: {
          periodId_categoryId_department: {
            periodId: alloc.periodId,
            categoryId: alloc.categoryId,
            department: alloc.department,
          },
        },
        create: alloc,
        update: { totalAllocation: alloc.totalAllocation },
      });
    }
    // eslint-disable-next-line no-console
    console.log("Budget seed: Q2 allocations successfully seeded");
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
