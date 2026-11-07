# Deployment Guide — MedKart Pharmacy Monolith

This document describes how to run MedKart locally step by step, how it is deployed to production on Vercel and Supabase (Free Tier), the real free-tier services and their verified limits, and demo login details for reviewer evaluation.

- **GitHub Repository:** [https://github.com/P1Manav/isocode_assignment](https://github.com/P1Manav/isocode_assignment)
- **Live Deployed Application:** [https://medkart-pharmacyt.vercel.app](https://medkart-pharmacyt.vercel.app)

> **SECURITY NOTICE:** Never commit secrets or actual private keys to the repository. All secrets must be configured via environment variables.

---

## 1. How to Run Locally, Step by Step

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- PostgreSQL 16 (local installation, Supabase free tier, or Docker Compose)

### Step 1: Clone Repository & Install Dependencies
```bash
git clone https://github.com/P1Manav/isocode_assignment.git
cd isocode_assignment
npm install
```

### Step 2: Configure Environment Variables
Copy the template `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure the following variables are configured in `.env`:
- `DATABASE_URL`: Connection string to your PostgreSQL instance (e.g. Supabase or `postgresql://postgres:postgres@localhost:5432/medkart`)
- `SESSION_SECRET`: A 32+ character random secret for signing session cookies
- `PRESCRIPTION_ENC_KEY`: A 64-character hex string (32 bytes) for AES-256-GCM prescription encryption
- `CRON_SECRET`: Secret bearer token securing automated refill reminders
- `OTP_PEPPER`: 16+ character secret used for salted HMAC-SHA256 OTP hashing
- `DEMO_MODE`: Set to `"true"` for local review (activates the top 1-click role switcher ribbon and mock OTP for demo numbers)
- `DEMO_PHONES`: (Optional) Comma-separated list of allowlisted demo phone numbers
- `SMS_PROVIDER`: (Optional) SMS provider name (`msg91`, `twilio_verify`, `fast2sms`, or `mock`)
- `MSG91_AUTH_KEY`: (Optional) MSG91 API key for real SMS OTP delivery
- `HF_API_TOKEN`: (Optional) Free Hugging Face user access token. If omitted, Tier 2 (in-process Tesseract.js WASM) runs automatically.
- `HF_OCR_MODEL`: AI OCR model (default: `microsoft/trocr-base-handwritten`).
- `PAYMENT_GATEWAY_KEY_ID`: (Optional) Razorpay or Cashfree Sandbox Key ID.
- `PAYMENT_GATEWAY_KEY_SECRET`: (Optional) Razorpay or Cashfree Sandbox Key Secret.
- `PAYMENT_GATEWAY_WEBHOOK_SECRET`: (Optional) Secret for HMAC-SHA256 webhook signature verification.

### Step 3: Run Database Migrations & Seed
```bash
# Generate Prisma Client
npx prisma generate

# Apply migrations (including PostgreSQL triggers and constraints)
npx prisma migrate deploy

# Seed initial catalogue, schedule rules, stores, and sample orders
npm run seed
```

### Step 4: Run Tests & Verification Gates
```bash
# Run unit and integration tests (238 tests across 32 suites)
npm test

# Run real PostgreSQL trigger integration tests (8 tests against live DB)
npm run test:db

# Run strict TypeScript typecheck
npm run typecheck

# Run production build
npm run build
```

---

## 2. Free-Tier Architecture & Deployment Reality Check

Every component of MedKart runs end-to-end on verified free tiers:

| Component / Provider | Role | Free Tier Specifications & Verified Limits |
|---|---|---|
| **Vercel Hobby** | Web hosting & Serverless API routes | **Limits**: 250 MB uncompressed function bundle, 15s serverless execution timeout, 4.5 MB request body limit. **Execution Reality**: Tesseract.js WASM engine fits within the 250 MB bundle, but cold-start WASM instantiation on Vercel's shared vCPUs can consume 4–8s. Hosted Tier 1 (`router.huggingface.co`) offloads compute to Hugging Face infrastructure; Tier 2 (Tesseract.js WASM) runs reliably in local/Docker runtimes; both safely fall back to Tier 3 pharmacist manual queue if timeouts or quota limits occur without ever crashing the request. |
| **Hugging Face Inference API** | Tier 1 Non-generative OCR model (`microsoft/trocr-base-handwritten`) | **Limits**: Free tier access token, rate-limited to a few hundred requests/hour. Endpoint migrated to `router.huggingface.co`. Cold-starts handled via 25s timeout and automatic fallback to Tier 2 Tesseract. |
| **Tesseract.js WASM Engine** | Tier 2 In-process local OCR | **Limits**: Pure WebAssembly (WASM), zero network calls, zero rate limits, runs completely in-process with real per-word confidence scores. |
| **Supabase PostgreSQL** | Cloud-native relational database | **Limits**: 500 MB storage, connection pooling via Supavisor / PgBouncer on port 6543, direct Postgres on 5432. |
| **Razorpay / Cashfree Sandbox** | UPI payments & checkout simulation (Path A) | **Limits**: Test mode credentials, zero real money. Real webhook HMAC-SHA256 signature verification via `crypto.timingSafeEqual`. |
| **Direct UPI Transfer (Path B)** | Peer-to-peer / merchant UPI QR payment | **Limits**: Dynamically driven by `UPI_PAYEE_VPA`. Path B is hidden if unconfigured. Capped by `UPI_MAX_AMOUNT_INR` (default ₹100). Payments are never auto-marked paid; staff manually verifies UTR before dispatch. |
| **SMS / OTP Provider Chain** | Resilient phone verification | **Limits**: Configurable fallback chain (MSG91 -> Twilio Verify -> Fast2SMS -> Email -> Mock). Honest on-screen demo SMS banner by default for allowlisted demo accounts only; real SMS dispatched when provider credentials are configured. |

### Environment Variables on Vercel & CI

| Variable Name | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Supabase PostgreSQL connection string (pooled on port 6543 or direct on 5432) |
| `SHADOW_DATABASE_URL` | CI / Dev | Shadow database URL required by Prisma (`prisma migrate dev` and CI schema-drift verification). Not used at runtime. |
| `SESSION_SECRET` | **Yes** | 32+ character secret for HS256 JWT cookie signing |
| `PRESCRIPTION_ENC_KEY` | **Yes** | 64-character hex string for AES-256-GCM encryption |
| `CRON_SECRET` | **Yes** | Secret bearer token for daily refill cron (`/api/cron/reminders`) |
| `OTP_PEPPER` | **Yes** | 16+ character secret used for salted HMAC-SHA256 OTP hashing (fails closed in prod) |
| `NEXT_PUBLIC_APP_URL` | No | Canonical URL of deployed Vercel application |
| `PUBLIC_CATALOGUE_OTC_ONLY` | No | When `"true"`, restricts unauthenticated `/api/products` to OTC only |
| `DEMO_MODE` | No | `"true"` to enable 1-click reviewer ribbon |
| `DEMO_PHONES` | No | Comma-separated allowlist of demo phone numbers |
| `SMS_PROVIDER` | No | Selected SMS provider (`msg91`, `twilio_verify`, `fast2sms`, or `mock`) |
| `MSG91_AUTH_KEY` | No | MSG91 SMS gateway auth key |
| `MSG91_TEMPLATE_ID` | No | MSG91 DLT approved template ID |
| `SMS_PROVIDER_TEMPLATE_ID` | No | Generic SMS provider template ID fallback |
| `TWILIO_ACCOUNT_SID` | No | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | No | Twilio Auth Token |
| `TWILIO_VERIFY_SERVICE_SID` | No | Twilio Verify Service SID (VA...) or Messaging Service SID (MG...) |
| `TWILIO_PHONE_NUMBER` | No | Twilio sender phone number in E.164 format (+1...) |
| `FAST2SMS_API_KEY` | No | Fast2SMS API Key |
| `EMAIL_PROVIDER` | No | Email provider (`resend`, `brevo`, or `smtp`) |
| `RESEND_API_KEY` | No | Resend API key for Email OTP fallback |
| `BREVO_API_KEY` | No | Brevo API key for transactional email delivery |
| `SMTP_HOST` | No | SMTP host address for transactional email |
| `EMAIL_FROM` | No | Sender email address for OTP delivery |
| `AI_READER` | No | OCR engine selection (`hf`, `tesseract`, or `mock`) |
| `HF_API_TOKEN` | No | Hugging Face free-tier token for hosted TrOCR model |
| `HF_OCR_MODEL` | No | OCR model name (default: `microsoft/trocr-base-handwritten`) |
| `PAYMENT_GATEWAY_KEY_ID` | No | Razorpay sandbox test key ID (Path A) |
| `PAYMENT_GATEWAY_KEY_SECRET` | No | Razorpay sandbox test key secret |
| `PAYMENT_GATEWAY_WEBHOOK_SECRET` | No | Webhook HMAC verification secret |
| `UPI_PAYEE_VPA` | No | Direct UPI payee VPA (Path B). When omitted, Path B is completely hidden. |
| `UPI_PAYEE_NAME` | No | Direct UPI payee business name (default: "MedKart Pharmacy") |
| `UPI_MAX_AMOUNT_INR` | No | Maximum permitted amount for direct UPI demo (default: 100) |
| `PLAYWRIGHT_TEST_BASE_URL` | No | Optional base URL override for Playwright end-to-end tests |

> **Prisma Shadow Database Configuration (`SHADOW_DATABASE_URL`):**
> Prisma requires a secondary, throwaway database (a "shadow database") when running `prisma migrate dev` or computing migration diffs in CI (`prisma migrate diff`) to detect schema drift against migrations without modifying the main database.
> - **In Local Development & CI:** Run a local PostgreSQL instance or create a throwaway database (`CREATE DATABASE medkart_shadow;`), setting `SHADOW_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/medkart_shadow?sslmode=disable"`.
> - **With Cloud Supabase:** Supabase cloud projects are single-tenant databases where `CREATE DATABASE` cannot be executed over pooled connections. To run `prisma migrate dev` against Supabase, provide the direct connection string (port 5432 with `?sslmode=require`) of a second free-tier Supabase project as `SHADOW_DATABASE_URL`.
> - **In Production:** `prisma migrate deploy` (used on Vercel or CI deploy steps) does **not** require a shadow database, as it simply executes existing migration files in sequence against `DATABASE_URL`.

---

## 3. Demo Login Details for the Reviewer

When `DEMO_MODE=true` is enabled, the top ribbon provides **1-click instant login buttons** for every user role without requiring manual credentials. Alternatively, manual OTP login is available on the `/login` screen:

| Role | Name | Phone Number | Description / Permissions |
|---|---|---|---|
| **Customer (Caregiver)** | Debasish Ghosh | `9830011111` | Orders monthly medicines for his mother (Anjali Ghosh) and himself. Has order RX-50211 in seed data. |
| **Customer** | Rina Sen | `9830022222` | Chronic patient reordering Telmisartan. Has order RX-50214 (Awaiting Pharmacist). |
| **Customer** | Arif Mondal | `9830033333` | Has order RX-50219 (On Hold, prescription re-upload requested). |
| **Pharmacist (Registered)** | Sunita Banerjee | `9830044444` | Licensed pharmacist (Reg: `WB/PHARM/2024/0001`). Can access the Verification Queue, review prescription images, approve/edit/reject lines, verify prescription dates, and approve orders. |
| **Store Staff** | Bikash Mondal | `9830066661` | Salt Lake store staff. Can view routed orders for Salt Lake, access decrypted prescription for approved orders, and enter invoice numbers to pack orders. |
| **Central Operations (Ops)** | Arijit Sen | `9830099999` | Operations manager. Can inspect system-wide metrics, SLA medians, active store volumes, trigger manual refill runs, and upload daily stock CSVs. |

### How OTP Verification Works in Demo Mode:
1. Enter any of the phone numbers above on the `/login` screen and click **"Send Verification Code"**.
2. A yellow **"Demo SMS Received"** banner displays the 6-digit code on screen (or enter `123456`).
3. Click **"Verify & Continue"** to be routed to your role-specific dashboard.

---

## 4. 10-Minute Reviewer Walkthrough

The top ribbon on every page includes a **Demo Roles Switcher** for instant 1-click testing:

1. **Customer Flow (or Self-Registration):**
   - Click `Customer (Debasish)` from the top ribbon (or register a new account on `/login` via the "New to MedKart? Create an account" link).
   - Tap `Reorder My Medicines` &rarr; select one of the synthetic prescriptions &rarr; choose delivery address.
   - Select payment method: either **Sandbox UPI Gateway (Path A)** with instant simulation, or **Direct UPI Transfer (Path B)** with genuine QR code, voluntary demo consent, and 12-digit UTR submission.
   - Submit order. Notice it generates a live tracking timeline.
2. **Pharmacist Flow:** Click `Pharmacist (Sunita)` &rarr; open `Verification Queue` &rarr; click `Verify Prescription` on the submitted order.
   - Inspect the AES-256 decrypted prescription image with Zoom In/Out, Rotate, and Pan controls.
   - Review AI draft medicines with confidence indicators (Tier 1 TrOCR / Tier 2 Tesseract WASM).
   - Approve lines or request re-upload (places order `ON_HOLD`).
   - Click `Approve Order & Route to Store`.
3. **Store Staff Fulfillment Desk:** Click `Store Staff (Salt Lake)` &rarr; view orders assigned to Salt Lake store.
   - **Direct UPI Gate Enforcement:** If the order was placed via Direct UPI, the order requires explicit payment confirmation. Click `Confirm UPI Receipt` to verify the 12-digit UTR into the audit trail. Attempting to pack prior to confirmation is strictly blocked server-side (HTTP 400).
   - **Pack & Invoice:** Click `Pack Order`, enter invoice number (e.g. `INV-SL-2026-901`), and mark packed. The application-layer `assertDispatchable` check and PostgreSQL trigger guarantee no unapproved orders can ever be packed.
   - **Courier Handover & Delivery:** Mark `Handover to Courier` (recording courier partner & tracking ID) and transition to `Delivered`.
4. **Ops Dashboard:** Click `Ops Dashboard` &rarr; inspect multi-store volume heatmaps, median pharmacist verification times, SLA tracking, trigger automated refill reminders, and validate daily stock CSV imports.
