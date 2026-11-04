// tests/unit/schedule-gating.test.ts
import { describe, it, expect } from 'vitest';
import {
  canSellOnline,
  requiresPrescription,
  requiresPharmacistApproval,
  requiresRegisterEntry,
  getOnlineRestrictionMessage,
  type ScheduleRule,
} from '@/domain/schedule-gating';

describe('Schedule Gating Rules', () => {
  const rules: Record<string, ScheduleRule> = {
    OTC: {
      schedule: 'OTC',
      canSellOnline: true,
      requiresPrescription: false,
      requiresPharmacistApproval: false,
      requiresRegisterEntry: false,
    },
    H: {
      schedule: 'H',
      canSellOnline: true,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: false,
    },
    H1: {
      schedule: 'H1',
      canSellOnline: true,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: true,
    },
    X: {
      schedule: 'X',
      canSellOnline: false,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: false,
    },
    NARCOTIC: {
      schedule: 'NARCOTIC',
      canSellOnline: false,
      requiresPrescription: true,
      requiresPharmacistApproval: true,
      requiresRegisterEntry: false,
    },
  };

  it('permits online sales for OTC, H, and H1', () => {
    expect(canSellOnline(rules.OTC)).toBe(true);
    expect(canSellOnline(rules.H)).toBe(true);
    expect(canSellOnline(rules.H1)).toBe(true);
  });

  it('strictly forbids online sales for Schedule X and Narcotic items', () => {
    expect(canSellOnline(rules.X)).toBe(false);
    expect(canSellOnline(rules.NARCOTIC)).toBe(false);
  });

  it('requires prescription for H, H1, X, and NARCOTIC', () => {
    expect(requiresPrescription(rules.OTC)).toBe(false);
    expect(requiresPrescription(rules.H)).toBe(true);
    expect(requiresPrescription(rules.H1)).toBe(true);
    expect(requiresPrescription(rules.X)).toBe(true);
    expect(requiresPrescription(rules.NARCOTIC)).toBe(true);
  });

  it('requires pharmacist approval for H, H1, X, and NARCOTIC', () => {
    expect(requiresPharmacistApproval(rules.OTC)).toBe(false);
    expect(requiresPharmacistApproval(rules.H)).toBe(true);
    expect(requiresPharmacistApproval(rules.H1)).toBe(true);
  });

  it('requires register entry ONLY for Schedule H1', () => {
    expect(requiresRegisterEntry(rules.OTC)).toBe(false);
    expect(requiresRegisterEntry(rules.H)).toBe(false);
    expect(requiresRegisterEntry(rules.H1)).toBe(true);
  });

  it('returns a calm, neutral rejection message without medical jargon', () => {
    const msg = getOnlineRestrictionMessage();
    expect(msg).toBe('This item cannot be ordered online. Please visit your nearest store.');
    expect(msg).not.toMatch(/dangerous|poison|illegal|narcotic/i);
  });
});
