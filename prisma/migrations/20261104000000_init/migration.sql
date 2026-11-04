-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'PHARMACIST', 'STORE_STAFF', 'OPS');

-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'hi', 'bn');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('OTC', 'H', 'H1', 'X', 'NARCOTIC');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ON_HOLD', 'REJECTED', 'APPROVED', 'PACKED', 'HANDED_OVER', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LineStatus" AS ENUM ('PENDING', 'APPROVED', 'EDITED_APPROVED', 'REJECTED', 'BLOCKED_NOT_SOLD_ONLINE');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('PENDING', 'APPROVED', 'RE_UPLOAD_ASKED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('MOCK_UPI', 'COD');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT_MOCK');

-- CreateEnum
CREATE TYPE "AccessAction" AS ENUM ('VIEW', 'DOWNLOAD');

-- CreateEnum
CREATE TYPE "ImageLegibility" AS ENUM ('CLEAR', 'PARTIAL', 'UNREADABLE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "pharmacist_reg_no" TEXT,
    "store_id" TEXT,
    "language" "Language" NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "pincode" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "address" TEXT,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "pack_size" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "schedule" "ScheduleType" NOT NULL,
    "generic_group_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_rules" (
    "schedule" "ScheduleType" NOT NULL,
    "can_sell_online" BOOLEAN NOT NULL,
    "requires_prescription" BOOLEAN NOT NULL,
    "requires_pharmacist_approval" BOOLEAN NOT NULL,
    "requires_register_entry" BOOLEAN NOT NULL,

    CONSTRAINT "schedule_rules_pkey" PRIMARY KEY ("schedule")
);

-- CreateTable
CREATE TABLE "store_stock" (
    "id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "display_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "family_profile_id" TEXT,
    "store_id" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "address_text" TEXT,
    "address_lat" DOUBLE PRECISION,
    "address_lng" DOUBLE PRECISION,
    "payment_method" "PaymentMethod",
    "prescription_encrypted" BYTEA,
    "prescription_iv" BYTEA,
    "prescription_auth_tag" BYTEA,
    "prescription_mime" TEXT,
    "prescription_status" "PrescriptionStatus",
    "prescription_valid_until" TIMESTAMP(3),
    "ai_image_legibility" "ImageLegibility",
    "ai_prescriber_text" TEXT,
    "ai_date_text" TEXT,
    "ai_model_name" TEXT,
    "ai_latency_ms" INTEGER,
    "manual_entry_needed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_lines" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "raw_text" TEXT,
    "ai_drug_name" TEXT,
    "ai_strength" TEXT,
    "ai_confidence" DOUBLE PRECISION,
    "ai_alternatives" JSONB,
    "line_status" "LineStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION,
    "pharmacist_id" TEXT,
    "pharmacist_reg_no" TEXT,
    "reject_reason" TEXT,
    "edit_note" TEXT,
    "generic_suggested" BOOLEAN NOT NULL DEFAULT false,
    "customer_consent_generic" BOOLEAN NOT NULL DEFAULT false,
    "consent_timestamp" TIMESTAMP(3),
    "needs_review" BOOLEAN NOT NULL DEFAULT false,
    "h1_prescriber_name" TEXT,
    "h1_prescriber_reg_no" TEXT,
    "h1_patient_name" TEXT,
    "h1_date" TIMESTAMP(3),
    "h1_quantity" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_audit" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_audit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prescription_access_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_role" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "action" "AccessAction" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_hash" TEXT NOT NULL,

    CONSTRAINT "prescription_access_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refill_trackers" (
    "id" TEXT NOT NULL,
    "family_profile_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "units_dispensed" INTEGER NOT NULL,
    "units_per_day" DOUBLE PRECISION NOT NULL,
    "days_of_supply" INTEGER NOT NULL,
    "run_out_date" DATE NOT NULL,
    "remind_days_before" INTEGER NOT NULL DEFAULT 5,
    "reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "last_order_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refill_trackers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_outbox" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "address_text" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pincode_coords" (
    "pincode" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "pincode_coords_pkey" PRIMARY KEY ("pincode")
);

-- CreateTable
CREATE TABLE "generic_substitutes" (
    "id" TEXT NOT NULL,
    "original_product_id" TEXT NOT NULL,
    "generic_product_id" TEXT NOT NULL,

    CONSTRAINT "generic_substitutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_records" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "store_stock_store_id_product_id_key" ON "store_stock"("store_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_display_id_key" ON "orders"("display_id");

-- CreateIndex
CREATE UNIQUE INDEX "refill_trackers_family_profile_id_product_id_key" ON "refill_trackers"("family_profile_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "generic_substitutes_original_product_id_generic_product_id_key" ON "generic_substitutes"("original_product_id", "generic_product_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_profiles" ADD CONSTRAINT "family_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_stock" ADD CONSTRAINT "store_stock_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_family_profile_id_fkey" FOREIGN KEY ("family_profile_id") REFERENCES "family_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_pharmacist_id_fkey" FOREIGN KEY ("pharmacist_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_audit" ADD CONSTRAINT "order_audit_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_audit" ADD CONSTRAINT "order_audit_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_access_log" ADD CONSTRAINT "prescription_access_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prescription_access_log" ADD CONSTRAINT "prescription_access_log_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_trackers" ADD CONSTRAINT "refill_trackers_family_profile_id_fkey" FOREIGN KEY ("family_profile_id") REFERENCES "family_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refill_trackers" ADD CONSTRAINT "refill_trackers_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_outbox" ADD CONSTRAINT "message_outbox_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generic_substitutes" ADD CONSTRAINT "generic_substitutes_original_product_id_fkey" FOREIGN KEY ("original_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generic_substitutes" ADD CONSTRAINT "generic_substitutes_generic_product_id_fkey" FOREIGN KEY ("generic_product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_records" ADD CONSTRAINT "otp_records_phone_fkey" FOREIGN KEY ("phone") REFERENCES "users"("phone") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;



-- ─── Defense in Depth: Postgres Dispatch Guard Trigger ─────────────────

CREATE OR REPLACE FUNCTION assert_dispatchable_order_trigger()
RETURNS TRIGGER AS $$
DECLARE
  unapproved_count INTEGER;
  missing_h1_count INTEGER;
  active_lines_count INTEGER;
BEGIN
  -- Only enforce when transitioning to PACKED, HANDED_OVER, or DELIVERED
  IF NEW.status IN ('PACKED', 'HANDED_OVER', 'DELIVERED') THEN
    
    -- 1. Prescription must be attached
    IF NEW.prescription_encrypted IS NULL THEN
      RAISE EXCEPTION 'Dispatch blocked by DB trigger: Prescription image is missing for order %', NEW.id;
    END IF;

    -- 2. Prescription must be within validity window
    IF NEW.prescription_valid_until IS NULL OR NEW.prescription_valid_until < CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'Dispatch blocked by DB trigger: Prescription is expired or invalid for order %', NEW.id;
    END IF;

    -- 3. Check active lines count
    SELECT COUNT(*) INTO active_lines_count
    FROM "order_lines"
    WHERE "order_id" = NEW.id
      AND "line_status" NOT IN ('BLOCKED_NOT_SOLD_ONLINE', 'REJECTED');

    IF active_lines_count = 0 THEN
      RAISE EXCEPTION 'Dispatch blocked by DB trigger: No active lines to dispatch for order %', NEW.id;
    END IF;

    -- 4. Check for unapproved active lines or missing pharmacist registration
    SELECT COUNT(*) INTO unapproved_count
    FROM "order_lines"
    WHERE "order_id" = NEW.id
      AND "line_status" NOT IN ('BLOCKED_NOT_SOLD_ONLINE', 'REJECTED')
      AND (
        "line_status" NOT IN ('APPROVED', 'EDITED_APPROVED')
        OR "pharmacist_id" IS NULL
        OR "pharmacist_reg_no" IS NULL
      );

    IF unapproved_count > 0 THEN
      RAISE EXCEPTION 'Dispatch blocked by DB trigger: % line(s) lack valid pharmacist approval for order %', unapproved_count, NEW.id;
    END IF;

    -- 5. Check for H1 items missing complete register entry
    SELECT COUNT(*) INTO missing_h1_count
    FROM "order_lines" ol
    JOIN "products" p ON ol."product_id" = p."id"
    JOIN "schedule_rules" sr ON p."schedule" = sr."schedule"
    WHERE ol."order_id" = NEW.id
      AND sr."requires_register_entry" = true
      AND ol."line_status" IN ('APPROVED', 'EDITED_APPROVED')
      AND (
        ol."h1_prescriber_name" IS NULL
        OR ol."h1_prescriber_reg_no" IS NULL
        OR ol."h1_patient_name" IS NULL
        OR ol."h1_date" IS NULL
        OR ol."h1_quantity" IS NULL
      );

    IF missing_h1_count > 0 THEN
      RAISE EXCEPTION 'Dispatch blocked by DB trigger: % Schedule H1 line(s) missing mandatory register entry for order %', missing_h1_count, NEW.id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assert_dispatchable_order ON "orders";
CREATE TRIGGER trg_assert_dispatchable_order
BEFORE UPDATE OF "status" ON "orders"
FOR EACH ROW
EXECUTE FUNCTION assert_dispatchable_order_trigger();
