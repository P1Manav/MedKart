// src/lib/metrics.ts

/**
 * Calculates the median SLA duration in minutes given an array of durations in milliseconds.
 * Returns null if the array is empty.
 */
export function calculateMedianSlaMinutes(durationsMs: number[]): number | null {
  if (!durationsMs || durationsMs.length === 0) {
    return null;
  }

  const sorted = [...durationsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  let medianMs: number;
  if (sorted.length % 2 === 0) {
    medianMs = (sorted[mid - 1] + sorted[mid]) / 2;
  } else {
    medianMs = sorted[mid];
  }

  // Convert milliseconds to minutes
  return Number((medianMs / (60 * 1000)).toFixed(1));
}
