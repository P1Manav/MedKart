// tests/integration/full-order-flow.test.ts
import { describe, it, expect } from 'vitest';
import { validateTransition } from '@/domain/order-state';
import { assertDispatchable, type DispatchableOrder } from '@/domain/assert-dispatchable';

describe('End-to-End Order Verification & Dispatch Lifecycle', () => {
  it('enforces that an unapproved Schedule H order cannot be packed', () => {
    // 1. Order submitted by customer, awaiting pharmacist check
    const order: DispatchableOrder = {
      id: 'RX-TEST-01',
      status: 'SUBMITTED',
      prescriptionEncrypted: Buffer.from('test_prescription_bytes'),
      prescriptionValidUntil: new Date('2026-12-31'),
      lines: [
        {
          id: 'line_1',
          lineStatus: 'PENDING', // Still pending pharmacist review!
          productSchedule: 'H',
          pharmacistId: null,
          pharmacistRegNo: null,
          requiresRegisterEntry: false,
          h1PrescriberName: null,
          h1PrescriberRegNo: null,
          h1PatientName: null,
          h1Date: null,
          h1Quantity: null,
        },
      ],
    };

    // State machine prohibits SUBMITTED -> PACKED
    expect(() => validateTransition('SUBMITTED', 'PACKED')).toThrow();

    // assertDispatchable fails
    const dispatchCheck = assertDispatchable(order);
    expect(dispatchCheck.canDispatch).toBe(false);
    expect(dispatchCheck.reasons[0]).toContain('not approved');
  });

  it('permits store packing only after pharmacist approves and records registration number', () => {
    // 1. Pharmacist approves line
    const approvedOrder: DispatchableOrder = {
      id: 'RX-TEST-01',
      status: 'APPROVED',
      prescriptionEncrypted: Buffer.from('test_prescription_bytes'),
      prescriptionValidUntil: new Date('2026-12-31'),
      lines: [
        {
          id: 'line_1',
          lineStatus: 'APPROVED',
          productSchedule: 'H',
          pharmacistId: 'user_pharm_01',
          pharmacistRegNo: 'WB-PHARM-2024-4102',
          requiresRegisterEntry: false,
          h1PrescriberName: null,
          h1PrescriberRegNo: null,
          h1PatientName: null,
          h1Date: null,
          h1Quantity: null,
        },
      ],
    };

    // State machine check allows APPROVED -> PACKED
    expect(validateTransition('APPROVED', 'PACKED')).toBe('PACKED');

    // assertDispatchable passes completely
    const dispatchCheck = assertDispatchable(approvedOrder);
    expect(dispatchCheck.canDispatch).toBe(true);
    expect(dispatchCheck.reasons).toHaveLength(0);

    // Store handover check: PACKED -> HANDED_OVER
    expect(validateTransition('PACKED', 'HANDED_OVER')).toBe('HANDED_OVER');

    // Delivery confirmation: HANDED_OVER -> DELIVERED
    expect(validateTransition('HANDED_OVER', 'DELIVERED')).toBe('DELIVERED');
  });
});
