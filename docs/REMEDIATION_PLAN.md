# MedKart Remediation and Hardening Plan (Prompt v2)

## 1. Executive Summary & Protocol Compliance

This remediation plan addresses the findings from the independent code review on the MedKart Pharmacy application (`P1Manav/isocode_assignment`, branch `master`). In accordance with **Protocol v2 §2**:
- **Test-first for safety fixes:** Every P0 item begins with a failing test run and reported failure before modifying production code.
- **Phase gate after every work item:** `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
- **Atomic conventional commits:** Format `fix(domain): block X/NARCOTIC lines in assertDispatchable [P0-1]`.
- **Reporting format:** `✅ <what> | tests: <n passing> | commit: <short hash>`.
- **Zero secrets in repository:** Fail-closed configuration via Zod `env.ts`.

---

## 2. Work Items: Priority P0 (Safety & Truthfulness)

### P0-1. Schedule X / NARCOTIC Online Sale Blocking
- **Problem:** `assertDispatchable` and the SQL trigger never check a line's schedule. `APPROVE_LINE` can flip a `BLOCKED_NOT_SOLD_ONLINE` line to `APPROVED`. `EDIT_LINE` can swap in a Schedule X product.
- **Files to touch:**
  - `src/domain/assert-dispatchable.ts`
  - `src/domain/schedule-gating.ts`
  - `src/app/api/pharmacist/orders/[id]/verify/route.ts`
  - `src/app/api/store/orders/[id]/pack/route.ts`
  - `prisma/migrations/20261104100000_schedule_x_guard_and_otp_fk/migration.sql` (new migration)
- **Test to write FIRST:**
  - `tests/unit/assert-dispatchable.test.ts`:
    1. Assert `assertDispatchable()` fails if any active line maps to `canSellOnline: false`, even if marked `APPROVED` or `EDITED_APPROVED`.
    2. Assert `assertDispatchable()` fails if a `BLOCKED_NOT_SOLD_ONLINE` line is included in dispatch.
  - Route tests: Verify route rejects `APPROVE_LINE` and `EDIT_LINE` for Schedule X / Narcotic products with HTTP 409 ("This item cannot be ordered online. Please visit your nearest store.").
- **New Assumption:** None (directly enforces Drugs & Cosmetics Rules 1945).

---

### P0-2. Real Postgres Trigger Integration Test
- **Problem:** `tests/integration/db-trigger.test.ts` currently greps migration files and evaluates a JS simulation.
- **Files to touch:**
  - `tests/integration/db-trigger.test.ts` (rewrite to use Prisma `$executeRaw` against real Postgres)
  - `package.json` (add `"test:db": "vitest run tests/integration/db-trigger.test.ts"`)
  - `.github/workflows/ci.yml` (add `postgres:16` service container, run `prisma migrate deploy`, run `npm run test:db`)
- **Test to write FIRST:**
  - Real integration test with raw SQL `UPDATE orders SET status = 'PACKED' WHERE id = ...`:
    - Case 1: Missing prescription -> DB raises exception (`Prescription image is missing`).
    - Case 2: Expired prescription -> DB raises exception (`Prescription is expired or invalid`).
    - Case 3: PENDING line -> DB raises exception (`lack valid pharmacist approval`).
    - Case 4: Missing pharmacist reg no -> DB raises exception (`lack valid pharmacist approval`).
    - Case 5: H1 line missing each required register field -> DB raises exception (`missing mandatory register entry`).
    - Case 6: Schedule X line force-approved -> DB raises exception (`cannot be sold online`).
    - Case 7: Legitimate valid approved order -> succeeds with `UPDATE 1`.
  - Must fail loudly if `DATABASE_URL` is unset.
- **New Assumption:** A17: `npm run test:db` requires an accessible Postgres database; fails loudly if `DATABASE_URL` is missing.

---

### P0-3. MockReader Production Safeguard & AI Confidence Separation
- **Problem:** Production code falls back to `MockReader('valid')` if `GEMINI_API_KEY` is not set, fabricating medicines. AI confidence is overwritten with fuzzy match score.
- **Files to touch:**
  - `src/lib/ai/index.ts` / `src/lib/ai/reader-factory.ts` (new reader factory)
  - `src/lib/ai/gemini-reader.ts` (add 20s `AbortSignal.timeout`, retry logic, set legibility to `UNREADABLE`)
  - `src/app/api/orders/route.ts` (use reader factory; store model confidence in `aiConfidence`, matcher score in `aiAlternatives`)
- **Test to write FIRST:**
  - `tests/unit/reader-factory.test.ts`:
    1. Assert `getPrescriptionReader()` returns `GeminiReader` in `NODE_ENV='production'`, even when `GEMINI_API_KEY` is unset.
    2. Assert missing key in non-test mode produces `manualEntryNeeded: true`, `aiImageLegibility: 'UNREADABLE'`, 0 lines.
    3. Assert `MockReader` is only returnable when `NODE_ENV === 'test'` or (`AI_READER === 'mock'` AND `NODE_ENV !== 'production'`).
- **New Assumption:** A18: Gemini API calls time out after 20 seconds and retry once on 429/5xx before falling back safely to manual pharmacist review.

---

### P0-4. Fail-Closed Environment & Secrets Validation
- **Problem:** Hard-coded fallbacks exist in `session.ts`, `encrypt.ts`, and `cron/reminders/route.ts`. Cron route allows query param `?secret=` and dev bypass.
- **Files to touch:**
  - `src/lib/env.ts` (new Zod validation schema for environment variables)
  - `src/lib/auth/session.ts` (remove fallback; throw on missing `SESSION_SECRET`)
  - `src/lib/crypto/encrypt.ts` (remove fallback; throw on missing `PRESCRIPTION_ENC_KEY`)
  - `src/app/api/cron/reminders/route.ts` (accept ONLY `Authorization: Bearer <CRON_SECRET>`; remove `?secret=` and dev bypass; export `GET` and `POST`; ignore `asOfDate` in prod unless OPS)
  - `src/app/api/ops/run-reminders/route.ts` (new OPS-authenticated endpoint for dashboard reminder trigger)
  - `vitest.setup.ts` (set test secrets for Vitest unit runner)
- **Test to write FIRST:**
  - `tests/unit/secrets-fail-closed.test.ts`:
    1. Calling `encryptPrescription()` without `PRESCRIPTION_ENC_KEY` throws error naming the variable.
    2. Calling `createSessionToken()` without `SESSION_SECRET` throws error naming the variable.
    3. Cron route rejects query parameter secret with 401.
    4. Cron route rejects unauthenticated call even in development.
- **New Assumption:** None.

---

### P0-5. Demo Login & OTP Hardening
- **Problem:** `mockOtp` is returned unconditionally if `OTP_MOCK=true`. Demo ribbon renders always. `OtpRecord` has FK to `users.phone` blocking first-time customers. OTP random generator and hash compare have flaws.
- **Files to touch:**
  - `src/lib/auth/otp.ts`
  - `prisma/schema.prisma` & Migration `20261104100000_...` (drop `otp_records_phone_fkey` constraint)
  - `src/components/layout/nav-header.tsx` (only render demo ribbon when `DEMO_MODE=true`)
- **Test to write FIRST:**
  - `tests/unit/otp.test.ts`:
    1. Assert `generateNumericOtp` range generates 6 digits [100000, 999999] across 10,000 iterations (using `randomInt(100000, 1000000)`).
    2. Assert `mockOtp` is undefined unless `DEMO_MODE=true`.
    3. Assert atomic attempt limit lockouts after 5 failed attempts.
    4. Assert `timingSafeEqual` hash comparison.
- **New Assumption:** A19: `DEMO_MODE=true` is used for demo reviewer instances; production operates with `DEMO_MODE=false`.

---

### P0-6. Real Re-upload Endpoint & UI Integration
- **Problem:** `handleReuploadSubmit` simulates a 1-second delay without calling any backend endpoint.
- **Files to touch:**
  - `src/app/api/orders/[id]/reupload/route.ts` (new endpoint)
  - `src/app/customer/order/[id]/page.tsx` (wire real form submission to new endpoint)
- **Test to write FIRST:**
  - `tests/integration/reupload.test.ts`:
    1. Order in `ON_HOLD` can be re-uploaded by owning customer, transitioning to `SUBMITTED` and resetting `prescriptionStatus = 'PENDING'`.
    2. Non-owner customer gets 403.
    3. Order not in `ON_HOLD` gets 409.
- **New Assumption:** None.

---

### P0-7. Dynamic Operations Dashboard Metrics
- **Problem:** Ops dashboard renders hard-coded numbers ("46 stores", "8.4 min", "3.2%", "0 leaked").
- **Files to touch:**
  - `src/app/api/ops/metrics/route.ts` (new route computing active store count, median SLA from `OrderAudit`, rejection breakdown, blocked count)
  - `src/app/ops/dashboard/page.tsx` (fetch metrics dynamically; render empty states if no data)
- **Test to write FIRST:**
  - `tests/unit/metrics.test.ts`:
    1. SLA calculation returns accurate median minutes between `SUBMITTED` and pharmacist verification.
    2. Rejection reason counts correctly aggregated.
- **New Assumption:** A20: If fewer than 2 completed verifications exist, median SLA renders "N/A (insufficient data)".

---

### P0-8. Information Leakage Prevention & Explicit Selects
- **Problem:** `GET /api/orders` leaks encrypted prescription bytes and auth tags. No `GET /api/orders/[id]` endpoint exists.
- **Files to touch:**
  - `src/app/api/orders/route.ts` (use explicit `select` excluding encrypted blobs; add pagination and server filters)
  - `src/app/api/orders/[id]/route.ts` (new route with explicit `select` and object-level authorization)
  - `src/app/customer/order/[id]/page.tsx`, `src/app/pharmacist/review/[id]/page.tsx`, `src/app/store/orders/page.tsx` (call `GET /api/orders/[id]`)
- **Test to write FIRST:**
  - `tests/unit/order-leakage.test.ts`:
    1. Assert response from `GET /api/orders` does NOT contain `prescriptionEncrypted`, `prescriptionIv`, or `prescriptionAuthTag`.
    2. Assert response from `GET /api/orders/[id]` does NOT contain encrypted blobs.
- **New Assumption:** None.

---

### P0-9. Broken Object-Level Authorization & Race Conditions
- **Problem:** Image route lets any `STORE_STAFF` view any prescription. Store staff with no `storeId` fetches all orders. Race conditions possible on order verification.
- **Files to touch:**
  - `src/lib/auth/rbac.ts` (`assertPrescriptionAccess`)
  - `src/app/api/prescription/[id]/image/route.ts`
  - `src/app/api/orders/route.ts`
  - `src/app/api/pharmacist/orders/[id]/verify/route.ts` (remove OPS role; remove fallback reg no; enforce `updateMany` conditional update; add `ADD_LINE` action for manual entry)
- **Test to write FIRST:**
  - `tests/unit/rbac-object-level.test.ts`:
    1. Customer A cannot view Customer B's prescription image (403).
    2. Store staff cannot view prescription of another store (403).
    3. Store staff cannot view prescription before `APPROVED` status (403).
    4. Store staff with `storeId: null` gets empty list (not all orders).
    5. Order verification with missing reg no returns 403.
    6. Concurrent/duplicate approval returns 409 Conflict.
- **New Assumption:** None.

---

### P0-10. Prescription Validity from Rx Date
- **Problem:** Validity is computed from upload date rather than doctor's prescription date.
- **Files to touch:**
  - `src/domain/assert-dispatchable.ts` (`computePrescriptionValidUntil`)
  - `src/app/api/pharmacist/orders/[id]/verify/route.ts` (require prescription date confirmation on `APPROVE_ORDER`)
  - `src/app/pharmacist/review/[id]/page.tsx` (add confirmed prescription date picker)
- **Test to write FIRST:**
  - `tests/unit/prescription-validity.test.ts`:
    1. Calendar boundary test: Aug 31 + 6 months in non-leap year -> Feb 28.
    2. Calendar boundary test: Aug 31 + 6 months in leap year -> Feb 29.
    3. IST timezone boundary vs UTC midnight.
    4. Assert order approval fails if prescription date is missing.
- **New Assumption:** None.

---

### P0-11. Multi-Language i18n Wiring & Parity
- **Problem:** 88 keys exist in `messages/*.json` but no UI component uses `useTranslations`.
- **Files to touch:**
  - `src/app/layout.tsx` (read cookie, set `<html lang>`, wrap in `NextIntlClientProvider`)
  - `messages/en.json`, `messages/hi.json`, `messages/bn.json`
  - `src/app/login/page.tsx`, `src/app/customer/home/page.tsx`, `src/app/customer/order/new/page.tsx`, `src/app/customer/order/[id]/page.tsx`, `src/app/pharmacist/queue/page.tsx`, `src/app/pharmacist/review/[id]/page.tsx`
- **Test to write FIRST:**
  - `tests/unit/i18n-parity.test.ts`:
    1. Assert 100% key parity between `en.json`, `hi.json`, and `bn.json`.
    2. Assert no translation key contains an empty string.
- **New Assumption:** None.

---

### P0-12. CI Automation, Typecheck & Honest Documentation
- **Problem:** Missing `@playwright/test` causes `tsc --noEmit` to fail. Hard-coded badge claims "78 passing".
- **Files to touch:**
  - `package.json` (add `@playwright/test` devDependency, scripts `postinstall`, `db:migrate`, `test:db`)
  - `.github/workflows/ci.yml` (add Postgres service, run migrations, run unit + db tests, run build, run Playwright)
  - `README.md`, `docs/ASSUMPTIONS.md`, `docs/TECHNICAL_DESIGN_DOCUMENT.md`
- **Test to write FIRST:**
  - `npm run typecheck` passes with zero TypeScript errors.
- **New Assumption:** None.

---

## 3. Work Items: Priority P1 (Completeness & Depth)

*Executed sequentially after all P0 items are green and verified:*
- **P1-1. Real route-level tests:** Test helper executing real Next.js route handlers against test Postgres.
- **P1-2. Stock reservation:** Atomic inventory decrement at `APPROVE_ORDER` with row-level locks; release on reject/cancel.
- **P1-3. Routing inputs:** Customer saved address picker; server-derived pincode lat/lng; validate `paymentMethod` with Zod enum.
- **P1-4. Refill lifecycle:** Upsert `RefillTracker` upon order pack; atomic reminder outbox transaction; one-tap reorder validity verification.
- **P1-5. Append-only audit & cryptography:** DB triggers raising on `UPDATE`/`DELETE` for `prescription_access_log` and `order_audit`; HMAC-SHA256 hashed IPs; AES-GCM AAD binding.
- **P1-6. Upload validation:** Magic byte inspection (JPEG `FF D8 FF`, PNG `89 50 4E 47`); client-side resize to max ~1600px.
- **P1-7 & P1-7b. Matching safety & generic consent:** Fuse.js threshold tightened to 0.3; Schedule X/Narcotic deny-list; customer-recorded substitution consent.
- **P1-8 & P1-9. Order lifecycle & ops rules admin:** Routes for handover/delivery; customer cancel route; ops rules screen; robust CSV parsing.
- **P1-10. Error handling & Next.js proxy:** Centralized `apiHandler` mapping to standard HTTP status codes; `src/proxy.ts` session protection.

---

## 4. Priority P2 (Polish & Final Deliverables)

- **Seed data calibration:** Clarify 10 demo stores seeded from the 46-store chain brief.
- **Asset cleanup:** Untrack `submission/*.zip` and `docs/*.docx` from git; generate synthetic images via script.
- **Accessibility:** 48px touch targets, contrast compliance, aria-live status regions.
- **End-to-End Playwright Suite:** E2E smoke test covering customer upload -> pharmacist approval -> store pack.
- **Submission Packaging:** Rebuild `deployment.md` and `Technical Design Document (PDF/Word)` into final ZIP.

---

## 5. Explicit Approval Requests (Protocol §2.6)

Before modifying code, the following actions require explicit user confirmation:
1. **Dependency Installation:** Permission to install `@playwright/test` into `devDependencies` (resolves current `tsc --noEmit` failure TS2307).
2. **Database Migration:** Permission to create migration `20261104100000_schedule_x_guard_and_otp_fk` (updates PostgreSQL trigger to block non-REJECTED `can_sell_online = false` lines and drops the foreign key `otp_records_phone_fkey`).
3. **Test Deletion/Replacement:** Permission to delete the string-grep and JS simulation in `tests/integration/db-trigger.test.ts` and replace it with real raw SQL against PostgreSQL.
4. **Git Untracking:** Permission to remove `docs/Technical_Design_Document.docx` and `submission/isocode_pharmacy_submission.zip` from git tracking (`git rm --cached`).
5. **Secrets Rotation Warning:** Notice that previous fallback secrets in git are burned and fresh secrets must be supplied in Vercel / production environments.

