/**
 * Applies the two pending stock-transfer migrations directly via Prisma.
 * Run once: npx ts-node prisma/apply-pending-migrations.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** Returns true if the column already exists in the table */
async function columnExists(table: string, column: string): Promise<boolean> {
    const rows = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
        `SELECT COUNT(*) AS cnt
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = ?
       AND COLUMN_NAME  = ?`,
        table,
        column
    );
    return Number(rows[0]?.cnt ?? 0) > 0;
}

async function addColumnIfMissing(
    table: string,
    column: string,
    definition: string,
    after?: string
) {
    if (await columnExists(table, column)) {
        console.log(`     ${column} already exists — skipped.`);
        return;
    }
    const afterClause = after ? ` AFTER \`${after}\`` : "";
    await prisma.$executeRawUnsafe(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}${afterClause}`
    );
    console.log(`     ${column} added.`);
}

async function run() {
    console.log("Applying pending stock-transfer migrations...\n");

    // ── Migration 1: receipt_rejection_and_correction_status ────────────────
    console.log("Step 1 — StockTransferRequest: receipt rejection columns");

    await addColumnIfMissing("StockTransferRequest", "receiptRejectionReason", "TEXT NULL");
    await addColumnIfMissing("StockTransferRequest", "receiptRejectedByUserId", "VARCHAR(191) NULL");
    await addColumnIfMissing("StockTransferRequest", "receiptRejectedAt", "DATETIME(3) NULL");

    console.log("\nStep 2 — Expanding status ENUM...");
    await prisma.$executeRawUnsafe(`
    ALTER TABLE \`StockTransferRequest\`
      MODIFY COLUMN \`status\` ENUM(
        'PENDING',
        'APPROVED_IN_TRANSIT',
        'COMPLETED',
        'REJECTED',
        'RECEIPT_REJECTED',
        'PENDING_CORRECTION'
      ) NOT NULL DEFAULT 'PENDING'
  `);
    console.log("     ENUM updated.");

    console.log("\nStep 3 — Foreign key for receiptRejectedByUserId...");
    try {
        await prisma.$executeRawUnsafe(`
      ALTER TABLE \`StockTransferRequest\`
        ADD CONSTRAINT \`StockTransferRequest_receiptRejectedByUserId_fkey\`
        FOREIGN KEY (\`receiptRejectedByUserId\`) REFERENCES \`User\`(\`id\`)
        ON DELETE SET NULL ON UPDATE CASCADE
    `);
        console.log("     Foreign key added.");
    } catch (e: any) {
        const msg: string = e.message ?? "";
        if (msg.includes("Duplicate key name") || msg.includes("already exists")) {
            console.log("     Foreign key already exists — skipped.");
        } else {
            throw e;
        }
    }

    // ── Migration 2: partial_issue_reason ───────────────────────────────────
    console.log("\nStep 4 — StockTransferItem: partialIssueReason column");
    await addColumnIfMissing("StockTransferItem", "partialIssueReason", "TEXT NULL", "qtyIssued");

    // ── Mark both migrations as applied in _prisma_migrations ───────────────
    console.log("\nStep 5 — Updating _prisma_migrations table...");
    const migrations = [
        "20260603120000_receipt_rejection_and_correction_status",
        "20260603130000_partial_issue_reason",
    ];

    for (const name of migrations) {
        const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
            `SELECT id FROM \`_prisma_migrations\` WHERE migration_name = ?`,
            name
        );
        if (existing.length === 0) {
            await prisma.$executeRawUnsafe(
                `INSERT INTO \`_prisma_migrations\`
           (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (UUID(), '', NOW(), ?, NULL, NULL, NOW(), 1)`,
                name
            );
            console.log(`     Recorded ${name}.`);
        } else {
            console.log(`     ${name} already recorded — skipped.`);
        }
    }

    console.log("\n✓ All done. Now run:  npx prisma generate");
}

run()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
