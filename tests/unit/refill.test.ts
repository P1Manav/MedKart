// tests/unit/refill.test.ts
import { describe, it, expect } from 'vitest';
import {
  calculateRefillSchedule,
  isRefillReminderDue,
  getRemainingDaysOfSupply,
} from '@/domain/refill';

describe('Refill Calculations & Idempotent Reminders', () => {
  it('correctly calculates days of supply and run out date', () => {
    // 60 tablets dispensed, 2 tablets per day = 30 days
    const dispenseDate = new Date('2026-11-01T00:00:00Z');
    const schedule = calculateRefillSchedule({
      unitsDispensed: 60,
      unitsPerDay: 2,
      dispenseDate,
      remindDaysBefore: 5,
    });

    expect(schedule.daysOfSupply).toBe(30);
    // Run-out date should be 30 days after Nov 1 = Dec 1
    expect(schedule.runOutDate.toISOString()).toContain('2026-12-01');
    // Reminder date should be 5 days before Dec 1 = Nov 26
    expect(schedule.reminderDate.toISOString()).toContain('2026-11-26');
  });

  it('detects when reminder is due based on reference date', () => {
    const runOutDate = new Date('2026-11-10T00:00:00Z');

    // As of Nov 1: 9 days left -> Not due yet (default threshold is 5 days)
    const nov1 = new Date('2026-11-01T00:00:00Z');
    expect(isRefillReminderDue(runOutDate, 5, nov1, false)).toBe(false);

    // As of Nov 6: 4 days left -> Within reminder window, so due!
    const nov6 = new Date('2026-11-06T00:00:00Z');
    expect(isRefillReminderDue(runOutDate, 5, nov6, false)).toBe(true);
  });

  it('guarantees idempotency: returns false if reminder was already sent', () => {
    const runOutDate = new Date('2026-11-10T00:00:00Z');
    const nov6 = new Date('2026-11-06T00:00:00Z');

    // Even though it is due, alreadySent === true suppresses duplicate dispatch
    expect(isRefillReminderDue(runOutDate, 5, nov6, true)).toBe(false);
  });

  it('accurately computes remaining days of supply', () => {
    const runOutDate = new Date('2026-11-20T00:00:00Z');
    const today = new Date('2026-11-15T00:00:00Z');
    expect(getRemainingDaysOfSupply(runOutDate, today)).toBe(5);

    // If past run out date, never returns negative
    const past = new Date('2026-11-25T00:00:00Z');
    expect(getRemainingDaysOfSupply(runOutDate, past)).toBe(0);
  });
});
