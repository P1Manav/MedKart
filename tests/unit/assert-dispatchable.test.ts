// tests/unit/assert-dispatchable.test.ts
import { describe, it, expect } from 'vitest';
import {
  assertDispatchable,
  computePrescriptionValidUntil,
  type DispatchableOrder,
} from '@/domain/assert-dispatchable';

describe('assertDispatchable (Defence in Depth)', () => {
  const futureDate = new Date();
  futureDate.setMonth(futureDate.getMonth() + 3);

  const pastDate = new Date();
  pastDate.setMonth(pastDate.getMonth() - 1);

  const validOrder: DispatchableOrder = {
    id: 'RX-50211',
    status: 'APPROVED',
    prescriptionEncrypted: Buffer.from('mock_encrypted_prescription_bytes'),
    prescriptionValidUntil: futureDate,
    lines: [
      {
        id: 'line_1',
        lineStatus: 'APPROVED',
        productSchedule: 'H',
        pharmacistId: 'pharm_1',
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

  it('allows dispatch when all conditions are satisfied', () => {
    const result = assertDispatchable(validOrder);
    expect(result.canDispatch).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('blocks dispatch when prescription image is missing', () => {
    const order: DispatchableOrder = {
      ...validOrder,
      prescriptionEncrypted: null,
    };
    const result = assertDispatchable(order);
    expect(result.canDispatch).toBe(false);
    expect(result.reasons).toContain('Prescription image is missing.');
  });

  it('blocks dispatch when prescription has expired', () => {
    const order: DispatchableOrder = {
      ...validOrder,
      prescriptionValidUntil: pastDate,
    };
    const result = assertDispatchable(order, new Date());
    expect(result.canDispatch).toBe(false);
    expect(result.reasons[0]).toContain('Prescription has expired');
  });

  it('blocks dispatch when prescription validity date is missing', () => {
    const order: DispatchableOrder = {
      ...validOrder,
      prescriptionValidUntil: null,
    };
    const result = assertDispatchable(order);
    expect(result.canDispatch).toBe(false);
    expect(result.reasons).toContain('Prescription validity date is not set.');
  });

  it('blocks dispatch when any active line is not approved', () => {
    const order: DispatchableOrder = {
      ...validOrder,
      lines: [
        {
          ...validOrder.lines[0],
          lineStatus: 'PENDING',
        },
      ],
    };
    const result = assertDispatchable(order);
    expect(result.canDispatch).toBe(false);
    expect(result.reasons[0]).toContain('is not approved');
  });

  it('blocks dispatch when pharmacist details are missing from an approved line', () => {
    const order: DispatchableOrder = {
      ...validOrder,
      lines: [
        {
          ...validOrder.lines[0],
          pharmacistId: null,
          pharmacistRegNo: null,
        },
      ],
    };
    const result = assertDispatchable(order);
    expect(result.canDispatch).toBe(false);
    expect(result.reasons[0]).toContain('missing pharmacist details');
  });

  it('blocks dispatch for Schedule H1 items without complete register entry', () => {
    const h1Order: DispatchableOrder = {
      ...validOrder,
      lines: [
        {
          id: 'line_h1',
          lineStatus: 'APPROVED',
          productSchedule: 'H1',
          pharmacistId: 'pharm_1',
          pharmacistRegNo: 'WB-PHARM-2024-4102',
          requiresRegisterEntry: true,
          h1PrescriberName: null, // Missing prescriber name!
          h1PrescriberRegNo: 'WBMC-1234',
          h1PatientName: 'Test Patient',
          h1Date: new Date(),
          h1Quantity: 10,
        },
      ],
    };

    const result = assertDispatchable(h1Order);
    expect(result.canDispatch).toBe(false);
    expect(result.reasons[0]).toContain('(H1) is missing register entry: prescriber name');
  });

  it('allows dispatch for Schedule H1 items with complete register entry', () => {
    const h1Order: DispatchableOrder = {
      ...validOrder,
      lines: [
        {
          id: 'line_h1',
          lineStatus: 'APPROVED',
          productSchedule: 'H1',
          pharmacistId: 'pharm_1',
          pharmacistRegNo: 'WB-PHARM-2024-4102',
          requiresRegisterEntry: true,
          h1PrescriberName: 'Dr. S. Mukherjee',
          h1PrescriberRegNo: 'WBMC-1234',
          h1PatientName: 'Test Patient',
          h1Date: new Date(),
          h1Quantity: 10,
        },
      ],
    };

    const result = assertDispatchable(h1Order);
    expect(result.canDispatch).toBe(true);
    expect(result.reasons).toHaveLength(0);
  });

  it('ignores rejected and blocked lines when evaluating active dispatchable lines', () => {
    const orderWithBlockedLine: DispatchableOrder = {
      ...validOrder,
      lines: [
        ...validOrder.lines,
        {
          id: 'line_blocked',
          lineStatus: 'BLOCKED_NOT_SOLD_ONLINE',
          productSchedule: 'X',
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

    const result = assertDispatchable(orderWithBlockedLine);
    expect(result.canDispatch).toBe(true);
  });

  it('computes 6-month validity window accurately', () => {
    const baseDate = new Date('2026-01-15T00:00:00Z');
    const validUntil = computePrescriptionValidUntil(baseDate, 6);
    expect(validUntil.toISOString()).toContain('2026-07-15');
  });
});

