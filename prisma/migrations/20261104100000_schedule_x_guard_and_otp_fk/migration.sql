-- Migration: 20261104100000_schedule_x_guard_and_otp_fk
-- 1. Drop foreign key constraint on otp_records to users so new customers can request OTPs
ALTER TABLE "otp_records" DROP CONSTRAINT IF EXISTS "otp_records_phone_fkey";

-- 2. Add index for OTP lookup and rate limiting
CREATE INDEX IF NOT EXISTS "otp_records_phone_created_at_idx" ON "otp_records"("phone", "created_at");

-- 3. Replace dispatch guard trigger function to strictly block Schedule X / unsellable items from dispatch
CREATE OR REPLACE FUNCTION assert_dispatchable_order_trigger()
RETURNS TRIGGER AS $$
DECLARE
  unsellable_count INTEGER;
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

    -- 3. Check for items that cannot be sold online (Schedule X / Narcotics / can_sell_online = false)
    SELECT COUNT(*) INTO unsellable_count
    FROM "order_lines" ol
    JOIN "products" p ON ol."product_id" = p."id"
    JOIN "schedule_rules" sr ON p."schedule" = sr."schedule"
    WHERE ol."order_id" = NEW.id
      AND ol."line_status" NOT IN ('REJECTED')
      AND sr."can_sell_online" = false;

    IF unsellable_count > 0 THEN
      RAISE EXCEPTION 'Dispatch blocked by DB trigger: % item(s) cannot be sold online for order %', unsellable_count, NEW.id;
    END IF;

    -- 4. Check active lines count
    SELECT COUNT(*) INTO active_lines_count
    FROM "order_lines"
    WHERE "order_id" = NEW.id
      AND "line_status" NOT IN ('BLOCKED_NOT_SOLD_ONLINE', 'REJECTED');

    IF active_lines_count = 0 THEN
      RAISE EXCEPTION 'Dispatch blocked by DB trigger: No active lines to dispatch for order %', NEW.id;
    END IF;

    -- 5. Check for unapproved active lines or missing pharmacist registration
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

    -- 6. Check for H1 items missing complete register entry
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
