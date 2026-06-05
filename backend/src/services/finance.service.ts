import { PrismaClient, AccountType, AccountStatus, JournalStatus } from "@prisma/client";
import { HttpError } from "../errors/http-error";
import { prisma } from "../server";

export interface CreateAccountInput {
  code: string;
  name: string;
  type: AccountType;
  description?: string;
}

export interface CreateJournalLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface CreateJournalEntryInput {
  reference?: string;
  description: string;
  date?: string;
  lines: CreateJournalLineInput[];
}

export async function listAccounts() {
  return prisma.financeAccount.findMany({
    orderBy: { code: "asc" },
  });
}

export async function createAccount(data: CreateAccountInput) {
  const existing = await prisma.financeAccount.findUnique({
    where: { code: data.code },
  });

  if (existing) {
    throw new HttpError(400, `Account with code ${data.code} already exists`, "BAD_REQUEST");
  }

  return prisma.financeAccount.create({
    data: {
      code: data.code,
      name: data.name,
      type: data.type,
      description: data.description,
      balance: 0,
      status: AccountStatus.ACTIVE,
    },
  });
}

export async function listJournalEntries() {
  return prisma.journalEntry.findMany({
    include: {
      lines: {
        include: {
          account: {
            select: { code: true, name: true, type: true },
          },
        },
      },
      createdBy: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { date: "desc" },
  });
}

export async function createJournalEntry(userId: string, data: CreateJournalEntryInput) {
  if (!data.lines || data.lines.length < 2) {
    throw new HttpError(400, "A journal entry must have at least two lines", "BAD_REQUEST");
  }

  // Calculate sum of debits and credits
  let totalDebit = 0;
  let totalCredit = 0;

  for (const line of data.lines) {
    if (line.debit < 0 || line.credit < 0) {
      throw new HttpError(400, "Debits and credits cannot be negative values", "BAD_REQUEST");
    }
    if (line.debit > 0 && line.credit > 0) {
      throw new HttpError(400, "A single journal line cannot have both debit and credit values", "BAD_REQUEST");
    }
    if (line.debit === 0 && line.credit === 0) {
      throw new HttpError(400, "A journal line must have either a debit or a credit value", "BAD_REQUEST");
    }
    totalDebit += line.debit;
    totalCredit += line.credit;
  }

  // Allow minor decimal precision tolerance (e.g. 0.01)
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new HttpError(
      400,
      `Journal entry is out of balance. Total Debits: ${totalDebit}, Total Credits: ${totalCredit}`,
      "BAD_REQUEST"
    );
  }

  // Generate unique journal entry number
  const count = await prisma.journalEntry.count();
  const entryNumber = `JE-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  return prisma.journalEntry.create({
    data: {
      entryNumber,
      reference: data.reference,
      description: data.description,
      date: data.date ? new Date(data.date) : new Date(),
      status: JournalStatus.DRAFT,
      createdById: userId,
      lines: {
        create: data.lines.map((l) => ({
          accountId: l.accountId,
          debit: l.debit,
          credit: l.credit,
          description: l.description,
        })),
      },
    },
    include: {
      lines: true,
    },
  });
}

export async function postJournalEntry(entryId: string) {
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  });

  if (!entry) {
    throw new HttpError(404, "Journal entry not found", "NOT_FOUND");
  }

  if (entry.status === JournalStatus.POSTED) {
    throw new HttpError(400, "Journal entry is already posted", "BAD_REQUEST");
  }

  // Run in a transaction
  return prisma.$transaction(async (tx) => {
    // 1. Mark entry as posted
    const updatedEntry = await tx.journalEntry.update({
      where: { id: entryId },
      data: { status: JournalStatus.POSTED },
      include: {
        lines: {
          include: { account: true },
        },
      },
    });

    // 2. Update balances for each account
    for (const line of updatedEntry.lines) {
      const account = line.account;
      let balanceChange = 0;

      // Rules for balance computation:
      // Asset/Expense: debit increases, credit decreases
      // Liability/Equity/Revenue: credit increases, debit decreases
      const isDebitIncrease =
        account.type === AccountType.ASSET || account.type === AccountType.EXPENSE;

      const debitVal = Number(line.debit);
      const creditVal = Number(line.credit);

      if (isDebitIncrease) {
        balanceChange = debitVal - creditVal;
      } else {
        balanceChange = creditVal - debitVal;
      }

      await tx.financeAccount.update({
        where: { id: account.id },
        data: {
          balance: {
            increment: balanceChange,
          },
        },
      });
    }

    return updatedEntry;
  });
}

export async function getTrialBalance() {
  const accounts = await prisma.financeAccount.findMany({
    orderBy: { code: "asc" },
  });

  let totalDebit = 0;
  let totalCredit = 0;

  const records = accounts.map((acc) => {
    const bal = Number(acc.balance);
    let debit = 0;
    let credit = 0;

    const isDebitBalance =
      acc.type === AccountType.ASSET || acc.type === AccountType.EXPENSE;

    if (isDebitBalance) {
      if (bal >= 0) {
        debit = bal;
      } else {
        credit = Math.abs(bal);
      }
    } else {
      if (bal >= 0) {
        credit = bal;
      } else {
        debit = Math.abs(bal);
      }
    }

    totalDebit += debit;
    totalCredit += credit;

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      debit,
      credit,
    };
  });

  return {
    records,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
    },
  };
}

export async function getIncomeStatement() {
  const accounts = await prisma.financeAccount.findMany({
    where: {
      type: { in: [AccountType.REVENUE, AccountType.EXPENSE] },
    },
    orderBy: { code: "asc" },
  });

  const revenues = accounts
    .filter((a) => a.type === AccountType.REVENUE)
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      amount: Number(a.balance),
    }));

  const expenses = accounts
    .filter((a) => a.type === AccountType.EXPENSE)
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      amount: Number(a.balance),
    }));

  const totalRevenue = revenues.reduce((sum, r) => sum + r.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
  const netIncome = totalRevenue - totalExpense;

  return {
    revenues,
    expenses,
    totals: {
      revenue: totalRevenue,
      expense: totalExpense,
      netIncome,
    },
  };
}

export async function getBalanceSheet() {
  const accounts = await prisma.financeAccount.findMany({
    where: {
      type: { in: [AccountType.ASSET, AccountType.LIABILITY, AccountType.EQUITY] },
    },
    orderBy: { code: "asc" },
  });

  // Also include the current net income under Retained Earnings (Equity)
  const incomeStatement = await getIncomeStatement();
  const currentNetIncome = incomeStatement.totals.netIncome;

  const assets = accounts
    .filter((a) => a.type === AccountType.ASSET)
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      amount: Number(a.balance),
    }));

  const liabilities = accounts
    .filter((a) => a.type === AccountType.LIABILITY)
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      amount: Number(a.balance),
    }));

  const equities = accounts
    .filter((a) => a.type === AccountType.EQUITY)
    .map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      amount: Number(a.balance),
    }));

  // Append current Net Income to equity (or report it as a line item)
  equities.push({
    id: "net-income-calculation",
    code: "3999",
    name: "Retained Earnings (Current Period)",
    amount: currentNetIncome,
  });

  const totalAssets = assets.reduce((sum, a) => sum + a.amount, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);
  const totalEquity = equities.reduce((sum, e) => sum + e.amount, 0);

  return {
    assets,
    liabilities,
    equities,
    totals: {
      assets: totalAssets,
      liabilities: totalLiabilities,
      equity: totalEquity,
      liabilitiesAndEquity: totalLiabilities + totalEquity,
    },
  };
}
