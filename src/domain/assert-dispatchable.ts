// src/domain/assert-dispatchable.ts
// The ONLY function used by any transition into PACKED, HANDED_OVER, or DELIVERED.
// Defence in depth — this is the application-layer check. A DB trigger is the second layer.

import type { LineStatus } from './order-state';

export interface DispatchableOrderLine {
  id: string;
  lineStatus: LineStatus;
  productSchedule: string; // ScheduleType
  canSellOnline?: boolean;
  pharmacistId: string | null;
  pharmacistRegNo: string | null;
  requiresRegisterEntry: boolean;
  h1PrescriberName: string | null;
  h1PrescriberRegNo: string | null;
  h1PatientName: string | null;
  h1Date: Date | null;
  h1Quantity: number | null;
}

export interface DispatchableOrder {
  id: string;
  status: string;
  prescriptionEncrypted: Buffer | Uint8Array | null;
  prescriptionValidUntil: Date | null;
  lines: DispatchableOrderLine[];
}

export interface DispatchCheckResult {
  canDispatch: boolean;
  reasons: string[];
}

/** Prescription validity window: default 6 months (ASSUMPTION A1). */
const DEFAULT_VALIDITY_MONTHS = 6;

/**
 * assertDispatchable — the ONLY path for PACKED/HANDED_OVER/DELIVERED transitions.
 *
 * Fails unless:
 * 1. Every line that needs approval is APPROVED or EDITED_APPROVED by a pharmacist with reg no.
 * 2. Prescription is attached and within validity window.
 * 3. H1 lines have complete register entries.
 *
 * Lines with BLOCKED_NOT_SOLD_ONLINE are excluded from the check (they are not dispatched).
 * Lines with REJECTED are excluded (they are not dispatched).
 */
export function assertDispatchable(
  order: DispatchableOrder,
  asOfDate: Date = new Date()
): DispatchCheckResult {
  const reasons: string[] = [];

  // 1. Prescription must be attached
  if (!order.prescriptionEncrypted || order.prescriptionEncrypted.length === 0) {
    reasons.push('Prescription image is missing.');
  }

  // 2. Prescription must be within validity window
  if (order.prescriptionValidUntil) {
    if (asOfDate > order.prescriptionValidUntil) {
      reasons.push('Prescription has expired. Please request a new prescription.');
    }
  } else {
    reasons.push('Prescription validity date is not set.');
  }

  // 3. Reject any item that cannot be sold online (Schedule X / Narcotics)
  for (const line of order.lines) {
    if (line.lineStatus !== 'REJECTED' && line.canSellOnline === false) {
      reasons.push(
        `Line ${line.id} (${line.productSchedule}) cannot be ordered online. This item must be rejected.`
      );
    }
  }

  // 4. Check each active line
  const activeLines = order.lines.filter(
    (l) => l.lineStatus !== 'BLOCKED_NOT_SOLD_ONLINE' && l.lineStatus !== 'REJECTED'
  );

  if (activeLines.length === 0) {
    reasons.push('No active lines to dispatch.');
  }

  for (const line of activeLines) {
    // Line must be approved
    if (line.lineStatus !== 'APPROVED' && line.lineStatus !== 'EDITED_APPROVED') {
      reasons.push(
        `Line ${line.id} is not approved (status: ${line.lineStatus}).`
      );
      continue;
    }

    // Approved line must have pharmacist with reg no
    if (!line.pharmacistId || !line.pharmacistRegNo) {
      reasons.push(
        `Line ${line.id} is approved but missing pharmacist details.`
      );
    }

    // H1 lines need complete register entry
    if (line.requiresRegisterEntry) {
      const missing: string[] = [];
      if (!line.h1PrescriberName) missing.push('prescriber name');
      if (!line.h1PrescriberRegNo) missing.push('prescriber registration number');
      if (!line.h1PatientName) missing.push('patient name');
      if (!line.h1Date) missing.push('date');
      if (line.h1Quantity == null) missing.push('quantity');

      if (missing.length > 0) {
        reasons.push(
          `Line ${line.id} (H1) is missing register entry: ${missing.join(', ')}.`
        );
      }
    }
  }

  return {
    canDispatch: reasons.length === 0,
    reasons,
  };
}

/**
 * Safely adds months to a Date, clamping to the last valid day of the target month.
 * e.g., 31 Aug + 6 months -> 28 Feb (or 29 Feb in leap year), NOT 3 March.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  const seconds = date.getUTCSeconds();
  const ms = date.getUTCMilliseconds();

  const totalMonths = month + months;
  const targetYear = year + Math.floor(totalMonths / 12);
  const targetMonth = ((totalMonths % 12) + 12) % 12;

  // Last day of targetMonth in targetYear:
  const maxDays = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, maxDays);

  return new Date(Date.UTC(targetYear, targetMonth, clampedDay, hours, minutes, seconds, ms));
}

/**
 * Parses a "YYYY-MM-DD" date string in IST (Indian Standard Time, UTC+5:30)
 * at midday (12:00:00 IST = 06:30:00 UTC) so that when viewed in either IST or UTC,
 * the calendar date does not slip to adjacent days.
 */
export function parseDateInIST(dateString: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString.trim());
  if (match) {
    const [, y, m, d] = match;
    return new Date(Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), 6, 30, 0));
  }
  const d = new Date(dateString);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date string: ${dateString}`);
  }
  return d;
}

/**
 * Compute prescription valid-until date from a prescription date.
 * Default: 6 months from prescription date with calendar-safe month clamping (ASSUMPTION A1, configurable).
 */
export function computePrescriptionValidUntil(
  prescriptionDate: Date,
  validityMonths: number = DEFAULT_VALIDITY_MONTHS
): Date {
  return addMonthsClamped(prescriptionDate, validityMonths);
}

