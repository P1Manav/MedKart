# MedKart Pharmacy — Security Architecture & Dependency Audit

## 1. Security Overview

MedKart Pharmacy implements defence-in-depth principles across all architectural tiers, strictly conforming to the Indian Drugs and Cosmetics Act (1940 & Rules 1945) and the Digital Personal Data Protection (DPDP) Act 2023.

### 1.1 Core Security Invariants
- **Fail-Closed Secrets (`src/lib/env.ts`):** In production, missing database, session, encryption, cron, or OTP secrets immediately terminate startup with descriptive errors without leaking values.
- **Client Sanitization (`src/lib/api-error.ts`):** 100% of route handlers route unexpected runtime exceptions to `handleApiError`, returning a redacted generic error message (`Something went wrong`) and an opaque correlation ID (`errorId`). Stack traces, internal file paths, and SQL queries are never leaked.
- **Log Redaction (`src/lib/logger.ts`):** All logging passes through an isomorphic redacting filter that strips full Indian phone numbers, 6-digit OTP codes, JWT bearer tokens, Postgres credentials, and hex keys before printing to stdout/stderr.
- **Object-Level RBAC (`src/lib/auth/rbac.ts`):** Enforces customer tenancy isolation (customers can only access their own or family members' orders), store-staff geographic partitioning (staff can only access orders assigned to their store), and role-gated prescription access.
- **Two-Tier Prescription Gating:**
  1. Application-level dispatch assertions (`assertDispatchable`).
  2. Database-level trigger on PostgreSQL (`orders_check_packed_guard_trigger`) preventing direct SQL status updates to `PACKED` unless verification and regulatory requirements are met.
- **Direct UPI Money Path Hardening:**
  - 12-digit exact numeric regex validation (`^\d{12}$`).
  - Unique DB constraint on `orders.utr` preventing reuse of any UTR across orders or on rejected orders.
  - Mandatory customer statutory consent stored server-side.
  - Server-derived payable amounts (client-specified amounts are ignored).
  - Maximum transaction cap fallback (`UPI_MAX_AMOUNT_INR`).
  - Constant-time signature verification for payment webhooks with replay prevention.

---

## 2. Dependency Vulnerability Analysis (npm audit)

### 2.1 Resolution of `deepmerge-ts` Vulnerability
- **Advisory:** GHSA-ggr8-5vv4-36mx (Stack exhaustion in `deepmerge-ts <8.0.0` when merging recursive object graphs).
- **Vulnerability Path:** `prisma` CLI -> `@prisma/config` -> `deepmerge-ts`.
- **Mitigation Applied:** Pinned `deepmerge-ts` to `^8.0.0` via npm `overrides` in `package.json`:
  ```json
  "overrides": {
    "deepmerge-ts": "^8.0.0"
  }
  ```
- **Audit Verification:** Running `npm audit --omit=dev` confirms:
  ```text
  found 0 vulnerabilities
  ```
- **Runtime Scope:**
  `prisma` CLI is executed strictly during build (`prisma generate`) and deployment migrations (`prisma migrate deploy`). It does not execute in serverless runtime paths serving user HTTP traffic; user database operations use `@prisma/client`.

---

## 3. Secret Detection & Static Analysis (Gitleaks)

The repository integrates automated Gitleaks secret scanning in CI (`.github/workflows/ci.yml`) to ensure no real phone numbers, credentials, private keys, or API tokens are committed to source control.
All sensitive configurations rely strictly on environment variable names configured in `.env.example`.
