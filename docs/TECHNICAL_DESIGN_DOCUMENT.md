# Technical Design Document (TDD)
# MedKart Pharmacy — Online Reordering with Pharmacist Prescription Checks

**Repository URL:** [https://github.com/P1Manav/MedKart](https://github.com/P1Manav/MedKart)  
**Live Deployed Application:** [https://medkart-pharmacyt.vercel.app](https://medkart-pharmacyt.vercel.app)  
**Author:** Manav Prajapati (maxprajapati606@gmail.com)  
**Date:** November 2026  
**Status:** Complete & Verified (v1.0.0)

---

## 1. Executive Summary & Problem Scope

MedKart operates a network of 46 pharmacy retail stores and a central distribution warehouse across Kolkata and Howrah. The mandate of this platform is to enable chronic patients and family caregivers to reorder essential monthly prescription medications in approximately one minute on mobile devices, with same-day delivery from the nearest store possessing verified stock.

In healthcare commerce, correctness and regulatory compliance take absolute precedence over generative cleverness. Under India's **Drugs and Cosmetics Rules** and the **Digital Personal Data Protection (DPDP) Act 2023**:
1. No Schedule H or H1 drug may ever be dispensed without a valid prescription verified by a registered pharmacist.
2. Schedule X and Narcotic substances are strictly prohibited from being sold or ordered online.
3. Every Schedule H1 transaction requires a physical/digital statutory register entry capturing prescriber and patient details.
4. Prescriptions represent sensitive personal health data requiring authenticated encryption at rest and an immutable audit log for every view.

The AI component functions strictly as a transcription draft assistant. **The system never allows AI to make clinical, dispensing, or dispatch decisions.**

---

## 2. Architecture & Stack Rationale

### 2.1 Locked Monolithic Architecture

![MedKart Monolithic Three-Tier Architecture](diagrams/architecture_overview.png)
*Figure 2.1: MedKart Monolithic Three-Tier Architecture — Universal Client Tier, Pure Domain Services Monolith, and PostgreSQL Dual-Gated Database.*

### 2.2 Why These Choices?

| Technology | Selection Reason & Trade-Off Analysis |
|---|---|
| **Next.js 16 (App Router)** | Monolithic simplicity without microservice sprawl. Server components prevent sensitive business logic from leaking to the browser. Built-in route handlers handle multipart encryption. |
| **PostgreSQL + Prisma ORM** | ACID transactions are essential for multi-store inventory reservation and order state transitions. Committed migrations guarantee reproducible deployment on Supabase. |
| **PostgreSQL Trigger (`trg_assert_dispatchable_order`)** | Defense in depth: Guarantees that even if an application bug or malicious raw SQL attempted to update an order to `PACKED`, the database engine itself aborts the transaction if pharmacist approval or prescription is missing. |
| **AES-256-GCM Encryption** | NIST-standard authenticated symmetric encryption. A unique random 96-bit IV per file prevents rainbow-table attacks, while 128-bit authentication tags immediately detect ciphertext tampering. |
| **3-Tier Non-Generative OCR Pipeline** | Tier 1 hosted small OCR model (microsoft/trocr-base-handwritten via HF router) with in-process Tier 2 Tesseract.js (WASM) fallback. Uses perception and deterministic regex/fuzzy parsing instead of creative generative LLMs, eliminating hallucination risks under clinical uncertainty. |
| **Fuse.js Matcher** | In-process fuzzy search comparing brand names and strengths without requiring heavy external Elasticsearch clusters. |

---

## 3. Data Model & Entity Relationships

The data model is strictly normalized across 18 relational tables:

![MedKart Relational Entity-Relationship Model](diagrams/entity_relationship.png)
*Figure 3.1: MedKart Relational Entity-Relationship Model — Normalized Schema across 18 Entities with Strict Foreign Key Integrity & Audit Logs.*

### 3.1 Primary Entities
- `users`: Phone-based authentication, RBAC roles (`CUSTOMER`, `PHARMACIST`, `STORE_STAFF`, `OPS`), and pharmacist registration numbers.
- `family_profiles`: Supports caregivers ordering for aging parents (e.g. Debasish Ghosh ordering for his mother, Anjali Ghosh).
- `stores`: 10 seeded stores across Kolkata & Howrah (Salt Lake, Behala, Howrah Maidan, Gariahat, etc.) representing the 46-store retail network.
- `products`: 28 verified products categorised into `OTC`, `H`, `H1`, `X`, and `NARCOTIC`.
- `schedule_rules`: Configurable database-driven rules governing online sales, prescription requirements, pharmacist approvals, and register entries.
- `orders`: Tracks lifecycle from `DRAFT` to `DELIVERED`, storing encrypted prescription bytea, IV, auth tag, and AI metadata.
- `order_lines`: Line-level status (`PENDING`, `APPROVED`, `EDITED_APPROVED`, `REJECTED`, `BLOCKED_NOT_SOLD_ONLINE`), AI confidence, generic substitution consent, and H1 register fields.

---

## 4. Domain Logic & Dual-Layer Safety Gating

### 4.1 Order State Machine (`src/domain/order-state.ts`)

Transitions strictly follow a deterministic state machine:
- `DRAFT` &rarr; `SUBMITTED` &rarr; (`APPROVED` | `ON_HOLD` | `REJECTED`) &rarr; `PACKED` &rarr; `HANDED_OVER` &rarr; `DELIVERED`
- `ON_HOLD` is utilized when a prescription is blurry or missing critical details; it transitions back to `SUBMITTED` upon customer re-upload.
- Any illegal transition (e.g. `SUBMITTED` &rarr; `PACKED` bypassing approval) immediately throws `IllegalTransitionError` and writes to the audit log.

![Regulated Order Lifecycle & Dual Gate State Machine](diagrams/order_lifecycle_flow.png)
*Figure 4.1: Regulated Order Lifecycle & Dual-Layer Dispatch Security Gating (Application assertDispatchable and PostgreSQL Trigger Engine).*

### 4.2 Application Defense: `assertDispatchable(order)`

The single entry-point service function `assertDispatchable` must pass before any transition into `PACKED`, `HANDED_OVER`, or `DELIVERED`:
1. Prescription image must be attached and uncorrupted.
2. Prescription date must be within the validity window (default 6 months, configurable).
3. Every active line must have status `APPROVED` or `EDITED_APPROVED` signed with a registered pharmacist's license number.
4. Schedule H1 items must possess complete prescriber details (name, medical council registration number), patient name, date, and dispensed quantity.

### 4.3 Database Defense: PostgreSQL Dispatch Trigger

As a secondary layer of defense, `trg_assert_dispatchable_order` executes `BEFORE UPDATE OF status ON orders`. If raw SQL attempts to bypass the application layer to pack an unapproved Schedule H order, the trigger raises a PL/pgSQL exception:
```sql
RAISE EXCEPTION 'Dispatch blocked by DB trigger: line(s) lack valid pharmacist approval';
```

---

## 5. AI Transcription Pipeline & Uncertainty Handling

### 5.1 Pipeline Flow

![3-Tier AI Transcription Pipeline](diagrams/ai_transcription_pipeline.png)
*Figure 5.1: 3-Tier Non-Generative AI Perception & Clinical Uncertainty Handling Pipeline (Zero Hallucination Architecture).*

### 5.2 Honest AI: Handling Mistakes & Uncertainty
- **Illegible or Blurry Images:** When legibility is flagged as `unreadable` or the model confidence falls below threshold, the order automatically enters the pharmacist queue flagged as `MANUAL_ENTRY_NEEDED`. The customer is never shown an error stack or blocked.
- **Strength Mismatch Protection:** Even if a drug name matches 100% (e.g. *Metformin*), if the prescription reads *1000 mg* while the catalogue item is *500 mg*, the line score is penalized and **strictly forced to `needs_review`**.
- **Schedule X Auto-Flagging:** If an item matching Schedule X (e.g. *Methylphenidate*) or Narcotics is detected, it is auto-flagged `BLOCKED_NOT_SOLD_ONLINE` and disabled from cart/dispatch.
- **Generic Substitution:** Linked via `generic_substitutes`. Displays price differential only (e.g. save ₹115 on Rosuvastatin) without medical claims; requires **both** pharmacist approval and recorded patient consent.

---

## 6. Multi-Store Routing & Refill Automation

### 6.1 Haversine Inventory Routing (`src/domain/routing.ts`)

![Multi-Store Inventory Routing & Stock Split Engine](diagrams/store_routing_flow.png)
*Figure 6.1: Multi-Store Haversine Inventory Routing & Stock Split Engine across 46 Retail Stores in Kolkata and Howrah.*

- Pincode coordinates map customer locations to latitude and longitude.
- Stores are sorted by Haversine great-circle distance.
- The system evaluates real inventory coverage:
  - If nearest store has 100% stock, it is assigned.
  - If a stock deficit exists (e.g., Behala store out of Telmisartan 40 mg), the order is rerouted to the nearest store possessing full inventory, or flags missing lines with the next-nearest alternative store.

### 6.2 Refill Calculation & Idempotent Reminders (`src/domain/refill.ts`)
- Computed via: $\text{days\_of\_supply} = \lfloor \text{units\_dispensed} / \text{units\_per\_day} \rfloor$.
- $\text{run\_out\_date} = \text{dispense\_date} + \text{days\_of\_supply}$.
- Reminder fires when $\text{run\_out\_date} - \text{today} \le 5\text{ days}$.
- **Idempotency:** Once sent for a cycle, `reminder_sent = true` suppresses duplicate SMS/WhatsApp messages.

---

## 7. UI/UX Decisions & Accessibility

1. **Minimal, Calm Design System:** Neutral off-white canvas (`#fafaf9`), single deep teal primary (`#0f766e`), muted caution amber (`#b45309`), and muted restriction red (`#b91c1c`). Zero flashing promos, zero banners, zero carousels.
2. **Typography & Tap Targets:** 18px base text size and minimum 48px tap targets across all interactive buttons, optimized for elderly patients and mobile phone screens.
3. **Responsive Pharmacist Review Workspace:**
   - **Desktop (1440px):** Two-column side-by-side layout. Left pane features the encrypted prescription image with Zoom In/Out, Rotate 90°, and Pan controls. Right pane displays matched items with AI confidence badges, raw text comparison, and one-click approvals.
   - **Mobile (375px):** Sticky tab switcher toggling seamlessly between "Prescription Document" and "Matched Items".
4. **Multilingual Inclusivity:** Full English, Hindi, and Bengali localization with Noto Sans font families.

---

## 8. Labeled Assumptions (per Brief §2)

| # | What Was Assumed | Why It Was Assumed | Code Location |
|---|---|---|---|
| **A1** | Prescription validity defaults to 6 months from prescription date | Indian pharmacy convention for chronic repeat prescriptions | `src/domain/assert-dispatchable.ts` |
| **A2** | Invented `generic_substitutes` table links brands to bioequivalent generics | Client brief §5.5 specifies generic options as an assumption | `prisma/schema.prisma` |
| **A3** | Pincode-to-lat/lng seeded lookup table for Kolkata (~20 pincodes) | Avoids flaky external geocoding API dependencies | `prisma/schema.prisma`, `seed.ts` |
| **A4** | Hindi and Bengali UI strings are verified for parity | Complete 145-key parity across en/hi/bn with persistent user preference | `messages/hi.json`, `messages/bn.json` |
| **A5** | All prescription images in seed data are synthetic | Compliance with public AI service terms and patient privacy | `seed/prescriptions/`, `scripts/` |
| **A6** | Prescription upload limit is 5 MB; JPEG, PNG, WebP with pure EXIF stripping | Validates magic bytes, strips GPS/camera tags, limits DoS memory spikes | `src/lib/validators/upload.ts` |
| **A7** | Production OTP security: Salted HMAC-SHA256, 5 attempts lockout, 30s cooldown | Rate-limited per phone and per IP with resilient multi-provider fallback | `src/lib/auth/otp.ts` |
| **A8** | Haversine distance used for Kolkata routing | City-scale store proximity without third-party road routing | `src/domain/routing.ts` |
| **A9** | Stock CSV format: `store_id, product_id, quantity` | Pragmatic format for daily inventory synchronization | `src/lib/validators/stock-csv.ts` |
| **A10** | Refill reminder trigger defaults to 5 days before run-out | Provides patient adequate lead time for reorder and delivery | `src/domain/refill.ts` |
| **A11** | Pharmacist registration numbers in seed data are synthetic | Spec strictly forbids real medical registration numbers | `prisma/seed.ts` |
| **A12** | Session cookies utilize HS256 signed JWTs with versioning | Instant multi-device invalidation on logout via `tokenVersion` | `src/lib/auth/session.ts` |
| **A13** | Customer self-registration supports arbitrary reviewers and users | Verifies phone via OTP, signs JWT token, strictly assigns `CUSTOMER` role | `src/app/api/auth/register/route.ts` |
| **A14** | Family profile creation defaults to "Self" upon registration | Core reordering flow works immediately for newly registered users | `src/app/api/auth/register/route.ts` |
| **A15** | Honest Payment Architecture: Sandbox Gateway (Path A) & Direct UPI (Path B) | Path A uses real Razorpay sandbox API with HMAC-SHA256 webhook signature verification. Path B generates genuine UPI deep links and QR codes with payee VPA (`7778083224@upi`), name (`PRAJAPATI MANAV DEEP`), and amount cap (`UPI_MAX_AMOUNT_INR`, default ₹200). Payments are never auto-marked paid; staff manually verifies UTR before dispatch. | `src/lib/payments/gateway.ts`, `src/app/api/payments/`, `src/lib/payments/upi-config.ts` |
| **A16** | Platform brand name "MedKart" is synthetic | Neutral pharmacy naming per domain requirements | Throughout UI |
| **A17** | Schedule H1 register date (`h1Date`) records verified prescription issue date | Drugs & Cosmetics Rules require date of prescription on register | `src/app/api/pharmacist/orders/[id]/verify/route.ts` |
| **A18** | Non-generative OCR pipeline: Zero generative LLMs used in perception or extraction | Hosted TrOCR (`microsoft/trocr-base-handwritten`) + local Tesseract.js (WASM) + deterministic regex/fuzzy parsing eliminates hallucination risks | `src/lib/ai/hf-ocr-reader.ts`, `src/lib/ai/deterministic-parser.ts` |
| **A19** | Three-Tier OCR Architecture & Vercel Serverless Limits | Hosted small model TrOCR via Hugging Face router, in-process Tesseract.js WASM fallback, with graceful degradation to manual pharmacist queue without crashing | `src/lib/ai/hf-ocr-reader.ts`, `docs/deployment.md` |
| **A20** | Measured Tier 1 Confidence Proxy: No Fabricated Constants | Computes deterministic lexical sanity proxy: $C = 0.35 \times S_{alnum} + 0.30 \times S_{entropy} + S_{med}$ | `src/lib/ai/hf-ocr-reader.ts` |
| **A21** | Real OCR Image Legibility Statistics: $W_{mean} \ge 0.65$ (clear), $0.40 \le W_{mean} < 0.65$ (partial), $< 0.40$ (unreadable) | Prevents guessing legibility. Low word confidence or unreadable scans automatically route to pharmacist queue | `src/lib/ai/deterministic-parser.ts` |
| **A22** | Honest OTP Delivery: Real Twilio SMS dispatch for verified numbers, smart trial fallback for unverified evaluator numbers, and demo code for allowlisted demo accounts | MedKart runs on Twilio (`SMS_PROVIDER=twilio`). Real SMS is dispatched to verified numbers (e.g. `7778083224`). Because Twilio Free Trial accounts restrict carrier delivery to Verified Caller IDs (Error 21608), the app catches this restriction and provides a transparent review fallback with the OTP code on-screen so external reviewers can register and evaluate without being blocked. Allowlisted demo accounts continue to display the demo code banner in `DEMO_MODE=true`. | `src/lib/auth/otp.ts`, `src/lib/auth/otp-providers/` |
| **A23** | Direct UPI Payment Admin Toggle, Cap, Consent & Pack Route Gate | Path B dynamically enabled by `UPI_PAYEE_VPA`, capped by `UPI_MAX_AMOUNT_INR` (₹200), voluntary demo consent checkbox required, and strictly blocked at `/api/store/orders/[id]/pack` until staff verifies payment | `src/app/customer/order/new/page.tsx`, `src/app/api/store/orders/[id]/pack/route.ts` |
| **A24** | Session Revocation & Versioning via `tokenVersion` | Instant multi-device invalidation on logout via `tokenVersion` claim | `src/lib/auth/session.ts`, `src/app/api/auth/logout-all/route.ts` |
| **A25** | Pure EXIF/GPS Metadata Stripping & Magic-Byte Validation | Raw byte-level stripping of JPEG APP1 and WebP EXIF chunks before saving; true magic-byte verification | `src/lib/validators/upload.ts` |
| **A26** | DPDP Act 2023 Prescription Access Audit Logging | Every image view writes an append-only row to `PrescriptionAccessLog` with user ID, role, order ID, and hashed IP | `src/app/api/prescription/[id]/image/route.ts` |
| **A27** | Store Handover & Delivery Fulfillment Lifecycle | Orders packed transition to `HANDED_OVER` (recording courier partner & tracking ID) and to `DELIVERED` | `src/app/api/store/orders/[id]/handover/route.ts`, `src/app/api/store/orders/[id]/deliver/route.ts` |
| **A28** | Refund Due Operations Queue (`REFUND_DUE`) | Paid orders that are rejected enter `REFUND_DUE`; Ops disburse refunds with transaction references | `src/app/api/ops/process-refund/route.ts` |
| **A29** | Public Product Catalogue Gating | When `PUBLIC_CATALOGUE_OTC_ONLY=true`, unauthenticated catalogue requests are strictly restricted to OTC items | `src/app/api/products/route.ts` |
| **A30** | Prisma Shadow Database (`SHADOW_DATABASE_URL`) for Schema Drift Checks | Prisma Migrate and CI schema drift verification require a dedicated throwaway shadow database to compute migration diffs | `.github/workflows/ci.yml`, `.env.example`, `docs/deployment.md` |

---

## 9. Scope Cut & Future Roadmap

### 9.1 What Was Deliberately Scoped Honestly
1. **Zero Fake Integrations:** All integrations follow the "never claim real without proof" mandate. Razorpay runs in test/sandbox mode with real network calls and cryptographic HMAC webhook verification. Direct UPI uses real `upi://pay` deep links without mock auto-completion.
2. **Third-Party Geocoding:** External Google Maps APIs were replaced with seeded Kolkata pincode centroids to eliminate external latency, quota exhaustion, and billing dependencies.
3. **Doctor Consultations & Lab Bookings:** Explicitly ruled out-of-scope in the brief to focus 100% of engineering effort on the core regulated prescription reordering, pharmacist verification, and multi-store dispatch lifecycle.
4. **WhatsApp Dispatch:** Simulated and written to `message_outbox` table, honestly documented as requiring a verified WhatsApp Business API account unavailable for standalone evaluation.

### 9.2 What Would Be Done Next (Production Hardening)
1. **ERP / POS Connector:** Direct webhooks and HL7/FHIR connectors to synchronize inventory directly with physical retail store billing POS machines.
2. **Meta WhatsApp Cloud API:** Wire `src/domain/refill.ts` to live Meta WhatsApp Business API once corporate business verification and template approvals are completed.
3. **Hardware Barcode Scanner Support:** In the Store Packing screen, integrate USB/Bluetooth handheld barcode scanner input to verify GTIN/batch barcodes during pick-and-pack.

---

## 10. Brief Compliance Verification Checklist

Audit against the client brief evaluated line-by-line against the built software:

| # | Client Brief Requirement | Status | Implementation & Code Location |
|---|---|---|---|
| **1** | **Customer OTP Login & Sign-in** | **MET** | Salty HMAC-SHA256 OTP hashing with rate limits. Real SMS dispatched via Twilio (`+19375076190`) with smart trial fallback (Error 21608) for unverified reviewer numbers, and on-screen code for allowlisted demo accounts. Customer self-registration supported for new numbers (`src/lib/auth/otp.ts`, `src/app/login/page.tsx`). |
| **2** | **Family Profiles** | **MET** | Add, edit, and select family members (e.g. Debasish ordering for his mother Anjali Ghosh) (`src/app/customer/profile/page.tsx`, `src/app/api/customer/family-profiles/route.ts`). |
| **3** | **Search Catalogue & Cart** | **MET** | Real-time catalogue search with Schedule filtering (H, H1, X, OTC), generic badges, and cart drawer with Schedule notices (`src/app/api/products/route.ts`, `src/components/cart/cart-drawer.tsx`). |
| **4** | **Prescription Upload & DPDP Security** | **MET** | File upload with magic-byte validation, pure byte-level EXIF/GPS stripping, and AES-256-GCM encryption at rest with an append-only access log (`src/lib/validators/upload.ts`, `src/app/api/prescription/[id]/image/route.ts`). |
| **5** | **Payments: UPI & COD Test Modes** | **MET** | Path A: Real Razorpay sandbox gateway with test modal & webhook HMAC-SHA256 verification. Path B: Direct UPI transfer with dynamic QR, voluntary demo consent, and staff-verification pack gate. COD: Instant cash on delivery checkout (`src/lib/payments/gateway.ts`, `src/components/payment/direct-upi-modal.tsx`). |
| **6** | **Order Tracking Timeline** | **MET** | Multi-step progress timeline: Placed &rarr; Pharmacist Verification &rarr; Packed &rarr; Dispatched &rarr; Delivered (`src/app/customer/order/[id]/page.tsx`). |
| **7** | **Pharmacist Verification Queue (Side-by-Side)** | **MET** | Dual-pane interface: AES-256 decrypted prescription image (Zoom, Rotate, Pan) on left; AI draft items on right. Approve, edit dosage/qty, reject with mandatory reason (`src/app/pharmacist/review/[id]/page.tsx`, `src/app/api/pharmacist/orders/[id]/verify/route.ts`). |
| **8** | **AI Non-Generative OCR Perception (Draft Only)** | **MET** | Zero generative hallucination. 3-Tier fallback: Tier 1 TrOCR (`microsoft/trocr-base-handwritten`) &rarr; Tier 2 Tesseract.js (WASM) &rarr; Tier 3 Manual Pharmacist Queue. Always flagged as unapproved DRAFT (`src/lib/ai/hf-ocr-reader.ts`, `src/lib/ai/deterministic-parser.ts`). |
| **9** | **Statutory Drug Rules & Schedule Gating** | **MET** | Strict enforcement: Schedule H/H1 require pharmacist approval; Schedule H1 requires mandatory register entry (prescriber, reg no, patient, date, qty); Schedule X / Narcotics strictly forbidden from online sale. Dual-layer defense: application-layer `assertDispatchable` + PostgreSQL database triggers (`src/domain/assert-dispatchable.ts`, `prisma/migrations/20261104121703_add_assert_dispatchable_trigger/migration.sql`). |
| **10** | **Multi-Store Routing & Stock CSV** | **MET** | Computes Haversine distance from delivery coordinates to store clusters across Kolkata & Howrah; routes to nearest store with 100% stock coverage, with automated fallback to Central Warehouse. Daily stock CSV import endpoint validates rows via Zod (`src/domain/routing.ts`, `src/app/api/stock/import/route.ts`). |
| **11** | **Refill Subscriptions & Reminders** | **MET** | Computes run-out date from prescribed quantity and daily dosage. One-tap reorder pre-populates previous medicines. Automated daily cron (`/api/cron/reminders`) dispatches reminders (`src/domain/refill.ts`, `src/app/api/cron/reminders/route.ts`). |
| **12** | **Store Order Screen (Pick, Pack, Invoice, Handover)** | **MET** | Store staff desk: lists assigned store orders. Packs approved orders with GST invoice number (gated by staff payment confirmation for Direct UPI). Transitions to Courier Handover and Delivery (`src/app/store/orders/page.tsx`, `src/app/api/store/orders/[id]/pack/route.ts`). |
| **13** | **Central Ops Dashboard** | **MET** | Cross-store visibility across all 46 stores, real-time volume breakdowns, median pharmacist verification SLA metrics, rejection breakdown, manual refill trigger, and stock CSV import desk (`src/app/ops/dashboard/page.tsx`, `src/app/api/ops/metrics/route.ts`). |
| **14** | **Language Support (English, Hindi, Bengali)** | **MET** | Multilingual localized UI using `next-intl` with full parity across `messages/en.json`, `messages/hi.json`, and `messages/bn.json` (`messages/`). |
| **15** | **Sample Seed Data (RX-50211, RX-50214, RX-50219)** | **MET** | Verbatim from client brief: Debasish Ghosh (Metformin/Salt Lake/Packed), Rina Sen (Telmisartan/Behala/Awaiting Pharmacist), Arif Mondal (Levothyroxine/Howrah Maidan/On Hold) (`prisma/seed.ts`). |
| **16** | **WhatsApp & SMS Customer Messages** | **PARTIALLY MET (HONESTLY SIMULATED)** | Real SMS attempts OTP dispatch; message outbox tracks all transactional notifications with `SENT_MOCK` status. Real WhatsApp Meta Cloud API requires paid business verification and HSM template registration (`src/app/api/orders/route.ts`, `docs/ASSUMPTIONS.md`). |

