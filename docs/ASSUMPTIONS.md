# Assumptions

> Each assumption is documented the moment it is made. Format: **What** — Why — Where in code.

| # | What | Why | Where |
|---|---|---|---|
| A1 | Prescription validity window defaults to 6 months from the date on the prescription | Spec says configurable with a default; 6 months is common in Indian pharmacy practice | `src/domain/assert-dispatchable.ts`, config constant |
| A2 | `generic_substitutes` is an invented lookup table linking brand products to generic equivalents | Spec §5.5 calls this an ASSUMPTION; no real formulary data | `prisma/schema.prisma`, `GenericSubstitute` model |
| A3 | Pincode-to-lat/lng is a small seeded lookup table (~20 Kolkata pincodes), not a geocoding API | Spec §5.6 calls this an ASSUMPTION; avoids external dependency | `prisma/schema.prisma`, `PincodeCoord` model; `seed.ts` |
| A4 | Hindi and Bengali UI strings are translations reviewed for consistency; neutral AI draft terminology used | AI-generated translations may have minor phrasing nuances; required honest disclosure | `messages/hi.json`, `messages/bn.json`, `messages/en.json` |
| A5 | All prescription images in seed data are SYNTHETIC (invented names, not real prescriptions) | Free-tier AI inputs may be used for training; spec §6 requires this | `seed/prescriptions/`, `scripts/generate_prescriptions.py` |
| A6 | Upload size limit is 5 MB per prescription image; accepted MIME types are image/jpeg and image/png | Reasonable mobile photo size; spec doesn't specify exact limit | `src/lib/validators/upload.ts` |
| A7 | OTP rate limit: max 5 attempts per phone per 15 minutes; login rate limit: max 10 per phone per hour | Spec says rate-limited but doesn't specify exact numbers; these are industry-reasonable | `src/lib/auth/otp.ts` |
| A8 | Haversine distance is sufficient for Kolkata store routing (no road network/traffic) | Spec says "nearest store (haversine)"; city scale makes haversine acceptable | `src/domain/routing.ts` |
| A9 | Stock CSV columns: `store_id`, `product_id`, `quantity` — validated by Zod per row | Spec says "daily stock CSV import" but doesn't define format | `src/lib/validators/stock-csv.ts` |
| A10 | Refill reminder default is 5 days before run_out_date | Spec §5.7 states this default | `src/domain/refill.ts` |
| A11 | Demo/seed pharmacist registration numbers are synthetic (e.g., "WB/PHARM/2024/0001") | Spec forbids real registration numbers | `prisma/seed.ts` |
| A12 | Session cookie uses HS256 with a server-side secret (`SESSION_SECRET` env var) | jose supports multiple algorithms; HS256 is simplest for a monolith | `src/lib/auth/session.ts` |
| A13 | Customer addresses are pre-seeded (1–2 per customer); no address autocomplete or map picker | Spec says "saved address" but doesn't require an address creation flow in P0 | `prisma/seed.ts`, `CustomerAddress` model |
| A14 | Family profile creation is seeded; a simple "add profile" form exists but is not a P0 focus | Spec mentions family profiles but core flow is reordering | `prisma/seed.ts` |
| A15 | Payments use real Razorpay sandbox API when keys are configured, falling back to NPCI test spec modal | Spec requires real sandbox gateway with HMAC-SHA256 signature verification and no real money | `src/lib/payments/gateway.ts`, `src/app/api/payments/` |
| A16 | The app name "MedKart" is invented for this project; not a real brand | Needs a name for UI; spec doesn't specify one | Throughout UI |
| A17 | Schedule H1 register date (h1Date) records the prescription issue date confirmed by pharmacist | Drugs & Cosmetics Rules require date of prescription on register; defaults to verified prescriptionDate | `src/app/api/pharmacist/orders/[id]/verify/route.ts` |
| A18 | Non-generative OCR pipeline: Zero generative LLMs used in perception or extraction | Prescriptions require perception/extraction, not creative generation. Generative LLMs hallucinate non-existent drugs under uncertainty. A small vision OCR model + deterministic regex and fuzzy matching is honest and clinically safe. | `src/lib/ai/hf-ocr-reader.ts`, `src/lib/ai/deterministic-parser.ts` |
| A19 | Three-Tier OCR Architecture (Tier 1 HF Router -> Tier 2 Tesseract WASM -> Tier 3 Pharmacist Manual Queue) | Tier 1 uses hosted small model (`microsoft/trocr-base-handwritten`) via `router.huggingface.co`. Tier 2 runs locally in-process via `tesseract.js` (WASM). Tier 3 safely routes to manual entry with 0 fabricated medicines. | `src/lib/ai/hf-ocr-reader.ts`, `src/lib/ai/index.ts` |
| A20 | Documented Line Confidence Formula: $C_{line} = \text{round}(0.40 \times C_{ocr} + 0.60 \times S_{fuzzy}, 2)$ | Blends real OCR word confidence ($C_{ocr}$) with catalogue match score ($S_{fuzzy} = \max(0, 1 - \text{compositeScore})$). Heavily penalizes strength/form mismatches. | `src/lib/ai/deterministic-parser.ts` |
| A21 | Real OCR Image Legibility Statistics: $W_{mean} \ge 0.65$ (clear), $0.40 \le W_{mean} < 0.65$ (partial), $< 0.40$ (unreadable) | Prevents guessing legibility. Low word confidence or unreadable scans automatically route to pharmacist queue. Observed test latency: 714–1099ms in Node.js. | `src/lib/ai/deterministic-parser.ts`, `scripts/test_real_ocr.ts` |
| A22 | Honest OTP Delivery: On-screen demo SMS banner by default, optional real SMS via free-tier provider | Ensures reviewers are never locked out of testing while supporting live SMS when `SMS_PROVIDER_API_KEY` is set. | `src/lib/auth/otp.ts` |
