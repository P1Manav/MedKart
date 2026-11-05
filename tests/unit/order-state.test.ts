// tests/unit/order-state.test.ts
import { describe, it, expect } from 'vitest';
import {
  validateTransition,
  allowedTransitions,
  IllegalTransitionError,
  createAuditEvent,
  type OrderStatus,
} from '@/domain/order-state';

describe('Order State Machine', () => {
  describe('Legal Transitions', () => {
    const legalPairs: Array<[OrderStatus, OrderStatus]> = [
      ['DRAFT', 'SUBMITTED'],
      ['DRAFT', 'PAYMENT_PENDING_VERIFICATION'],
      ['DRAFT', 'CANCELLED'],
      ['PAYMENT_PENDING_VERIFICATION', 'SUBMITTED'],
      ['PAYMENT_PENDING_VERIFICATION', 'REFUND_DUE'],
      ['PAYMENT_PENDING_VERIFICATION', 'CANCELLED'],
      ['SUBMITTED', 'APPROVED'],
      ['SUBMITTED', 'ON_HOLD'],
      ['SUBMITTED', 'REJECTED'],
      ['SUBMITTED', 'REFUND_DUE'],
      ['SUBMITTED', 'CANCELLED'],
      ['ON_HOLD', 'SUBMITTED'],
      ['ON_HOLD', 'REFUND_DUE'],
      ['ON_HOLD', 'CANCELLED'],
      ['APPROVED', 'PACKED'],
      ['APPROVED', 'REFUND_DUE'],
      ['APPROVED', 'CANCELLED'],
      ['PACKED', 'HANDED_OVER'],
      ['HANDED_OVER', 'DELIVERED'],
      ['REFUND_DUE', 'CANCELLED'],
    ];

    it.each(legalPairs)('allows transition from %s to %s', (from, to) => {
      expect(validateTransition(from, to)).toBe(to);
    });
  });

  describe('Illegal Transitions', () => {
    const illegalPairs: Array<[OrderStatus, OrderStatus]> = [
      ['DRAFT', 'APPROVED'],
      ['DRAFT', 'PACKED'],
      ['DRAFT', 'DELIVERED'],
      ['SUBMITTED', 'PACKED'], // Cannot pack without approval!
      ['SUBMITTED', 'DELIVERED'],
      ['ON_HOLD', 'PACKED'],
      ['ON_HOLD', 'APPROVED'], // Must return to SUBMITTED upon re-upload first
      ['REJECTED', 'SUBMITTED'], // Terminal state
      ['REJECTED', 'APPROVED'],
      ['APPROVED', 'SUBMITTED'],
      ['PACKED', 'SUBMITTED'],
      ['PACKED', 'DELIVERED'], // Must be handed over first
      ['DELIVERED', 'CANCELLED'], // Terminal state
      ['CANCELLED', 'SUBMITTED'], // Terminal state
    ];

    it.each(illegalPairs)('throws IllegalTransitionError from %s to %s', (from, to) => {
      expect(() => validateTransition(from, to)).toThrow(IllegalTransitionError);
    });
  });

  describe('allowedTransitions', () => {
    it('returns reachable states for DRAFT', () => {
      expect(allowedTransitions('DRAFT')).toEqual(['SUBMITTED', 'PAYMENT_PENDING_VERIFICATION', 'CANCELLED']);
    });

    it('returns reachable states for PAYMENT_PENDING_VERIFICATION', () => {
      expect(allowedTransitions('PAYMENT_PENDING_VERIFICATION')).toEqual(['SUBMITTED', 'CANCELLED', 'REFUND_DUE']);
    });

    it('returns reachable states for REFUND_DUE', () => {
      expect(allowedTransitions('REFUND_DUE')).toEqual(['CANCELLED']);
    });

    it('returns empty array for terminal states', () => {
      expect(allowedTransitions('DELIVERED')).toEqual([]);
      expect(allowedTransitions('REJECTED')).toEqual([]);
      expect(allowedTransitions('CANCELLED')).toEqual([]);
    });
  });

  describe('createAuditEvent', () => {
    it('creates an audit event with timestamp and actor details', () => {
      const event = createAuditEvent('ord_123', 'user_pharmacist', 'PHARMACIST', 'SUBMITTED', 'APPROVED', 'Prescription clear');
      expect(event).toMatchObject({
        orderId: 'ord_123',
        actorId: 'user_pharmacist',
        actorRole: 'PHARMACIST',
        fromStatus: 'SUBMITTED',
        toStatus: 'APPROVED',
        reason: 'Prescription clear',
      });
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });
});
