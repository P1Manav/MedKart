# Deployment Guide — MedKart Pharmacy Monolith

This document describes how to run MedKart locally step by step, how it is deployed to production on Vercel and Neon (Free Tier), the real free-tier services and their verified limits, and demo login details for reviewer evaluation.

- **GitHub Repository:** [https://github.com/P1Manav/isocode_assignment](https://github.com/P1Manav/isocode_assignment)
- **Live Deployed Application:** [https://medkart-pharmacyt.vercel.app](https://medkart-pharmacyt.vercel.app)

> **SECURITY NOTICE:** Never commit secrets or actual private keys to the repository. All secrets must be configured via environment variables.

---

## 1. How to Run Locally, Step by Step

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- PostgreSQL 16 (local installation, Neon free tier, or Docker Compose)

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
- `DATABASE_URL`: Connection string to your PostgreSQL instance (e.g. Neon or `postgresql://postgres:postgres@localhost:5432/medkart`)
- `SESSION_SECRET`: A 32+ character random secret for signing session cookies
- `PRESCRIPTION_ENC_KEY`: A 64-character hex string (32 bytes) for AES-256-GCM prescription encryption
- `CRON_SECRET`: Secret bearer token securing automated refill reminders
- `OTP_MOCK`: Set to `"true"` for local review (displays OTP on screen in the Demo SMS banner)
- `DEMO_MODE`: Set to `"true"` for local review (activates the top 1-click role switcher ribbon)
- `HF_API_TOKEN`: (Optional) Free Hugging Face user access token. If omitted, Tier 2 (in-process Tesseract.js WASM) runs automatically.
- `HF_OCR_MODEL`: AI OCR model (default: `microsoft/trocr-base-handwritten`).
- `PAYMENT_GATEWAY_KEY_ID`: (Optional) Razorpay or Cashfree Sandbox Key ID.
- `PAYMENT_GATEWAY_KEY_SECRET`: (Optional) Razorpay or Cashfree Sandbox Key Secret.
- `PAYMENT_GATEWAY_WEBHOOK_SECRET`: (Optional) Secret for HMAC-SHA256 webhook signature verification.
- `SMS_PROVIDER_API_KEY`: (Optional) Free-tier SMS provider API key (e.g. MSG91/Twilio).

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
# Run unit and integration tests (174 tests across 29 suites)
npm test

# Run real PostgreSQL trigger integration tests
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
| **Vercel Hobby** | Web hosting & Serverless API routes | **Limits**: 250 MB uncompressed function bundle, 15s serverless execution timeout, 4.5 MB request body limit. **Design**: Tier 1 (hosted Hugging Face OCR) offloads heavy CPU/RAM; Tier 2 (Tesseract.js WASM) initializes in ~700ms in Node; both fall back safely to Tier 3 manual queue without crashing or timing out. |
| **Hugging Face Inference API** | Tier 1 Non-generative OCR model (`microsoft/trocr-base-handwritten`) | **Limits**: Free tier access token, rate-limited to a few hundred requests/hour. Endpoint migrated to `router.huggingface.co`. Cold-starts handled via 25s timeout and automatic fallback to Tier 2 Tesseract. |
| **Tesseract.js WASM Engine** | Tier 2 In-process local OCR | **Limits**: Pure WebAssembly (WASM), zero network calls, zero rate limits, runs completely in-process with real per-word confidence scores. |
| **Neon PostgreSQL** | Serverless relational database | **Limits**: 0.5 GiB storage, auto-suspend after 5 min idle, 1 free branch, pooling via PgBouncer. |
| **Razorpay / Cashfree Sandbox** | UPI payments & checkout simulation | **Limits**: Test mode credentials, zero real money. Real webhook HMAC-SHA256 signature verification via `crypto.timingSafeEqual`. |
| **Demo SMS / Optional Provider** | OTP phone authentication | **Limits**: Honest on-screen demo SMS banner by default (ensuring reviewers are never locked out), with optional real SMS delivery via free-tier provider when `SMS_PROVIDER_API_KEY` is set. |

### Environment Variables on Vercel

| Variable Name | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Neon PostgreSQL connection string (pooled) |
| `SESSION_SECRET` | **Yes** | 32+ character secret for HS256 JWT cookie signing |
| `PRESCRIPTION_ENC_KEY` | **Yes** | 64-character hex string for AES-256-GCM encryption |
| `CRON_SECRET` | **Yes** | Secret bearer token for daily refill cron |
| `HF_API_TOKEN` | No | Hugging Face free-tier token for hosted TrOCR model |
| `HF_OCR_MODEL` | No | OCR model name (default: `microsoft/trocr-base-handwritten`) |
| `PAYMENT_GATEWAY_KEY_ID` | No | Razorpay sandbox test key ID |
| `PAYMENT_GATEWAY_KEY_SECRET` | No | Razorpay sandbox test key secret |
| `PAYMENT_GATEWAY_WEBHOOK_SECRET` | No | Webhook HMAC verification secret |
| `SMS_PROVIDER_API_KEY` | No | Optional free-tier SMS provider API key |
| `OTP_MOCK` | No | `"true"` for demo mode (on-screen banner) |
| `DEMO_MODE` | No | `"true"` to enable 1-click reviewer ribbon |
| `NEXT_PUBLIC_APP_URL` | No | Canonical URL of deployed Vercel application |

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
