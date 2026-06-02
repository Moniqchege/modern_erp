import ExcelJS from "exceljs";
import { prisma } from "../server";

export type ProcurementReportType =
    | "supplier-directory"
    | "supplier-compliance"
    | "requisitions"
    | "purchase-orders"
    | "po-line-items"
    | "grn-register"
    | "spend-by-supplier"
    | "three-way-match"
    | "payment-vouchers";

export const PROCUREMENT_REPORT_TYPES: Array<{
    id: ProcurementReportType;
    label: string;
    description: string;
    dateRange: boolean;
}> = [
        {
            id: "supplier-directory",
            label: "Supplier directory",
            description: "All suppliers — contact info, status, onboarding stage, bank details",
            dateRange: false,
        },
        {
            id: "requisitions",
            label: "Purchase requisitions",
            description: "All requisitions with status, department, estimated total and approvals",
            dateRange: true,
        },
        {
            id: "purchase-orders",
            label: "Purchase orders",
            description: "All POs with supplier, subtotal, VAT, total, status and delivery date",
            dateRange: true,
        },
        {
            id: "po-line-items",
            label: "PO line items",
            description: "Every line item across all POs — item, qty ordered, received and unit price",
            dateRange: true,
        },
        {
            id: "grn-register",
            label: "GRN register",
            description: "Goods received notes with PO reference, supplier, quantities and QC status",
            dateRange: true,
        },
        {
            id: "spend-by-supplier",
            label: "Spend by supplier",
            description: "Total PO spend aggregated per supplier for the selected date range",
            dateRange: true,
        },
        {
            id: "three-way-match",
            label: "3-way match & invoices",
            description: "Invoice match records with PO, GRN and invoice amounts, discrepancies and status",
            dateRange: true,
        },
    ];

function parseDateRange(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(Date.now() - 365 * 86400000);
    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);
    return { fromDate, toDate };
}

function styleHeader(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF059669" }, // emerald-600
    };
    headerRow.alignment = { vertical: "middle" };
    headerRow.height = 18;
}

function n(v: unknown): number {
    return Number(v) || 0;
}

function d(v: Date | null | undefined): string {
    return v ? v.toISOString().slice(0, 10) : "";
}

async function buildWorkbook(
    reportType: ProcurementReportType,
    from?: string,
    to?: string
): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Modern ERP – Procurement";
    const { fromDate, toDate } = parseDateRange(from, to);

    // ── 1. Supplier directory ─────────────────────────────────────────────────
    if (reportType === "supplier-directory") {
        const sheet = wb.addWorksheet("Supplier Directory");
        sheet.columns = [
            { header: "Code", key: "code", width: 12 },
            { header: "Name", key: "name", width: 30 },
            { header: "Contact person", key: "contactPerson", width: 22 },
            { header: "Phone", key: "phone", width: 16 },
            { header: "Email", key: "email", width: 28 },
            { header: "Status", key: "status", width: 12 },
            { header: "Onboarding status", key: "onboardingStatus", width: 20 },
            { header: "Tax PIN", key: "taxPin", width: 16 },
            { header: "VAT number", key: "vatNumber", width: 16 },
            { header: "Bank name", key: "bankName", width: 20 },
            { header: "Bank account", key: "bankAccountNo", width: 18 },
            { header: "Bank branch", key: "bankBranch", width: 18 },
            { header: "Address", key: "address", width: 30 },
            { header: "Activated at", key: "activatedAt", width: 14 },
            { header: "Created at", key: "createdAt", width: 14 },
        ];
        styleHeader(sheet);

        const suppliers = await prisma.supplier.findMany({ orderBy: { name: "asc" } });
        for (const s of suppliers) {
            sheet.addRow({
                code: s.code,
                name: s.name,
                contactPerson: s.contactPerson ?? "",
                phone: s.phone ?? "",
                email: s.email ?? "",
                status: s.status,
                onboardingStatus: s.onboardingStatus,
                taxPin: s.taxPin ?? "",
                vatNumber: s.vatNumber ?? "",
                bankName: s.bankName ?? "",
                bankAccountNo: s.bankAccountNo ?? "",
                bankBranch: s.bankBranch ?? "",
                address: s.address ?? "",
                activatedAt: d(s.activatedAt),
                createdAt: d(s.createdAt),
            });
        }
        return wb;
    }

    // ── 2. Supplier compliance documents ─────────────────────────────────────
    if (reportType === "supplier-compliance") {
        const sheet = wb.addWorksheet("Compliance Documents");
        sheet.columns = [
            { header: "Supplier code", key: "supplierCode", width: 14 },
            { header: "Supplier name", key: "supplierName", width: 28 },
            { header: "Document type", key: "documentType", width: 24 },
            { header: "Document number", key: "documentNumber", width: 20 },
            { header: "Issue date", key: "issueDate", width: 14 },
            { header: "Expiry date", key: "expiryDate", width: 14 },
            { header: "Status", key: "status", width: 16 },
            { header: "File URL", key: "fileUrl", width: 40 },
            { header: "Created at", key: "createdAt", width: 14 },
        ];
        styleHeader(sheet);

        const docs = await prisma.supplierComplianceDocument.findMany({
            orderBy: [{ supplier: { name: "asc" } }, { createdAt: "desc" }],
            include: { supplier: { select: { code: true, name: true } } },
        });
        for (const doc of docs) {
            sheet.addRow({
                supplierCode: doc.supplier.code,
                supplierName: doc.supplier.name,
                documentType: doc.documentType,
                documentNumber: doc.referenceNo ?? "",
                issueDate: d(doc.issuedAt ?? null),
                expiryDate: d(doc.expiresAt ?? null),
                status: doc.status,
                fileUrl: doc.fileUrl ?? "",
                createdAt: d(doc.createdAt),
            });
        }
        return wb;
    }

    // ── 3. Purchase requisitions ──────────────────────────────────────────────
    if (reportType === "requisitions") {
        const sheet = wb.addWorksheet("Purchase Requisitions");
        sheet.columns = [
            { header: "Req no.", key: "requisitionNo", width: 16 },
            { header: "Status", key: "status", width: 22 },
            { header: "Requested by", key: "requestedBy", width: 20 },
            { header: "Department", key: "department", width: 16 },
            { header: "Source", key: "source", width: 22 },
            { header: "Supplier", key: "supplierName", width: 26 },
            { header: "Currency", key: "currency", width: 10 },
            { header: "Est. subtotal", key: "estimatedTotal", width: 16 },
            { header: "Required by", key: "requiredByDate", width: 14 },
            { header: "Approved at", key: "approvedAt", width: 14 },
            { header: "Rejection reason", key: "rejectionReason", width: 30 },
            { header: "Justification", key: "justification", width: 36 },
            { header: "Created at", key: "createdAt", width: 14 },
        ];
        styleHeader(sheet);

        const reqs = await prisma.purchaseRequisition.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            orderBy: { createdAt: "desc" },
            include: { supplier: { select: { name: true } } },
        });
        for (const r of reqs) {
            sheet.addRow({
                requisitionNo: r.requisitionNo,
                status: r.status,
                requestedBy: r.requestedBy,
                department: r.department ?? "",
                source: r.source,
                supplierName: r.supplier?.name ?? "",
                currency: r.currency,
                estimatedTotal: n(r.estimatedTotal),
                requiredByDate: d(r.requiredByDate ?? null),
                approvedAt: d(r.approvedAt ?? null),
                rejectionReason: r.rejectionReason ?? "",
                justification: r.justification ?? "",
                createdAt: d(r.createdAt),
            });
        }
        return wb;
    }

    // ── 4. Purchase orders ────────────────────────────────────────────────────
    if (reportType === "purchase-orders") {
        const sheet = wb.addWorksheet("Purchase Orders");
        sheet.columns = [
            { header: "PO number", key: "poNumber", width: 16 },
            { header: "Status", key: "status", width: 20 },
            { header: "Supplier", key: "supplierName", width: 28 },
            { header: "Currency", key: "currency", width: 10 },
            { header: "Subtotal", key: "subtotal", width: 16 },
            { header: "Tax rate (%)", key: "taxRate", width: 12 },
            { header: "VAT amount", key: "taxAmount", width: 16 },
            { header: "Total amount", key: "totalAmount", width: 16 },
            { header: "Expected delivery", key: "expectedDelivery", width: 18 },
            { header: "Issued at", key: "issuedAt", width: 14 },
            { header: "Issued by", key: "issuedBy", width: 20 },
            { header: "Linked req. no.", key: "requisitionNo", width: 16 },
            { header: "Created at", key: "createdAt", width: 14 },
        ];
        styleHeader(sheet);

        const pos = await prisma.purchaseOrder.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            orderBy: { createdAt: "desc" },
            include: {
                supplier: { select: { name: true } },
                requisition: { select: { requisitionNo: true } },
            },
        });
        for (const po of pos) {
            sheet.addRow({
                poNumber: po.poNumber,
                status: po.status,
                supplierName: po.supplier.name,
                currency: po.currency,
                subtotal: n(po.subtotal),
                taxRate: n(po.taxRate),
                taxAmount: n(po.taxAmount),
                totalAmount: n(po.totalAmount),
                expectedDelivery: d(po.expectedDelivery ?? null),
                issuedAt: d(po.issuedAt ?? null),
                issuedBy: po.issuedBy ?? "",
                requisitionNo: po.requisition?.requisitionNo ?? "",
                createdAt: d(po.createdAt),
            });
        }
        return wb;
    }

    // ── 5. PO line items ──────────────────────────────────────────────────────
    if (reportType === "po-line-items") {
        const sheet = wb.addWorksheet("PO Line Items");
        sheet.columns = [
            { header: "PO number", key: "poNumber", width: 16 },
            { header: "PO status", key: "poStatus", width: 18 },
            { header: "Supplier", key: "supplierName", width: 26 },
            { header: "Currency", key: "currency", width: 10 },
            { header: "SKU", key: "sku", width: 14 },
            { header: "Item description", key: "description", width: 30 },
            { header: "Qty ordered", key: "quantity", width: 14 },
            { header: "Qty received", key: "quantityReceived", width: 14 },
            { header: "Unit price", key: "unitPrice", width: 14 },
            { header: "Line total", key: "lineTotal", width: 14 },
            { header: "PO created at", key: "createdAt", width: 14 },
        ];
        styleHeader(sheet);

        const lines = await prisma.purchaseOrderLine.findMany({
            where: { purchaseOrder: { createdAt: { gte: fromDate, lte: toDate } } },
            orderBy: [{ purchaseOrder: { createdAt: "desc" } }],
            include: {
                purchaseOrder: {
                    select: {
                        poNumber: true,
                        status: true,
                        currency: true,
                        createdAt: true,
                        supplier: { select: { name: true } },
                    },
                },
                itemProfile: { select: { sku: true } },
            },
        });
        for (const l of lines) {
            sheet.addRow({
                poNumber: l.purchaseOrder.poNumber,
                poStatus: l.purchaseOrder.status,
                supplierName: l.purchaseOrder.supplier.name,
                currency: l.purchaseOrder.currency,
                sku: l.itemProfile.sku,
                description: l.description ?? "",
                quantity: n(l.quantity),
                quantityReceived: n(l.quantityReceived),
                unitPrice: n(l.unitPrice),
                lineTotal: n(l.lineTotal),
                createdAt: d(l.purchaseOrder.createdAt),
            });
        }
        return wb;
    }

    // ── 6. GRN register ───────────────────────────────────────────────────────
    if (reportType === "grn-register") {
        const sheet = wb.addWorksheet("GRN Register");
        sheet.columns = [
            { header: "GRN number", key: "grnNumber", width: 16 },
            { header: "PO number", key: "poNumber", width: 16 },
            { header: "Supplier", key: "supplierName", width: 26 },
            { header: "Delivery seq.", key: "deliverySequence", width: 14 },
            { header: "Status", key: "status", width: 16 },
            { header: "QC status", key: "qcStatus", width: 16 },
            { header: "Net weight (kg)", key: "netWeightAccepted", width: 16 },
            { header: "Received by", key: "receivedBy", width: 20 },
            { header: "Received at", key: "receivedAt", width: 16 },
            { header: "Posted at", key: "postedAt", width: 16 },
            { header: "Batch trace code", key: "batchTraceCode", width: 20 },
        ];
        styleHeader(sheet);

        const grns = await prisma.goodsReceivedNote.findMany({
            where: { receivedAt: { gte: fromDate, lte: toDate } },
            orderBy: { receivedAt: "desc" },
            include: {
                purchaseOrder: { select: { poNumber: true, supplier: { select: { name: true } } } },
                qcResults: { select: { status: true }, take: 1 },
            },
        });
        for (const g of grns) {
            sheet.addRow({
                grnNumber: g.grnNumber,
                poNumber: g.purchaseOrder.poNumber,
                supplierName: g.purchaseOrder.supplier.name,
                deliverySequence: g.deliverySequence,
                status: g.status,
                qcStatus: g.qcResults[0]?.status ?? "PENDING",
                netWeightAccepted: g.netWeightAccepted != null ? n(g.netWeightAccepted) : "",
                receivedBy: g.receivedBy ?? "",
                receivedAt: g.receivedAt.toISOString().slice(0, 16).replace("T", " "),
                postedAt: g.postedAt ? g.postedAt.toISOString().slice(0, 10) : "",
                batchTraceCode: g.batchTraceCode ?? "",
            });
        }
        return wb;
    }

    // ── 7. Spend by supplier ──────────────────────────────────────────────────
    if (reportType === "spend-by-supplier") {
        const sheet = wb.addWorksheet("Spend by Supplier");
        sheet.columns = [
            { header: "Supplier code", key: "code", width: 14 },
            { header: "Supplier name", key: "name", width: 30 },
            { header: "PO count", key: "poCount", width: 12 },
            { header: "Subtotal (KES)", key: "subtotal", width: 18 },
            { header: "VAT (KES)", key: "taxAmount", width: 16 },
            { header: "Total spend (KES)", key: "totalAmount", width: 20 },
        ];
        styleHeader(sheet);

        const agg = await prisma.purchaseOrder.groupBy({
            by: ["supplierId"],
            where: { createdAt: { gte: fromDate, lte: toDate } },
            _count: { _all: true },
            _sum: { subtotal: true, taxAmount: true, totalAmount: true },
            orderBy: { _sum: { totalAmount: "desc" } },
        });

        const supplierIds = agg.map((a) => a.supplierId);
        const suppliers = await prisma.supplier.findMany({
            where: { id: { in: supplierIds } },
            select: { id: true, code: true, name: true },
        });
        const supplierMap = Object.fromEntries(suppliers.map((s) => [s.id, s]));

        let grandSubtotal = 0, grandVat = 0, grandTotal = 0;
        for (const row of agg) {
            const s = supplierMap[row.supplierId];
            const sub = n(row._sum.subtotal);
            const vat = n(row._sum.taxAmount);
            const tot = n(row._sum.totalAmount);
            grandSubtotal += sub; grandVat += vat; grandTotal += tot;
            sheet.addRow({
                code: s?.code ?? "",
                name: s?.name ?? "Unknown",
                poCount: row._count._all,
                subtotal: sub,
                taxAmount: vat,
                totalAmount: tot,
            });
        }
        // totals row
        sheet.addRow({});
        const totRow = sheet.addRow({
            code: "", name: "GRAND TOTAL", poCount: agg.reduce((s, r) => s + r._count._all, 0),
            subtotal: grandSubtotal, taxAmount: grandVat, totalAmount: grandTotal,
        });
        totRow.font = { bold: true };
        return wb;
    }

    // ── 8. Three-way match & invoices ─────────────────────────────────────────
    if (reportType === "three-way-match") {
        const sheet = wb.addWorksheet("3-Way Match");
        sheet.columns = [
            { header: "Match number", key: "matchNumber", width: 18 },
            { header: "Status", key: "status", width: 22 },
            { header: "PO number", key: "poNumber", width: 16 },
            { header: "Supplier", key: "supplierName", width: 26 },
            { header: "Invoice number", key: "invoiceNumber", width: 18 },
            { header: "Invoice date", key: "invoiceDate", width: 14 },
            { header: "Currency", key: "currency", width: 10 },
            { header: "Invoice subtotal", key: "invoiceSubtotal", width: 18 },
            { header: "Invoice VAT", key: "invoiceTax", width: 16 },
            { header: "Invoice total", key: "invoiceTotal", width: 16 },
            { header: "PO total", key: "poTotal", width: 14 },
            { header: "GRN total", key: "grnTotal", width: 14 },
            { header: "Price var %", key: "priceVariancePct", width: 14 },
            { header: "Qty var %", key: "quantityVariancePct", width: 14 },
            { header: "Discrepancy notes", key: "discrepancyNotes", width: 36 },
            { header: "Matched by", key: "matchedBy", width: 20 },
            { header: "Matched at", key: "matchedAt", width: 16 },
        ];
        styleHeader(sheet);

        const matches = await prisma.threeWayMatch.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            orderBy: { createdAt: "desc" },
            include: {
                supplierInvoice: true,
                grn: {
                    include: {
                        purchaseOrder: {
                            select: { poNumber: true, supplier: { select: { name: true } } },
                        },
                    },
                },
            },
        });

        for (const m of matches) {
            sheet.addRow({
                matchNumber: m.matchNumber,
                status: m.status,
                poNumber: m.grn.purchaseOrder.poNumber,
                supplierName: m.grn.purchaseOrder.supplier.name,
                invoiceNumber: m.supplierInvoice.invoiceNumber,
                invoiceDate: d(m.supplierInvoice.invoiceDate),
                currency: m.supplierInvoice.currency,
                invoiceSubtotal: n(m.supplierInvoice.subtotal),
                invoiceTax: n(m.supplierInvoice.taxAmount),
                invoiceTotal: n(m.supplierInvoice.totalAmount),
                poTotal: m.poTotal != null ? n(m.poTotal) : "",
                grnTotal: m.grnTotal != null ? n(m.grnTotal) : "",
                priceVariancePct: m.priceVariancePct != null ? n(m.priceVariancePct) : "",
                quantityVariancePct: m.quantityVariancePct != null ? n(m.quantityVariancePct) : "",
                discrepancyNotes: m.discrepancyNotes ?? "",
                matchedBy: m.matchedBy ?? "",
                matchedAt: m.matchedAt ? d(m.matchedAt) : "",
            });
        }
        return wb;
    }

    // ── 9. Payment vouchers ───────────────────────────────────────────────────
    if (reportType === "payment-vouchers") {
        const sheet = wb.addWorksheet("Payment Vouchers");
        sheet.columns = [
            { header: "Voucher number", key: "voucherNumber", width: 18 },
            { header: "Status", key: "status", width: 16 },
            { header: "Match number", key: "matchNumber", width: 18 },
            { header: "Supplier", key: "supplierName", width: 28 },
            { header: "Invoice number", key: "invoiceNumber", width: 18 },
            { header: "Currency", key: "currency", width: 10 },
            { header: "Amount", key: "amount", width: 16 },
            { header: "Approved by", key: "approvedBy", width: 20 },
            { header: "Approved at", key: "approvedAt", width: 14 },
            { header: "Paid at", key: "paidAt", width: 14 },
            { header: "AP queue pushed", key: "apQueuePushedAt", width: 18 },
            { header: "Created at", key: "createdAt", width: 14 },
        ];
        styleHeader(sheet);

        const vouchers = await prisma.paymentVoucher.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            orderBy: { createdAt: "desc" },
            include: {
                threeWayMatch: {
                    select: {
                        matchNumber: true,
                        grn: {
                            select: {
                                purchaseOrder: { select: { supplier: { select: { name: true } } } },
                            },
                        },
                    },
                },
                supplierInvoice: { select: { invoiceNumber: true } },
            },
        });

        for (const v of vouchers) {
            sheet.addRow({
                voucherNumber: v.voucherNumber,
                status: v.status,
                matchNumber: v.threeWayMatch.matchNumber,
                supplierName: v.threeWayMatch.grn.purchaseOrder.supplier.name,
                invoiceNumber: v.supplierInvoice.invoiceNumber,
                currency: v.currency,
                amount: n(v.amount),
                approvedBy: v.approvedBy ?? "",
                approvedAt: d(v.approvedAt ?? null),
                paidAt: d(v.paidAt ?? null),
                apQueuePushedAt: d(v.apQueuePushedAt ?? null),
                createdAt: d(v.createdAt),
            });
        }
        return wb;
    }

    throw new Error(`Unknown report type: ${reportType}`);
}

export async function generateProcurementReportBuffer(
    reportType: ProcurementReportType,
    from?: string,
    to?: string
): Promise<Buffer> {
    const wb = await buildWorkbook(reportType, from, to);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
}
