// src/domain/schedule-gating.ts
// All schedule-based gating reads from the database schedule_rules table.

import type { ScheduleType } from '@prisma/client';

export interface ScheduleRule {
  schedule: ScheduleType;
  canSellOnline: boolean;
  requiresPrescription: boolean;
  requiresPharmacistApproval: boolean;
  requiresRegisterEntry: boolean;
}

/**
 * Check if a schedule type can be sold online.
 * Returns false for X and NARCOTIC by default.
 */
export function canSellOnline(rule: ScheduleRule): boolean {
  return rule.canSellOnline;
}

/**
 * Check if a schedule type requires a prescription.
 */
export function requiresPrescription(rule: ScheduleRule): boolean {
  return rule.requiresPrescription;
}

/**
 * Check if a schedule type requires pharmacist approval.
 */
export function requiresPharmacistApproval(rule: ScheduleRule): boolean {
  return rule.requiresPharmacistApproval;
}

/**
 * Check if a schedule type requires an H1 register entry.
 */
export function requiresRegisterEntry(rule: ScheduleRule): boolean {
  return rule.requiresRegisterEntry;
}

/**
 * Returns the rejection message for items that cannot be sold online.
 * Neutral language per spec — no alarming medical terms.
 */
export function getOnlineRestrictionMessage(): string {
  return 'This item cannot be ordered online. Please visit your nearest store.';
}

