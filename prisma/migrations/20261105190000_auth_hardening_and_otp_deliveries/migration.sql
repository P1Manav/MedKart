-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_PENDING_VERIFICATION';
ALTER TYPE "OrderStatus" ADD VALUE 'REFUND_DUE';

-- AlterTable
ALTER TABLE "otp_records" ADD COLUMN     "ip_address" TEXT,
ADD COLUMN     "salt" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "email" TEXT,
ADD COLUMN     "email_verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "session_version" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'system';

-- CreateTable
CREATE TABLE "otp_deliveries" (
    "id" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "masked_phone" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error_code" TEXT,
    "cost_in_credits" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_deliveries_phone_hash_idx" ON "otp_deliveries"("phone_hash");

-- CreateIndex
CREATE INDEX "otp_deliveries_created_at_idx" ON "otp_deliveries"("created_at");

-- CreateIndex
CREATE INDEX "otp_records_ip_address_created_at_idx" ON "otp_records"("ip_address", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

