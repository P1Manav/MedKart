// src/domain/refill.ts
// Pure refill calculation and reminder trigger logic.
// The app NEVER gives medical advice: units_per_day is labelled "as written on your prescription".

export interface RefillCalculationInput {
  unitsDispensed: number;
  unitsPerDay: number;
  dispenseDate?: Date;
  remindDaysBefore?: number;
}

export interface RefillSchedule {
  daysOfSupply: number;
  runOutDate: Date;
  reminderDate: Date;
  remindDaysBefore: number;
}

export const DEFAULT_REMIND_DAYS_BEFORE = 5;

/**
 * Computes days of supply, run-out date, and reminder trigger date.
 */
export function calculateRefillSchedule(
  input: RefillCalculationInput
): RefillSchedule {
  if (input.unitsDispensed <= 0) {
    throw new Error('unitsDispensed must be greater than zero.');
  }
  if (input.unitsPerDay <= 0) {
    throw new Error('unitsPerDay must be greater than zero.');
  }

  const remindDaysBefore = input.remindDaysBefore ?? DEFAULT_REMIND_DAYS_BEFORE;
  const daysOfSupply = Math.floor(input.unitsDispensed / input.unitsPerDay);

  const startDate = input.dispenseDate ? new Date(input.dispenseDate) : new Date();

  // Normalize to UTC midnight for date calculation
  const runOutDate = new Date(startDate);
  runOutDate.setDate(runOutDate.getDate() + daysOfSupply);

  const reminderDate = new Date(runOutDate);
  reminderDate.setDate(reminderDate.getDate() - remindDaysBefore);

  return {
    daysOfSupply,
    runOutDate,
    reminderDate,
    remindDaysBefore,
  };
}

/**
 * Evaluates whether a medicine is due for a refill reminder as of a given reference date.
 * Accepts `asOfDate` parameter for automated testing and deterministic demos.
 */
export function isRefillReminderDue(
  runOutDate: Date,
  remindDaysBefore: number = DEFAULT_REMIND_DAYS_BEFORE,
  asOfDate: Date = new Date(),
  alreadySent: boolean = false
): boolean {
  if (alreadySent) {
    return false; // Idempotent: Never trigger twice for the same run_out_date
  }

  const targetDate = new Date(runOutDate);
  const diffTime = targetDate.getTime() - asOfDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Trigger reminder when within reminder window or overdue
  return diffDays <= remindDaysBefore;
}

/**
 * Calculates remaining days of supply as of a given date.
 */
export function getRemainingDaysOfSupply(
  runOutDate: Date,
  asOfDate: Date = new Date()
): number {
  const diffTime = runOutDate.getTime() - asOfDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}
