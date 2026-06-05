"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPeriods = listPeriods;
exports.createPeriod = createPeriod;
exports.listCategories = listCategories;
exports.createCategory = createCategory;
exports.listAllocations = listAllocations;
exports.createAllocation = createAllocation;
exports.listImprestRequests = listImprestRequests;
exports.getImprestRequest = getImprestRequest;
exports.createImprestRequest = createImprestRequest;
exports.approveImprestRequest = approveImprestRequest;
exports.rejectImprestRequest = rejectImprestRequest;
exports.disburseImprestRequest = disburseImprestRequest;
exports.submitImprestSurrender = submitImprestSurrender;
exports.listSurrenders = listSurrenders;
exports.verifyImprestSurrender = verifyImprestSurrender;
const client_1 = require("@prisma/client");
const http_error_1 = require("../errors/http-error");
const server_1 = require("../server");
async function listPeriods() {
    return server_1.prisma.budgetPeriod.findMany({
        orderBy: { startDate: "desc" },
    });
}
async function createPeriod(name, startDate, endDate) {
    const existing = await server_1.prisma.budgetPeriod.findUnique({
        where: { name },
    });
    if (existing) {
        throw new http_error_1.HttpError(400, `Budget period ${name} already exists`, "BAD_REQUEST");
    }
    return server_1.prisma.budgetPeriod.create({
        data: { name, startDate, endDate, status: client_1.BudgetPeriodStatus.ACTIVE },
    });
}
async function listCategories() {
    return server_1.prisma.budgetCategory.findMany({
        orderBy: { code: "asc" },
    });
}
async function createCategory(name, code, description) {
    const existing = await server_1.prisma.budgetCategory.findUnique({
        where: { code },
    });
    if (existing) {
        throw new http_error_1.HttpError(400, `Category code ${code} already exists`, "BAD_REQUEST");
    }
    return server_1.prisma.budgetCategory.create({
        data: { name, code, description },
    });
}
async function listAllocations(periodId) {
    return server_1.prisma.budget.findMany({
        where: periodId ? { periodId } : undefined,
        include: {
            period: true,
            category: true,
        },
        orderBy: { department: "asc" },
    });
}
async function createAllocation(periodId, categoryId, department, amount) {
    if (amount <= 0) {
        throw new http_error_1.HttpError(400, "Allocation amount must be greater than zero", "BAD_REQUEST");
    }
    // Upsert the allocation
    return server_1.prisma.budget.upsert({
        where: {
            periodId_categoryId_department: {
                periodId,
                categoryId,
                department,
            },
        },
        create: {
            periodId,
            categoryId,
            department,
            totalAllocation: amount,
            spentAmount: 0,
            committedAmount: 0,
        },
        update: {
            totalAllocation: amount,
        },
    });
}
async function listImprestRequests(requesterId, status) {
    return server_1.prisma.imprestRequest.findMany({
        where: {
            requesterId: requesterId ? requesterId : undefined,
            status: status ? status : undefined,
        },
        include: {
            requester: { select: { id: true, name: true, email: true } },
            approver: { select: { id: true, name: true, email: true } },
            budget: {
                include: {
                    period: true,
                    category: true,
                },
            },
            surrender: {
                include: {
                    verifiedBy: { select: { id: true, name: true } },
                },
            },
        },
        orderBy: { createdAt: "desc" },
    });
}
async function getImprestRequest(id) {
    const request = await server_1.prisma.imprestRequest.findUnique({
        where: { id },
        include: {
            requester: { select: { id: true, name: true, email: true } },
            approver: { select: { id: true, name: true, email: true } },
            budget: {
                include: {
                    period: true,
                    category: true,
                },
            },
            surrender: {
                include: {
                    verifiedBy: { select: { id: true, name: true } },
                },
            },
        },
    });
    if (!request) {
        throw new http_error_1.HttpError(404, "Imprest request not found", "NOT_FOUND");
    }
    return request;
}
async function createImprestRequest(userId, department, budgetId, amount, purpose) {
    if (amount <= 0) {
        throw new http_error_1.HttpError(400, "Request amount must be greater than zero", "BAD_REQUEST");
    }
    const budget = await server_1.prisma.budget.findUnique({
        where: { id: budgetId },
        include: { period: true },
    });
    if (!budget) {
        throw new http_error_1.HttpError(404, "Target budget allocation not found", "NOT_FOUND");
    }
    if (budget.period.status !== client_1.BudgetPeriodStatus.ACTIVE) {
        throw new http_error_1.HttpError(400, "Cannot request funds from a closed budget period", "BAD_REQUEST");
    }
    const remaining = Number(budget.totalAllocation) - Number(budget.spentAmount) - Number(budget.committedAmount);
    if (amount > remaining) {
        throw new http_error_1.HttpError(400, `Insufficient budget. Requested: ${amount}, Remaining: ${remaining}`, "BAD_REQUEST");
    }
    const count = await server_1.prisma.imprestRequest.count();
    const requestNo = `IMP-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    return server_1.prisma.imprestRequest.create({
        data: {
            requestNo,
            requesterId: userId,
            department,
            budgetId,
            amount,
            purpose,
            status: client_1.ImprestStatus.PENDING_APPROVAL,
        },
    });
}
async function approveImprestRequest(userId, requestId) {
    const request = await server_1.prisma.imprestRequest.findUnique({
        where: { id: requestId },
        include: { budget: true },
    });
    if (!request) {
        throw new http_error_1.HttpError(404, "Imprest request not found", "NOT_FOUND");
    }
    if (request.status !== client_1.ImprestStatus.PENDING_APPROVAL) {
        throw new http_error_1.HttpError(400, `Imprest request cannot be approved from status: ${request.status}`, "BAD_REQUEST");
    }
    // Update budget committed amount and update request status
    return server_1.prisma.$transaction(async (tx) => {
        await tx.budget.update({
            where: { id: request.budgetId },
            data: {
                committedAmount: {
                    increment: request.amount,
                },
            },
        });
        return tx.imprestRequest.update({
            where: { id: requestId },
            data: {
                status: client_1.ImprestStatus.APPROVED,
                approverId: userId,
                approvedAt: new Date(),
            },
            include: {
                requester: { select: { name: true } },
            },
        });
    });
}
async function rejectImprestRequest(userId, requestId, reason) {
    const request = await server_1.prisma.imprestRequest.findUnique({
        where: { id: requestId },
    });
    if (!request) {
        throw new http_error_1.HttpError(404, "Imprest request not found", "NOT_FOUND");
    }
    if (request.status !== client_1.ImprestStatus.PENDING_APPROVAL && request.status !== client_1.ImprestStatus.APPROVED) {
        throw new http_error_1.HttpError(400, `Imprest request cannot be rejected from status: ${request.status}`, "BAD_REQUEST");
    }
    return server_1.prisma.$transaction(async (tx) => {
        // If it was already approved (and thus committed), decrement budget commitment
        if (request.status === client_1.ImprestStatus.APPROVED) {
            await tx.budget.update({
                where: { id: request.budgetId },
                data: {
                    committedAmount: {
                        decrement: request.amount,
                    },
                },
            });
        }
        return tx.imprestRequest.update({
            where: { id: requestId },
            data: {
                status: client_1.ImprestStatus.REJECTED,
                approverId: userId,
                rejectionReason: reason || "Rejected by manager",
            },
        });
    });
}
async function disburseImprestRequest(userId, requestId, paymentMethod, referenceNo) {
    const request = await server_1.prisma.imprestRequest.findUnique({
        where: { id: requestId },
        include: {
            requester: true,
            budget: { include: { category: true } },
        },
    });
    if (!request) {
        throw new http_error_1.HttpError(404, "Imprest request not found", "NOT_FOUND");
    }
    if (request.status !== client_1.ImprestStatus.APPROVED) {
        throw new http_error_1.HttpError(400, `Imprest request cannot be disbursed from status: ${request.status}`, "BAD_REQUEST");
    }
    return server_1.prisma.$transaction(async (tx) => {
        // 1. Mark request as disbursed
        const updated = await tx.imprestRequest.update({
            where: { id: requestId },
            data: {
                status: client_1.ImprestStatus.DISBURSED,
                disbursementDate: new Date(),
                paymentMethod,
                referenceNo,
            },
        });
        // 2. Automate Journal Entry: Debit Imprest Clearing/Petty Cash, Credit Bank
        // First find accounts by code
        const pettyCashAcc = await tx.financeAccount.findUnique({
            where: { code: "1020" }, // Imprest Clearing / Petty Cash code
        });
        const bankAcc = await tx.financeAccount.findUnique({
            where: { code: "1010" }, // Bank Account code
        });
        if (pettyCashAcc && bankAcc) {
            const jeNumber = `JE-IMP-${request.requestNo}`;
            // Upsert/Create Journal entry
            const journalEntry = await tx.journalEntry.create({
                data: {
                    entryNumber: jeNumber,
                    reference: request.requestNo,
                    description: `Disbursement of imprest request ${request.requestNo} to ${request.requester.name} for ${request.purpose}`,
                    status: client_1.JournalStatus.POSTED,
                    createdById: userId,
                    lines: {
                        create: [
                            {
                                accountId: pettyCashAcc.id,
                                debit: request.amount,
                                credit: 0,
                                description: `Debit Imprest clearing for ${request.requester.name}`,
                            },
                            {
                                accountId: bankAcc.id,
                                debit: 0,
                                credit: request.amount,
                                description: `Credit bank account for imprest payout`,
                            },
                        ],
                    },
                },
            });
            // Update balances directly (as the JE status is POSTED)
            await tx.financeAccount.update({
                where: { id: pettyCashAcc.id },
                data: { balance: { increment: request.amount } },
            });
            await tx.financeAccount.update({
                where: { id: bankAcc.id },
                data: { balance: { decrement: request.amount } },
            });
        }
        return updated;
    });
}
async function submitImprestSurrender(userId, requestId, actualSpent, receiptUrl) {
    if (actualSpent < 0) {
        throw new http_error_1.HttpError(400, "Actual spent amount cannot be negative", "BAD_REQUEST");
    }
    const request = await server_1.prisma.imprestRequest.findUnique({
        where: { id: requestId },
        include: { surrender: true },
    });
    if (!request) {
        throw new http_error_1.HttpError(404, "Imprest request not found", "NOT_FOUND");
    }
    if (request.status !== client_1.ImprestStatus.DISBURSED) {
        throw new http_error_1.HttpError(400, `Cannot surrender imprest from request status: ${request.status}`, "BAD_REQUEST");
    }
    const refundAmount = Number(request.amount) - actualSpent;
    const count = await server_1.prisma.imprestSurrender.count();
    const surrenderNo = `SUR-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;
    return server_1.prisma.imprestSurrender.create({
        data: {
            surrenderNo,
            imprestRequestId: requestId,
            actualSpent,
            refundAmount: refundAmount > 0 ? refundAmount : 0,
            receiptUrl,
            status: client_1.SurrenderStatus.PENDING,
        },
    });
}
async function listSurrenders() {
    return server_1.prisma.imprestSurrender.findMany({
        include: {
            imprestRequest: {
                include: {
                    requester: { select: { name: true } },
                    budget: { include: { category: true } },
                },
            },
            verifiedBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
    });
}
async function verifyImprestSurrender(userId, surrenderId, approve, reason) {
    const surrender = await server_1.prisma.imprestSurrender.findUnique({
        where: { id: surrenderId },
        include: {
            imprestRequest: {
                include: {
                    requester: true,
                    budget: { include: { category: true } },
                },
            },
        },
    });
    if (!surrender) {
        throw new http_error_1.HttpError(404, "Imprest surrender request not found", "NOT_FOUND");
    }
    if (surrender.status !== client_1.SurrenderStatus.PENDING) {
        throw new http_error_1.HttpError(400, `Imprest surrender is already processed as ${surrender.status}`, "BAD_REQUEST");
    }
    const request = surrender.imprestRequest;
    return server_1.prisma.$transaction(async (tx) => {
        if (approve) {
            // 1. Update surrender status to APPROVED
            const updatedSurrender = await tx.imprestSurrender.update({
                where: { id: surrenderId },
                data: {
                    status: client_1.SurrenderStatus.APPROVED,
                    verifiedById: userId,
                    verifiedAt: new Date(),
                },
            });
            // 2. Update Imprest Request status to SURRENDERED
            await tx.imprestRequest.update({
                where: { id: request.id },
                data: { status: client_1.ImprestStatus.SURRENDERED },
            });
            // 3. Update budget allocation: committed -= requestAmount, spent += actualSpent
            await tx.budget.update({
                where: { id: request.budgetId },
                data: {
                    committedAmount: { decrement: request.amount },
                    spentAmount: { increment: surrender.actualSpent },
                },
            });
            // 4. Post Journal Entry:
            // Debit Expense (based on category code/budget category),
            // Debit Cash/Bank (refund amount if actualSpent < originalAmount),
            // Credit Petty Cash (original amount)
            // Note: If actualSpent > originalAmount, the user might request top up, but we cap it at original imprest amount here.
            const pettyCashAcc = await tx.financeAccount.findUnique({
                where: { code: "1020" },
            });
            const bankAcc = await tx.financeAccount.findUnique({
                where: { code: "1010" },
            });
            // Try to find a specific expense account related to category, otherwise default to Operational Expense "5010"
            let expenseAcc = await tx.financeAccount.findUnique({
                where: { code: "5010" }, // Operational Expenses default
            });
            if (pettyCashAcc && bankAcc && expenseAcc) {
                const jeNumber = `JE-SUR-${surrender.surrenderNo}`;
                const refundVal = Number(surrender.refundAmount);
                const spentVal = Number(surrender.actualSpent);
                const reqVal = Number(request.amount);
                const journalLines = [
                    {
                        accountId: expenseAcc.id,
                        debit: spentVal,
                        credit: 0,
                        description: `Expense booking for imprest surrender ${surrender.surrenderNo} (${request.budget.category.name})`,
                    },
                    {
                        accountId: pettyCashAcc.id,
                        debit: 0,
                        credit: reqVal,
                        description: `Clear imprest receivable of ${reqVal}`,
                    },
                ];
                // If there was a refund, debit bank to receipt the refund
                if (refundVal > 0) {
                    journalLines.push({
                        accountId: bankAcc.id,
                        debit: refundVal,
                        credit: 0,
                        description: `Unused imprest funds refund from ${request.requester.name}`,
                    });
                }
                await tx.journalEntry.create({
                    data: {
                        entryNumber: jeNumber,
                        reference: surrender.surrenderNo,
                        description: `Reconciliation of imprest surrender ${surrender.surrenderNo} for ${request.requester.name}`,
                        status: client_1.JournalStatus.POSTED,
                        createdById: userId,
                        lines: {
                            create: journalLines,
                        },
                    },
                });
                // Update balances
                await tx.financeAccount.update({
                    where: { id: expenseAcc.id },
                    data: { balance: { increment: spentVal } },
                });
                await tx.financeAccount.update({
                    where: { id: pettyCashAcc.id },
                    data: { balance: { decrement: reqVal } },
                });
                if (refundVal > 0) {
                    await tx.financeAccount.update({
                        where: { id: bankAcc.id },
                        data: { balance: { increment: refundVal } },
                    });
                }
            }
            return updatedSurrender;
        }
        else {
            // Reject surrender: set surrender status to REJECTED, and reset imprest request status to DISBURSED
            // so that they can submit it again.
            const updatedSurrender = await tx.imprestSurrender.update({
                where: { id: surrenderId },
                data: {
                    status: client_1.SurrenderStatus.REJECTED,
                    verifiedById: userId,
                    verifiedAt: new Date(),
                    rejectionReason: reason || "Rejected by finance team",
                },
            });
            await tx.imprestRequest.update({
                where: { id: request.id },
                data: { status: client_1.ImprestStatus.DISBURSED },
            });
            return updatedSurrender;
        }
    });
}
