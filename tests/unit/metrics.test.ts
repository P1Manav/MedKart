// tests/unit/metrics.test.ts
import { describe, it, expect } from 'vitest';
import { calculateMedianSlaMinutes } from '@/lib/metrics';

describe('Operational Metrics Calculations (P0-7)', () => {
  it('calculates median verification time correctly for odd number of durations', () => {
    // 5 minutes, 10 minutes, 15 minutes
    const durations = [15 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000];
    const median = calculateMedianSlaMinutes(durations);
    expect(median).toBe(10);
  });

  it('calculates median verification time correctly for even number of durations', () => {
    // 6, 8, 12, 16 minutes -> median is (8 + 12)/2 = 10 minutes
    const durations = [16 * 60 * 1000, 6 * 60 * 1000, 8 * 60 * 1000, 12 * 60 * 1000];
    const median = calculateMedianSlaMinutes(durations);
    expect(median).toBe(10);
  });

  it('returns null when duration list is empty', () => {
    const median = calculateMedianSlaMinutes([]);
    expect(median).toBeNull();
  });
});
