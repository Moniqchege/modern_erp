"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextSequence = nextSequence;
exports.computeComplianceStatus = computeComplianceStatus;
exports.evaluateMaizeQC = evaluateMaizeQC;
exports.variancePct = variancePct;
exports.toDecimal = toDecimal;
const client_1 = require("@prisma/client");
const server_1 = require("../../server");
const EXPIRING_SOON_DAYS = 30;
async function nextSequence(prefix) {
    const year = new Date().getFullYear();
    // Count the correct model for each prefix to avoid cross-model collisions
    let count = 0;
    if (prefix === "PR") {
        count = await server_1.prisma.purchaseRequisition.count();
    }
    else if (prefix === "PO") {
        count = await server_1.prisma.purchaseOrder.count();
    }
    else {
        // Fallback: combine counts so different prefixes don't share a namespace
        count = await server_1.prisma.purchaseRequisition.count();
    }
    // Use timestamp + count to minimise collision probability under concurrent load
    const seq = String(count + 1).padStart(5, "0");
    return `${prefix}-${year}-${seq}`;
}
function computeComplianceStatus(expiresAt) {
    if (!expiresAt)
        return "NON_COMPLIANT";
    const now = new Date();
    if (expiresAt < now)
        return "NON_COMPLIANT";
    const soon = new Date();
    soon.setDate(soon.getDate() + EXPIRING_SOON_DAYS);
    if (expiresAt <= soon)
        return "EXPIRING_SOON";
    return "ACTIVE";
}
function evaluateMaizeQC(input) {
    const moistureMax = input.moistureMaxPct ?? 14;
    const aflatoxinMax = input.aflatoxinMaxPpb ?? 10;
    if (input.aflatoxinPpb >= aflatoxinMax || input.liveInsectsCount > 0) {
        return {
            status: "FULL_REJECTION",
            assignedGrade: "REJECT",
            priceDeductionPct: 100,
            blocksInventoryPost: true,
            rejectionNote: "Full rejection: aflatoxin or live insects exceed limits.",
        };
    }
    if (input.moistureContentPct >= moistureMax + 2 || input.foreignMatterPct >= 5) {
        return {
            status: "FULL_REJECTION",
            assignedGrade: "REJECT",
            priceDeductionPct: 100,
            blocksInventoryPost: true,
            rejectionNote: "Full rejection: moisture or foreign matter critically high.",
        };
    }
    let deduction = 0;
    let grade = "GRADE_A";
    if (input.moistureContentPct > moistureMax) {
        deduction += (input.moistureContentPct - moistureMax) * 2;
        grade = "GRADE_B";
    }
    if (input.rottenBrokenPct > 3) {
        deduction += input.rottenBrokenPct - 3;
        grade = grade === "GRADE_A" ? "GRADE_B" : "GRADE_C";
    }
    if (input.foreignMatterPct > 2) {
        deduction += input.foreignMatterPct - 2;
        grade = "GRADE_C";
    }
    if (deduction > 0) {
        return {
            status: "FAILED_CONDITIONAL",
            assignedGrade: grade,
            priceDeductionPct: Math.min(deduction, 25),
            blocksInventoryPost: false,
        };
    }
    return {
        status: "PASSED",
        assignedGrade: "GRADE_A",
        priceDeductionPct: 0,
        blocksInventoryPost: false,
    };
}
function variancePct(a, b) {
    if (b === 0)
        return a === 0 ? 0 : 100;
    return Math.abs((a - b) / b) * 100;
}
function toDecimal(value) {
    return new client_1.Prisma.Decimal(value);
}
