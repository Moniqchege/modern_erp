import { Prisma } from "@prisma/client";
import { prisma } from "../../server";

const EXPIRING_SOON_DAYS = 30;

export async function nextSequence(prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const count = await prisma.purchaseOrder.count();
  const seq = String(count + 1).padStart(5, "0");
  return `${prefix}-${year}-${seq}`;
}

export function computeComplianceStatus(expiresAt: Date | null | undefined): "ACTIVE" | "EXPIRING_SOON" | "NON_COMPLIANT" {
  if (!expiresAt) return "NON_COMPLIANT";
  const now = new Date();
  if (expiresAt < now) return "NON_COMPLIANT";
  const soon = new Date();
  soon.setDate(soon.getDate() + EXPIRING_SOON_DAYS);
  if (expiresAt <= soon) return "EXPIRING_SOON";
  return "ACTIVE";
}

export interface MaizeQCInput {
  moistureContentPct: number;
  aflatoxinPpb: number;
  rottenBrokenPct: number;
  foreignMatterPct: number;
  liveInsectsCount: number;
  moistureMaxPct?: number;
  aflatoxinMaxPpb?: number;
}

export interface MaizeQCResult {
  status: "PASSED" | "FAILED_CONDITIONAL" | "FULL_REJECTION";
  assignedGrade: "GRADE_A" | "GRADE_B" | "GRADE_C" | "REJECT";
  priceDeductionPct: number;
  blocksInventoryPost: boolean;
  rejectionNote?: string;
}

export function evaluateMaizeQC(input: MaizeQCInput): MaizeQCResult {
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
  let grade: MaizeQCResult["assignedGrade"] = "GRADE_A";

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

export function variancePct(a: number, b: number): number {
  if (b === 0) return a === 0 ? 0 : 100;
  return Math.abs((a - b) / b) * 100;
}

export function toDecimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}
