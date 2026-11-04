# Deployment Guide — MedKart Pharmacy Monolith

This guide walks through deploying the MedKart Pharmacy application to **Vercel** with a serverless **PostgreSQL database on Neon** (Free Tier).

> **SECURITY NOTICE:** Never commit secrets or actual private keys to the repository. All secrets must be configured via environment variables.

---

## 1. Prerequisites

1. A [Neon](https://neon.tech) free tier account for PostgreSQL.
2. A [Vercel](https://vercel.com) free tier account for Next.js hosting.
3. A [Google AI Studio](https://aistudio.google.com/) account for a free Gemini API key (optional; system falls back to `MockReader` in test environments).

---

## 2. Database Setup on Neon

1. Create a new PostgreSQL project on Neon (e.g. `medkart-prod`).
2. Copy the pooled or direct connection string (format: `postgresql://user:password@ep-xyz.neon.tech/neondb?sslmode=require`).
3. Apply migrations:
   ```bash
   npx prisma migrate deploy
   ```
4. Seed initial catalogue, schedule rules, stores, and sample orders:
   ```bash
   npm run seed
   ```

---

## 3. Environment Variables

Configure the following environment variables in your Vercel Project Settings (`Settings` &rarr; `Environment Variables`):

| Variable Name | Required | Description | Example / Note |
|---|---|---|---|
| `DATABASE_URL` | **Yes** | PostgreSQL connection URL | `postgresql://<user>:<password>@<host>/<db>?sslmode=require` |
| `SESSION_SECRET` | **Yes** | 32+ character random secret for jose HS256 JWT cookie signing | Generate with `openssl rand -hex 32` |
| `PRESCRIPTION_ENC_KEY` | **Yes** | 64-character hex string (32 bytes) for AES-256-GCM prescription encryption | Generate with `openssl rand -hex 32` |
| `GEMINI_API_KEY` | No | Google AI Studio free tier key | If omitted, app routes to MockReader for automated tests |
| `GEMINI_MODEL` | No | AI transcription model name | Default: `gemini-2.5-flash` |
| `CRON_SECRET` | **Yes** | Secret token securing automated refill reminders | Random secret string |
| `OTP_MOCK` | No | Set to `"true"` for demo mode (displays OTP on screen in Demo SMS banner) | Set to `"false"` in production |
| `NEXT_PUBLIC_APP_URL` | No | Production URL of the deployed application | e.g. `https://medkart-kolkata.vercel.app` |

---

## 4. Vercel Cron Configuration

Vercel Cron runs the daily refill reminder job. In `vercel.json`:

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

The endpoint is authenticated via `Authorization: Bearer <CRON_SECRET>`.

---

## 5. Reviewer Verification (Under 10 Minutes)

1. Open deployed URL.
2. Click **"Customer (Debasish)"** in the top ribbon to log in.
3. Tap **"Reorder My Medicines"**, select or upload a prescription image, and submit.
4. Switch to **"Pharmacist (Sunita)"** from the top ribbon.
5. In the **Verification Queue**, click **"Verify Prescription"** on the newly submitted order.
6. Use zoom/pan controls to inspect doctor signature and date, approve lines, and click **"Approve Order & Route"**.
7. Switch to **"Store Staff"** &rarr; see order in **Store Packing Desk** &rarr; enter invoice number &rarr; mark packed.
8. Verify that trying to pack an unapproved Schedule H order is strictly blocked with a visible error.
