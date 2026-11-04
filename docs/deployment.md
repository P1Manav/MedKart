# Deployment Guide — MedKart Pharmacy Monolith

This document describes how to run MedKart locally step by step, how it is deployed to production on Vercel and Neon (Free Tier), and the demo login details for reviewer evaluation.

> **SECURITY NOTICE:** Never commit secrets or actual private keys to the repository. All secrets must be configured via environment variables.

---

## 1. How to Run Locally, Step by Step

### Prerequisites
- Node.js 20+ or 22+
- npm 10+
- PostgreSQL 16 (local installation, Neon free tier, or Docker)

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
- `DATABASE_URL`: Connection string to your PostgreSQL instance (e.g., `postgresql://postgres:postgres@localhost:5432/medkart`)
- `SESSION_SECRET`: A 32+ character random secret for signing session cookies
- `PRESCRIPTION_ENC_KEY`: A 64-character hex string (32 bytes) for AES-256-GCM prescription encryption
- `CRON_SECRET`: Secret bearer token securing automated refill reminders
- `OTP_MOCK`: Set to `"true"` for local review (displays OTP on screen in the Demo SMS banner)
- `DEMO_MODE`: Set to `"true"` for local review (activates the top 1-click role switcher ribbon)
- `GEMINI_API_KEY`: (Optional) Free Google AI Studio API key. If omitted, the app uses `MockReader` in non-production.

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
# Run unit and integration tests (124 tests)
npm test

# Run real PostgreSQL trigger integration tests
npm run test:db

# Run strict TypeScript typecheck
npm run typecheck

# Run ESLint check
npm run lint
```

### Step 5: Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 2. Production Deployment (Vercel & Neon Free Tier)

### 2.1 Database Setup on Neon (Free Tier)
1. Sign up for a free PostgreSQL database at [Neon.tech](https://neon.tech).
2. Create a project (e.g., `medkart-prod`).
3. Copy the connection string (`postgresql://<user>:<password>@<host>/<database>?sslmode=require`).
4. Run migrations from your local terminal against Neon:
   ```bash
   npx prisma migrate deploy
   npm run seed
   ```

### 2.2 Hosting Setup on Vercel (Free Hobby Tier)
1. Import the GitHub repository `P1Manav/isocode_assignment` into Vercel.
2. Select Framework Preset: **Next.js**.
3. Build Command: `npm run build`
4. Configure Environment Variables in Vercel Project Settings (names only; never commit values):

| Variable Name | Required | Description |
|---|---|---|
| `DATABASE_URL` | **Yes** | Neon PostgreSQL connection string |
| `SESSION_SECRET` | **Yes** | 32+ character secret for HS256 JWT cookie signing |
| `PRESCRIPTION_ENC_KEY` | **Yes** | 64-character hex string for AES-256-GCM encryption |
| `CRON_SECRET` | **Yes** | Secret bearer token for daily refill cron |
| `GEMINI_API_KEY` | **Yes** | Google AI Studio free tier key for Gemini 2.5 Flash |
| `GEMINI_MODEL` | No | AI model name (default: `gemini-2.5-flash`) |
| `OTP_MOCK` | No | `"true"` for demo mode; `"false"` for real SMS provider |
| `DEMO_MODE` | No | `"true"` to enable 1-click reviewer ribbon |
| `NEXT_PUBLIC_APP_URL` | No | Canonical URL of deployed Vercel application |

### 2.3 Vercel Daily Refill Reminder Cron
Automated refill reminder jobs are configured in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/reminders",
      "schedule": "0 2 * * *"
    }
  ]
}
```
Vercel Cron automatically attaches `Authorization: Bearer <CRON_SECRET>` when invoking the endpoint.

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

## 4. 10-Minute Reviewer Verification Walkthrough

1. **Step 1: Customer Reorder (1 minute)**
   - Click `Customer (Debasish)` in the top ribbon.
   - Click the large `Reorder My Medicines` button on the home screen.
   - Pick a synthetic sample prescription (e.g. `Sample 1: Metformin 500 mg`).
   - Click `Submit Order for Pharmacist Verification`.
   - Verify that you are redirected to the tracking page with an active progress timeline.

2. **Step 2: Pharmacist Verification (3 minutes)**
   - Click `Pharmacist (Sunita)` in the top ribbon and open `Verification Queue`.
   - Click `Verify Prescription` on the submitted order.
   - Inspect the prescription with Zoom, Pan, and Rotate controls.
   - Verify the prescription date (e.g. confirm issue date within 6 months).
   - Click `Approve Order & Route to Store`.

3. **Step 3: Store Packing & Enforcement (2 minutes)**
   - Click `Store Staff (Salt Lake)` in the top ribbon.
   - Notice that unapproved Schedule H orders have their `Pack Order` button disabled with a clear statutory message.
   - On the newly approved order, click `Pack Order`, enter invoice number (e.g. `INV-SL-2026-901`), and mark packed.

4. **Step 4: Operations & Compliance (2 minutes)**
   - Click `Ops Dashboard` in the top ribbon.
   - Observe live aggregated metrics: active store inventory, order volume breakdown, and median pharmacist SLA minutes.
   - Trigger the automated refill reminder engine.
