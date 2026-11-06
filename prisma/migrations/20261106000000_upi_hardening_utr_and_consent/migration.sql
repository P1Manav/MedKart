-- AlterTable
ALTER TABLE "orders" ADD COLUMN "direct_upi_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "utr" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "orders_utr_key" ON "orders"("utr");
