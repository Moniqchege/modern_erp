-- CreateTable
CREATE TABLE "SupplierSuppliedItem" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "itemProfileId" TEXT NOT NULL,
    "isPreferred" BOOLEAN NOT NULL DEFAULT false,
    "leadTimeDays" INTEGER,
    "minOrderQty" DECIMAL(12,3),
    "lastUnitPrice" DECIMAL(12,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierSuppliedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierSuppliedItem_supplierId_itemProfileId_key" ON "SupplierSuppliedItem"("supplierId", "itemProfileId");

-- CreateIndex
CREATE INDEX "SupplierSuppliedItem_supplierId_idx" ON "SupplierSuppliedItem"("supplierId");

-- CreateIndex
CREATE INDEX "SupplierSuppliedItem_itemProfileId_idx" ON "SupplierSuppliedItem"("itemProfileId");

-- AddForeignKey
ALTER TABLE "SupplierSuppliedItem" ADD CONSTRAINT "SupplierSuppliedItem_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierSuppliedItem" ADD CONSTRAINT "SupplierSuppliedItem_itemProfileId_fkey" FOREIGN KEY ("itemProfileId") REFERENCES "ProcurementItemProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
